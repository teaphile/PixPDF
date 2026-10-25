import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import { advancedPanelMarkup, mountAdvancedPanel } from "../../ui/advanced-panel.js";
import {
  canvasToBlob,
  errorMessage,
  escapeHtml,
  formatBytes,
  isImageFile,
  sanitizeFilename
} from "../../lib/utils.js";
import {
  drawSource,
  formatFromFile,
  loadImageSource,
  makeCanvas,
  mimeFor
} from "../../lib/image.js";
import { readImageMetadata, setImageDpi } from "../../lib/image-metadata.js";

const formatValue = (value) => {
  if (value === undefined || value === null || value === "") return "";
  if (value instanceof Date) return value.toLocaleString();
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  return String(value);
};

export default {
  async mount(root, { tool }) {
    let file = null;
    let loaded = null;
    let previewUrl = null;
    let metadata = {};
    let strip = true;
    let setDpi = true;
    let dpi = 300;
    let format = "keep";
    let busy = false;
    let advanced = null;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: "image/*",
          title: "Drop an image to inspect",
          subtitle: 'or <span class="text-link">browse your device</span> · one image at a time',
          hint: "See hidden EXIF and GPS data, then clean it locally"
        })}
        <div class="organize-empty-note">${icon("Info", {
          size: 15
        })} Camera metadata, GPS location and colour profiles can stay hidden inside ordinary photos.</div>
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
      )} Reading metadata…</div></div>`;
      try {
        loaded?.dispose?.();
        loaded = await loadImageSource(file);
        metadata = await readImageMetadata(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        renderWorkspace();
      } catch (error) {
        toast(errorMessage(error), { type: "error" });
        renderInitial();
      }
    };

    const rows = () => {
      const camera = [metadata.Make, metadata.Model].filter(Boolean).join(" ");
      return [
        ["Camera", camera],
        ["Lens", metadata.LensModel || metadata.Lens],
        ["Taken", metadata.DateTimeOriginal || metadata.CreateDate || metadata.ModifyDate],
        ["Exposure", metadata.ExposureTime ? `${metadata.ExposureTime} s` : ""],
        ["Aperture", metadata.FNumber ? `f/${metadata.FNumber}` : ""],
        ["ISO", metadata.ISO || metadata.ISOSpeedRatings],
        ["Focal length", metadata.FocalLength ? `${metadata.FocalLength} mm` : ""],
        ["Orientation", metadata.Orientation],
        ["Colour space", metadata.ColorSpace],
        ["GPS latitude", metadata.latitude],
        ["GPS longitude", metadata.longitude],
        ["Software", metadata.Software],
        ["Artist", metadata.Artist],
        ["Copyright", metadata.Copyright]
      ]
        .map(([label, value]) => [label, formatValue(value)])
        .filter(([, value]) => value);
    };

    const renderWorkspace = () => {
      const info = rows();
      const hasGps = metadata.latitude !== undefined && metadata.longitude !== undefined;
      root.innerHTML = `<div class="workspace-card metadata-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("Info", { size: 22 })}</span>
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

        <div class="metadata-layout">
          <div class="metadata-preview">
            <img src="${previewUrl}" alt="Image preview" />
            ${
              hasGps
                ? `<div class="metadata-gps-warning">${icon("Globe", {
                    size: 15
                  })} This photo contains GPS coordinates (${escapeHtml(
                    formatValue(metadata.latitude)
                  )}, ${escapeHtml(formatValue(metadata.longitude))}).</div>`
                : ""
            }
            <div class="metadata-table">
              <div class="metadata-row"><span>File type</span><strong>${escapeHtml(
                (file.type || formatFromFile(file)).replace("image/", "").toUpperCase()
              )}</strong></div>
              <div class="metadata-row"><span>Dimensions</span><strong>${loaded.width} × ${loaded.height} px</strong></div>
              <div class="metadata-row"><span>File size</span><strong>${formatBytes(file.size)}</strong></div>
              ${info
                .map(
                  ([label, value]) =>
                    `<div class="metadata-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(
                      value
                    )}</strong></div>`
                )
                .join("")}
              ${
                info.length
                  ? ""
                  : `<div class="metadata-empty">${icon("ShieldCheck", {
                      size: 16
                    })} No hidden camera or location metadata found.</div>`
              }
            </div>
          </div>

          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("ShieldCheck", { size: 15 })} Privacy</span>
              <label class="switch-row" for="meta-strip">
                <input id="meta-strip" type="checkbox" ${strip ? "checked" : ""} data-strip />
                <span class="switch" aria-hidden="true"></span>
                <span>Remove all hidden metadata</span>
              </label>
              <p class="editor-hint">Re-encoding clears EXIF, GPS, camera details and embedded profiles.</p>
            </div>

            <div class="editor-group">
              <span class="editor-group-title">${icon("Scaling", { size: 15 })} Print resolution</span>
              <label class="switch-row" for="meta-dpi">
                <input id="meta-dpi" type="checkbox" ${setDpi ? "checked" : ""} data-set-dpi />
                <span class="switch" aria-hidden="true"></span>
                <span>Set DPI</span>
              </label>
              <div class="field" data-dpi-field>
                <label class="field-label" for="meta-dpi-value">DPI</label>
                <input id="meta-dpi-value" class="input" type="number" min="36" max="1200" value="${dpi}" data-dpi-value />
              </div>
              <div class="field">
                <label class="field-label" for="meta-format">Output format</label>
                <div class="select-wrap">
                  <select id="meta-format" data-format>
                    <option value="keep">Keep original (${formatFromFile(file).toUpperCase()})</option>
                    <option value="jpg">JPG</option>
                    <option value="png">PNG</option>
                    <option value="webp">WebP</option>
                  </select>
                  ${icon("ChevronDown", { size: 16 })}
                </div>
              </div>
              <button type="button" class="button button-primary button-lg button-block" data-run>${icon(
                "Download",
                { size: 18 }
              )} ${escapeHtml(tool.action)}</button>
            </div>
          </aside>
        </div>
        ${advancedPanelMarkup(tool)}
        <div data-result></div>
      </div>`;
      bindWorkspace();
      advanced = mountAdvancedPanel(root, tool);
    };

    const bindWorkspace = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) load(selected);
        replaceInput.value = "";
      });
      root.querySelector("[data-strip]").addEventListener("change", (event) => {
        strip = event.target.checked;
      });
      const dpiField = root.querySelector("[data-dpi-field]");
      root.querySelector("[data-set-dpi]").addEventListener("change", (event) => {
        setDpi = event.target.checked;
        dpiField.style.opacity = setDpi ? "1" : "0.45";
      });
      root.querySelector("[data-dpi-value]").addEventListener("input", (event) => {
        dpi = Math.max(36, Math.min(1200, Number(event.target.value) || 300));
      });
      root.querySelector("[data-format]").addEventListener("change", (event) => {
        format = event.target.value;
      });
      root.querySelector("[data-run]").addEventListener("click", run);
    };

    const run = async () => {
      if (busy) return;
      busy = true;
      const button = root.querySelector("[data-run]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Saving…`;
      const started = performance.now();
      try {
        const originalFormat = formatFromFile(file);
        const targetFormat = format === "keep" ? originalFormat : format === "jpg" ? "jpg" : format;
        let blob;
        let extension = targetFormat;
        const extra = advanced?.values || {};
        const maxWidth = Number(extra.maxWidth) || 0;
        const rebuildWidth = maxWidth > 0 && maxWidth < loaded.width ? maxWidth : loaded.width;
        const rebuildHeight = Math.round((loaded.height * rebuildWidth) / loaded.width);
        if (!strip && format === "keep" && rebuildWidth === loaded.width) {
          blob = file;
        } else {
          const canvas = makeCanvas(rebuildWidth, rebuildHeight);
          const context = canvas.getContext("2d");
          if (targetFormat === "jpg") {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
          drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
          blob = await canvasToBlob(
            canvas,
            mimeFor(targetFormat),
            targetFormat === "png" ? undefined : 0.92
          );
          extension = targetFormat;
          canvas.width = 1;
          canvas.height = 1;
        }
        if (setDpi) {
          blob = await setImageDpi(blob, dpi);
        }
        const suffix = strip ? "-clean" : "-metadata";
        const base = sanitizeFilename(file.name, "image");
        renderResult(
          root.querySelector("[data-result]"),
          [{ blob, name: `${base}${suffix}.${extension}` }],
          { tool, inputs: file.size, duration: performance.now() - started, outputOptions: advanced?.values }
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
      loaded?.dispose?.();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      loaded = null;
      previewUrl = null;
    };
  }
};
