import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import { editImage, loadImageSource } from "../../lib/image.js";
import {
  errorMessage,
  escapeHtml,
  formatBytes,
  isImageFile,
  sanitizeFilename
} from "../../lib/utils.js";

const DEFAULTS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  grayscale: 0,
  blur: 0,
  hue: 0,
  rotate: 0,
  flipH: false,
  flipV: false
};

const SLIDERS = [
  { key: "brightness", label: "Brightness", min: 50, max: 150, step: 1, unit: "%" },
  { key: "contrast", label: "Contrast", min: 50, max: 150, step: 1, unit: "%" },
  { key: "saturation", label: "Saturation", min: 0, max: 200, step: 1, unit: "%" },
  { key: "warmth", label: "Warmth", min: 0, max: 80, step: 1, unit: "%" },
  { key: "grayscale", label: "Black & white", min: 0, max: 100, step: 1, unit: "%" },
  { key: "hue", label: "Hue shift", min: -180, max: 180, step: 1, unit: "°" },
  { key: "blur", label: "Soft blur", min: 0, max: 10, step: 0.5, unit: "px" }
];

export default {
  async mount(root, { tool }) {
    let file = null;
    let loaded = null;
    let previewUrl = null;
    let state = { ...DEFAULTS };
    let busy = false;
    let raf = null;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: "image/*",
          title: "Drop a photo to edit",
          subtitle: 'or <span class="text-link">browse your device</span> · JPG, PNG, WebP, GIF, BMP or SVG',
          hint: "A real-time editor that never uploads your photos"
        })}
        <div class="organize-empty-note">${icon("Info", {
          size: 15
        })} Tune light and colour with live previews, then export at full resolution.</div>
      </div>`;
      bindDropzone(root, (files) => {
        const image = files.find(isImageFile);
        if (!image) {
          toast("Please choose an image file.", { type: "error" });
          return;
        }
        loadImage(image);
      });
    };

    const loadImage = async (selected) => {
      file = selected;
      root.innerHTML = `<div class="workspace-card"><div class="custom-loading">${icon(
        "LoaderCircle",
        { size: 22, className: "spin" }
      )} Opening your photo…</div></div>`;
      try {
        loaded?.dispose?.();
        loaded = await loadImageSource(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        state = { ...DEFAULTS };
        renderWorkspace();
      } catch (error) {
        toast(errorMessage(error), { type: "error" });
        renderInitial();
      }
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card editor-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("SlidersHorizontal", { size: 22 })}</span>
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <span>${loaded.width} × ${loaded.height} px · ${formatBytes(file.size)}</span>
            </div>
          </div>
          <div class="organize-toolbar-actions">
            <button type="button" class="button button-ghost button-sm" data-reset-edits>${icon(
              "RotateCcw",
              { size: 15 }
            )} Reset</button>
            <button type="button" class="icon-button icon-button-sm" data-replace aria-label="Choose another image">${icon(
              "RefreshCw",
              { size: 17 }
            )}</button>
          </div>
          <input type="file" accept="image/*" hidden data-replace-input />
        </div>

        <div class="editor-layout">
          <div class="editor-preview-area">
            <div class="editor-stage">
              <canvas data-editor-preview aria-label="Edited image preview"></canvas>
            </div>
            <div class="editor-hint">${icon("Info", { size: 14 })} Preview is scaled for speed — export uses the full-resolution original.</div>
          </div>
          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("Sun", { size: 15 })} Light &amp; colour</span>
              ${SLIDERS.map(
                (slider) => `<div class="field field-range editor-slider">
                  <div class="range-head">
                    <label class="field-label" for="edit-${slider.key}">${slider.label}</label>
                    <output data-value="${slider.key}">${state[slider.key]}${slider.unit}</output>
                  </div>
                  <input id="edit-${slider.key}" type="range" min="${slider.min}" max="${slider.max}" step="${slider.step}" value="${state[slider.key]}" data-slider="${slider.key}" />
                </div>`
              ).join("")}
            </div>

            <div class="editor-group">
              <span class="editor-group-title">${icon("RotateCw", { size: 15 })} Orientation</span>
              <div class="editor-orientation">
                <button type="button" class="icon-button" data-rotate="-90" aria-label="Rotate left">${icon(
                  "RotateCcw",
                  { size: 18 }
                )}</button>
                <button type="button" class="icon-button" data-rotate="90" aria-label="Rotate right">${icon(
                  "RotateCw",
                  { size: 18 }
                )}</button>
                <button type="button" class="icon-button" data-flip="h" aria-label="Flip horizontally">${icon(
                  "FlipHorizontal2",
                  { size: 18 }
                )}</button>
                <button type="button" class="icon-button" data-flip="v" aria-label="Flip vertically">${icon(
                  "FlipVertical2",
                  { size: 18 }
                )}</button>
                <span class="orientation-value" data-orientation>0°</span>
              </div>
            </div>

            <div class="editor-group editor-export">
              <div class="field">
                <label class="field-label" for="edit-format">Export as</label>
                <div class="select-wrap">
                  <select id="edit-format" data-format>
                    <option value="png">PNG — lossless</option>
                    <option value="jpg">JPG — smaller</option>
                    <option value="webp">WebP — modern</option>
                  </select>
                  ${icon("ChevronDown", { size: 16 })}
                </div>
              </div>
              <div class="field field-range" data-quality-field style="opacity:.45">
                <div class="range-head">
                  <label class="field-label" for="edit-quality">Quality</label>
                  <output data-quality-value>92%</output>
                </div>
                <input id="edit-quality" type="range" min="0.5" max="1" step="0.02" value="0.92" data-quality />
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
      bindEditor();
      drawPreview();
    };

    const bindEditor = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) loadImage(selected);
        replaceInput.value = "";
      });

      root.querySelectorAll("[data-slider]").forEach((slider) => {
        slider.addEventListener("input", () => {
          state[slider.dataset.slider] = Number(slider.value);
          root.querySelector(`[data-value="${slider.dataset.slider}"]`).textContent = `${
            slider.value
          }${SLIDERS.find((item) => item.key === slider.dataset.slider)?.unit || ""}`;
          schedulePreview();
        });
      });

      root.querySelectorAll("[data-rotate]").forEach((button) => {
        button.addEventListener("click", () => {
          state.rotate = (state.rotate + Number(button.dataset.rotate) + 360) % 360;
          updateOrientationLabel();
          schedulePreview();
        });
      });
      root.querySelectorAll("[data-flip]").forEach((button) => {
        button.addEventListener("click", () => {
          if (button.dataset.flip === "h") state.flipH = !state.flipH;
          else state.flipV = !state.flipV;
          button.classList.toggle("is-active");
          updateOrientationLabel();
          schedulePreview();
        });
      });

      root.querySelector("[data-reset-edits]").addEventListener("click", () => {
        state = { ...DEFAULTS };
        root.querySelectorAll("[data-slider]").forEach((slider) => {
          slider.value = state[slider.dataset.slider];
        });
        root.querySelectorAll("[data-value]").forEach((output) => {
          const item = SLIDERS.find((slider) => slider.key === output.dataset.value);
          if (item) output.textContent = `${state[item.key]}${item.unit}`;
        });
        root.querySelectorAll("[data-flip]").forEach((button) => button.classList.remove("is-active"));
        updateOrientationLabel();
        schedulePreview();
      });

      root.querySelector("[data-format]").addEventListener("change", (event) => {
        root.querySelector("[data-quality-field]").style.opacity =
          event.target.value === "png" ? "0.45" : "1";
      });
      root.querySelector("[data-quality]").addEventListener("input", (event) => {
        root.querySelector("[data-quality-value]").textContent = `${Math.round(
          Number(event.target.value) * 100
        )}%`;
      });

      root.querySelector("[data-export]").addEventListener("click", exportImage);
    };

    const updateOrientationLabel = () => {
      const label = root.querySelector("[data-orientation]");
      if (label) {
        label.textContent = `${state.rotate}°${state.flipH ? " · flipped H" : ""}${
          state.flipV ? " · flipped V" : ""
        }`;
      }
    };

    const filterString = () =>
      [
        `brightness(${state.brightness}%)`,
        `contrast(${state.contrast}%)`,
        `saturate(${state.saturation}%)`,
        `sepia(${state.warmth}%)`,
        `grayscale(${state.grayscale}%)`,
        `blur(${state.blur}px)`,
        `hue-rotate(${state.hue}deg)`
      ].join(" ");

    const drawPreview = () => {
      raf = null;
      const canvas = root.querySelector("[data-editor-preview]");
      if (!canvas || !loaded) return;
      const swap = state.rotate === 90 || state.rotate === 270;
      const fullWidth = swap ? loaded.height : loaded.width;
      const fullHeight = swap ? loaded.width : loaded.height;
      const scale = Math.min(1, 1250 / Math.max(fullWidth, fullHeight));
      canvas.width = Math.max(1, Math.round(fullWidth * scale));
      canvas.height = Math.max(1, Math.round(fullHeight * scale));
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      const drawWidth = loaded.width * scale;
      const drawHeight = loaded.height * scale;
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((state.rotate * Math.PI) / 180);
      context.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
      context.filter = filterString();
      context.drawImage(loaded.source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.restore();
    };

    const schedulePreview = () => {
      if (raf) return;
      raf = requestAnimationFrame(drawPreview);
    };

    const exportImage = async () => {
      if (busy) return;
      busy = true;
      const button = root.querySelector("[data-export]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Rendering…`;
      const resultEl = root.querySelector("[data-result]");
      const format = root.querySelector("[data-format]").value;
      const quality = Number(root.querySelector("[data-quality]").value);
      try {
        const result = await editImage(file, state, { format, quality });
        result.name = `${sanitizeFilename(file.name, "image")}-edited.${format}`;
        renderResult(resultEl, [result], {
          tool,
          inputs: file.size,
          onReset: () => {
            loaded?.dispose?.();
            loaded = null;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = null;
            file = null;
            renderInitial();
          }
        });
      } catch (error) {
        console.error(error);
        toast(errorMessage(error), { type: "error" });
      } finally {
        busy = false;
        button.disabled = false;
        button.innerHTML = previous;
      }
    };

    renderInitial();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      loaded?.dispose?.();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }
};
