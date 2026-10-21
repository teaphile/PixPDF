import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import {
  PDFDocument,
  openPdf,
  openPdfJs,
  pdfjsLib,
  renderPageToCanvas,
  savePdf
} from "../../lib/pdf.js";
import {
  canvasToBlob,
  errorMessage,
  escapeHtml,
  formatBytes,
  isPdfFile,
  sanitizeFilename
} from "../../lib/utils.js";

export default {
  async mount(root, { tool }) {
    let file = null;
    let doc = null;
    let pageCount = 0;
    let currentPage = 0;
    let boxes = [];
    let busy = false;
    let drawing = false;
    let start = null;
    let draft = null;
    let lastViewport = null;
    let previewCanvas = null;
    let overlay = null;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: ".pdf,application/pdf",
          title: "Drop a PDF to redact",
          subtitle: 'or <span class="text-link">browse your device</span> · one file at a time',
          hint: "Mark private areas — redacted pages are rebuilt as images"
        })}
        <div class="organize-empty-note">${icon("ScanText", {
          size: 15
        })} Search for words or draw boxes. Redaction removes the underlying text from marked pages.</div>
      </div>`;
      bindDropzone(root, (files) => {
        const pdf = files.find(isPdfFile);
        if (!pdf) {
          toast("Please choose a PDF file.", { type: "error" });
          return;
        }
        load(pdf);
      });
    };

    const load = async (selected) => {
      file = selected;
      root.innerHTML = `<div class="workspace-card"><div class="custom-loading">${icon(
        "LoaderCircle",
        { size: 22, className: "spin" }
      )} Opening your PDF…</div></div>`;
      try {
        doc = await openPdfJs(file);
        pageCount = doc.numPages;
        boxes = Array.from({ length: pageCount }, () => []);
        currentPage = 0;
        renderWorkspace();
        await renderPage();
      } catch (error) {
        toast(
          /password|encrypted/i.test(String(error?.message || ""))
            ? "This PDF is password-protected. Unlock it first, then redact."
            : errorMessage(error),
          { type: "error", duration: 7000 }
        );
        renderInitial();
      }
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card redact-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("ScanText", { size: 22 })}</span>
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <span>${pageCount} page${pageCount === 1 ? "" : "s"} · ${formatBytes(file.size)}</span>
            </div>
          </div>
          <button type="button" class="button button-ghost button-sm" data-replace>${icon("RefreshCw", {
            size: 15
          })} Change PDF</button>
          <input type="file" accept=".pdf,application/pdf" hidden data-replace-input />
        </div>

        <div class="redact-warning">${icon("ShieldCheck", { size: 15 })} Redaction is permanent. Marked pages are converted to images so hidden text cannot be copied back out.</div>

        <div class="redact-layout">
          <div class="redact-stage">
            <div class="redact-toolbar">
              <button type="button" class="icon-button icon-button-sm" data-prev aria-label="Previous page">${icon(
                "ArrowLeft",
                { size: 17 }
              )}</button>
              <strong data-page-label>Page 1 of ${pageCount}</strong>
              <button type="button" class="icon-button icon-button-sm" data-next aria-label="Next page">${icon(
                "ArrowRight",
                { size: 17 }
              )}</button>
              <span class="redact-count" data-box-count>0 marks on this page</span>
            </div>
            <div class="redact-canvas-wrap" data-redact-wrap>
              <canvas data-redact-preview aria-label="PDF page preview"></canvas>
              <canvas data-redact-overlay class="redact-overlay" aria-label="Draw redaction boxes"></canvas>
            </div>
            <p class="editor-hint">${icon("Info", {
              size: 14
            })} Drag on the page to draw a box. Use search to find a word and mark every match.</p>
          </div>

          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("Search", { size: 15 })} Find text</span>
              <div class="redact-search">
                <input class="input" type="text" placeholder="Word or phrase…" data-search />
                <button type="button" class="button button-ghost button-sm" data-find>${icon("Search", {
                  size: 15
                })} Mark</button>
              </div>
              <p class="editor-hint">Finds matches on the current page. Draw a box for anything search cannot see.</p>
              <div class="redact-actions">
                <button type="button" class="button button-ghost button-sm" data-undo>${icon("RotateCcw", {
                  size: 15
                })} Undo mark</button>
                <button type="button" class="button button-ghost button-sm" data-clear>${icon("Trash2", {
                  size: 15
                })} Clear page</button>
              </div>
            </div>
            <div class="editor-group">
              <span class="editor-group-title">${icon("Layers", { size: 15 })} Summary</span>
              <div class="redact-summary" data-summary></div>
              <button type="button" class="button button-primary button-lg button-block" data-run>${icon(
                "ShieldCheck",
                { size: 18 }
              )} ${escapeHtml(tool.action)}</button>
            </div>
          </aside>
        </div>
        <div data-result></div>
      </div>`;
      bindWorkspace();
      updateSummary();
    };

    const renderPage = async () => {
      const page = await doc.getPage(currentPage + 1);
      const base = page.getViewport({ scale: 1 });
      const targetWidth = Math.min(1000, Math.max(520, root.querySelector("[data-redact-wrap]")?.clientWidth || 900));
      const scale = targetWidth / base.width;
      const viewport = page.getViewport({ scale });
      lastViewport = viewport;
      previewCanvas = root.querySelector("[data-redact-preview]");
      overlay = root.querySelector("[data-redact-overlay]");
      previewCanvas.width = Math.max(1, Math.round(viewport.width));
      previewCanvas.height = Math.max(1, Math.round(viewport.height));
      overlay.width = previewCanvas.width;
      overlay.height = previewCanvas.height;
      previewCanvas.style.width = "100%";
      previewCanvas.style.height = "auto";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      const context = previewCanvas.getContext("2d", { alpha: false });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      page.cleanup();
      root.querySelector("[data-page-label]").textContent = `Page ${currentPage + 1} of ${pageCount}`;
      root.querySelector("[data-prev]").disabled = currentPage === 0;
      root.querySelector("[data-next]").disabled = currentPage === pageCount - 1;
      drawOverlay();
    };

    const drawOverlay = () => {
      if (!overlay) return;
      const context = overlay.getContext("2d");
      context.clearRect(0, 0, overlay.width, overlay.height);
      const all = [...boxes[currentPage]];
      if (draft) all.push(draft);
      for (const box of all) {
        const x = box.x * overlay.width;
        const y = box.y * overlay.height;
        const width = box.w * overlay.width;
        const height = box.h * overlay.height;
        context.fillStyle = "rgba(214, 35, 58, 0.28)";
        context.fillRect(x, y, width, height);
        context.strokeStyle = "#d6233a";
        context.lineWidth = 2;
        context.strokeRect(x, y, width, height);
      }
      updateSummary();
    };

    const updateSummary = () => {
      const countEl = root.querySelector("[data-box-count]");
      if (!countEl) return;
      const total = boxes.reduce((sum, page) => sum + page.length, 0);
      countEl.textContent = `${boxes[currentPage].length} mark${
        boxes[currentPage].length === 1 ? "" : "s"
      } on this page`;
      root.querySelector("[data-summary]").innerHTML = boxes
        .map((page, index) =>
          page.length
            ? `<div class="metadata-row"><span>Page ${index + 1}</span><strong>${page.length} mark${
                page.length === 1 ? "" : "s"
              }</strong></div>`
            : ""
        )
        .join("") || `<p class="editor-hint">No redaction marks yet.</p>`;
      const totalMark = boxes.some((page) => page.length);
      root.querySelector("[data-run]").disabled = !totalMark;
    };

    const pointerBox = (event) => {
      const rect = overlay.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
      };
    };

    const bindOverlay = () => {
      overlay.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        overlay.setPointerCapture(event.pointerId);
        drawing = true;
        start = pointerBox(event);
        draft = { x: start.x, y: start.y, w: 0, h: 0 };
        drawOverlay();
      });
      overlay.addEventListener("pointermove", (event) => {
        if (!drawing || !start) return;
        event.preventDefault();
        const point = pointerBox(event);
        draft = {
          x: Math.min(start.x, point.x),
          y: Math.min(start.y, point.y),
          w: Math.abs(point.x - start.x),
          h: Math.abs(point.y - start.y)
        };
        drawOverlay();
      });
      const finish = (event) => {
        if (!drawing) return;
        drawing = false;
        try {
          overlay.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        if (draft && draft.w > 0.002 && draft.h > 0.002) boxes[currentPage].push(draft);
        draft = null;
        start = null;
        drawOverlay();
      };
      overlay.addEventListener("pointerup", finish);
      overlay.addEventListener("pointercancel", finish);
    };

    const findText = async () => {
      const query = root.querySelector("[data-search]").value.trim();
      if (!query) {
        toast("Type a word or phrase to find.", { type: "error" });
        return;
      }
      const page = await doc.getPage(currentPage + 1);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      let matches = 0;
      for (const item of content.items) {
        const text = item.str || "";
        const index = text.toLowerCase().indexOf(query.toLowerCase());
        if (index < 0) continue;
        const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const height = Math.max(4, item.height || Math.hypot(transform[2], transform[3]));
        const width = Math.max(4, item.width || 0);
        const x = transform[4];
        const top = transform[5] - height;
        const fractionStart = index / Math.max(1, text.length);
        const fractionWidth = Math.min(1 - fractionStart, query.length / Math.max(1, text.length));
        boxes[currentPage].push({
          x: Math.max(0, (x + width * fractionStart) / viewport.width),
          y: Math.max(0, top / viewport.height),
          w: Math.min(1, (width * fractionWidth) / viewport.width),
          h: Math.min(1, (height * 1.15) / viewport.height)
        });
        matches += 1;
      }
      page.cleanup();
      if (!matches) toast("No match on this page.", { type: "error" });
      else toast(`${matches} match${matches === 1 ? "" : "es"} marked.`, { type: "success" });
      drawOverlay();
    };

    const bindWorkspace = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) {
          doc?.destroy?.();
          doc = null;
          boxes = [];
          load(selected);
        }
        replaceInput.value = "";
      });
      root.querySelector("[data-prev]").addEventListener("click", async () => {
        if (currentPage === 0) return;
        currentPage -= 1;
        await renderPage();
      });
      root.querySelector("[data-next]").addEventListener("click", async () => {
        if (currentPage >= pageCount - 1) return;
        currentPage += 1;
        await renderPage();
      });
      root.querySelector("[data-find]").addEventListener("click", findText);
      root.querySelector("[data-search]").addEventListener("keydown", (event) => {
        if (event.key === "Enter") findText();
      });
      root.querySelector("[data-undo]").addEventListener("click", () => {
        boxes[currentPage].pop();
        drawOverlay();
      });
      root.querySelector("[data-clear]").addEventListener("click", () => {
        boxes[currentPage] = [];
        drawOverlay();
      });
      root.querySelector("[data-run]").addEventListener("click", run);
      bindOverlay();
    };

    const run = async () => {
      if (busy || !boxes.some((page) => page.length)) return;
      busy = true;
      const button = root.querySelector("[data-run]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Applying redactions…`;
      const started = performance.now();
      let outputDoc;
      try {
        outputDoc = await PDFDocument.create();
        const libDoc = await openPdf(file);
        for (let index = 0; index < pageCount; index += 1) {
          button.innerHTML = `${icon("LoaderCircle", {
            size: 18,
            className: "spin"
          })} Redacting page ${index + 1} of ${pageCount}…`;
          if (!boxes[index].length) {
            const copied = await outputDoc.copyPages(libDoc, [index]);
            outputDoc.addPage(copied[0]);
            continue;
          }
          const page = await doc.getPage(index + 1);
          const { canvas, viewport } = await renderPageToCanvas(page, 1.8, "#ffffff");
          const context = canvas.getContext("2d");
          context.fillStyle = "#000000";
          boxes[index].forEach((box) => {
            const paddingX = canvas.width * 0.002;
            const paddingY = canvas.height * 0.002;
            context.fillRect(
              box.x * canvas.width - paddingX,
              box.y * canvas.height - paddingY,
              box.w * canvas.width + paddingX * 2,
              box.h * canvas.height + paddingY * 2
            );
          });
          const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
          const image = await outputDoc.embedJpg(await jpegBlob.arrayBuffer());
          const newPage = outputDoc.addPage([viewport.width, viewport.height]);
          newPage.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height });
          page.cleanup();
          canvas.width = 1;
          canvas.height = 1;
        }
        const bytes = await savePdf(outputDoc);
        const blob = new Blob([bytes], { type: "application/pdf" });
        renderResult(
          root.querySelector("[data-result]"),
          [{ blob, name: `${sanitizeFilename(file.name, "document")}-redacted.pdf` }],
          { tool, inputs: file.size, duration: performance.now() - started }
        );
      } catch (error) {
        console.error(error);
        toast(errorMessage(error), { type: "error", duration: 7000 });
      } finally {
        busy = false;
        button.disabled = false;
        button.innerHTML = previous;
      }
    };

    renderInitial();
    return () => {
      doc?.destroy?.();
      doc = null;
      boxes = [];
      previewCanvas = null;
      overlay = null;
    };
  }
};
