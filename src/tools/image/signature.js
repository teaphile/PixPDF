import "@fontsource/caveat/400.css";
import "@fontsource/dancing-script/400.css";
import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import {
  canvasToBlob,
  errorMessage,
  escapeHtml,
  formatBytes,
  sanitizeFilename
} from "../../lib/utils.js";

const WIDTH = 1000;
const HEIGHT = 320;

export default {
  async mount(root, { tool }) {
    let mode = "draw";
    let color = "#172033";
    let lineWidth = 4;
    let fontFamily = "Caveat";
    let fontScale = 0.58;
    let text = "";
    let strokes = [];
    let drawing = false;
    let active = null;
    let hasFile = false;
    let busy = false;
    let canvas = null;
    let context = null;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: "image/*",
          title: "Start a new signature",
          subtitle: 'or <span class="text-link">skip upload</span> and draw on the pad below',
          hint: "Create a reusable transparent signature on this device"
        })}
        <div class="run-zone">
          <button type="button" class="button button-primary button-lg" data-start>${icon("PenTool", {
            size: 19
          })} Open signature studio</button>
        </div>
      </div>`;
      bindDropzone(root, () => startStudio());
      root.querySelector("[data-start]").addEventListener("click", () => startStudio());
    };

    const startStudio = async () => {
      hasFile = true;
      await document.fonts.ready;
      renderStudio();
      setupCanvas();
      draw();
    };

    const renderStudio = () => {
      root.innerHTML = `<div class="workspace-card signature-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("PenTool", { size: 22 })}</span>
            <div>
              <strong>New signature</strong>
              <span>Transparent PNG · 1000 × 320 px workspace</span>
            </div>
          </div>
          <button type="button" class="button button-ghost button-sm" data-reset>${icon("RotateCcw", {
            size: 15
          })} Start over</button>
        </div>

        <div class="signature-layout">
          <div class="signature-main">
            <div class="signature-tabs" role="tablist" aria-label="Signature mode">
              <button type="button" role="tab" class="signature-tab is-active" data-mode="draw">${icon(
                "PenTool",
                { size: 16 }
              )} Draw</button>
              <button type="button" role="tab" class="signature-tab" data-mode="type">${icon("Type", {
                size: 16
              })} Type</button>
            </div>
            <div class="signature-pad-wrap" data-draw-panel>
              <canvas data-signature-pad aria-label="Signature drawing canvas"></canvas>
              <span class="sign-pad-baseline">Sign above the line</span>
            </div>
            <div class="signature-type-wrap" data-type-panel hidden>
              <input class="input signature-text-input" type="text" maxlength="60" placeholder="Type your name…" data-text />
              <div class="signature-font-row">
                <label class="inline-field">Style
                  <select data-font>
                    <option value="Caveat">Caveat — relaxed</option>
                    <option value="Dancing Script">Dancing Script — elegant</option>
                  </select>
                </label>
                <label class="inline-field inline-range">Size
                  <input type="range" min="0.3" max="0.9" step="0.02" value="${fontScale}" data-font-scale />
                </label>
              </div>
            </div>
            <div class="signature-tools">
              <label class="inline-field">Ink <input type="color" value="${color}" data-color /></label>
              <label class="inline-field inline-range">Pen
                <input type="range" min="2" max="12" step="0.5" value="${lineWidth}" data-width />
              </label>
              <button type="button" class="button button-ghost button-sm" data-undo>${icon("RotateCcw", {
                size: 15
              })} Undo</button>
              <button type="button" class="text-button" data-clear>${icon("Trash2", { size: 14 })} Clear</button>
            </div>
          </div>
          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("Info", { size: 15 })} Export</span>
              <p class="editor-hint">Transparent PNG keeps the background clear so you can place the signature on any document.</p>
              <div class="signature-preview-card">
                <span>Preview</span>
                <div class="signature-preview" data-signature-preview></div>
              </div>
              <button type="button" class="button button-primary button-lg button-block" data-export>${icon(
                "Download",
                { size: 18 }
              )} ${escapeHtml(tool.action)}</button>
            </div>
          </aside>
        </div>
        <div data-result></div>
      </div>`;
      bindStudio();
      updatePreview();
    };

    const setupCanvas = () => {
      canvas = root.querySelector("[data-signature-pad]");
      context = canvas.getContext("2d");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const rect = canvas.getBoundingClientRect();
      canvas.style.height = `${(rect.width * HEIGHT) / WIDTH}px`;
      draw();
    };

    const pointFromEvent = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT
      };
    };

    const draw = () => {
      if (!context) return;
      context.clearRect(0, 0, WIDTH, HEIGHT);
      context.lineCap = "round";
      context.lineJoin = "round";
      if (mode === "type") {
        if (!text.trim()) return;
        const size = Math.round(HEIGHT * fontScale);
        context.fillStyle = color;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `400 ${size}px "${fontFamily}", cursive`;
        context.fillText(text.trim(), WIDTH / 2, HEIGHT / 2, WIDTH - 80);
        return;
      }
      for (const stroke of strokes) {
        if (!stroke.points.length) continue;
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.width;
        context.beginPath();
        const first = stroke.points[0];
        context.moveTo(first.x, first.y);
        for (let index = 1; index < stroke.points.length; index += 1) {
          context.lineTo(stroke.points[index].x, stroke.points[index].y);
        }
        if (stroke.points.length === 1) context.lineTo(first.x + 0.1, first.y);
        context.stroke();
      }
    };

    const updatePreview = () => {
      const preview = root.querySelector("[data-signature-preview]");
      if (!preview || !canvas) return;
      preview.innerHTML = "";
      const image = document.createElement("img");
      image.alt = "Signature preview";
      image.src = (mode === "type" ? trimmedCanvas() || canvas : canvas).toDataURL("image/png");
      preview.appendChild(image);
    };

    const trimmedCanvas = () => {
      if (mode === "type") {
        const out = document.createElement("canvas");
        out.width = WIDTH;
        out.height = HEIGHT;
        const ctx = out.getContext("2d");
        if (text.trim()) {
          const size = Math.round(HEIGHT * fontScale);
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `400 ${size}px "${fontFamily}", cursive`;
          ctx.fillText(text.trim(), WIDTH / 2, HEIGHT / 2, WIDTH - 80);
        }
        return trimTransparent(out);
      }
      if (!canvas) return null;
      return trimTransparent(canvas);
    };

    const trimTransparent = (source) => {
      const ctx = source.getContext("2d");
      const data = ctx.getImageData(0, 0, source.width, source.height).data;
      let minX = source.width;
      let minY = source.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < source.height; y += 1) {
        for (let x = 0; x < source.width; x += 1) {
          if (data[(y * source.width + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX) return null;
      const pad = 18;
      const x = Math.max(0, minX - pad);
      const y = Math.max(0, minY - pad);
      const width = Math.min(source.width - x, maxX - minX + pad * 2);
      const height = Math.min(source.height - y, maxY - minY + pad * 2);
      const out = document.createElement("canvas");
      out.width = Math.max(1, width);
      out.height = Math.max(1, height);
      out.getContext("2d").drawImage(source, x, y, width, height, 0, 0, out.width, out.height);
      return out;
    };

    const exportCanvas = () => trimmedCanvas() || canvas;

    const bindStudio = () => {
      root.querySelector("[data-reset]").addEventListener("click", () => {
        strokes = [];
        text = "";
        renderInitial();
      });
      root.querySelectorAll("[data-mode]").forEach((button) => {
        button.addEventListener("click", async () => {
          mode = button.dataset.mode;
          root.querySelectorAll("[data-mode]").forEach((item) => {
            item.classList.toggle("is-active", item === button);
          });
          root.querySelector("[data-draw-panel]").hidden = mode !== "draw";
          root.querySelector("[data-type-panel]").hidden = mode !== "type";
          if (mode === "type") {
            await document.fonts.ready;
            root.querySelector("[data-text]")?.focus();
          }
          draw();
          updatePreview();
        });
      });
      root.querySelector("[data-text]").addEventListener("input", (event) => {
        text = event.target.value;
        draw();
        updatePreview();
      });
      root.querySelector("[data-font]").addEventListener("change", async (event) => {
        fontFamily = event.target.value;
        await document.fonts.ready;
        draw();
        updatePreview();
      });
      root.querySelector("[data-font-scale]").addEventListener("input", (event) => {
        fontScale = Number(event.target.value);
        draw();
        updatePreview();
      });
      root.querySelector("[data-color]").addEventListener("input", (event) => {
        color = event.target.value;
        draw();
        updatePreview();
      });
      root.querySelector("[data-width]").addEventListener("input", (event) => {
        lineWidth = Number(event.target.value);
      });
      root.querySelector("[data-undo]").addEventListener("click", () => {
        if (mode === "draw") strokes.pop();
        else text = root.querySelector("[data-text]").value = "";
        draw();
        updatePreview();
      });
      root.querySelector("[data-clear]").addEventListener("click", () => {
        strokes = [];
        text = "";
        const input = root.querySelector("[data-text]");
        if (input) input.value = "";
        draw();
        updatePreview();
      });

      const pad = root.querySelector("[data-signature-pad]");
      pad.addEventListener("pointerdown", (event) => {
        if (mode !== "draw") return;
        event.preventDefault();
        pad.setPointerCapture(event.pointerId);
        drawing = true;
        active = { color, width: lineWidth, points: [pointFromEvent(event)] };
        strokes.push(active);
        draw();
        updatePreview();
      });
      pad.addEventListener("pointermove", (event) => {
        if (!drawing || !active) return;
        event.preventDefault();
        active.points.push(pointFromEvent(event));
        draw();
        updatePreview();
      });
      const finish = (event) => {
        if (!drawing) return;
        drawing = false;
        active = null;
        try {
          pad.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        updatePreview();
      };
      pad.addEventListener("pointerup", finish);
      pad.addEventListener("pointercancel", finish);
      pad.addEventListener("pointerleave", (event) => {
        if (drawing && event.buttons === 0) finish(event);
      });
      root.querySelector("[data-export]").addEventListener("click", run);
    };

    const run = async () => {
      if (busy) return;
      if (mode === "type" && !text.trim()) {
        toast("Type your name first.", { type: "error" });
        return;
      }
      if (mode === "draw" && !strokes.some((stroke) => stroke.points.length > 1)) {
        toast("Draw or type a signature first.", { type: "error" });
        return;
      }
      busy = true;
      const button = root.querySelector("[data-export]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Exporting…`;
      try {
        const out = exportCanvas();
        const blob = await canvasToBlob(out, "image/png");
        const base = text.trim() ? sanitizeFilename(text.trim(), "signature") : "signature";
        renderResult(
          root.querySelector("[data-result]"),
          [{ blob, name: `${base}-signature.png` }],
          { tool, inputs: 0 }
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
      strokes = [];
      canvas = null;
      context = null;
      hasFile = false;
    };
  }
};
