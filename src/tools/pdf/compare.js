import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, createProgress, dropzoneMarkup } from "../../ui/result.js";
import { advancedPanelMarkup, mountAdvancedPanel } from "../../ui/advanced-panel.js";
import {
  openPdfJs,
  renderPageToCanvas,
  renderPdfPagePreview,
  destroyPdfJs,
} from "../../lib/pdf.js";
import {
  downloadBlob,
  errorMessage,
  isPasswordError,
  escapeHtml,
  formatBytes,
  isPdfFile,
  sanitizeFilename,
  yieldToUi
} from "../../lib/utils.js";

let compareOptions = {};

const normaliseText = (text) => {
  let value = String(text || "");
  if (compareOptions.ignoreWhitespace !== false) value = value.replace(/\s+/g, " ").trim();
  if (compareOptions.ignoreCase) value = value.toLowerCase();
  return value;
};

const tokenize = (text) => normaliseText(text).split(" ").filter(Boolean);

/**
 * Compare two rendered pages as tiny grayscale signatures. This is the only
 * way to compare scanned documents that have no text layer at all.
 */
async function signatureOf(doc, pageNumber) {
  const page = await doc.getPage(pageNumber);
  try {
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(0.6, 140 / Math.max(1, viewport.width));
    const { canvas } = await renderPageToCanvas(page, scale, "#ffffff");
    const sample = document.createElement("canvas");
    sample.width = 32;
    sample.height = 32;
    const context = sample.getContext("2d");
    context.drawImage(canvas, 0, 0, 32, 32);
    canvas.width = 1;
    canvas.height = 1;
    const { data } = context.getImageData(0, 0, 32, 32);
    const gray = new Uint8Array(32 * 32);
    for (let index = 0; index < gray.length; index += 1) {
      const offset = index * 4;
      gray[index] = Math.round(
        data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114
      );
    }
    return gray;
  } finally {
    page.cleanup();
  }
}

function pixelDifference(a, b) {
  if (!a || !b) return a || b ? 1 : 0;
  let total = 0;
  for (let index = 0; index < a.length; index += 1) {
    total += Math.abs(a[index] - b[index]);
  }
  return total / (a.length * 255);
}

function diffWords(aText, bText) {
  const a = tokenize(aText);
  const b = tokenize(bText);
  if (a.length * b.length > 1_800_000) {
    return [
      ...(a.length ? [{ type: "remove", text: a.join(" ") }] : []),
      ...(b.length ? [{ type: "add", text: b.join(" ") }] : [])
    ];
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "remove", text: a[i] });
      i += 1;
    } else {
      ops.push({ type: "add", text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) {
    ops.push({ type: "remove", text: a[i] });
    i += 1;
  }
  while (j < b.length) {
    ops.push({ type: "add", text: b[j] });
    j += 1;
  }
  const merged = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) last.text += ` ${op.text}`;
    else merged.push({ ...op });
  }
  return merged;
}

const diffHtml = (ops) =>
  ops
    .map((op) => {
      const text = escapeHtml(op.text);
      if (op.type === "add") return `<ins class="diff-add">${text}</ins>`;
      if (op.type === "remove") return `<del class="diff-remove">${text}</del>`;
      return `<span class="diff-same">${text}</span>`;
    })
    .join(" ");

const changeCounts = (ops) => {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === "add") added += op.text.split(" ").filter(Boolean).length;
    if (op.type === "remove") removed += op.text.split(" ").filter(Boolean).length;
  }
  return { added, removed, changed: added + removed > 0 };
};

export default {
  async mount(root, { tool }) {
    let fileA = null;
    let fileB = null;
    let pageCount = 0;
    let currentPage = 0;
    let pageTextsA = [];
    let pageTextsB = [];
    let diffs = [];
    let previews = new Map();
    let busy = false;
    let advanced = null;
    let pixelDiffs = [];
    let pageSignaturesA = [];
    let pageSignaturesB = [];
    let hasTextLayer = true;
    let compareMode = "auto";
    let password = "";

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: ".pdf,application/pdf",
          multiple: true,
          title: "Drop two PDF versions",
          subtitle: 'or <span class="text-link">browse your device</span> · choose 2 PDF files',
          hint: "Changes are detected on this device — both documents stay private"
        })}
        <div class="organize-empty-note">${icon("Info", {
          size: 15
        })} Load the original first and the revised version second. Text on both is compared word by word.</div>
      </div>`;
      bindDropzone(root, (files) => {
        const pdfs = files.filter(isPdfFile);
        if (pdfs.length !== 2) {
          toast("Choose exactly two PDF files.", { type: "error" });
          return;
        }
        load(pdfs[0], pdfs[1]);
      });
    };

    const load = async (first, second) => {
      fileA = first;
      fileB = second;
      compareOptions = advanced?.values || {};
      root.innerHTML = `<div class="workspace-card">
        <div class="custom-loading">${icon("LoaderCircle", { size: 22, className: "spin" })} Reading both PDFs…</div>
        <div data-progress></div>
      </div>`;
      const progress = createProgress(root.querySelector("[data-progress]"));
      progress.set(0.02, "Opening documents…");
      let docA;
      let docB;
      try {
        docA = await openPdfJs(fileA, password);
        docB = await openPdfJs(fileB, password);
        pageCount = Math.max(docA.numPages, docB.numPages);
        pageTextsA = [];
        pageTextsB = [];
        for (let index = 0; index < pageCount; index += 1) {
          progress.set(0.08 + (index / pageCount) * 0.45, `Reading page ${index + 1} of ${pageCount}…`);
          if (index < docA.numPages) {
            const page = await docA.getPage(index + 1);
            pageTextsA.push((await page.getTextContent()).items.map((item) => item.str).join(" "));
            page.cleanup();
          } else {
            pageTextsA.push("");
          }
          if (index < docB.numPages) {
            const page = await docB.getPage(index + 1);
            pageTextsB.push((await page.getTextContent()).items.map((item) => item.str).join(" "));
            page.cleanup();
          } else {
            pageTextsB.push("");
          }
          await yieldToUi();
        }
        pageSignaturesA = [];
        pageSignaturesB = [];
        pixelDiffs = [];
        for (let index = 0; index < pageCount; index += 1) {
          progress.set(0.55 + (index / pageCount) * 0.42, `Comparing page ${index + 1} of ${pageCount}…`);
          diffs.push(diffWords(pageTextsA[index], pageTextsB[index]));
          if (compareMode !== "text") {
            try {
              const [sigA, sigB] = await Promise.all([
                index < docA.numPages ? signatureOf(docA, index + 1) : null,
                index < docB.numPages ? signatureOf(docB, index + 1) : null
              ]);
              pageSignaturesA.push(sigA);
              pageSignaturesB.push(sigB);
              pixelDiffs.push(pixelDifference(sigA, sigB));
            } catch {
              pixelDiffs.push(0);
            }
          }
        }
        hasTextLayer = [...pageTextsA, ...pageTextsB].some((text) => String(text || "").trim().length > 12);
        progress.set(1, "Ready");
        renderWorkspace();
      } catch (error) {
        console.error(error);
        if (isPasswordError(error)) {
          promptPassword();
        } else {
          toast(errorMessage(error), { type: "error", duration: 7000 });
          renderInitial();
        }
      } finally {
        await destroyPdfJs(docA);
        await destroyPdfJs(docB);
      }
    };

    const promptPassword = () => {
      root.innerHTML = `<div class="workspace-card">
        <div class="password-prompt">
          <div class="password-prompt-icon">${icon("Lock", { size: 22 })}</div>
          <div class="password-prompt-body">
            <strong>These PDFs are password-protected</strong>
            <p>Enter the password for the document(s). It stays in this tab.</p>
            <div class="password-prompt-row">
              <input class="input" type="password" placeholder="PDF password" data-compare-password />
              <button type="button" class="button button-primary" data-compare-password-submit>${icon("LockOpen", {
                size: 16
              })} Open &amp; compare</button>
            </div>
          </div>
        </div>
      </div>`;
      const input = root.querySelector("[data-compare-password]");
      const submit = () => {
        if (!input.value) {
          input.focus();
          return;
        }
        password = input.value;
        load(fileA, fileB);
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") submit();
      });
      root.querySelector("[data-compare-password-submit]").addEventListener("click", submit);
      input.focus();
    };

    const tolerance = () => Math.max(0, Number(advanced?.values?.pixelTolerance) || 0) / 100;

    const pageChanged = (index) => {
      const counts = changeCounts(diffs[index] || []);
      if (hasTextLayer) return counts.changed;
      return (pixelDiffs[index] || 0) > tolerance();
    };

    const stats = () => {
      const total = { added: 0, removed: 0, changedPages: 0, pixelPages: 0, visual: !hasTextLayer };
      diffs.forEach((ops, index) => {
        const counts = changeCounts(ops);
        total.added += counts.added;
        total.removed += counts.removed;
        if (counts.changed) total.changedPages += 1;
        if ((pixelDiffs[index] || 0) > tolerance()) total.pixelPages += 1;
        void index;
      });
      if (!hasTextLayer) total.changedPages = total.pixelPages;
      return total;
    };

    const renderWorkspace = () => {
      const summary = stats();
      root.innerHTML = `<div class="workspace-card compare-card">
        <div class="compare-summary">
          <div class="compare-summary-main">
            <span class="result-icon">${icon(summary.changedPages ? "Files" : "CircleCheck", { size: 24 })}</span>
            <div>
              <h3>${
                summary.changedPages
                  ? `${summary.changedPages} page${summary.changedPages === 1 ? "" : "s"} changed`
                  : summary.visual
                    ? "Pages look identical"
                    : "No text differences found"
              }</h3>
              <p>${
                summary.visual
                  ? `Visual comparison of ${pageCount} page${pageCount === 1 ? "" : "s"} (no text layer found)`
                  : `${summary.added} addition${summary.added === 1 ? "" : "s"} · ${summary.removed} removal${
                      summary.removed === 1 ? "" : "s"
                    } · ${pageCount} page${pageCount === 1 ? "" : "s"} compared`
              }</p>
            </div>
          </div>
          <div class="compare-actions">
            <button type="button" class="button button-ghost button-sm" data-reset>${icon("RefreshCw", {
              size: 15
            })} Compare another pair</button>
            <button type="button" class="button button-primary" data-report>${icon("Download", {
              size: 17
            })} Download report</button>
          </div>
        </div>

        <div class="compare-files">
          <div class="compare-file"><span>A</span><strong>${escapeHtml(fileA.name)}</strong><em>${formatBytes(
            fileA.size
          )}</em></div>
          <div class="compare-file"><span>B</span><strong>${escapeHtml(fileB.name)}</strong><em>${formatBytes(
            fileB.size
          )}</em></div>
        </div>

        <div class="compare-page-bar">
          <button type="button" class="icon-button icon-button-sm" data-prev aria-label="Previous page">${icon(
            "ArrowLeft",
            { size: 17 }
          )}</button>
          <strong data-page-label>Page 1 of ${pageCount}</strong>
          <button type="button" class="icon-button icon-button-sm" data-next aria-label="Next page">${icon(
            "ArrowRight",
            { size: 17 }
          )}</button>
          <span class="compare-page-state" data-page-state></span>
        </div>

        <div class="compare-grid">
          <div class="compare-pane">
            <div class="compare-pane-head">Original <span data-count-a></span></div>
            <div class="compare-page-preview" data-preview-a></div>
            <div class="compare-text"><div class="diff-panel" data-text-a></div></div>
          </div>
          <div class="compare-pane">
            <div class="compare-pane-head">Revised <span data-count-b></span></div>
            <div class="compare-page-preview" data-preview-b></div>
            <div class="compare-text"><div class="diff-panel" data-text-b></div></div>
          </div>
        </div>
        ${advancedPanelMarkup(tool)}
        <div data-result></div>
      </div>`;
      bindWorkspace();
      advanced = mountAdvancedPanel(root, tool);
      const optionsHost = root.querySelector("[data-advanced-options]");
      if (optionsHost) {
        optionsHost.addEventListener("change", () => {
          compareOptions = advanced?.values || {};
          diffs = pageTextsA.map((text, index) => diffWords(text, pageTextsB[index]));
          renderWorkspace();
        });
      }
      showPage(0);
    };

    const renderPreview = async (side, pageIndex) => {
      const target = root.querySelector(`[data-preview-${side}]`);
      if (!target) return;
      const key = `${side}-${pageIndex}`;
      if (previews.has(key)) {
        target.innerHTML = `<img src="${previews.get(key)}" alt="${side === "a" ? "Original" : "Revised"} page" />`;
        return;
      }
      target.innerHTML = `<span class="preview-loading">${icon("LoaderCircle", {
        size: 18,
        className: "spin"
      })}</span>`;
      const file = side === "a" ? fileA : fileB;
      const total = side === "a" ? pageTextsA.length : pageTextsB.length;
      if (pageIndex >= total) {
        target.innerHTML = `<span class="compare-missing">No page ${pageIndex + 1} in this file</span>`;
        return;
      }
      try {
        const dataUrl = await renderPdfPagePreview(file, pageIndex + 1, 620);
        previews.set(key, dataUrl);
        target.innerHTML = `<img src="${dataUrl}" alt="${side === "a" ? "Original" : "Revised"} page" />`;
      } catch {
        target.innerHTML = `<span class="compare-missing">Preview unavailable</span>`;
      }
    };

    const showPage = async (index) => {
      currentPage = Math.max(0, Math.min(pageCount - 1, index));
      const ops = diffs[currentPage] || [];
      const counts = changeCounts(ops);
      const pageLabel = root.querySelector("[data-page-label]");
      if (!pageLabel) return;
      pageLabel.textContent = `Page ${currentPage + 1} of ${pageCount}`;
      const pixel = pixelDiffs[currentPage] || 0;
      const visualChanged = pixel > tolerance();
      const stateEl = root.querySelector("[data-page-state]");
      if (hasTextLayer) {
        stateEl.textContent = counts.changed
          ? `${counts.added} added · ${counts.removed} removed${pixel > tolerance() ? ` · ${Math.round(pixel * 100)}% pixels` : ""}`
          : "No text changes";
        stateEl.classList.toggle("is-unchanged", !counts.changed && !visualChanged);
      } else {
        stateEl.textContent = visualChanged ? `${Math.round(pixel * 100)}% different pixels` : "Pages look identical";
        stateEl.classList.toggle("is-unchanged", !visualChanged);
      }
      root.querySelector("[data-prev]").disabled = currentPage === 0;
      root.querySelector("[data-next]").disabled = currentPage === pageCount - 1;
      const noText = hasTextLayer
        ? `<span class="compare-missing">No text found on this page.</span>`
        : `<span class="compare-missing">Scanned page — compared visually (${Math.round(
            pixel * 100
          )}% of pixels differ).</span>`;
      root.querySelector("[data-text-a]").innerHTML = ops.length
        ? diffHtml(ops.filter((op) => op.type !== "add"))
        : noText;
      root.querySelector("[data-text-b]").innerHTML = ops.length
        ? diffHtml(ops.filter((op) => op.type !== "remove"))
        : noText;
      root.querySelector("[data-count-a]").textContent = `${tokenize(pageTextsA[currentPage]).length} words`;
      root.querySelector("[data-count-b]").textContent = `${tokenize(pageTextsB[currentPage]).length} words`;
      await Promise.all([renderPreview("a", currentPage), renderPreview("b", currentPage)]);
    };

    const downloadReport = () => {
      const summary = stats();
      const sections = diffs
        .map((ops, index) => {
          const counts = changeCounts(ops);
          const includeSame = advanced?.values?.reportIncludeSame === true;
          const pixel = pixelDiffs[index] || 0;
          const visualChanged = pixel > tolerance();
          if (!counts.changed && !includeSame && !visualChanged) return "";
          if (!counts.changed) {
            return `<section class="report-page"><h2>Page ${index + 1} <small>${
              visualChanged ? `${Math.round(pixel * 100)}% pixels differ` : "no changes"
            }</small></h2>${visualChanged && !hasTextLayer ? "<p>Scanned page — visual difference only.</p>" : ""}</section>`;
          }
          return `<section class="report-page">
            <h2>Page ${index + 1} <small>${counts.added} added · ${counts.removed} removed${
              visualChanged ? ` · ${Math.round(pixel * 100)}% pixels` : ""
            }</small></h2>
            <div class="report-diff">${diffHtml(ops)}</div>
          </section>`;
        })
        .filter(Boolean)
        .join("");

      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
        <title>PDF comparison report</title>
        <style>
          body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#182033}
          h1{font-size:28px;margin-bottom:4px} .meta{color:#687086;margin-bottom:28px}
          .summary{background:#f4f2ff;border:1px solid #e3ddff;border-radius:14px;padding:18px 20px;margin:24px 0}
          h2{font-size:20px;border-top:1px solid #e7e3ef;padding-top:24px;margin-top:32px}
          h2 small{font-weight:400;color:#687086;font-size:13px;margin-left:8px}
          .report-diff{white-space:pre-wrap}.diff-add{background:#d8f8e4;color:#11643a;text-decoration:none}
          .diff-remove{background:#ffe0e3;color:#9a2433}
        </style></head><body>
        <h1>PDF comparison report</h1>
        <p class="meta">PixPDF · ${new Date().toLocaleString()}</p>
        <div class="summary"><strong>${summary.changedPages} changed page${
          summary.changedPages === 1 ? "" : "s"
        }</strong><br />A: ${escapeHtml(fileA.name)}<br />B: ${escapeHtml(
          fileB.name
        )}<br />${
          summary.visual
            ? "Compared visually (no text layer)"
            : `${summary.added} additions · ${summary.removed} removals`
        }</div>
        ${sections || "<p>No text differences were found.</p>"}
        </body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const reportName = String(advanced?.values?.outputName || "").trim();
      downloadBlob(
        blob,
        reportName
          ? `${sanitizeFilename(reportName, "comparison")}.html`
          : `${sanitizeFilename(fileA.name, "document")}-comparison.html`
      );
      root.querySelector("[data-result]").innerHTML = `<p class="result-privacy">${icon("Check", {
        size: 14
      })} Report downloaded.</p>`;
    };

    const bindWorkspace = () => {
      root.querySelector("[data-prev]").addEventListener("click", () => showPage(currentPage - 1));
      root.querySelector("[data-next]").addEventListener("click", () => showPage(currentPage + 1));
      root.querySelector("[data-report]").addEventListener("click", downloadReport);
      root.querySelector("[data-reset]").addEventListener("click", () => {
        fileA = null;
        fileB = null;
        pageTextsA = [];
        pageTextsB = [];
        diffs = [];
        previews = new Map();
        renderInitial();
      });
    };

    renderInitial();
    return () => {
      fileA = null;
      fileB = null;
      previews.clear();
    };
  }
};
