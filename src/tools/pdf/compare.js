import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, createProgress, dropzoneMarkup } from "../../ui/result.js";
import {
  openPdfJs,
  renderPdfPagePreview
} from "../../lib/pdf.js";
import {
  downloadBlob,
  errorMessage,
  escapeHtml,
  formatBytes,
  isPdfFile,
  sanitizeFilename,
  yieldToUi
} from "../../lib/utils.js";

const tokenize = (text) => String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

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
      root.innerHTML = `<div class="workspace-card">
        <div class="custom-loading">${icon("LoaderCircle", { size: 22, className: "spin" })} Reading both PDFs…</div>
        <div data-progress></div>
      </div>`;
      const progress = createProgress(root.querySelector("[data-progress]"));
      progress.set(0.02, "Opening documents…");
      let docA;
      let docB;
      try {
        docA = await openPdfJs(fileA);
        docB = await openPdfJs(fileB);
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
        diffs = [];
        for (let index = 0; index < pageCount; index += 1) {
          progress.set(0.55 + (index / pageCount) * 0.42, `Comparing page ${index + 1} of ${pageCount}…`);
          diffs.push(diffWords(pageTextsA[index], pageTextsB[index]));
          await yieldToUi();
        }
        progress.set(1, "Ready");
        renderWorkspace();
      } catch (error) {
        console.error(error);
        toast(
          /password|encrypted/i.test(String(error?.message))
            ? "One of these PDFs is password-protected. Unlock it first, then compare."
            : errorMessage(error),
          { type: "error", duration: 7000 }
        );
        renderInitial();
      } finally {
        await docA?.destroy();
        await docB?.destroy();
      }
    };

    const stats = () => {
      const total = { added: 0, removed: 0, changedPages: 0 };
      diffs.forEach((ops) => {
        const counts = changeCounts(ops);
        total.added += counts.added;
        total.removed += counts.removed;
        if (counts.changed) total.changedPages += 1;
      });
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
                  : "No text differences found"
              }</h3>
              <p>${summary.added} addition${summary.added === 1 ? "" : "s"} · ${summary.removed} removal${
                summary.removed === 1 ? "" : "s"
              } · ${pageCount} page${pageCount === 1 ? "" : "s"} compared</p>
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
        <div data-result></div>
      </div>`;
      bindWorkspace();
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
      root.querySelector("[data-page-state]").textContent = counts.changed
        ? `${counts.added} added · ${counts.removed} removed`
        : "No changes";
      root.querySelector("[data-page-state]").classList.toggle("is-unchanged", !counts.changed);
      root.querySelector("[data-prev]").disabled = currentPage === 0;
      root.querySelector("[data-next]").disabled = currentPage === pageCount - 1;
      root.querySelector("[data-text-a]").innerHTML = ops.length
        ? diffHtml(ops.filter((op) => op.type !== "add"))
        : `<span class="compare-missing">No text found on this page.</span>`;
      root.querySelector("[data-text-b]").innerHTML = ops.length
        ? diffHtml(ops.filter((op) => op.type !== "remove"))
        : `<span class="compare-missing">No text found on this page.</span>`;
      root.querySelector("[data-count-a]").textContent = `${tokenize(pageTextsA[currentPage]).length} words`;
      root.querySelector("[data-count-b]").textContent = `${tokenize(pageTextsB[currentPage]).length} words`;
      await Promise.all([renderPreview("a", currentPage), renderPreview("b", currentPage)]);
    };

    const downloadReport = () => {
      const summary = stats();
      const sections = diffs
        .map((ops, index) => {
          const counts = changeCounts(ops);
          if (!counts.changed) return "";
          return `<section class="report-page">
            <h2>Page ${index + 1} <small>${counts.added} added · ${counts.removed} removed</small></h2>
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
        )}<br />${summary.added} additions · ${summary.removed} removals</div>
        ${sections || "<p>No text differences were found.</p>"}
        </body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      downloadBlob(blob, `${sanitizeFilename(fileA.name, "document")}-comparison.html`);
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
