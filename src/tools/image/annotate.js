import {
  Canvas,
  Ellipse,
  Group,
  Line,
  PencilBrush,
  Rect,
  Textbox,
  Triangle,
  util
} from "fabric";
import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import {
  canvasToBlob,
  errorMessage,
  escapeHtml,
  formatBytes,
  isImageFile,
  sanitizeFilename
} from "../../lib/utils.js";
import { drawSource, loadImageSource, makeCanvas } from "../../lib/image.js";

const STICKERS = ["⭐", "❤️", "✅", "❗", "🔥", "👀"];

export default {
  async mount(root, { tool }) {
    let file = null;
    let loaded = null;
    let previewUrl = null;
    let canvas = null;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let displayWidth = 0;
    let ink = "#e11d48";
    let size = 34;
    let format = "png";
    let quality = 0.94;
    let history = [];
    let suppressSync = false;
    let busy = false;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: "image/*",
          title: "Drop an image to annotate",
          subtitle: 'or <span class="text-link">browse your device</span> · one image at a time',
          hint: "Add text, arrows, shapes and freehand notes to screenshots"
        })}
        <div class="organize-empty-note">${icon("Info", {
          size: 15
        })} Export at full resolution with crisp text — perfect for tutorials and support screenshots.</div>
      </div>`;
      bindDropzone(root, (files) => {
        const image = files.find(isImageFile);
        if (!image) {
          toast("Please choose an image file.", { type: "error" });
          return;
        }
        load(image);
      });
    };

    const load = async (selected) => {
      file = selected;
      root.innerHTML = `<div class="workspace-card"><div class="custom-loading">${icon(
        "LoaderCircle",
        { size: 22, className: "spin" }
      )} Opening your image…</div></div>`;
      try {
        loaded?.dispose?.();
        loaded = await loadImageSource(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        displayWidth = Math.min(1100, loaded.width);
        history = [];
        renderWorkspace();
        await setupCanvas();
      } catch (error) {
        toast(errorMessage(error), { type: "error" });
        renderInitial();
      }
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card annotate-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("PenTool", { size: 22 })}</span>
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <span>${loaded.width} × ${loaded.height} px · ${formatBytes(file.size)}</span>
            </div>
          </div>
          <div class="organize-toolbar-actions">
            <button type="button" class="button button-ghost button-sm" data-undo>${icon("RotateCcw", {
              size: 15
            })} Undo</button>
            <button type="button" class="icon-button icon-button-sm" data-replace aria-label="Choose another image">${icon(
              "RefreshCw",
              { size: 17 }
            )}</button>
          </div>
          <input type="file" accept="image/*" hidden data-replace-input />
        </div>

        <div class="annotate-layout">
          <div class="annotate-stage-column">
            <div class="editpdf-toolbar">
              <button type="button" class="editpdf-tool is-active" data-tool="select">${icon("MousePointerClick", {
                size: 16
              })} Select</button>
              <button type="button" class="editpdf-tool" data-tool="text">${icon("Type", { size: 16 })} Text</button>
              <button type="button" class="editpdf-tool" data-tool="rect">${icon("Maximize2", { size: 16 })} Box</button>
              <button type="button" class="editpdf-tool" data-tool="ellipse">${icon("CircleCheck", {
                size: 16
              })} Circle</button>
              <button type="button" class="editpdf-tool" data-tool="arrow">${icon("ArrowRight", {
                size: 16
              })} Arrow</button>
              <button type="button" class="editpdf-tool" data-tool="draw">${icon("PenTool", { size: 16 })} Draw</button>
              <button type="button" class="editpdf-tool" data-tool="sticker">${icon("Star", { size: 16 })} Sticker</button>
              <button type="button" class="editpdf-tool editpdf-delete" data-delete title="Delete selected object">${icon(
                "Trash2",
                { size: 16 }
              )}</button>
            </div>
            <div class="annotate-stage" data-annotate-stage>
              <img data-annotate-bg src="${previewUrl}" alt="Image being annotated" />
              <canvas data-annotate-canvas aria-label="Annotation canvas"></canvas>
            </div>
            <p class="editor-hint">${icon("Info", {
              size: 14
            })} Select an object to move, resize or rotate it. Export uses the original resolution.</p>
          </div>

          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("Palette", { size: 15 })} Style</span>
              <div class="field field-color">
                <label class="field-label" for="annotate-color">Colour</label>
                <div class="color-row">
                  <input id="annotate-color" type="color" value="${ink}" data-ink />
                  <span class="color-hex">${ink}</span>
                </div>
              </div>
              <div class="field field-range">
                <div class="range-head">
                  <label class="field-label" for="annotate-size">Size</label>
                  <output data-size-value>${size} px</output>
                </div>
                <input id="annotate-size" type="range" min="10" max="140" step="1" value="${size}" data-size />
              </div>
            </div>
            <div class="editor-group">
              <span class="editor-group-title">${icon("ImageDown", { size: 15 })} Export</span>
              <div class="field">
                <label class="field-label" for="annotate-format">Format</label>
                <div class="select-wrap">
                  <select id="annotate-format" data-format>
                    <option value="png">PNG — crisp</option>
                    <option value="jpg">JPG — smaller</option>
                    <option value="webp">WebP</option>
                  </select>
                  ${icon("ChevronDown", { size: 16 })}
                </div>
              </div>
              <div class="field field-range" data-quality-field style="opacity:.45">
                <div class="range-head">
                  <label class="field-label" for="annotate-quality">Quality</label>
                  <output data-quality-value>94%</output>
                </div>
                <input id="annotate-quality" type="range" min="0.5" max="1" step="0.02" value="${quality}" data-quality />
              </div>
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

    const setupCanvas = async () => {
      const stage = root.querySelector("[data-annotate-stage]");
      const bg = root.querySelector("[data-annotate-bg]");
      await new Promise((resolve) => {
        if (bg.complete && bg.naturalWidth) resolve();
        else bg.onload = resolve;
      });
      canvasHeight = Math.round((displayWidth * loaded.height) / loaded.width);
      stage.style.aspectRatio = `${displayWidth} / ${canvasHeight}`;
      canvasWidth = displayWidth;
      const el = root.querySelector("[data-annotate-canvas]");
      canvas = new Canvas(el, {
        width: canvasWidth,
        height: canvasHeight,
        selection: true,
        preserveObjectStacking: true
      });
      el.style.width = "100%";
      el.style.height = "100%";
      bindCanvas();
    };

    const objectsJson = () => (canvas ? canvas.getObjects().map((object) => object.toObject()) : []);

    const pushHistory = () => {
      history.push(objectsJson());
      if (history.length > 40) history.shift();
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

    const addText = (content = "Double-click to edit") => {
      pushHistory();
      const text = new Textbox(content, {
        left: canvasWidth * 0.15,
        top: canvasHeight * 0.18,
        width: canvasWidth * 0.55,
        fontSize: content.length <= 2 ? size * 2 : size,
        fontFamily: "Helvetica",
        fill: ink,
        editable: true,
        padding: 4
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.requestRenderAll();
    };

    const addRect = () => {
      pushHistory();
      const rect = new Rect({
        left: canvasWidth * 0.25,
        top: canvasHeight * 0.32,
        width: canvasWidth * 0.34,
        height: canvasHeight * 0.12,
        fill: "rgba(255,255,255,0.001)",
        stroke: ink,
        strokeWidth: Math.max(2, size / 10),
        rx: 6,
        ry: 6
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.requestRenderAll();
    };

    const addEllipse = () => {
      pushHistory();
      const ellipse = new Ellipse({
        left: canvasWidth * 0.25,
        top: canvasHeight * 0.32,
        rx: canvasWidth * 0.14,
        ry: canvasHeight * 0.1,
        fill: "rgba(255,255,255,0.001)",
        stroke: ink,
        strokeWidth: Math.max(2, size / 10)
      });
      canvas.add(ellipse);
      canvas.setActiveObject(ellipse);
      canvas.requestRenderAll();
    };

    const addArrow = () => {
      pushHistory();
      const stroke = Math.max(2, size / 8);
      const line = new Line([0, 0, 180, 0], { stroke: ink, strokeWidth: stroke, strokeLineCap: "round" });
      const head = new Triangle({
        left: 162,
        top: -14,
        width: 30,
        height: 28,
        fill: ink,
        angle: 90,
        originX: "center",
        originY: "center"
      });
      const group = new Group([line, head], {
        left: canvasWidth * 0.3,
        top: canvasHeight * 0.5,
        scaleX: Math.max(0.8, canvasWidth / 900),
        scaleY: Math.max(0.8, canvasWidth / 900)
      });
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
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
        brush.width = Math.max(2, size / 5);
        canvas.freeDrawingBrush = brush;
      }
      if (tool === "text") addText();
      if (tool === "rect") addRect();
      if (tool === "ellipse") addEllipse();
      if (tool === "arrow") addArrow();
      if (tool === "sticker") addText(STICKERS[Math.floor(Math.random() * STICKERS.length)]);
      if (!["draw", "select"].includes(tool)) {
        canvas.isDrawingMode = false;
      }
    };

    const deleteSelected = () => {
      const active = canvas?.getActiveObject();
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
      if (!history.length) {
        toast("Nothing to undo.", { type: "info" });
        return;
      }
      await applyObjects(history.pop());
    };

    const bindCanvas = () => {
      canvas.on("mouse:down", (event) => {
        if (event.target) pushHistory();
      });
      canvas.on("object:modified", () => canvas.requestRenderAll());
    };

    const bindWorkspace = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) {
          canvas?.dispose();
          canvas = null;
          history = [];
          load(selected);
        }
        replaceInput.value = "";
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
          active.set(active.type === "textbox" ? { fill: ink } : { stroke: ink });
          canvas.requestRenderAll();
        }
      });
      root.querySelector("[data-size]").addEventListener("input", (event) => {
        size = Number(event.target.value);
        root.querySelector("[data-size-value]").textContent = `${size} px`;
        const active = canvas?.getActiveObject();
        if (active) {
          if (active.type === "textbox") active.set({ fontSize: size });
          else active.set({ strokeWidth: Math.max(2, size / 10) });
          canvas.requestRenderAll();
        }
      });
      root.querySelector("[data-format]").addEventListener("change", (event) => {
        format = event.target.value;
        root.querySelector("[data-quality-field]").style.opacity = format === "png" ? "0.45" : "1";
      });
      root.querySelector("[data-quality]").addEventListener("input", (event) => {
        quality = Number(event.target.value);
        root.querySelector("[data-quality-value]").textContent = `${Math.round(quality * 100)}%`;
      });
      root.querySelector("[data-run]").addEventListener("click", run);
      const keyHandler = (event) => {
        if (!root.isConnected) return;
        const tag = event.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) return;
        if ((event.key === "Delete" || event.key === "Backspace") && canvas?.getActiveObject()) {
          event.preventDefault();
          deleteSelected();
        }
      };
      window.addEventListener("keydown", keyHandler);
      cleanupKey = () => window.removeEventListener("keydown", keyHandler);
    };

    let cleanupKey = null;

    const run = async () => {
      if (busy) return;
      if (!canvas?.getObjects().length) {
        toast("Add an annotation first.", { type: "error" });
        return;
      }
      busy = true;
      const button = root.querySelector("[data-run]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Exporting…`;
      try {
        const multiplier = Math.min(4, loaded.width / canvasWidth);
        const overlayUrl = canvas.toDataURL({ format: "png", multiplier });
        const overlay = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Could not render annotations."));
          image.src = overlayUrl;
        });
        const out = makeCanvas(loaded.width, loaded.height);
        const context = out.getContext("2d");
        if (format === "jpg") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, out.width, out.height);
        }
        drawSource(context, loaded.source, 0, 0, out.width, out.height);
        context.drawImage(overlay, 0, 0, out.width, out.height);
        const blob = await canvasToBlob(out, `image/${format === "jpg" ? "jpeg" : format}`, format === "png" ? undefined : quality);
        renderResult(
          root.querySelector("[data-result]"),
          [{ blob, name: `${sanitizeFilename(file.name, "image")}-annotated.${format}` }],
          { tool, inputs: file.size }
        );
      } catch (error) {
        toast(errorMessage(error), { type: "error" });
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
      loaded?.dispose?.();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      loaded = null;
      previewUrl = null;
    };
  }
};
