import {
  Canvas,
  Ellipse,
  FabricImage,
  Line,
  PencilBrush,
  Rect,
  Textbox,
  util
} from "fabric";
import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import {
  PDFDocument,
  openPdf,
  openPdfJs,
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

const FONTS = ["Helvetica", "Times New Roman", "Courier"];

export default {
  async mount(root, { tool }) {
    let file = null;
    let pdfDoc = null;
    let pageCount = 0;
    let currentPage = 0;
    let pageObjects = [];
    let history = [];
    let canvas = null;
    let busy = false;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let bgCache = new Map();
    let ink = "#e11d48";
    let fontSize = 34;
    let fontFamily = "Helvetica";
    let imageInput = null;
    let suppressSync = false;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: ".pdf,application/pdf",
          title: "Drop a PDF to edit",
          subtitle: 'or <span class="text-link">browse your device</span> · one file at a time',
          hint: "Add text, images, shapes and drawings to any page"
        })}
        <div class="organize-empty-note">${icon("Info", {
          size: 15
        })} Annotations are added as a new layer. Existing text and images stay untouched.</div>
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
      )} Opening your PDF editor…</div></div>`;
      try {
        pdfDoc = await openPdfJs(file);
        pageCount = pdfDoc.numPages;
        pageObjects = Array.from({ length: pageCount }, () => []);
        bgCache = new Map();
        history = [];
        currentPage = 0;
        renderWorkspace();
        await showPage(0);
      } catch (error) {
        toast(
          /password|encrypted/i.test(String(error?.message || ""))
            ? "This PDF is password-protected. Unlock it first, then edit."
            : errorMessage(error),
          { type: "error", duration: 7000 }
        );
        renderInitial();
      }
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card editpdf-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("PenTool", { size: 22 })}</span>
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <span>${pageCount} page${pageCount === 1 ? "" : "s"} · ${formatBytes(file.size)}</span>
            </div>
          </div>
          <div class="organize-toolbar-actions">
            <button type="button" class="button button-ghost button-sm" data-undo>${icon("RotateCcw", {
              size: 15
            })} Undo</button>
            <button type="button" class="icon-button icon-button-sm" data-replace aria-label="Choose another PDF">${icon(
              "RefreshCw",
              { size: 17 }
            )}</button>
          </div>
          <input type="file" accept=".pdf,application/pdf" hidden data-replace-input />
          <input type="file" accept="image/*" hidden data-image-input />
        </div>

        <div class="editpdf-layout">
          <div class="editpdf-stage-column">
            <div class="editpdf-toolbar">
              <button type="button" class="editpdf-tool is-active" data-tool="select">${icon("MousePointerClick", {
                size: 16
              })} Select</button>
              <button type="button" class="editpdf-tool" data-tool="text">${icon("Type", { size: 16 })} Text</button>
              <button type="button" class="editpdf-tool" data-tool="rect">${icon("Maximize2", { size: 16 })} Box</button>
              <button type="button" class="editpdf-tool" data-tool="ellipse">${icon("CircleCheck", {
                size: 16
              })} Ellipse</button>
              <button type="button" class="editpdf-tool" data-tool="line">${icon("Minus", { size: 16 })} Line</button>
              <button type="button" class="editpdf-tool" data-tool="draw">${icon("PenTool", { size: 16 })} Draw</button>
              <button type="button" class="editpdf-tool" data-tool="image">${icon("ImagePlus", {
                size: 16
              })} Image</button>
              <button type="button" class="editpdf-tool editpdf-delete" data-delete title="Delete selected object">${icon(
                "Trash2",
                { size: 16 }
              )}</button>
            </div>
            <div class="editpdf-stage" data-edit-stage>
              <img data-edit-bg alt="PDF page background" />
              <canvas data-edit-canvas aria-label="Editable PDF page"></canvas>
            </div>
            <div class="editpdf-pagebar">
              <button type="button" class="icon-button icon-button-sm" data-prev aria-label="Previous page">${icon(
                "ArrowLeft",
                { size: 17 }
              )}</button>
              <strong data-page-label>Page 1 of ${pageCount}</strong>
              <button type="button" class="icon-button icon-button-sm" data-next aria-label="Next page">${icon(
                "ArrowRight",
                { size: 17 }
              )}</button>
              <span class="editor-hint">Double-click text to edit it.</span>
            </div>
          </div>

          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("Palette", { size: 15 })} Style</span>
              <div class="field field-color">
                <label class="field-label" for="editpdf-color">Ink / fill</label>
                <div class="color-row">
                  <input id="editpdf-color" type="color" value="${ink}" data-ink />
                  <span class="color-hex">${ink}</span>
                </div>
              </div>
              <div class="field">
                <label class="field-label" for="editpdf-font">Font</label>
                <div class="select-wrap">
                  <select id="editpdf-font" data-font>
                    ${FONTS.map((font) => `<option value="${font}">${font}</option>`).join("")}
                  </select>
                  ${icon("ChevronDown", { size: 16 })}
                </div>
              </div>
              <div class="field field-range">
                <div class="range-head">
                  <label class="field-label" for="editpdf-size">Text / line size</label>
                  <output data-size-value>${fontSize} px</output>
                </div>
                <input id="editpdf-size" type="range" min="10" max="140" step="1" value="${fontSize}" data-size />
              </div>
            </div>
            <div class="editor-group">
              <span class="editor-group-title">${icon("Info", { size: 15 })} How it works</span>
              <p class="editor-hint">Select any object to move, resize, rotate or delete it. Freehand drawing stays editable until you save.</p>
              <button type="button" class="button button-primary button-lg button-block" data-run>${icon(
                "Download",
                { size: 18 }
              )} ${escapeHtml(tool.action)}</button>
            </div>
          </aside>
        </div>
        <div data-result></div>
      </div>`;
      bindWorkspace();
    };

    const getBackground = async (index) => {
      if (bgCache.has(index)) return bgCache.get(index);
      const page = await pdfDoc.getPage(index + 1);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(900 / base.width, 2);
      const rendered = await renderPageToCanvas(page, scale, "#ffffff");
      const dataUrl = rendered.canvas.toDataURL("image/png");
      const entry = { dataUrl, width: rendered.canvas.width, height: rendered.canvas.height, pageWidth: base.width, pageHeight: base.height };
      rendered.canvas.width = 1;
      rendered.canvas.height = 1;
      page.cleanup();
      bgCache.set(index, entry);
      return entry;
    };

    const objectsJson = () =>
      canvas ? canvas.getObjects().map((object) => object.toObject()) : [];

    const saveCurrentPage = () => {
      if (canvas) pageObjects[currentPage] = objectsJson();
    };

    const applyObjects = async (objects) => {
      if (!canvas) return;
      suppressSync = true;
      canvas.remove(...canvas.getObjects());
      if (objects?.length) {
        const enlivened = await util.enlivenObjects(objects);
        enlivened.forEach((object) => canvas.add(object));
      }
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      suppressSync = false;
    };

    const showPage = async (index, { save = true } = {}) => {
      if (save) saveCurrentPage();
      currentPage = Math.max(0, Math.min(pageCount - 1, index));
      const background = await getBackground(currentPage);
      const stage = root.querySelector("[data-edit-stage]");
      const bgImage = root.querySelector("[data-edit-bg]");
      const canvasEl = root.querySelector("[data-edit-canvas]");
      bgImage.src = background.dataUrl;
      await new Promise((resolve, reject) => {
        if (bgImage.complete && bgImage.naturalWidth) resolve();
        else {
          bgImage.onload = resolve;
          bgImage.onerror = () => reject(new Error("Could not render this page."));
        }
      });
      canvasWidth = background.width;
      canvasHeight = background.height;
      stage.style.aspectRatio = `${canvasWidth} / ${canvasHeight}`;
      if (!canvas) {
        canvas = new Canvas(canvasEl, {
          width: canvasWidth,
          height: canvasHeight,
          selection: true,
          preserveObjectStacking: true
        });
        bindCanvas();
      } else {
        canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
      }
      canvasEl.style.width = "100%";
      canvasEl.style.height = "100%";
      canvas.isDrawingMode = false;
      root.querySelectorAll("[data-tool]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.tool === "select");
      });
      await applyObjects(pageObjects[currentPage]);
      root.querySelector("[data-page-label]").textContent = `Page ${currentPage + 1} of ${pageCount}`;
      root.querySelector("[data-prev]").disabled = currentPage === 0;
      root.querySelector("[data-next]").disabled = currentPage === pageCount - 1;
      history = [];
    };

    const pushHistory = () => {
      history.push(objectsJson());
      if (history.length > 40) history.shift();
    };

    const setTool = (tool) => {
      root.querySelectorAll("[data-tool]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.tool === tool);
      });
      if (!canvas) return;
      canvas.isDrawingMode = tool === "draw";
      if (tool === "draw") {
        const brush = new PencilBrush(canvas);
        brush.color = ink;
        brush.width = Math.max(2, fontSize / 5);
        canvas.freeDrawingBrush = brush;
      }
      if (tool === "text") addText();
      if (tool === "rect") addRect();
      if (tool === "ellipse") addEllipse();
      if (tool === "line") addLine();
      if (tool === "image") imageInput?.click();
      if (tool !== "draw" && tool !== "image") setSelectTool();
    };

    const setSelectTool = () => {
      if (!canvas) return;
      canvas.isDrawingMode = false;
    };

    const addText = () => {
      if (!canvas) return;
      pushHistory();
      const text = new Textbox("Double-click to edit", {
        left: canvasWidth * 0.12,
        top: canvasHeight * 0.16,
        width: canvasWidth * 0.55,
        fontSize,
        fontFamily,
        fill: ink,
        editable: true,
        padding: 4
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.requestRenderAll();
    };

    const addRect = () => {
      if (!canvas) return;
      pushHistory();
      const rect = new Rect({
        left: canvasWidth * 0.25,
        top: canvasHeight * 0.3,
        width: canvasWidth * 0.32,
        height: canvasHeight * 0.12,
        fill: "rgba(255,255,255,0.001)",
        stroke: ink,
        strokeWidth: Math.max(2, fontSize / 10),
        rx: 4,
        ry: 4
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.requestRenderAll();
    };

    const addEllipse = () => {
      if (!canvas) return;
      pushHistory();
      const ellipse = new Ellipse({
        left: canvasWidth * 0.25,
        top: canvasHeight * 0.3,
        rx: canvasWidth * 0.13,
        ry: canvasHeight * 0.08,
        fill: "rgba(255,255,255,0.001)",
        stroke: ink,
        strokeWidth: Math.max(2, fontSize / 10)
      });
      canvas.add(ellipse);
      canvas.setActiveObject(ellipse);
      canvas.requestRenderAll();
    };

    const addLine = () => {
      if (!canvas) return;
      pushHistory();
      const line = new Line(
        [canvasWidth * 0.2, canvasHeight * 0.4, canvasWidth * 0.65, canvasHeight * 0.4],
        { stroke: ink, strokeWidth: Math.max(2, fontSize / 10), strokeLineCap: "round" }
      );
      canvas.add(line);
      canvas.setActiveObject(line);
      canvas.requestRenderAll();
    };

    const addImageFromDataUrl = async (dataUrl) => {
      if (!canvas) return;
      try {
        const image = await FabricImage.fromURL(dataUrl);
        pushHistory();
        const maxWidth = canvasWidth * 0.45;
        const scale = Math.min(1, maxWidth / image.width);
        image.set({
          left: canvasWidth * 0.25,
          top: canvasHeight * 0.25,
          scaleX: scale,
          scaleY: scale
        });
        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.requestRenderAll();
        toast("Image added. Drag or resize it on the page.", { type: "success" });
      } catch {
        toast("Could not add that image.", { type: "error" });
      }
    };

    const deleteSelected = () => {
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) {
        toast("Select an object to delete it.", { type: "info" });
        return;
      }
      pushHistory();
      if (active.type === "activeSelection") {
        active.getObjects().forEach((object) => canvas.remove(object));
      } else {
        canvas.remove(active);
      }
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    };

    const undo = async () => {
      if (!canvas || !history.length) {
        toast("Nothing to undo on this page.", { type: "info" });
        return;
      }
      const previous = history.pop();
      pageObjects[currentPage] = previous;
      await applyObjects(previous);
    };

    const bindCanvas = () => {
      canvas.on("object:modified", () => {
        canvas.requestRenderAll();
        if (!suppressSync) pageObjects[currentPage] = objectsJson();
      });
      canvas.on("mouse:down", (event) => {
        if (event.target) pushHistory();
      });
      canvas.on("path:created", () => {
        if (!suppressSync) pageObjects[currentPage] = objectsJson();
      });
      canvas.on("text:changed", () => {
        if (!suppressSync) pageObjects[currentPage] = objectsJson();
      });
      canvas.on("object:added", () => {
        if (!suppressSync) pageObjects[currentPage] = objectsJson();
      });
      canvas.on("object:removed", () => {
        if (!suppressSync) pageObjects[currentPage] = objectsJson();
      });
    };

    const bindWorkspace = () => {
      imageInput = root.querySelector("[data-image-input]");
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) {
          canvas?.dispose();
          canvas = null;
          bgCache = new Map();
          load(selected);
        }
        replaceInput.value = "";
      });
      imageInput.addEventListener("change", () => {
        const selected = imageInput.files?.[0];
        imageInput.value = "";
        if (!selected) return;
        const reader = new FileReader();
        reader.onload = () => addImageFromDataUrl(reader.result);
        reader.onerror = () => toast("Could not read that image.", { type: "error" });
        reader.readAsDataURL(selected);
      });
      root.querySelectorAll("[data-tool]").forEach((button) => {
        button.addEventListener("click", () => setTool(button.dataset.tool));
      });
      root.querySelector("[data-delete]").addEventListener("click", deleteSelected);
      root.querySelector("[data-undo]").addEventListener("click", undo);
      root.querySelector("[data-ink]").addEventListener("input", (event) => {
        ink = event.target.value;
        root.querySelector(".color-hex").textContent = ink;
        const active = canvas?.getActiveObject();
        if (active) {
          active.set({ fill: active.type === "textbox" || active.type === "i-text" ? ink : active.fill });
          active.set({ stroke: active.type === "textbox" ? active.stroke : ink });
          canvas.requestRenderAll();
        }
      });
      root.querySelector("[data-font]").addEventListener("change", (event) => {
        fontFamily = event.target.value;
        const active = canvas?.getActiveObject();
        if (active?.type === "textbox" || active?.type === "i-text") {
          active.set({ fontFamily });
          canvas.requestRenderAll();
        }
      });
      root.querySelector("[data-size]").addEventListener("input", (event) => {
        fontSize = Number(event.target.value);
        root.querySelector("[data-size-value]").textContent = `${fontSize} px`;
        const active = canvas?.getActiveObject();
        if (active) {
          if (active.type === "textbox" || active.type === "i-text") active.set({ fontSize });
          else active.set({ strokeWidth: Math.max(2, fontSize / 10) });
          canvas.requestRenderAll();
        }
      });
      root.querySelector("[data-prev]").addEventListener("click", () => {
        if (currentPage > 0) showPage(currentPage - 1);
      });
      root.querySelector("[data-next]").addEventListener("click", () => {
        if (currentPage < pageCount - 1) showPage(currentPage + 1);
      });
      root.querySelector("[data-run]").addEventListener("click", run);
      const keyHandler = (event) => {
        if (!root.isConnected) return;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) return;
        if (event.key === "Delete" || event.key === "Backspace") {
          if (canvas?.getActiveObject()) {
            event.preventDefault();
            deleteSelected();
          }
        }
      };
      window.addEventListener("keydown", keyHandler);
      cleanupKey = () => window.removeEventListener("keydown", keyHandler);
    };

    let cleanupKey = null;

    const exportPageCanvas = async (index, objects) => {
      const background = await getBackground(index);
      const el = document.createElement("canvas");
      el.width = background.width;
      el.height = background.height;
      const context = el.getContext("2d");
      const bgImage = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not rebuild this page."));
        image.src = background.dataUrl;
      });
      context.drawImage(bgImage, 0, 0);
      if (objects?.length) {
        if (!canvas) return null;
        canvas.setDimensions({ width: background.width, height: background.height });
        await applyObjects(objects);
        canvas.renderAll();
        const overlayUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
        const overlayImage = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Could not export this page."));
          image.src = overlayUrl;
        });
        context.drawImage(overlayImage, 0, 0);
      }
      return { canvas: el, background };
    };

    const run = async () => {
      if (busy) return;
      saveCurrentPage();
      if (!pageObjects.some((objects) => objects.length)) {
        toast("Add something to a page first.", { type: "error" });
        return;
      }
      busy = true;
      const button = root.querySelector("[data-run]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Saving edits…`;
      const started = performance.now();
      try {
        const libDoc = await openPdf(file);
        const output = await PDFDocument.create();
        const edited = pageObjects.map((objects, index) => (objects.length ? index : -1)).filter((index) => index >= 0);
        for (let index = 0; index < pageCount; index += 1) {
          button.innerHTML = `${icon("LoaderCircle", {
            size: 18,
            className: "spin"
          })} Building page ${index + 1} of ${pageCount}…`;
          if (!pageObjects[index].length) {
            const copied = await output.copyPages(libDoc, [index]);
            output.addPage(copied[0]);
            continue;
          }
          const rendered = await exportPageCanvas(index, pageObjects[index]);
          if (!rendered) continue;
          const blob = await canvasToBlob(rendered.canvas, "image/png");
          const image = await output.embedPng(await blob.arrayBuffer());
          const newPage = output.addPage([rendered.background.pageWidth, rendered.background.pageHeight]);
          newPage.drawImage(image, {
            x: 0,
            y: 0,
            width: rendered.background.pageWidth,
            height: rendered.background.pageHeight
          });
        }
        await showPage(currentPage, { save: false });
        const bytes = await savePdf(output);
        renderResult(
          root.querySelector("[data-result]"),
          [{ blob: new Blob([bytes], { type: "application/pdf" }), name: `${sanitizeFilename(file.name, "document")}-edited.pdf` }],
          { tool, inputs: file.size, duration: performance.now() - started }
        );
        toast(`${edited.length} edited page${edited.length === 1 ? "" : "s"} saved.`, { type: "success" });
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
      cleanupKey?.();
      cleanupKey = null;
      canvas?.dispose();
      canvas = null;
      pdfDoc?.destroy?.();
      pdfDoc = null;
      bgCache.clear();
    };
  }
};
