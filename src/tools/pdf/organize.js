import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, createProgress, dropzoneMarkup, renderResult } from "../../ui/result.js";
import { advancedPanelMarkup, mountAdvancedPanel } from "../../ui/advanced-panel.js";
import {
  A4,
  LETTER,
  PDFDocument,
  copyPdfMetadata,
  degrees,
  fitPageToSize,
  openPdf,
  openPdfJs,
  renderPageToCanvas,
  savePdf,
  destroyPdfJs,
} from "../../lib/pdf.js";
import {
  errorMessage,
  escapeHtml,
  formatBytes,
  isPdfFile,
  sanitizeFilename,
  uid,
  yieldToUi
} from "../../lib/utils.js";

export default {
  async mount(root, { tool }) {
    let file = null;
    let pages = [];
    let totalPages = 0;
    let busy = false;
    let advanced = null;
    let dragIndex = null;
    let progress = null;

    const destroy = () => {
      file = null;
      pages = [];
    };

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: ".pdf,application/pdf",
          title: "Drop a PDF to organise",
          subtitle: 'or <span class="text-link">browse your device</span> · one file at a time',
          hint: "Page thumbnails are generated on this device"
        })}
        <div class="organize-empty-note">${icon("Info", {
          size: 15
        })} You'll be able to drag pages, rotate them or remove mistakes before saving.</div>
      </div>`;
      const { dropzone } = bindDropzone(root, (files) => {
        const pdf = files.find(isPdfFile);
        if (!pdf) {
          toast("Please choose a PDF file.", { type: "error" });
          return;
        }
        loadPdf(pdf);
      });
      dropzone.addEventListener("drop", (event) => event.stopPropagation());
    };

    const loadPdf = async (selected) => {
      file = selected;
      root.innerHTML = `<div class="workspace-card">
        <div class="custom-loading">${icon("LoaderCircle", {
          size: 22,
          className: "spin"
        })} Opening your PDF and drawing thumbnails…</div>
        <div data-thumb-progress></div>
      </div>`;
      progress = createProgress(root.querySelector("[data-thumb-progress]"));
      progress.set(0.03, "Reading document…");
      try {
        const doc = await openPdfJs(file);
        totalPages = doc.numPages;
        pages = Array.from({ length: totalPages }, (_, index) => ({
          key: uid(),
          original: index,
          rotation: 0,
          thumb: null
        }));
        for (let index = 0; index < totalPages; index += 1) {
          progress.set((index / totalPages) * 0.92, `Rendering page ${index + 1} of ${totalPages}…`);
          const page = await doc.getPage(index + 1);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(190 / base.width, 2);
          const { canvas } = await renderPageToCanvas(page, scale, "#ffffff");
          pages[index].thumb = canvas.toDataURL("image/jpeg", 0.76);
          page.cleanup();
          await yieldToUi();
        }
        await destroyPdfJs(doc);
        progress.set(1, "Ready");
        renderWorkspace();
      } catch (error) {
        console.error(error);
        toast(errorMessage(error), { type: "error", duration: 7000 });
        const message = /password/i.test(String(error?.message))
          ? "This PDF is password-protected. Unlock it first, then come back to organise it."
          : errorMessage(error);
        root.innerHTML = `<div class="workspace-card">
          <div class="inline-error">${icon("TriangleAlert", { size: 18 })}<div><strong>Could not open this PDF</strong><p>${escapeHtml(
            message
          )}</p></div></div>
          <div class="run-zone"><button type="button" class="button button-ghost" data-retry>${icon(
            "ArrowLeft",
            { size: 16 }
          )} Try another file</button></div>
        </div>`;
        root.querySelector("[data-retry]").addEventListener("click", () => {
          file = null;
          pages = [];
          renderInitial();
        });
      }
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card organize-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("FileText", { size: 22 })}</span>
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <span data-page-summary>${pages.length} of ${totalPages} pages · ${formatBytes(file.size)}</span>
            </div>
          </div>
          <div class="organize-toolbar-actions">
            <button type="button" class="button button-ghost button-sm" data-rotate-all="-90" title="Rotate all pages left">${icon(
              "RotateCcw",
              { size: 16 }
            )} All left</button>
            <button type="button" class="button button-ghost button-sm" data-rotate-all="90" title="Rotate all pages right">${icon(
              "RotateCw",
              { size: 16 }
            )} All right</button>
            <button type="button" class="icon-button icon-button-sm" data-replace-file aria-label="Choose another PDF">${icon(
              "RefreshCw",
              { size: 17 }
            )}</button>
          </div>
        </div>
        <div class="organize-hint">${icon("GripVertical", { size: 15 })} Drag pages to reorder · use the buttons for rotation and removal</div>
        <div class="page-grid" data-page-grid></div>
        <input type="file" accept=".pdf,application/pdf" hidden data-replace-input />
        <div class="run-zone">
          <button type="button" class="button button-primary button-lg" data-save>${icon("Download", {
            size: 19
          })} ${escapeHtml(tool.action)}</button>
          <p class="run-note">${icon("ShieldCheck", { size: 14 })} Changes are written to a new PDF — your original stays untouched.</p>
        </div>
        ${advancedPanelMarkup(tool)}
        <div data-result></div>
      </div>`;
      progress = null;
      bindWorkspace();
      advanced = mountAdvancedPanel(root, tool);
      renderPages();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const bindWorkspace = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace-file]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) {
          if (!isPdfFile(selected)) {
            toast("Please choose a PDF file.", { type: "error" });
            return;
          }
          loadPdf(selected);
        }
        replaceInput.value = "";
      });

      root.querySelectorAll("[data-rotate-all]").forEach((button) => {
        button.addEventListener("click", () => {
          if (busy) return;
          const angle = Number(button.dataset.rotateAll);
          pages.forEach((page) => {
            page.rotation = (page.rotation + angle + 360) % 360;
          });
          renderPages();
        });
      });

      const grid = root.querySelector("[data-page-grid]");
      grid.addEventListener("click", (event) => {
        const card = event.target.closest("[data-page-card]");
        if (!card) return;
        const index = pages.findIndex((page) => page.key === card.dataset.pageCard);
        if (index < 0) return;
        const rotate = event.target.closest("[data-rotate]");
        if (rotate) {
          const angle = Number(rotate.dataset.rotate);
          pages[index].rotation = (pages[index].rotation + angle + 360) % 360;
          updateCard(card, pages[index]);
          return;
        }
        const remove = event.target.closest("[data-delete]");
        if (remove) {
          removePage(index);
          return;
        }
        const move = event.target.closest("[data-move]");
        if (move) {
          const direction = Number(move.dataset.move);
          const target = index + direction;
          if (target < 0 || target >= pages.length) return;
          const [page] = pages.splice(index, 1);
          pages.splice(target, 0, page);
          renderPages();
        }
      });

      grid.addEventListener("dragstart", (event) => {
        const card = event.target.closest("[data-page-card]");
        if (!card) return;
        dragIndex = pages.findIndex((page) => page.key === card.dataset.pageCard);
        card.classList.add("is-dragged");
        event.dataTransfer.effectAllowed = "move";
        try {
          event.dataTransfer.setData("text/plain", card.dataset.pageCard);
        } catch {
          /* ignore */
        }
      });
      grid.addEventListener("dragend", (event) => {
        event.target.closest("[data-page-card]")?.classList.remove("is-dragged");
        grid.querySelectorAll(".is-drop-target").forEach((element) =>
          element.classList.remove("is-drop-target")
        );
        dragIndex = null;
      });
      grid.addEventListener("dragover", (event) => {
        const card = event.target.closest("[data-page-card]");
        if (!card) return;
        event.preventDefault();
        card.classList.add("is-drop-target");
      });
      grid.addEventListener("dragleave", (event) => {
        event.target.closest("[data-page-card]")?.classList.remove("is-drop-target");
      });
      grid.addEventListener("drop", (event) => {
        const card = event.target.closest("[data-page-card]");
        if (!card) return;
        event.preventDefault();
        card.classList.remove("is-drop-target");
        let target = pages.findIndex((page) => page.key === card.dataset.pageCard);
        if (dragIndex === null || target < 0 || dragIndex === target) return;
        if (dragIndex < target) target -= 1;
        const [page] = pages.splice(dragIndex, 1);
        pages.splice(target, 0, page);
        dragIndex = null;
        renderPages();
      });

      root.querySelector("[data-save]").addEventListener("click", savePdfFile);
    };

    const renderPages = () => {
      const grid = root.querySelector("[data-page-grid]");
      if (!grid) return;
      grid.innerHTML = pages
        .map(
          (page, index) => `<div class="page-card" draggable="true" data-page-card="${page.key}">
            <div class="page-thumb">
              <img src="${page.thumb}" alt="Page ${page.original + 1}" style="transform: rotate(${page.rotation}deg)" />
              <span class="page-number">${page.original + 1}</span>
              <span class="page-order">${index + 1}</span>
            </div>
            <div class="page-actions">
              <button type="button" class="icon-button icon-button-xs" data-move="-1" aria-label="Move page earlier" ${index === 0 ? "disabled" : ""}>${icon(
                "ChevronsUp",
                { size: 15 }
              )}</button>
              <button type="button" class="icon-button icon-button-xs" data-move="1" aria-label="Move page later" ${
                index === pages.length - 1 ? "disabled" : ""
              }>${icon("ChevronsDown", { size: 15 })}</button>
              <button type="button" class="icon-button icon-button-xs" data-rotate="-90" aria-label="Rotate page left">${icon(
                "RotateCcw",
                { size: 15 }
              )}</button>
              <button type="button" class="icon-button icon-button-xs" data-rotate="90" aria-label="Rotate page right">${icon(
                "RotateCw",
                { size: 15 }
              )}</button>
              <button type="button" class="icon-button icon-button-xs danger" data-delete aria-label="Remove page">${icon(
                "Trash2",
                { size: 15 }
              )}</button>
            </div>
          </div>`
        )
        .join("");
      const summary = root.querySelector("[data-page-summary]");
      if (summary) {
        summary.textContent = `${pages.length} of ${totalPages} pages · ${formatBytes(file.size)}`;
      }
      const save = root.querySelector("[data-save]");
      if (save) save.disabled = pages.length === 0;
      if (!pages.length) {
        grid.innerHTML = `<div class="empty-state compact"><span class="empty-icon">${icon(
          "Trash2",
          { size: 24 }
        )}</span><h2>All pages removed</h2><p>Restore a page or choose another PDF to continue.</p></div>`;
      }
    };

    const updateCard = (card, page) => {
      const img = card.querySelector("img");
      if (img) img.style.transform = `rotate(${page.rotation}deg)`;
    };

    const removePage = (index) => {
      const [removed] = pages.splice(index, 1);
      renderPages();
      toast(`Page ${removed.original + 1} removed.`, {
        type: "info",
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () => {
            pages.splice(Math.min(index, pages.length), 0, removed);
            renderPages();
          }
        }
      });
    };

    const savePdfFile = async () => {
      if (busy || !pages.length) return;
      busy = true;
      const saveButton = root.querySelector("[data-save]");
      const previous = saveButton.innerHTML;
      saveButton.disabled = true;
      saveButton.innerHTML = `${icon("LoaderCircle", { size: 17, className: "spin" })} Building PDF…`;
      const resultEl = root.querySelector("[data-result]");
      const started = performance.now();
      try {
        const extra = advanced?.values || {};
        const doc = await openPdf(file);
        if (extra.flattenForms) {
          try {
            const form = doc.getForm();
            if (form.getFields().length) form.flatten();
          } catch {
            /* malformed forms can be ignored */
          }
        }
        const output = await PDFDocument.create();
        if (extra.preserveMetadata !== false) copyPdfMetadata(doc, output);
        const indices = pages.map((page) => page.original);
        const copied = await output.copyPages(doc, indices);
        const firstBox = copied[0]?.getMediaBox();
        const targetSize =
          extra.normalizeSize === "a4"
            ? A4
            : extra.normalizeSize === "letter"
              ? LETTER
              : extra.normalizeSize === "first" && firstBox
                ? { width: firstBox.width, height: firstBox.height }
                : null;
        const blankEvery = Math.max(0, Number(extra.blankEvery) || 0);
        copied.forEach((outputPage, index) => {
          outputPage.setRotation(
            degrees((outputPage.getRotation().angle + pages[index].rotation) % 360)
          );
          if (targetSize) fitPageToSize(outputPage, targetSize);
          output.addPage(outputPage);
          if (blankEvery > 0 && (index + 1) % blankEvery === 0 && index !== copied.length - 1) {
            const box = outputPage.getMediaBox();
            output.addPage([box.width, box.height]);
          }
        });
        const bytes = await savePdf(output);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const name = `${sanitizeFilename(file.name, "document")}-organized.pdf`;
        renderResult(resultEl, [{ blob, name }], {
          tool,
          outputOptions: advanced?.values,
          inputs: file.size,
          duration: performance.now() - started,
          onReset: () => {
            file = null;
            pages = [];
            renderInitial();
          }
        });
      } catch (error) {
        console.error(error);
        toast(errorMessage(error), { type: "error" });
      } finally {
        busy = false;
        saveButton.disabled = false;
        saveButton.innerHTML = previous;
      }
    };

    renderInitial();
    return destroy;
  }
};
