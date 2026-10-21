import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import { cropImage, loadImageSource } from "../../lib/image.js";
import {
  clamp,
  errorMessage,
  escapeHtml,
  formatBytes,
  isImageFile,
  sanitizeFilename
} from "../../lib/utils.js";

const ASPECTS = [
  { label: "Free", value: "free" },
  { label: "1:1", value: "1" },
  { label: "4:3", value: String(4 / 3) },
  { label: "3:2", value: "1.5" },
  { label: "16:9", value: String(16 / 9) },
  { label: "9:16", value: String(9 / 16) }
];

export default {
  async mount(root, { tool }) {
    let file = null;
    let previewUrl = null;
    let imageWidth = 0;
    let imageHeight = 0;
    let crop = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 };
    let aspect = "free";
    let drag = null;
    let busy = false;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: "image/*",
          title: "Drop an image to crop",
          subtitle: 'or <span class="text-link">browse your device</span> · JPG, PNG, WebP, GIF, BMP or SVG',
          hint: "The crop happens on this device at full resolution"
        })}
        <div class="organize-empty-note">${icon("Info", {
          size: 15
        })} Drag the frame to reposition, pull a handle to resize, or pick an aspect ratio.</div>
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
      )} Opening your image…</div></div>`;
      try {
        const loaded = await loadImageSource(file);
        imageWidth = loaded.width;
        imageHeight = loaded.height;
        loaded.dispose();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        crop = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 };
        aspect = "free";
        renderWorkspace();
      } catch (error) {
        toast(errorMessage(error), { type: "error" });
        renderInitial();
      }
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card crop-editor-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("ImagePlus", { size: 22 })}</span>
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <span>${imageWidth} × ${imageHeight} px · ${formatBytes(file.size)}</span>
            </div>
          </div>
          <div class="organize-toolbar-actions">
            <button type="button" class="button button-ghost button-sm" data-reset-crop>${icon(
              "RotateCcw",
              { size: 15 }
            )} Reset crop</button>
            <button type="button" class="icon-button icon-button-sm" data-replace aria-label="Choose another image">${icon(
              "RefreshCw",
              { size: 17 }
            )}</button>
          </div>
          <input type="file" accept="image/*" hidden data-replace-input />
        </div>

        <div class="crop-layout">
          <div class="crop-canvas-area">
            <div class="crop-stage" data-stage>
              <div class="crop-image-wrap" data-image-wrap>
                <img src="${previewUrl}" alt="${escapeHtml(file.name)}" draggable="false" data-crop-image />
                <div class="crop-overlay" data-overlay>
                  <div class="crop-grid" aria-hidden="true"></div>
                  ${["nw", "n", "ne", "e", "se", "s", "sw", "w"]
                    .map(
                      (handle) =>
                        `<span class="crop-handle handle-${handle}" data-handle="${handle}" aria-hidden="true"></span>`
                    )
                    .join("")}
                </div>
              </div>
            </div>
            <div class="crop-readout">
              <span>${icon("Crop", { size: 14 })} <strong data-crop-size>—</strong></span>
              <span data-crop-ratio>Free crop</span>
            </div>
          </div>

          <aside class="crop-controls">
            <div class="field field-wide">
              <span class="field-label">Aspect ratio</span>
              <div class="aspect-chips">
                ${ASPECTS.map(
                  (item) =>
                    `<button type="button" class="chip ${item.value === "free" ? "is-active" : ""}" data-aspect="${item.value}">${item.label}</button>`
                ).join("")}
              </div>
            </div>
            <div class="field">
              <label class="field-label" for="crop-format">Output format</label>
              <div class="select-wrap">
                <select id="crop-format" data-crop-format>
                  <option value="png">PNG — lossless</option>
                  <option value="jpg">JPG — smaller</option>
                  <option value="webp">WebP — modern</option>
                </select>
                ${icon("ChevronDown", { size: 16 })}
              </div>
            </div>
            <div class="field field-range">
              <div class="range-head">
                <label class="field-label" for="crop-quality">Quality</label>
                <output data-quality-value>92%</output>
              </div>
              <input id="crop-quality" type="range" min="0.5" max="1" step="0.02" value="0.92" data-crop-quality />
            </div>
            <div class="crop-tip">${icon("Info", {
              size: 14
            })} Cropping exports a new file. Your original is never changed.</div>
            <button type="button" class="button button-primary button-lg button-block" data-crop>${icon(
              "Crop",
              { size: 18 }
            )} ${escapeHtml(tool.action)}</button>
          </aside>
        </div>
        <div data-result></div>
      </div>`;
      bindEditor();
      renderCrop();
    };

    const bindEditor = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) loadImage(selected);
        replaceInput.value = "";
      });

      root.querySelector("[data-reset-crop]").addEventListener("click", () => {
        crop = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 };
        aspect = "free";
        root.querySelectorAll("[data-aspect]").forEach((chip) => {
          chip.classList.toggle("is-active", chip.dataset.aspect === "free");
        });
        renderCrop();
      });

      root.querySelectorAll("[data-aspect]").forEach((chip) => {
        chip.addEventListener("click", () => {
          aspect = chip.dataset.aspect;
          root.querySelectorAll("[data-aspect]").forEach((item) => {
            item.classList.toggle("is-active", item === chip);
          });
          if (aspect !== "free") fitAspect(Number(aspect));
          renderCrop();
        });
      });

      root.querySelector("[data-crop-format]").addEventListener("change", (event) => {
        const qualityField = root.querySelector("[data-crop-quality]").closest(".field-range");
        qualityField.style.opacity = event.target.value === "png" ? "0.45" : "1";
      });
      root.querySelector("[data-crop-quality]").addEventListener("input", (event) => {
        root.querySelector("[data-quality-value]").textContent = `${Math.round(
          Number(event.target.value) * 100
        )}%`;
      });

      const stage = root.querySelector("[data-stage]");
      const imageWrap = root.querySelector("[data-image-wrap]");
      const overlay = root.querySelector("[data-overlay]");
      overlay.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 && event.pointerType === "mouse") return;
        event.preventDefault();
        const handle = event.target.closest("[data-handle]")?.dataset.handle || "move";
        const rect = imageWrap.getBoundingClientRect();
        drag = {
          handle,
          startX: event.clientX,
          startY: event.clientY,
          rect,
          start: { ...crop },
          aspect: aspect === "free" ? null : Number(aspect)
        };
        stage.setPointerCapture?.(event.pointerId);
        overlay.classList.add("is-dragging");
      });
      stage.addEventListener("pointermove", (event) => {
        if (!drag) return;
        event.preventDefault();
        const dx = (event.clientX - drag.startX) / drag.rect.width;
        const dy = (event.clientY - drag.startY) / drag.rect.height;
        const next = { ...drag.start };
        const handle = drag.handle;
        if (handle === "move") {
          next.x = clamp(drag.start.x + dx, 0, 1 - drag.start.w);
          next.y = clamp(drag.start.y + dy, 0, 1 - drag.start.h);
        } else {
          if (handle.includes("w")) {
            const right = drag.start.x + drag.start.w;
            next.x = clamp(drag.start.x + dx, 0, right - 0.03);
            next.w = right - next.x;
          }
          if (handle.includes("e")) {
            next.w = clamp(drag.start.w + dx, 0.03, 1 - drag.start.x);
          }
          if (handle.includes("n")) {
            const bottom = drag.start.y + drag.start.h;
            next.y = clamp(drag.start.y + dy, 0, bottom - 0.03);
            next.h = bottom - next.y;
          }
          if (handle.includes("s")) {
            next.h = clamp(drag.start.h + dy, 0.03, 1 - drag.start.y);
          }
          if (drag.aspect) {
            applyAspectToCrop(next, handle, drag.aspect);
          }
        }
        crop = {
          x: clamp(next.x, 0, Math.max(0, 1 - next.w)),
          y: clamp(next.y, 0, Math.max(0, 1 - next.h)),
          w: clamp(next.w, 0.03, 1),
          h: clamp(next.h, 0.03, 1)
        };
        renderCrop();
      });
      const endDrag = (event) => {
        if (!drag) return;
        drag = null;
        overlay.classList.remove("is-dragging");
        try {
          stage.releasePointerCapture?.(event.pointerId);
        } catch {
          /* ignore */
        }
      };
      stage.addEventListener("pointerup", endDrag);
      stage.addEventListener("pointercancel", endDrag);

      root.querySelector("[data-crop]").addEventListener("click", exportCrop);
    };

    const applyAspectToCrop = (next, handle, pixelRatio) => {
      const fracRatio = (pixelRatio * imageHeight) / imageWidth;
      const anchorRight = handle.includes("w");
      const anchorBottom = handle.includes("n");
      const anchorX = anchorRight ? drag.start.x + drag.start.w : drag.start.x;
      const anchorY = anchorBottom ? drag.start.y + drag.start.h : drag.start.y;
      if (handle.includes("e") || handle.includes("w") || handle.includes("n") || handle.includes("s")) {
        if (handle.includes("e") || handle.includes("w")) {
          next.h = next.w / fracRatio;
        } else {
          next.w = next.h * fracRatio;
        }
        next.x = anchorRight ? anchorX - next.w : anchorX;
        next.y = anchorBottom ? anchorY - next.h : anchorY;
        if (next.x < 0) {
          next.x = 0;
          next.w = anchorX;
          next.h = next.w / fracRatio;
        }
        if (next.y < 0) {
          next.y = 0;
          next.h = anchorY;
          next.w = next.h * fracRatio;
        }
        if (next.x + next.w > 1) {
          next.w = 1 - next.x;
          next.h = next.w / fracRatio;
        }
        if (next.y + next.h > 1) {
          next.h = 1 - next.y;
          next.w = next.h * fracRatio;
        }
      }
    };

    const fitAspect = (pixelRatio) => {
      const fracRatio = (pixelRatio * imageHeight) / imageWidth;
      const centerX = crop.x + crop.w / 2;
      const centerY = crop.y + crop.h / 2;
      let width = Math.min(0.9, 0.9 * fracRatio);
      let height = width / fracRatio;
      if (height > 0.9) {
        height = 0.9;
        width = height * fracRatio;
      }
      crop = {
        w: width,
        h: height,
        x: clamp(centerX - width / 2, 0, 1 - width),
        y: clamp(centerY - height / 2, 0, 1 - height)
      };
    };

    const renderCrop = () => {
      const overlay = root.querySelector("[data-overlay]");
      if (!overlay) return;
      overlay.style.left = `${crop.x * 100}%`;
      overlay.style.top = `${crop.y * 100}%`;
      overlay.style.width = `${crop.w * 100}%`;
      overlay.style.height = `${crop.h * 100}%`;
      const width = Math.max(1, Math.round(crop.w * imageWidth));
      const height = Math.max(1, Math.round(crop.h * imageHeight));
      const sizeEl = root.querySelector("[data-crop-size]");
      if (sizeEl) sizeEl.textContent = `${width} × ${height} px`;
      const ratioEl = root.querySelector("[data-crop-ratio]");
      if (ratioEl) {
        if (aspect === "free") {
          ratioEl.textContent = "Free crop";
        } else {
          const label = ASPECTS.find((item) => item.value === aspect)?.label || "";
          ratioEl.textContent = `${label} aspect`;
        }
      }
    };

    const exportCrop = async () => {
      if (busy) return;
      busy = true;
      const button = root.querySelector("[data-crop]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Cropping…`;
      const resultEl = root.querySelector("[data-result]");
      try {
        const format = root.querySelector("[data-crop-format]").value;
        const quality = Number(root.querySelector("[data-crop-quality]").value);
        const sourceCrop = {
          x: Math.round(crop.x * imageWidth),
          y: Math.round(crop.y * imageHeight),
          width: Math.max(1, Math.round(crop.w * imageWidth)),
          height: Math.max(1, Math.round(crop.h * imageHeight))
        };
        sourceCrop.width = Math.min(sourceCrop.width, imageWidth - sourceCrop.x);
        sourceCrop.height = Math.min(sourceCrop.height, imageHeight - sourceCrop.y);
        const result = await cropImage(file, sourceCrop, { format, quality });
        result.name = `${sanitizeFilename(file.name, "image")}-${sourceCrop.width}x${sourceCrop.height}.${format}`;
        renderResult(resultEl, [result], {
          tool,
          inputs: file.size,
          onReset: () => {
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
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    };
  }
};
