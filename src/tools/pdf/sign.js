import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, createProgress, dropzoneMarkup, renderResult } from "../../ui/result.js";
import { advancedPanelMarkup, mountAdvancedPanel } from "../../ui/advanced-panel.js";
import {
  StandardFonts,
  embedSignatureImage,
  getPdfPageCount,
  openPdf,
  renderPdfPagePreview,
  rgb,
  savePdf,
  withDisplaySpace
} from "../../lib/pdf.js";
import {
  errorMessage,
  escapeHtml,
  formatBytes,
  isPdfFile,
  sanitizeFilename
} from "../../lib/utils.js";

const POSITIONS = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-center", label: "Top center" },
  { value: "top-left", label: "Top left" }
];

export default {
  async mount(root, { tool }) {
    let file = null;
    let pageCount = 0;
    let busy = false;
    let advanced = null;
    let strokes = [];
    let uploadedImage = null;
    let drawing = false;
    let activeStroke = null;
    let previewUrl = null;
    let previewTimer = null;
    let padCanvas = null;
    let padContext = null;
    let padObserver = null;
    let dpr = 1;

    const state = {
      pageMode: "last",
      customPage: 1,
      position: "bottom-right",
      size: 22,
      margin: 40,
      color: "#1f2940",
      width: 3,
      password: ""
    };

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: ".pdf,application/pdf",
          title: "Drop a PDF to sign",
          subtitle: 'or <span class="text-link">browse your device</span> · one file at a time',
          hint: "Draw your signature privately on this device"
        })}
        <div class="organize-empty-note">${icon("Info", {
          size: 15
        })} You'll draw your signature, choose where it goes, then download a signed copy.</div>
      </div>`;
      bindDropzone(root, (files) => {
        const pdf = files.find(isPdfFile);
        if (!pdf) {
          toast("Please choose a PDF file.", { type: "error" });
          return;
        }
        loadPdf(pdf);
      });
    };

    const renderPasswordPrompt = (message = "") => {
      root.innerHTML = `<div class="workspace-card">
        <div class="password-prompt">
          <div class="password-prompt-icon">${icon("Lock", { size: 22 })}</div>
          <div class="password-prompt-body">
            <strong>This PDF needs a password</strong>
            <p>${escapeHtml(message || "Enter the document password to continue.")} The password stays in this tab.</p>
            <div class="password-prompt-row">
              <input class="input" type="password" autocomplete="current-password" placeholder="PDF password" data-sign-password />
              <button type="button" class="button button-primary" data-sign-password-submit>${icon("LockOpen", {
                size: 16
              })} Open PDF</button>
            </div>
          </div>
        </div>
      </div>`;
      const input = root.querySelector("[data-sign-password]");
      const submit = () => {
        const password = input.value;
        if (!password) {
          input.focus();
          return;
        }
        state.password = password;
        loadPdf(file);
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") submit();
      });
      root.querySelector("[data-sign-password-submit]").addEventListener("click", submit);
      requestAnimationFrame(() => input.focus());
    };

    const loadPdf = async (selected) => {
      if (selected !== file) state.password = "";
      file = selected;
      state.pageMode = "last";
      state.customPage = 1;
      previewUrl = null;
      root.innerHTML = `<div class="workspace-card">
        <div class="custom-loading">${icon("LoaderCircle", {
          size: 22,
          className: "spin"
        })} Preparing your signing workspace…</div>
      </div>`;
      try {
        pageCount = await getPdfPageCount(file, state.password);
        renderWorkspace();
      } catch (error) {
        console.error(error);
        if (/password|encrypted|decrypt/i.test(String(error?.message || ""))) {
          renderPasswordPrompt(errorMessage(error));
          return;
        }
        toast(errorMessage(error), { type: "error" });
        renderInitial();
      }
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card sign-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("FileText", { size: 22 })}</span>
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

        <div class="sign-layout">
          <div class="sign-pad-card">
            <div class="sign-pad-head">
              <div>
                <h3>${icon("PenTool", { size: 18 })} Draw your signature</h3>
                <p>Use a finger, mouse or stylus.</p>
              </div>
              <button type="button" class="text-button" data-clear-signature>${icon("Trash2", {
                size: 14
              })} Clear</button>
            </div>
            <div class="sign-pad-wrap">
              <canvas class="sign-pad" data-sign-pad aria-label="Signature drawing pad"></canvas>
              <span class="sign-pad-baseline">Sign above the line</span>
            </div>
            <div class="sign-pad-tools">
              <label class="inline-field">Colour <input type="color" value="${state.color}" data-sign-color /></label>
              <label class="inline-field inline-range">Thickness
                <input type="range" min="1.5" max="7" step="0.5" value="${state.width}" data-sign-width />
              </label>
              <button type="button" class="button button-ghost button-sm" data-upload-signature>${icon(
                "Upload",
                { size: 15 }
              )} Upload image</button>
              <input type="file" accept="image/png,image/jpeg" hidden data-sign-upload />
            </div>
          </div>

          <div class="sign-options">
            <div class="field">
              <label class="field-label" for="sign-page-mode">Apply to</label>
              <div class="select-wrap">
                <select id="sign-page-mode" data-page-mode>
                  <option value="last">Last page</option>
                  <option value="first">First page</option>
                  <option value="custom">Custom page</option>
                  <option value="all">Every page</option>
                </select>
                ${icon("ChevronDown", { size: 16 })}
              </div>
            </div>
            <div class="field" data-custom-page hidden>
              <label class="field-label" for="sign-page-number">Page number</label>
              <input id="sign-page-number" class="input" type="number" min="1" max="${pageCount}" value="1" data-page-number />
            </div>
            <div class="field">
              <label class="field-label" for="sign-position">Position</label>
              <div class="select-wrap">
                <select id="sign-position" data-position>
                  ${POSITIONS.map(
                    (position) =>
                      `<option value="${position.value}" ${
                        position.value === state.position ? "selected" : ""
                      }>${position.label}</option>`
                  ).join("")}
                </select>
                ${icon("ChevronDown", { size: 16 })}
              </div>
            </div>
            <div class="field field-range">
              <div class="range-head">
                <label class="field-label" for="sign-size">Signature size</label>
                <output data-size-value>${state.size}% of page width</output>
              </div>
              <input id="sign-size" type="range" min="6" max="55" step="1" value="${state.size}" data-size />
            </div>
            <div class="field field-range">
              <div class="range-head">
                <label class="field-label" for="sign-margin">Margin</label>
                <output data-margin-value>${state.margin} pt</output>
              </div>
              <input id="sign-margin" type="range" min="8" max="120" step="2" value="${state.margin}" data-margin />
            </div>
            <div class="sign-preview-card">
              <div class="sign-preview-head">
                <span>Preview</span>
                <span data-preview-page>Page ${pageCount}</span>
              </div>
              <div class="sign-preview" data-sign-preview>
                <span class="preview-loading">${icon("LoaderCircle", {
                  size: 18,
                  className: "spin"
                })}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="run-zone">
          <button type="button" class="button button-primary button-lg" data-apply>${icon("PenTool", {
            size: 18
          })} ${escapeHtml(tool.action)}</button>
          <p class="run-note">${icon("ShieldCheck", { size: 14 })} Signature and PDF never leave this device.</p>
        </div>
        ${advancedPanelMarkup(tool)}
        <div data-result></div>
      </div>`;
      bindWorkspace();
      advanced = mountAdvancedPanel(root, tool);
      setupPad();
      updatePreview();
    };

    const setupPad = () => {
      padObserver?.disconnect();
      padCanvas = root.querySelector("[data-sign-pad]");
      padContext = padCanvas.getContext("2d");
      resizePad();
      padObserver = new ResizeObserver(() => {
        resizePad();
      });
      padObserver.observe(padCanvas.parentElement);

      const position = (event) => {
        const rect = padCanvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      };

      padCanvas.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        padCanvas.setPointerCapture(event.pointerId);
        if (uploadedImage) {
          uploadedImage = null;
          strokes = [];
        }
        drawing = true;
        activeStroke = {
          color: state.color,
          width: state.width,
          points: [position(event)]
        };
        strokes.push(activeStroke);
        drawPad();
      });
      padCanvas.addEventListener("pointermove", (event) => {
        if (!drawing || !activeStroke) return;
        event.preventDefault();
        activeStroke.points.push(position(event));
        drawPad();
        schedulePreviewUpdate();
      });
      const finish = (event) => {
        if (!drawing) return;
        drawing = false;
        activeStroke = null;
        try {
          padCanvas.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        schedulePreviewUpdate();
      };
      padCanvas.addEventListener("pointerup", finish);
      padCanvas.addEventListener("pointercancel", finish);
      padCanvas.addEventListener("pointerleave", (event) => {
        if (drawing && event.buttons === 0) finish(event);
      });
    };

    const resizePad = () => {
      if (!padCanvas) return;
      const rect = padCanvas.getBoundingClientRect();
      if (!rect.width) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      padCanvas.width = Math.round(rect.width * dpr);
      padCanvas.height = Math.round(rect.height * dpr);
      drawPad();
    };

    const drawPad = () => {
      if (!padContext || !padCanvas) return;
      padContext.clearRect(0, 0, padCanvas.width, padCanvas.height);
      padContext.lineCap = "round";
      padContext.lineJoin = "round";

      if (uploadedImage) {
        const scale = Math.min(
          (padCanvas.width * 0.82) / uploadedImage.width,
          (padCanvas.height * 0.72) / uploadedImage.height
        );
        const width = uploadedImage.width * scale;
        const height = uploadedImage.height * scale;
        padContext.drawImage(
          uploadedImage,
          (padCanvas.width - width) / 2,
          (padCanvas.height - height) / 2,
          width,
          height
        );
      }

      for (const stroke of strokes) {
        if (!stroke.points.length) continue;
        padContext.strokeStyle = stroke.color;
        padContext.lineWidth = stroke.width * dpr;
        padContext.beginPath();
        const first = stroke.points[0];
        padContext.moveTo(first.x * dpr, first.y * dpr);
        for (let index = 1; index < stroke.points.length; index += 1) {
          const point = stroke.points[index];
          padContext.lineTo(point.x * dpr, point.y * dpr);
        }
        if (stroke.points.length === 1) {
          padContext.lineTo(first.x * dpr + 0.1, first.y * dpr);
        }
        padContext.stroke();
      }
    };

    const hasSignature = () =>
      Boolean(uploadedImage) || strokes.some((stroke) => stroke.points.length > 1);

    const getSignatureDataUrl = () => {
      if (!padCanvas || !hasSignature()) return null;
      if (uploadedImage && !strokes.length) {
        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / uploadedImage.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(uploadedImage.width * scale));
        canvas.height = Math.max(1, Math.round(uploadedImage.height * scale));
        canvas.getContext("2d").drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/png");
      }
      const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      for (const stroke of strokes) {
        for (const point of stroke.points) {
          bounds.minX = Math.min(bounds.minX, point.x * dpr);
          bounds.maxX = Math.max(bounds.maxX, point.x * dpr);
          bounds.minY = Math.min(bounds.minY, point.y * dpr);
          bounds.maxY = Math.max(bounds.maxY, point.y * dpr);
        }
      }
      const padding = 14 * dpr;
      const x = Math.max(0, bounds.minX - padding);
      const y = Math.max(0, bounds.minY - padding);
      const width = Math.min(padCanvas.width - x, bounds.maxX - bounds.minX + padding * 2);
      const height = Math.min(padCanvas.height - y, bounds.maxY - bounds.minY + padding * 2);
      if (width <= 1 || height <= 1) return null;
      const trimmed = document.createElement("canvas");
      trimmed.width = Math.ceil(width);
      trimmed.height = Math.ceil(height);
      trimmed
        .getContext("2d")
        .drawImage(padCanvas, x, y, width, height, 0, 0, trimmed.width, trimmed.height);
      return trimmed.toDataURL("image/png");
    };

    const signPageIndex = () => {
      if (state.pageMode === "first") return 0;
      if (state.pageMode === "custom") {
        const page = Math.max(1, Math.min(pageCount, Number(state.customPage) || 1));
        return page - 1;
      }
      return pageCount - 1;
    };

    const updatePreview = async () => {
      const preview = root.querySelector("[data-sign-preview]");
      if (!preview) return;
      const pageNumber = signPageIndex() + 1;
      root.querySelector("[data-preview-page]").textContent =
        state.pageMode === "all" ? `All ${pageCount} pages` : `Page ${pageNumber}`;
      if (!previewUrl || preview.dataset.page !== String(pageNumber)) {
        preview.innerHTML = `<span class="preview-loading">${icon("LoaderCircle", {
          size: 18,
          className: "spin"
        })}</span>`;
        try {
          const dataUrl = await renderPdfPagePreview(file, pageNumber, 520, state.password);
          previewUrl = dataUrl;
          preview.dataset.page = String(pageNumber);
        } catch {
          preview.innerHTML = `<span class="preview-failed">Preview unavailable</span>`;
          return;
        }
      }
      const signature = getSignatureDataUrl();
      const pos = state.position;
      const vertical = pos.startsWith("top") ? "top" : "bottom";
      const horizontal = pos.endsWith("left") ? "left" : pos.endsWith("right") ? "right" : "center";
      const offset = Math.max(2, (state.margin / 600) * 100);
      let style = `width:${state.size}%; ${vertical}:${offset}%;`;
      if (horizontal === "center") style += " left:50%; transform:translateX(-50%);";
      else style += ` ${horizontal}:${offset}%;`;
      preview.innerHTML = `<img class="preview-page-img" src="${previewUrl}" alt="Page ${pageNumber} preview" />
        ${
          signature
            ? `<img class="preview-signature" src="${signature}" alt="Signature preview" style="${style}" />`
            : `<span class="preview-hint">Draw your signature to see it here</span>`
        }`;
    };

    const schedulePreviewUpdate = () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updatePreview, 180);
    };

    const bindWorkspace = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) loadPdf(selected);
        replaceInput.value = "";
      });

      root.querySelector("[data-clear-signature]").addEventListener("click", () => {
        strokes = [];
        uploadedImage = null;
        drawPad();
        updatePreview();
      });

      root.querySelector("[data-sign-color]").addEventListener("input", (event) => {
        state.color = event.target.value;
      });
      root.querySelector("[data-sign-width]").addEventListener("input", (event) => {
        state.width = Number(event.target.value);
      });

      const uploadInput = root.querySelector("[data-sign-upload]");
      root.querySelector("[data-upload-signature]").addEventListener("click", () => uploadInput.click());
      uploadInput.addEventListener("change", async () => {
        const selected = uploadInput.files?.[0];
        uploadInput.value = "";
        if (!selected) return;
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Could not read that image."));
            reader.readAsDataURL(selected);
          });
          const image = new Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error("Could not decode that image."));
            image.src = dataUrl;
          });
          uploadedImage = image;
          strokes = [];
          drawPad();
          updatePreview();
          toast("Signature image added.", { type: "success", duration: 2200 });
        } catch (error) {
          toast(error.message || "Could not use that image.", { type: "error" });
        }
      });
      root.querySelector("[data-page-mode]").addEventListener("change", (event) => {
        state.pageMode = event.target.value;
        root.querySelector("[data-custom-page]").hidden = state.pageMode !== "custom";
        updatePreview();
      });
      root.querySelector("[data-page-number]").addEventListener("input", (event) => {
        state.customPage = Number(event.target.value) || 1;
        schedulePreviewUpdate();
      });
      root.querySelector("[data-position]").addEventListener("change", (event) => {
        state.position = event.target.value;
        updatePreview();
      });
      root.querySelector("[data-size]").addEventListener("input", (event) => {
        state.size = Number(event.target.value);
        root.querySelector("[data-size-value]").textContent = `${state.size}% of page width`;
        schedulePreviewUpdate();
      });
      root.querySelector("[data-margin]").addEventListener("input", (event) => {
        state.margin = Number(event.target.value);
        root.querySelector("[data-margin-value]").textContent = `${state.margin} pt`;
        schedulePreviewUpdate();
      });

      root.querySelector("[data-apply]").addEventListener("click", applySignature);
    };

    const applySignature = async () => {
      if (busy) return;
      const signature = getSignatureDataUrl();
      if (!signature) {
        toast("Draw or upload a signature first.", { type: "error" });
        root.querySelector("[data-sign-pad]")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      busy = true;
      const button = root.querySelector("[data-apply]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Signing…`;
      const resultEl = root.querySelector("[data-result]");
      const started = performance.now();
      try {
        const doc = await openPdf(file, state.password);
        const total = doc.getPageCount();
        let indices;
        if (state.pageMode === "all") {
          indices = doc.getPageIndices();
        } else if (state.pageMode === "first") {
          indices = [0];
        } else if (state.pageMode === "custom") {
          const page = Number(state.customPage);
          if (!Number.isInteger(page) || page < 1 || page > total) {
            throw new Error(`Choose a page between 1 and ${total}.`);
          }
          indices = [page - 1];
        } else {
          indices = [total - 1];
        }
        const extra = advanced?.values || {};
        const signatureImage = await embedSignatureImage(doc, signature);
        const opacity = Math.max(0.3, Math.min(1, (Number(extra.signatureOpacity) || 100) / 100));
        const stampDate = extra.addDateStamp === true;
        const stampDateText = new Date().toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
        let font = null;
        if (stampDate) font = await doc.embedFont(StandardFonts.Helvetica);
        indices.forEach((pageIndex) => {
          const page = doc.getPage(pageIndex);
          withDisplaySpace(page, ({ width: pageWidth, height: pageHeight }) => {
            const width = pageWidth * (state.size / 100);
            const height = width * (signatureImage.height / signatureImage.width);
            const margin = state.margin;
            let x = pageWidth - width - margin;
            let y = margin;
            if (state.position.endsWith("left")) x = margin;
            if (state.position.endsWith("center")) x = (pageWidth - width) / 2;
            if (state.position.startsWith("top")) y = pageHeight - height - margin;
            x = Math.max(6, Math.min(pageWidth - width - 6, x));
            y = Math.max(6, Math.min(pageHeight - height - 6, y));
            if (extra.drawSignatureBorder) {
              page.drawRectangle({
                x: x - 3,
                y: y - 3,
                width: width + 6,
                height: height + 6,
                borderColor: rgb(0.72, 0.7, 0.82),
                borderWidth: 0.7,
                opacity: 0
              });
            }
            page.drawImage(signatureImage, { x, y, width, height, opacity });
            if (stampDate && font) {
              const size = Math.max(7, Math.min(14, height * 0.22));
              page.drawText(stampDateText, {
                x,
                y: Math.max(4, y - size - 4),
                size,
                font,
                color: rgb(0.34, 0.32, 0.45),
                opacity
              });
            }
          });
        });
        const bytes = await savePdf(doc);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const name = `${sanitizeFilename(file.name, "document")}-signed.pdf`;
        renderResult(resultEl, [{ blob, name }], {
          tool,
          outputOptions: advanced?.values,
          inputs: file.size,
          duration: performance.now() - started,
          onReset: () => {
            file = null;
            strokes = [];
            uploadedImage = null;
            previewUrl = null;
            state.password = "";
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
      clearTimeout(previewTimer);
      padObserver?.disconnect();
      padObserver = null;
      strokes = [];
      uploadedImage = null;
      previewUrl = null;
    };
  }
};
