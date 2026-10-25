import { icon } from "./icons.js";
import { toast } from "./toast.js";
import {
  acceptMatches,
  clamp,
  downloadBlob,
  errorMessage,
  escapeHtml,
  formatBytes,
  formatDuration,
  isImageFile,
  isPasswordError,
  isPdfFile,
  sanitizeFilename,
  uid,
  yieldToUi
} from "../lib/utils.js";
import { zipOutputs } from "../lib/zip.js";
import { applyOutputOptions, zipNameFor } from "../lib/output-options.js";
import { addRecent, clearToolSettings, getToolSettings, saveToolSettings } from "../lib/storage.js";
import { takeStashedFiles } from "../lib/stash.js";

const imageExtensions = "JPG, PNG, WebP, GIF, BMP, SVG";

function releasePreview(entry) {
  if (entry?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(entry.previewUrl);
}

function defaultsFor(options = []) {
  const values = {};
  options.forEach((option) => {
    if (option.type !== "heading") values[option.key] = option.default;
  });
  return values;
}

function shouldShow(condition, values) {
  if (!condition) return true;
  if (Array.isArray(condition.in)) return condition.in.map(String).includes(String(values[condition.key]));
  if (Array.isArray(condition.notIn)) return !condition.notIn.map(String).includes(String(values[condition.key]));
  if ("equals" in condition) return String(values[condition.key]) === String(condition.equals);
  if ("not" in condition) return String(values[condition.key]) !== String(condition.not);
  if ("truthy" in condition) return Boolean(values[condition.key]);
  return true;
}

function parseValue(option, input) {
  if (option.type === "checkbox") return input.checked;
  if (option.type === "number" || option.type === "range") {
    if (input.value === "") return "";
    const parsed = Number(input.value);
    if (!Number.isFinite(parsed)) return option.default;
    return clamp(parsed, option.min ?? -Infinity, option.max ?? Infinity);
  }
  return input.value;
}

function sanitiseValues(tool, values) {
  const result = {};
  tool.options.forEach((option) => {
    if (option.type === "heading") return;
    const value = values[option.key];
    if (value === undefined || value === null) {
      result[option.key] = option.default;
      return;
    }
    if ((option.type === "number" || option.type === "range") && typeof value === "number") {
      result[option.key] = clamp(value, option.min ?? -Infinity, option.max ?? Infinity);
    } else {
      result[option.key] = value;
    }
  });
  return result;
}

export class GenericWorkspace {
  constructor(tool, implementation, root) {
    this.tool = tool;
    this.implementation = implementation;
    this.root = root;
    this.values = sanitiseValues(tool, { ...defaultsFor(tool.options), ...getToolSettings(tool.slug) });
    this.files = [];
    this.dragIndex = null;
    this.busy = false;
    this._thumbObserver = null;
  }

  mount() {
    const acceptLabel =
      this.tool.accept.includes("pdf") ? "PDF files" : `images (${imageExtensions})`;
    this.root.innerHTML = `
      <div class="workspace-card" data-workspace>
        <div class="dropzone" data-dropzone role="button" tabindex="0" aria-label="Add ${escapeHtml(acceptLabel)}">
          <input type="file" accept="${escapeHtml(this.tool.accept)}" ${this.tool.multiple ? "multiple" : ""} hidden data-file-input />
          <div class="dropzone-big" data-dropzone-big>
            <span class="dropzone-icon">${icon("Upload", { size: 28 })}</span>
            <h2>Drop ${escapeHtml(acceptLabel)} here</h2>
            <p>or <span class="text-link">browse your device</span> · up to ${this.tool.maxFiles} file${this.tool.maxFiles > 1 ? "s" : ""}</p>
            <span class="dropzone-hint">${icon("Lock", { size: 13 })} Files are processed locally — nothing is uploaded</span>
          </div>
          <div class="dropzone-mini" data-dropzone-mini hidden>
            <span class="mini-icon">${icon("Plus", { size: 18 })}</span>
            <span>Add more ${this.tool.accept.includes("pdf") ? "PDFs" : "images"}</span>
            <span class="mini-hint">or drop them here</span>
          </div>
        </div>

        <div class="queue" data-queue hidden>
          <div class="queue-head">
            <div class="queue-title">
              <strong data-file-count>0 files</strong>
              <span data-file-size></span>
            </div>
            <button type="button" class="text-button text-button-danger" data-clear-all>${icon("Trash", { size: 15 })} Clear all</button>
          </div>
          <div class="file-list" data-file-list></div>
        </div>

        ${
          this.tool.options.length
            ? `<div class="options" data-options hidden>
                 <div class="options-head">
                   <h2>${icon("SlidersHorizontal", { size: 18 })} Settings</h2>
                   <button type="button" class="text-button" data-reset-options>${icon("RotateCcw", { size: 14 })} Reset</button>
                 </div>
                 <div class="option-grid" data-option-grid></div>
                 <details class="advanced-panel" data-advanced-wrap hidden>
                   <summary>${icon("SlidersHorizontal", { size: 16 })}<span>Output, metadata & security</span><em data-advanced-count></em>${icon(
                     "ChevronDown",
                     { size: 16, className: "advanced-chevron" }
                   )}</summary>
                   <div class="custom-options" data-advanced-grid></div>
                 </details>
               </div>`
            : ""
        }

        <div class="run-zone">
          <button type="button" class="button button-primary button-lg run-button" data-run disabled>
            ${icon("Sparkles", { size: 19 })} <span>${escapeHtml(this.tool.action)}</span>
          </button>
          <p class="run-note">${icon("ShieldCheck", { size: 14 })} 100% local processing · no sign-up · no watermark</p>
        </div>

        <div class="progress-panel" data-progress hidden>
          <div class="progress-top">
            <span class="progress-spinner">${icon("LoaderCircle", { size: 20 })}</span>
            <span class="progress-message" data-progress-message>Working locally…</span>
            <span class="progress-percent" data-progress-percent>0%</span>
          </div>
          <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-progressbar>
            <div class="progress-fill" data-progress-fill></div>
          </div>
        </div>

        <div class="result-mount" data-result></div>
      </div>
    `;

    this.dropzone = this.root.querySelector("[data-dropzone]");
    this.input = this.root.querySelector("[data-file-input]");
    this.queueEl = this.root.querySelector("[data-queue]");
    this.listEl = this.root.querySelector("[data-file-list]");
    this.countEl = this.root.querySelector("[data-file-count]");
    this.sizeEl = this.root.querySelector("[data-file-size]");
    this.optionsEl = this.root.querySelector("[data-options]");
    this.optionGrid = this.root.querySelector("[data-option-grid]");
    this.advancedWrap = this.root.querySelector("[data-advanced-wrap]");
    this.advancedGrid = this.root.querySelector("[data-advanced-grid]");
    this.runButton = this.root.querySelector("[data-run]");
    this.resultEl = this.root.querySelector("[data-result]");
    this.progressEl = this.root.querySelector("[data-progress]");

    this.bindUpload();
    this.bindQueue();
    this.bindOptions();
    this.runButton.addEventListener("click", () => this.run());
    this.dropzone.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      this.input.click();
    });
    this.dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.input.click();
      }
    });
    this.input.addEventListener("change", () => {
      this.addFiles(this.input.files);
      this.input.value = "";
    });
    this.root.querySelector("[data-clear-all]")?.addEventListener("click", () => this.clearAll());
    this.root.querySelector("[data-reset-options]")?.addEventListener("click", () => {
      this.values = defaultsFor(this.tool.options);
      clearToolSettings(this.tool.slug);
      this.renderOptions();
      toast("Settings reset to defaults.", { type: "info", duration: 2200 });
    });

    addRecent(this.tool.slug);

    const stashed = takeStashedFiles().filter((file) =>
      acceptMatches(file, this.tool.accept)
    );
    if (stashed.length) {
      this.addFiles(stashed, { fromStash: true });
    }
    this.updateState();
  }

  destroy() {
    this.files.forEach((entry) => releasePreview(entry));
    this.files = [];
  }

  bindUpload() {
    ["dragenter", "dragover"].forEach((type) => {
      this.dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.dropzone.classList.add("is-dragging");
      });
    });
    ["dragleave", "dragend"].forEach((type) => {
      this.dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        this.dropzone.classList.remove("is-dragging");
      });
    });
    this.dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.dropzone.classList.remove("is-dragging");
      this.addFiles(event.dataTransfer?.files);
    });
  }

  bindQueue() {
    this.listEl.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove]");
      if (remove) {
        this.removeFile(remove.dataset.remove);
        return;
      }
      const move = event.target.closest("[data-move]");
      if (move) {
        const index = this.files.findIndex((entry) => entry.id === move.dataset.id);
        const direction = move.dataset.move === "up" ? -1 : 1;
        this.moveFile(index, index + direction);
      }
    });
    this.listEl.addEventListener("dragstart", (event) => {
      const card = event.target.closest("[data-file-card]");
      if (!card) return;
      this.dragIndex = this.files.findIndex((entry) => entry.id === card.dataset.fileCard);
      card.classList.add("is-dragged");
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", card.dataset.fileCard);
      } catch {
        /* ignore */
      }
    });
    this.listEl.addEventListener("dragend", (event) => {
      event.target.closest("[data-file-card]")?.classList.remove("is-dragged");
      this.dragIndex = null;
    });
    this.listEl.addEventListener("dragover", (event) => {
      const card = event.target.closest("[data-file-card]");
      if (!card) return;
      event.preventDefault();
      card.classList.add("is-drop-target");
    });
    this.listEl.addEventListener("dragleave", (event) => {
      event.target.closest("[data-file-card]")?.classList.remove("is-drop-target");
    });
    this.listEl.addEventListener("drop", (event) => {
      const card = event.target.closest("[data-file-card]");
      if (!card) return;
      event.preventDefault();
      card.classList.remove("is-drop-target");
      let targetIndex = this.files.findIndex((entry) => entry.id === card.dataset.fileCard);
      if (this.dragIndex === null || targetIndex < 0 || this.dragIndex === targetIndex) return;
      if (this.dragIndex < targetIndex) targetIndex -= 1;
      const [moved] = this.files.splice(this.dragIndex, 1);
      this.files.splice(targetIndex, 0, moved);
      this.dragIndex = null;
      this.renderQueue();
    });
  }

  bindOptions() {
    if (!this.optionsEl) return;
    const handle = (event) => {
      const input = event.target.closest("[data-option]");
      if (!input) return;
      const key = input.dataset.option;
      const option = this.tool.options.find((item) => item.key === key);
      if (!option) return;
      this.values[key] = parseValue(option, input);
      saveToolSettings(this.tool.slug, this.values);
      if (option.type === "range") {
        const valueEl = this.optionGrid.querySelector(`[data-range-value="${key}"]`);
        if (valueEl) valueEl.textContent = option.format ? option.format(this.values[key]) : this.values[key];
      }
      this.updateOptionVisibility();
    };
    this.optionGrid.addEventListener("input", handle);
    this.optionGrid.addEventListener("change", handle);
    this.advancedGrid?.addEventListener("input", handle);
    this.advancedGrid?.addEventListener("change", handle);
  }

  renderOptions() {
    if (!this.optionGrid) return;
    const primary = this.tool.options.filter((option) => !option.advanced);
    const advanced = this.tool.options.filter((option) => option.advanced);
    this.optionGrid.innerHTML = primary.map((option) => this.renderOption(option)).join("");
    if (this.advancedWrap && this.advancedGrid) {
      this.advancedWrap.hidden = advanced.length === 0;
      this.advancedGrid.innerHTML = advanced.map((option) => this.renderOption(option)).join("");
      const count = this.advancedWrap.querySelector("[data-advanced-count]");
      if (count) count.textContent = `${advanced.filter((option) => option.type !== "heading").length} controls`;
    }
    this.updateOptionVisibility();
  }

  renderOption(option) {
    const value = this.values[option.key];
    const wide = ["text", "textarea", "range", "color", "checkbox", "chips", "heading"].includes(option.type);
    const label = `<label class="field-label" for="opt-${escapeHtml(option.key)}">${escapeHtml(option.label)}</label>`;
    const help = option.help
      ? `<p class="field-help">${escapeHtml(option.help)}</p>`
      : "";

    if (option.type === "heading") {
      return `<div class="field field-wide field-heading" data-field="${escapeHtml(option.key)}"><span>${escapeHtml(
        option.label
      )}</span></div>`;
    }

    if (option.type === "textarea") {
      return `<div class="field field-wide" data-field="${escapeHtml(option.key)}">
        ${label}
        <textarea id="opt-${escapeHtml(option.key)}" class="input textarea-input" rows="${option.rows || 2}" placeholder="${escapeHtml(
          option.placeholder || ""
        )}" data-option="${escapeHtml(option.key)}">${escapeHtml(value ?? "")}</textarea>
        ${help}
      </div>`;
    }

    if (option.type === "select") {
      return `<div class="field ${wide ? "field-wide" : ""}" data-field="${escapeHtml(option.key)}">
        ${label}
        <div class="select-wrap">
          <select id="opt-${escapeHtml(option.key)}" data-option="${escapeHtml(option.key)}">
            ${option.choices
              .map(
                (choice) =>
                  `<option value="${escapeHtml(choice.value)}" ${
                    String(choice.value) === String(value) ? "selected" : ""
                  }>${escapeHtml(choice.label)}</option>`
              )
              .join("")}
          </select>
          ${icon("ChevronDown", { size: 16 })}
        </div>
        ${help}
      </div>`;
    }

    if (option.type === "choice" || option.type === "chips") {
      return `<div class="field ${wide ? "field-wide" : ""}" data-field="${escapeHtml(option.key)}">
        <span class="field-label">${escapeHtml(option.label)}</span>
        <div class="choice-group ${option.type === "chips" ? "choice-chips" : ""}" role="radiogroup" aria-label="${escapeHtml(option.label)}">
          ${option.choices
            .map(
              (choice) => `<label class="choice">
                <input type="radio" name="opt-${escapeHtml(option.key)}" value="${escapeHtml(choice.value)}"
                  data-option="${escapeHtml(option.key)}" ${
                    String(choice.value) === String(value) ? "checked" : ""
                  } />
                <span>${escapeHtml(choice.label)}</span>
              </label>`
            )
            .join("")}
        </div>
        ${help}
      </div>`;
    }

    if (option.type === "range") {
      return `<div class="field field-wide field-range" data-field="${escapeHtml(option.key)}">
        <div class="range-head">
          ${label}
          <output class="range-value" data-range-value="${escapeHtml(option.key)}">${
            option.format ? option.format(value) : value
          }</output>
        </div>
        <input id="opt-${escapeHtml(option.key)}" type="range" min="${option.min}" max="${option.max}" step="${
          option.step || 1
        }" value="${value}" data-option="${escapeHtml(option.key)}" />
        ${help}
      </div>`;
    }

    if (option.type === "number") {
      return `<div class="field" data-field="${escapeHtml(option.key)}">
        ${label}
        <div class="input-with-suffix"><input id="opt-${escapeHtml(option.key)}" class="input" type="number" value="${escapeHtml(
          value
        )}" min="${option.min ?? ""}" max="${option.max ?? ""}" step="${option.step || 1}" placeholder="${escapeHtml(
          option.placeholder || ""
        )}" data-option="${escapeHtml(option.key)}" />${option.suffix ? `<span class="input-suffix">${escapeHtml(option.suffix)}</span>` : ""}</div>
        ${help}
      </div>`;
    }

    if (option.type === "color") {
      return `<div class="field field-wide field-color" data-field="${escapeHtml(option.key)}">
        ${label}
        <div class="color-row">
          <input id="opt-${escapeHtml(option.key)}" type="color" value="${escapeHtml(value)}" data-option="${escapeHtml(
            option.key
          )}" />
          <span class="color-hex">${escapeHtml(value)}</span>
        </div>
        ${help}
      </div>`;
    }

    if (option.type === "checkbox") {
      return `<div class="field field-wide" data-field="${escapeHtml(option.key)}">
        <label class="switch-row" for="opt-${escapeHtml(option.key)}">
          <input id="opt-${escapeHtml(option.key)}" type="checkbox" ${
            value ? "checked" : ""
          } data-option="${escapeHtml(option.key)}" />
          <span class="switch" aria-hidden="true"></span>
          <span>${escapeHtml(option.label)}</span>
        </label>
        ${help}
      </div>`;
    }

    const secret = /password/i.test(option.key);
    return `<div class="field field-wide" data-field="${escapeHtml(option.key)}">
      ${label}
      <input id="opt-${escapeHtml(option.key)}" class="input" type="${
        secret ? "password" : "text"
      }" value="${escapeHtml(value)}" placeholder="${escapeHtml(
        option.placeholder || ""
      )}" autocomplete="${secret ? "new-password" : "off"}" data-option="${escapeHtml(option.key)}" />
      ${help}
    </div>`;
  }

  updateOptionVisibility() {
    if (!this.optionGrid) return;
    const containers = [this.optionGrid, this.advancedGrid].filter(Boolean);
    this.tool.options.forEach((option) => {
      containers.forEach((container) => {
        const field = container.querySelector(`[data-field="${option.key}"]`);
        if (field) field.hidden = !shouldShow(option.showIf, this.values);
      });
    });
    containers.forEach((container) => container.querySelectorAll("[data-option]").forEach((input) => {
      if (input.type === "color") {
        const hex = input.closest(".field-color")?.querySelector(".color-hex");
        if (hex) hex.textContent = input.value;
      }
    }));
  }

  async addFiles(fileList, { fromStash = false } = {}) {
    if (this.busy) return;
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    let accepted = 0;
    let rejected = 0;
    for (const file of incoming) {
      if (this.files.length >= this.tool.maxFiles) {
        toast(`You can add up to ${this.tool.maxFiles} files at once.`, { type: "error" });
        break;
      }
      if (!acceptMatches(file, this.tool.accept)) {
        rejected += 1;
        continue;
      }
      // Only single-file tools deduplicate. Multi-file tools (merge, join,
      // batch converters) legitimately need the same file more than once.
      if (!this.tool.multiple && this.files.some((entry) => entry.file.name === file.name && entry.file.size === file.size)) {
        continue;
      }
      if (!this.tool.multiple && this.files.length >= 1) {
        this.files.forEach((entry) => releasePreview(entry));
        this.files = [];
      }
      const entry = { id: uid(), file, previewUrl: null, pages: null };
      if (isImageFile(file)) entry.previewUrl = URL.createObjectURL(file);
      this.files.push(entry);
      accepted += 1;
      if (isPdfFile(file)) {
        import("../lib/pdf.js")
          .then((pdf) => pdf.getPdfPageCount(file))
          .then((pages) => {
            entry.pages = pages;
            this.renderQueue();
          })
          .catch(() => {});
      }
    }
    if (rejected) {
      toast(
        this.tool.accept.includes("pdf")
          ? "Please choose PDF files only."
          : "Please choose image files (JPG, PNG, WebP, GIF, BMP or SVG).",
        { type: "error" }
      );
    }
    if (accepted && fromStash) {
      toast(`${accepted} file${accepted > 1 ? "s" : ""} ready to go.`, { type: "success" });
    }
    this.renderQueue();
    this.updateState();
  }

  removeFile(id) {
    const index = this.files.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const [entry] = this.files.splice(index, 1);
    releasePreview(entry);
    this.renderQueue();
    this.updateState();
  }

  moveFile(index, target) {
    if (index < 0 || target < 0 || target >= this.files.length) return;
    const [entry] = this.files.splice(index, 1);
    this.files.splice(target, 0, entry);
    this.renderQueue();
  }

  clearAll() {
    this.files.forEach((entry) => releasePreview(entry));
    this.files = [];
    this.renderQueue();
    this.updateState();
    this.resultEl.innerHTML = "";
    if (this.progressEl) this.progressEl.hidden = true;
  }

  renderQueue() {
    const count = this.files.length;
    this.queueEl.hidden = count === 0;
    this.root.querySelector("[data-dropzone-big]").hidden = count > 0;
    this.root.querySelector("[data-dropzone-mini]").hidden = count === 0;
    this.dropzone.classList.toggle("has-files", count > 0);
    this.countEl.textContent = `${count} file${count === 1 ? "" : "s"}`;
    const total = this.files.reduce((sum, entry) => sum + entry.file.size, 0);
    this.sizeEl.textContent = total ? `· ${formatBytes(total)}` : "";
    this.listEl.innerHTML = this.files
      .map((entry, index) => {
        const isPdf = isPdfFile(entry.file);
        const kind = isPdf
          ? `${entry.pages ? `${entry.pages} page${entry.pages === 1 ? "" : "s"}` : "PDF"} · ${formatBytes(
              entry.file.size
            )}`
          : `${(entry.file.type || "image").replace("image/", "").toUpperCase() || "IMAGE"} · ${formatBytes(
              entry.file.size
            )}`;
        return `<div class="file-card" data-file-card="${entry.id}" ${
          this.tool.multiple ? 'draggable="true"' : ""
        }>
          <div class="file-thumb" data-thumb="${entry.id}">
            ${
              entry.previewUrl
                ? `<img src="${entry.previewUrl}" alt="" loading="lazy" />`
                : `<span class="pdf-thumb">${icon("FileText", { size: 24 })}</span>`
            }
          </div>
          <div class="file-info">
            <div class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</div>
            <div class="file-meta">${kind}</div>
          </div>
          ${
            this.tool.multiple
              ? `<div class="file-move">
                   <button type="button" class="icon-button icon-button-xs" data-move="up" data-id="${entry.id}" aria-label="Move ${escapeHtml(
                     entry.file.name
                   )} up" ${index === 0 ? "disabled" : ""}>${icon("ChevronsUp", { size: 16 })}</button>
                   <button type="button" class="icon-button icon-button-xs" data-move="down" data-id="${entry.id}" aria-label="Move ${escapeHtml(
                     entry.file.name
                   )} down" ${index === this.files.length - 1 ? "disabled" : ""}>${icon("ChevronsDown", {
                     size: 16
                   })}</button>
                 </div>`
              : ""
          }
          <button type="button" class="icon-button icon-button-sm file-remove" data-remove="${entry.id}" aria-label="Remove ${escapeHtml(
            entry.file.name
          )}">${icon("X", { size: 16 })}</button>
        </div>`;
      })
      .join("");

    this.files.forEach((entry) => {
      if (!isPdfFile(entry.file) || entry.previewUrl) return;
      const target = this.listEl.querySelector(`[data-thumb="${entry.id}"]`);
      if (!target) return;
      import("../lib/pdf.js")
        .then((pdf) => pdf.pdfThumbnail(entry.file, { width: 144 }))
        .then((dataUrl) => {
          if (dataUrl) {
            entry.previewUrl = dataUrl;
            target.innerHTML = `<img src="${dataUrl}" alt="" loading="lazy" />`;
          }
        })
        .catch(() => {});
    });
  }

  updateState() {
    const hasFiles = this.files.length > 0;
    if (this.optionsEl) this.optionsEl.hidden = !hasFiles;
    if (this.runButton) this.runButton.disabled = !hasFiles || this.busy;
    if (hasFiles && this.optionsEl && !this.optionGrid.children.length) {
      this.renderOptions();
    }
  }

  setProgress(fraction, message) {
    if (!this.progressEl) return;
    this.progressEl.hidden = false;
    const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    const bar = this.progressEl.querySelector("[data-progressbar]");
    bar.setAttribute("aria-valuenow", String(percent));
    this.progressEl.querySelector("[data-progress-fill]").style.width = `${percent}%`;
    this.progressEl.querySelector("[data-progress-percent]").textContent = `${percent}%`;
    if (message) this.progressEl.querySelector("[data-progress-message]").textContent = message;
  }

  async run() {
    if (this.busy || !this.files.length) return;
    if (
      this.tool.slug === "protect-pdf" &&
      !this.values.password &&
      this.values.generatePassword === false
    ) {
      toast("Choose a password before protecting your PDF.", { type: "error" });
      this.optionGrid?.querySelector('[data-option="password"]')?.focus();
      return;
    }
    this.busy = true;
    this.runButton.disabled = true;
    this.resultEl.innerHTML = "";
    this.progressEl.hidden = false;
    this.setProgress(0.02, "Preparing your files…");
    const started = performance.now();
    try {
      const files = this.files.map((entry) => entry.file);
      const inputs = files.reduce((sum, file) => sum + file.size, 0);
      const result = await this.implementation.process(files, this.values, {
        progress: (fraction, message) => this.setProgress(fraction, message),
        tool: this.tool
      });
      await yieldToUi();
      const normalized = normalizeOutputs(result, this.tool);
      if (!normalized.length) throw new Error("Nothing was produced. Please try again.");
      this.setProgress(0.98, "Applying output settings…");
      const outputs = await applyOutputOptions(normalized, this.values);
      const outputSize = outputs.reduce((sum, output) => sum + output.blob.size, 0);
      this.setProgress(1, "Finished");
      this.showResult(outputs, {
        inputs,
        outputSize,
        duration: performance.now() - started,
        fileCount: files.length,
        warnings: Array.isArray(outputs.warnings) ? outputs.warnings : [],
        notes: Array.isArray(outputs.notes) ? outputs.notes : [],
        outputOptions: this.values
      });
      this.progressEl.hidden = true;
    } catch (error) {
      console.error(error);
      this.progressEl.hidden = true;
      const message = errorMessage(error);
      const needsPassword =
        this.tool.category === "pdf" &&
        !["unlock-pdf", "protect-pdf"].includes(this.tool.slug) &&
        !this.values.password &&
        isPasswordError(error);
      if (needsPassword) {
        this.showPasswordPrompt(message);
      } else {
        toast(message, { type: "error", duration: 7000 });
        this.resultEl.innerHTML = `<div class="inline-error">${icon(
          "TriangleAlert",
          { size: 18 }
        )}<div><strong>Could not finish</strong><p>${escapeHtml(message)}</p></div></div>`;
        this.resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } finally {
      this.busy = false;
      this.runButton.disabled = this.files.length === 0;
      this.updateState();
    }
  }

  showPasswordPrompt(message) {
    this.resultEl.innerHTML = `<div class="password-prompt">
      <div class="password-prompt-icon">${icon("Lock", { size: 22 })}</div>
      <div class="password-prompt-body">
        <strong>This PDF needs a password</strong>
        <p>${escapeHtml(message || "Enter the document password to continue.")} The password stays in this tab.</p>
        <div class="password-prompt-row">
          <input class="input" type="password" autocomplete="current-password" placeholder="PDF password" data-pdf-password />
          <button type="button" class="button button-primary" data-pdf-password-submit>${icon("LockOpen", {
            size: 16
          })} Open PDF</button>
        </div>
      </div>
    </div>`;
    const input = this.resultEl.querySelector("[data-pdf-password]");
    const submit = () => {
      const password = input.value;
      if (!password) {
        input.focus();
        return;
      }
      this.values.password = password;
      this.resultEl.innerHTML = "";
      this.run();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
    });
    this.resultEl.querySelector("[data-pdf-password-submit]").addEventListener("click", submit);
    input.focus();
    this.resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  showResult(outputs, meta) {
    const multiple = outputs.length > 1;
    const saved = meta.inputs > 0 ? meta.inputs - meta.outputSize : 0;
    const savedPercent = meta.inputs > 0 ? Math.round((saved / meta.inputs) * 100) : 0;
    const summaryParts = [
      `${outputs.length} file${outputs.length === 1 ? "" : "s"} ready`,
      `${formatBytes(meta.inputs)} → ${formatBytes(meta.outputSize)}`
    ];
    if (savedPercent > 3) summaryParts.push(`${savedPercent}% smaller`);
    if (meta.duration) summaryParts.push(formatDuration(meta.duration));
    const primaryName = multiple ? "Download all as ZIP" : outputs[0].name;
    this.resultEl.innerHTML = `<div class="result-card" role="status">
      <div class="result-head">
        <span class="result-icon">${icon("Check", { size: 24 })}</span>
        <div>
          <h3>${multiple ? "Your files are ready" : "Your file is ready"}</h3>
          <p>${escapeHtml(summaryParts.join(" · "))}</p>
        </div>
      </div>
      ${warningsMarkup(meta.warnings)}
      ${(meta.notes || []).length ? `<div class="result-notes">${meta.notes
        .map((note) => `<p>${icon("Info", { size: 15 })}<span>${escapeHtml(note)}</span></p>`)
        .join("")}</div>` : ""}
      <div class="result-actions">
        <button type="button" class="button button-primary" data-download-primary>
          ${icon("Download", { size: 18 })} ${escapeHtml(primaryName)}
        </button>
        <button type="button" class="button button-ghost" data-run-again>${icon("RotateCcw", {
          size: 16
        })} Process again</button>
      </div>
      ${
        multiple
          ? `<ul class="result-list">${outputs
              .slice(0, 8)
              .map(
                (output, index) => `<li>
                  <span class="result-file-icon">${icon(
                    /\.(pdf)$/i.test(output.name) ? "FileText" : /\.(jpe?g|png|webp)$/i.test(output.name) ? "ImagePlus" : "File",
                    { size: 16 }
                  )}</span>
                  <span class="result-file-name">${escapeHtml(output.name)}</span>
                  <span class="result-file-size">${formatBytes(output.blob.size)}</span>
                  <button type="button" class="icon-button icon-button-sm" data-download-index="${index}" aria-label="Download ${escapeHtml(
                    output.name
                  )}">${icon("Download", { size: 15 })}</button>
                </li>`
              )
              .join("")}${
                outputs.length > 8
                  ? `<li class="result-more">+ ${outputs.length - 8} more in the ZIP</li>`
                  : ""
              }</ul>`
          : ""
      }
      <p class="result-privacy">${icon(
        "ShieldCheck",
        { size: 14 }
      )} Processed on this device. Nothing was uploaded or stored.</p>
    </div>`;

    const downloadOne = (output) => downloadBlob(output.blob, output.name);
    this.resultEl
      .querySelector("[data-download-primary]")
      .addEventListener("click", async (event) => {
        if (!multiple) {
          downloadOne(outputs[0]);
          return;
        }
        const button = event.currentTarget;
        button.disabled = true;
        const previous = button.innerHTML;
        button.innerHTML = `${icon("LoaderCircle", { size: 17, className: "spin" })} Packing ZIP…`;
        try {
          const zip = await zipOutputs(outputs, zipNameFor(meta.outputOptions, this.tool.output));
          downloadBlob(zip.blob, zip.name);
        } catch (error) {
          toast(errorMessage(error), { type: "error" });
        } finally {
          button.disabled = false;
          button.innerHTML = previous;
        }
      });
    this.resultEl.querySelectorAll("[data-download-index]").forEach((button) => {
      button.addEventListener("click", () => downloadOne(outputs[Number(button.dataset.downloadIndex)]));
    });
    this.resultEl.querySelector("[data-run-again]").addEventListener("click", () => {
      this.resultEl.innerHTML = "";
      this.updateState();
      this.dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    requestAnimationFrame(() => {
      this.resultEl.querySelector(".result-card")?.classList.add("is-in");
      this.resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
}

function warningsMarkup(warnings = []) {
  if (!warnings.length) return "";
  const names = warnings
    .map((warning) => warning.name)
    .slice(0, 3)
    .join(", ");
  const suffix = warnings.length > 3 ? "…" : "";
  return `<div class="result-warning">${icon("TriangleAlert", { size: 16 })}<span>${escapeHtml(
    `${warnings.length} file${warnings.length === 1 ? " was" : "s were"} skipped: ${names}${suffix}`
  )}</span></div>`;
}

function normalizeOutputs(result, tool) {
  let outputs;
  if (!result) outputs = [];
  else if (result instanceof Blob) outputs = [{ blob: result, name: tool.output }];
  else if (typeof result === "string") outputs = [{ blob: new Blob([result], { type: "text/plain" }), name: tool.output }];
  else if (result.text !== undefined) {
    outputs = [
      {
        blob: new Blob([result.text], { type: "text/plain;charset=utf-8" }),
        name: result.name || tool.output
      }
    ];
  } else if (result.blob) outputs = [result];
  else if (result.outputs) outputs = result.outputs;
  else if (Array.isArray(result)) outputs = result;
  else throw new Error("The tool returned an unexpected result.");
  const warnings = Array.isArray(result?.warnings)
    ? result.warnings
    : Array.isArray(outputs.warnings)
      ? outputs.warnings
      : [];
  const notes = Array.isArray(result?.notes)
    ? result.notes
    : Array.isArray(outputs.notes)
      ? outputs.notes
      : [];
  outputs = [...outputs];
  outputs.warnings = warnings;
  outputs.notes = notes;
  return outputs;
}

export function mountCustomWorkspace(root, html) {
  root.innerHTML = html;
}

export function outputName(tool, files, suffix = "") {
  const base = sanitizeFilename(files[0]?.name || tool.slug, tool.slug);
  return `${base}${suffix ? `-${suffix}` : ""}.pdf`;
}
