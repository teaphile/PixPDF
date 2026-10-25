import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import { advancedPanelMarkup, mountAdvancedPanel } from "../../ui/advanced-panel.js";
import {
  canvasToBlob,
  formatBytes,
  isImageFile,
  sanitizeFilename,
  errorMessage,
  escapeHtml
} from "../../lib/utils.js";
import {
  drawSource,
  loadImageSource,
  makeCanvas,
  mimeFor
} from "../../lib/image.js";

export default {
  async mount(root, { tool }) {
    let file = null;
    let loaded = null;
    let previewUrl = null;
    let rows = 3;
    let cols = 3;
    let format = "jpg";
    let quality = 0.92;
    let busy = false;
    let advanced = null;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: "image/*",
          title: "Drop an image to split",
          subtitle: 'or <span class="text-link">browse your device</span> · one image at a time',
          hint: "Every tile is created locally at full resolution"
        })}
        <div class="organize-empty-note">${icon("LayoutGrid", {
          size: 15
        })} Perfect for Instagram grids, puzzles, banners and print layouts.</div>
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
        renderWorkspace();
      } catch (error) {
        toast(errorMessage(error), { type: "error" });
        renderInitial();
      }
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card split-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("LayoutGrid", { size: 22 })}</span>
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <span>${loaded.width} × ${loaded.height} px · ${formatBytes(file.size)}</span>
            </div>
          </div>
          <button type="button" class="button button-ghost button-sm" data-replace>${icon("RefreshCw", {
            size: 15
          })} Change image</button>
          <input type="file" accept="image/*" hidden data-replace-input />
        </div>

        <div class="split-layout">
          <div class="split-stage">
            <div class="split-preview" data-split-preview>
              <img src="${previewUrl}" alt="Image preview" />
              <div class="split-grid-lines" data-grid-lines></div>
            </div>
            <p class="editor-hint">${icon("Info", {
              size: 14
            })} The grid is cropped to equal tiles. Total tiles: <strong data-tile-count>9</strong>.</p>
          </div>
          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("LayoutGrid", { size: 15 })} Grid</span>
              <div class="split-inputs">
                <div class="field">
                  <label class="field-label" for="split-rows">Rows</label>
                  <input id="split-rows" class="input" type="number" min="1" max="12" value="${rows}" data-rows />
                </div>
                <span class="split-times">×</span>
                <div class="field">
                  <label class="field-label" for="split-cols">Columns</label>
                  <input id="split-cols" class="input" type="number" min="1" max="12" value="${cols}" data-cols />
                </div>
              </div>
              <div class="split-presets">
                <button type="button" class="button button-ghost button-sm" data-preset="3,3">3 × 3</button>
                <button type="button" class="button button-ghost button-sm" data-preset="2,2">2 × 2</button>
                <button type="button" class="button button-ghost button-sm" data-preset="1,2">1 × 2</button>
                <button type="button" class="button button-ghost button-sm" data-preset="3,1">3 × 1</button>
              </div>
            </div>

            <div class="editor-group">
              <span class="editor-group-title">${icon("ImageDown", { size: 15 })} Output</span>
              <div class="field">
                <label class="field-label" for="split-format">Format</label>
                <div class="select-wrap">
                  <select id="split-format" data-format>
                    <option value="jpg">JPG</option>
                    <option value="png">PNG</option>
                    <option value="webp">WebP</option>
                  </select>
                  ${icon("ChevronDown", { size: 16 })}
                </div>
              </div>
              <div class="field field-range" data-quality-field>
                <div class="range-head">
                  <label class="field-label" for="split-quality">Quality</label>
                  <output data-quality-value>92%</output>
                </div>
                <input id="split-quality" type="range" min="0.5" max="1" step="0.02" value="${quality}" data-quality />
              </div>
              <button type="button" class="button button-primary button-lg button-block" data-run>${icon(
                "Scissors",
                { size: 18 }
              )} Split image</button>
            </div>
          </aside>
        </div>
        ${advancedPanelMarkup(tool)}
        <div data-result></div>
      </div>`;
      bindWorkspace();
      advanced = mountAdvancedPanel(root, tool);
      renderGrid();
    };

    const bindWorkspace = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) load(selected);
        replaceInput.value = "";
      });
      const rowsInput = root.querySelector("[data-rows]");
      const colsInput = root.querySelector("[data-cols]");
      const update = () => {
        rows = Math.max(1, Math.min(12, Number(rowsInput.value) || 1));
        cols = Math.max(1, Math.min(12, Number(colsInput.value) || 1));
        renderGrid();
      };
      rowsInput.addEventListener("input", update);
      colsInput.addEventListener("input", update);
      root.querySelectorAll("[data-preset]").forEach((button) => {
        button.addEventListener("click", () => {
          const [nextRows, nextCols] = button.dataset.preset.split(",").map(Number);
          rows = nextRows;
          cols = nextCols;
          rowsInput.value = String(rows);
          colsInput.value = String(cols);
          renderGrid();
        });
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
    };

    const renderGrid = () => {
      const lines = root.querySelector("[data-grid-lines]");
      if (!lines) return;
      const parts = [];
      for (let index = 1; index < cols; index += 1) {
        parts.push(`<span class="grid-line grid-line-v" style="left:${(index / cols) * 100}%"></span>`);
      }
      for (let index = 1; index < rows; index += 1) {
        parts.push(`<span class="grid-line grid-line-h" style="top:${(index / rows) * 100}%"></span>`);
      }
      lines.innerHTML = parts.join("");
      root.querySelector("[data-tile-count]").textContent = String(rows * cols);
    };

    const run = async () => {
      if (busy) return;
      busy = true;
      const button = root.querySelector("[data-run]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Splitting…`;
      const started = performance.now();
      try {
        const outputs = [];
        const base = sanitizeFilename(file.name, "image");
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const extra = advanced?.values || {};
            const overlap = Math.max(0, Number(extra.overlap) || 0);
            const cellWidth = loaded.width / cols;
            const cellHeight = loaded.height / rows;
            const x = Math.max(0, Math.round(col * cellWidth - (col ? overlap / 2 : 0)));
            const y = Math.max(0, Math.round(row * cellHeight - (row ? overlap / 2 : 0)));
            const right = Math.min(loaded.width, Math.round((col + 1) * cellWidth + (col < cols - 1 ? overlap / 2 : 0)));
            const bottom = Math.min(loaded.height, Math.round((row + 1) * cellHeight + (row < rows - 1 ? overlap / 2 : 0)));
            let targetWidth = right - x;
            let targetHeight = bottom - y;
            if (extra.squareTiles) {
              const side = Math.max(targetWidth, targetHeight);
              targetWidth = side;
              targetHeight = side;
            }
            const canvas = makeCanvas(targetWidth, targetHeight);
            const context = canvas.getContext("2d");
            if (format === "jpg") {
              context.fillStyle = "#ffffff";
              context.fillRect(0, 0, canvas.width, canvas.height);
            }
            drawSource(
              context,
              loaded.source,
              -x,
              -y,
              loaded.width,
              loaded.height
            );
            const blob = await canvasToBlob(
              canvas,
              mimeFor(format),
              format === "png" ? undefined : quality
            );
            outputs.push({
              blob,
              name: `${base}-r${row + 1}-c${col + 1}.${format}`
            });
            canvas.width = 1;
            canvas.height = 1;
          }
        }
        renderResult(root.querySelector("[data-result]"), outputs, {
          tool,
          outputOptions: advanced?.values,
          inputs: file.size,
          duration: performance.now() - started
        });
        toast(`${outputs.length} tiles created.`, { type: "success" });
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
      loaded?.dispose?.();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      loaded = null;
      previewUrl = null;
    };
  }
};
