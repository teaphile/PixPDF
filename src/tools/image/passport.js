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
import {
  loadImageSource,
  makeCanvas
} from "../../lib/image.js";

const PRESETS = {
  "passport-35x45": { label: "Passport — 35 × 45 mm", width: 35, height: 45 },
  "us-2x2": { label: "US passport — 2 × 2 in", width: 50.8, height: 50.8 },
  "canada-50x70": { label: "Canada — 50 × 70 mm", width: 50, height: 70 },
  "china-33x48": { label: "China visa — 33 × 48 mm", width: 33, height: 48 },
  "india-35x45": { label: "India — 35 × 45 mm", width: 35, height: 45 },
  "id-35x45": { label: "ID / visa — 35 × 45 mm", width: 35, height: 45 },
  custom: { label: "Custom size", width: 35, height: 45 }
};

export default {
  async mount(root, { tool }) {
    let file = null;
    let loaded = null;
    let previewUrl = null;
    let preset = "passport-35x45";
    let dpi = 300;
    let zoom = 1;
    let offsetX = 0;
    let offsetY = 0;
    let background = "#ffffff";
    let includeSheet = true;
    let busy = false;

    const dimensions = () => {
      const item = PRESETS[preset] || PRESETS["passport-35x45"];
      return { width: item.width, height: item.height };
    };

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: "image/*",
          title: "Drop a portrait photo",
          subtitle: 'or <span class="text-link">browse your device</span> · one image at a time',
          hint: "Create print-ready ID photos without uploading your face"
        })}
        <div class="organize-empty-note">${icon("Scaling", {
          size: 15
        })} Use a straight-on photo with some space around the head. A4 print sheet included.</div>
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
      )} Preparing your photo…</div></div>`;
      try {
        loaded?.dispose?.();
        loaded = await loadImageSource(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        zoom = 1;
        offsetX = 0;
        offsetY = 0;
        renderWorkspace();
      } catch (error) {
        toast(errorMessage(error), { type: "error" });
        renderInitial();
      }
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card passport-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("Scaling", { size: 22 })}</span>
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <span>${loaded.width} × ${loaded.height} px · ${formatBytes(file.size)}</span>
            </div>
          </div>
          <button type="button" class="button button-ghost button-sm" data-replace>${icon("RefreshCw", {
            size: 15
          })} Change photo</button>
          <input type="file" accept="image/*" hidden data-replace-input />
        </div>

        <div class="passport-layout">
          <div class="passport-stage">
            <div class="passport-frame" data-passport-frame>
              <canvas data-passport-preview aria-label="Passport photo preview"></canvas>
              <div class="passport-head-guide" aria-hidden="true"></div>
            </div>
            <p class="editor-hint">${icon("Info", {
              size: 14
            })} The photo is cropped to the selected official size. Drag the sliders to fit the face.</p>
          </div>
          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("Scaling", { size: 15 })} Photo size</span>
              <div class="field">
                <label class="field-label" for="passport-preset">Preset</label>
                <div class="select-wrap">
                  <select id="passport-preset" data-preset>
                    ${Object.entries(PRESETS)
                      .map(
                        ([value, item]) =>
                          `<option value="${value}" ${value === preset ? "selected" : ""}>${item.label}</option>`
                      )
                      .join("")}
                  </select>
                  ${icon("ChevronDown", { size: 16 })}
                </div>
              </div>
              <div class="split-inputs" data-custom-size ${
                preset === "custom" ? "" : "hidden"
              }>
                <div class="field">
                  <label class="field-label" for="passport-width">Width (mm)</label>
                  <input id="passport-width" class="input" type="number" min="15" max="150" value="${dimensions().width}" data-width />
                </div>
                <span class="split-times">×</span>
                <div class="field">
                  <label class="field-label" for="passport-height">Height (mm)</label>
                  <input id="passport-height" class="input" type="number" min="15" max="150" value="${dimensions().height}" data-height />
                </div>
              </div>
              <div class="field">
                <label class="field-label" for="passport-dpi">Print resolution</label>
                <div class="select-wrap">
                  <select id="passport-dpi" data-dpi>
                    <option value="300" selected>300 DPI — standard</option>
                    <option value="600">600 DPI — high quality</option>
                  </select>
                  ${icon("ChevronDown", { size: 16 })}
                </div>
              </div>
            </div>

            <div class="editor-group">
              <span class="editor-group-title">${icon("Crop", { size: 15 })} Framing</span>
              <div class="field field-range">
                <div class="range-head">
                  <label class="field-label" for="passport-zoom">Zoom</label>
                  <output data-zoom-value>${Math.round(zoom * 100)}%</output>
                </div>
                <input id="passport-zoom" type="range" min="1" max="3" step="0.02" value="${zoom}" data-zoom />
              </div>
              <div class="field field-range">
                <div class="range-head">
                  <label class="field-label" for="passport-x">Horizontal</label>
                  <output data-x-value>0</output>
                </div>
                <input id="passport-x" type="range" min="-100" max="100" step="1" value="0" data-x />
              </div>
              <div class="field field-range">
                <div class="range-head">
                  <label class="field-label" for="passport-y">Vertical</label>
                  <output data-y-value>0</output>
                </div>
                <input id="passport-y" type="range" min="-100" max="100" step="1" value="0" data-y />
              </div>
              <div class="field field-color">
                <label class="field-label" for="passport-background">Background fill</label>
                <div class="color-row">
                  <input id="passport-background" type="color" value="${background}" data-background />
                  <span class="color-hex">${background}</span>
                </div>
              </div>
            </div>

            <div class="editor-group">
              <label class="switch-row" for="passport-sheet">
                <input id="passport-sheet" type="checkbox" ${includeSheet ? "checked" : ""} data-sheet />
                <span class="switch" aria-hidden="true"></span>
                <span>Include A4 print sheet</span>
              </label>
              <button type="button" class="button button-primary button-lg button-block" data-run>${icon(
                "Scaling",
                { size: 18 }
              )} ${escapeHtml(tool.action)}</button>
            </div>
          </aside>
        </div>
        <div data-result></div>
      </div>`;
      bindWorkspace();
      drawPreview();
    };

    const drawCrop = (canvas, targetWidth, targetHeight) => {
      const size = dimensions();
      const ratio = size.width / size.height;
      const sourceRatio = loaded.width / loaded.height;
      let baseWidth;
      let baseHeight;
      if (sourceRatio > ratio) {
        baseHeight = loaded.height;
        baseWidth = baseHeight * ratio;
      } else {
        baseWidth = loaded.width;
        baseHeight = baseWidth / ratio;
      }
      baseWidth /= zoom;
      baseHeight /= zoom;
      const maxX = Math.max(0, (loaded.width - baseWidth) / 2);
      const maxY = Math.max(0, (loaded.height - baseHeight) / 2);
      const sourceX = Math.max(0, (loaded.width - baseWidth) / 2 + maxX * (offsetX / 100));
      const sourceY = Math.max(0, (loaded.height - baseHeight) / 2 + maxY * (offsetY / 100));
      canvas.width = Math.max(1, Math.round(targetWidth));
      canvas.height = Math.max(1, Math.round(targetHeight));
      const context = canvas.getContext("2d");
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        loaded.source,
        sourceX,
        sourceY,
        baseWidth,
        baseHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
    };

    const drawPreview = () => {
      const canvas = root.querySelector("[data-passport-preview]");
      if (!canvas) return;
      const size = dimensions();
      const maxWidth = 280;
      const maxHeight = 340;
      let width = maxWidth;
      let height = (width * size.height) / size.width;
      if (height > maxHeight) {
        height = maxHeight;
        width = (height * size.width) / size.height;
      }
      drawCrop(canvas, width * 2, height * 2);
      canvas.style.aspectRatio = `${size.width} / ${size.height}`;
      root.querySelector("[data-passport-frame]").style.setProperty("--photo-ratio", `${size.width}/${size.height}`);
    };

    const bindWorkspace = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) load(selected);
        replaceInput.value = "";
      });
      root.querySelector("[data-preset]").addEventListener("change", (event) => {
        preset = event.target.value;
        const size = dimensions();
        root.querySelector("[data-custom-size]").hidden = preset !== "custom";
        root.querySelector("[data-width]").value = String(size.width);
        root.querySelector("[data-height]").value = String(size.height);
        drawPreview();
      });
      root.querySelector("[data-dpi]").addEventListener("change", (event) => {
        dpi = Number(event.target.value);
      });
      root.querySelector("[data-width]").addEventListener("input", (event) => {
        PRESETS.custom.width = Math.max(15, Number(event.target.value) || 35);
        drawPreview();
      });
      root.querySelector("[data-height]").addEventListener("input", (event) => {
        PRESETS.custom.height = Math.max(15, Number(event.target.value) || 45);
        drawPreview();
      });
      const zoomInput = root.querySelector("[data-zoom]");
      const xInput = root.querySelector("[data-x]");
      const yInput = root.querySelector("[data-y]");
      zoomInput.addEventListener("input", () => {
        zoom = Number(zoomInput.value);
        root.querySelector("[data-zoom-value]").textContent = `${Math.round(zoom * 100)}%`;
        drawPreview();
      });
      xInput.addEventListener("input", () => {
        offsetX = Number(xInput.value);
        root.querySelector("[data-x-value]").textContent = String(offsetX);
        drawPreview();
      });
      yInput.addEventListener("input", () => {
        offsetY = Number(yInput.value);
        root.querySelector("[data-y-value]").textContent = String(offsetY);
        drawPreview();
      });
      root.querySelector("[data-background]").addEventListener("input", (event) => {
        background = event.target.value;
        root.querySelector(".color-hex").textContent = background;
        drawPreview();
      });
      root.querySelector("[data-sheet]").addEventListener("change", (event) => {
        includeSheet = event.target.checked;
      });
      root.querySelector("[data-run]").addEventListener("click", run);
    };

    const run = async () => {
      if (busy) return;
      busy = true;
      const button = root.querySelector("[data-run]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Creating photo…`;
      const started = performance.now();
      try {
        const size = dimensions();
        const photoWidth = Math.round((size.width / 25.4) * dpi);
        const photoHeight = Math.round((size.height / 25.4) * dpi);
        const photoCanvas = makeCanvas(photoWidth, photoHeight);
        drawCrop(photoCanvas, photoWidth, photoHeight);
        const photoBlob = await canvasToBlob(photoCanvas, "image/png");
        const base = sanitizeFilename(file.name, "photo");
        const outputs = [
          {
            blob: photoBlob,
            name: `${base}-passport-${Math.round(size.width)}x${Math.round(size.height)}mm.png`
          }
        ];
        if (includeSheet) {
          const sheetWidth = Math.round((210 / 25.4) * dpi);
          const sheetHeight = Math.round((297 / 25.4) * dpi);
          const gap = Math.round((4 / 25.4) * dpi);
          const margin = Math.round((10 / 25.4) * dpi);
          const sheet = makeCanvas(sheetWidth, sheetHeight);
          const context = sheet.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, sheet.width, sheet.height);
          const columns = Math.max(1, Math.floor((sheet.width - margin * 2 + gap) / (photoWidth + gap)));
          const rowsCount = Math.max(1, Math.floor((sheet.height - margin * 2 + gap) / (photoHeight + gap)));
          const totalWidth = columns * photoWidth + (columns - 1) * gap;
          const totalHeight = rowsCount * photoHeight + (rowsCount - 1) * gap;
          const startX = Math.round((sheet.width - totalWidth) / 2);
          const startY = Math.round((sheet.height - totalHeight) / 2);
          context.strokeStyle = "#d8d5e4";
          context.lineWidth = Math.max(1, dpi / 300);
          for (let row = 0; row < rowsCount; row += 1) {
            for (let col = 0; col < columns; col += 1) {
              const x = startX + col * (photoWidth + gap);
              const y = startY + row * (photoHeight + gap);
              context.drawImage(photoCanvas, x, y);
              context.strokeRect(x, y, photoWidth, photoHeight);
            }
          }
          const sheetBlob = await canvasToBlob(sheet, "image/jpeg", 0.94);
          outputs.push({
            blob: sheetBlob,
            name: `${base}-passport-print-sheet-${dpi}dpi.jpg`
          });
        }
        renderResult(root.querySelector("[data-result]"), outputs, {
          tool,
          inputs: file.size,
          duration: performance.now() - started
        });
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
