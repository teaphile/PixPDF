import { icon } from "./icons.js";
import { downloadBlob, escapeHtml, formatBytes, formatDuration } from "../lib/utils.js";
import { zipOutputs } from "../lib/zip.js";
import { applyOutputOptions, zipNameFor } from "../lib/output-options.js";
import { toast } from "./toast.js";

export function normalizeOutputs(result, fallbackName = "result.bin") {
  if (!result) return [];
  if (result instanceof Blob) return [{ blob: result, name: fallbackName }];
  if (result.blob) return [result];
  if (Array.isArray(result)) return result;
  if (result.outputs) return result.outputs;
  throw new Error("The tool returned an unexpected result.");
}

export async function renderResult(
  container,
  rawOutputs,
  { tool, inputs = 0, outputSize, duration = 0, summary, onReset, outputOptions } = {}
) {
  if (!rawOutputs.length) return;
  // Visual tools share the same output controls as the standard workspace.
  const outputs = outputOptions
    ? await applyOutputOptions(rawOutputs, outputOptions)
    : rawOutputs;
  const totalOut = outputSize ?? outputs.reduce((sum, output) => sum + output.blob.size, 0);
  const multiple = outputs.length > 1;
  const savedPercent = inputs > 0 ? Math.round(((inputs - totalOut) / inputs) * 100) : 0;
  const parts = [`${outputs.length} file${outputs.length === 1 ? "" : "s"} ready`];
  if (inputs) parts.push(`${formatBytes(inputs)} → ${formatBytes(totalOut)}`);
  if (savedPercent > 3) parts.push(`${savedPercent}% smaller`);
  if (duration) parts.push(formatDuration(duration));
  if (summary) parts.unshift(summary);

  const notes = [...(outputs.notes || []), ...(outputOptions?.notes || [])].filter(Boolean);
  container.innerHTML = `<div class="result-card is-in" role="status">
    <div class="result-head">
      <span class="result-icon">${icon("Check", { size: 24 })}</span>
      <div>
        <h3>${multiple ? "Your files are ready" : "Your file is ready"}</h3>
        <p>${escapeHtml(parts.join(" · "))}</p>
      </div>
    </div>
    ${notes.length ? `<div class="result-notes">${notes
      .map((note) => `<p>${icon("Info", { size: 15 })}<span>${escapeHtml(note)}</span></p>`)
      .join("")}</div>` : ""}
    <div class="result-actions">
      <button type="button" class="button button-primary" data-dl-primary>
        ${icon("Download", { size: 18 })} ${escapeHtml(
          multiple ? "Download all as ZIP" : outputs[0].name
        )}
      </button>
      ${onReset ? `<button type="button" class="button button-ghost" data-reset>${icon("RotateCcw", { size: 16 })} Start over</button>` : ""}
    </div>
    ${
      multiple
        ? `<ul class="result-list">${outputs
            .slice(0, 8)
            .map(
              (output, index) => `<li>
                <span class="result-file-icon">${icon(
                  /\.pdf$/i.test(output.name) ? "FileText" : "File",
                  { size: 16 }
                )}</span>
                <span class="result-file-name">${escapeHtml(output.name)}</span>
                <span class="result-file-size">${formatBytes(output.blob.size)}</span>
                <button type="button" class="icon-button icon-button-sm" data-dl-index="${index}" aria-label="Download ${escapeHtml(
                  output.name
                )}">${icon("Download", { size: 15 })}</button>
              </li>`
            )
            .join("")}${outputs.length > 8 ? `<li class="result-more">+ ${outputs.length - 8} more in the ZIP</li>` : ""}</ul>`
        : ""
    }
    <p class="result-privacy">${icon("ShieldCheck", { size: 14 })} Processed on this device. Nothing was uploaded or stored.</p>
  </div>`;

  const primary = container.querySelector("[data-dl-primary]");
  primary.addEventListener("click", async () => {
    if (!multiple) {
      downloadBlob(outputs[0].blob, outputs[0].name);
      return;
    }
    const previous = primary.innerHTML;
    primary.disabled = true;
    primary.innerHTML = `${icon("LoaderCircle", { size: 17, className: "spin" })} Packing ZIP…`;
    try {
      const zip = await zipOutputs(outputs, zipNameFor(outputOptions, tool?.output || "pixpdf-results.zip"));
      downloadBlob(zip.blob, zip.name);
    } catch (error) {
      toast(error.message || "Could not build the ZIP.", { type: "error" });
    } finally {
      primary.disabled = false;
      primary.innerHTML = previous;
    }
  });

  container.querySelectorAll("[data-dl-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const output = outputs[Number(button.dataset.dlIndex)];
      downloadBlob(output.blob, output.name);
    });
  });

  container.querySelector("[data-reset]")?.addEventListener("click", () => {
    container.innerHTML = "";
    onReset();
  });

  requestAnimationFrame(() => {
    container.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

export function createProgress(container) {
  const panel = document.createElement("div");
  panel.className = "progress-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="progress-top">
      <span class="progress-spinner">${icon("LoaderCircle", { size: 20 })}</span>
      <span class="progress-message">Working locally…</span>
      <span class="progress-percent">0%</span>
    </div>
    <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="progress-fill"></div>
    </div>
  `;
  if (container) container.prepend(panel);
  return {
    element: panel,
    show() {
      panel.hidden = false;
    },
    hide() {
      panel.hidden = true;
    },
    set(fraction, message) {
      const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
      panel.hidden = false;
      panel.querySelector(".progress-track").setAttribute("aria-valuenow", String(percent));
      panel.querySelector(".progress-fill").style.width = `${percent}%`;
      panel.querySelector(".progress-percent").textContent = `${percent}%`;
      if (message) panel.querySelector(".progress-message").textContent = message;
    }
  };
}

export function dropzoneMarkup({ accept, multiple = false, title, subtitle, hint }) {
  return `<div class="dropzone" data-dropzone role="button" tabindex="0" aria-label="${escapeHtml(title)}">
    <input type="file" accept="${escapeHtml(accept)}" ${multiple ? "multiple" : ""} hidden data-file-input />
    <div class="dropzone-big">
      <span class="dropzone-icon">${icon("Upload", { size: 28 })}</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${subtitle}</p>
      <span class="dropzone-hint">${icon("Lock", { size: 13 })} ${escapeHtml(
        hint || "Files are processed locally — nothing is uploaded"
      )}</span>
    </div>
  </div>`;
}

export function bindDropzone(root, onFiles) {
  const dropzone = root.querySelector("[data-dropzone]");
  const input = root.querySelector("[data-file-input]");
  const open = () => input.click();
  dropzone.addEventListener("click", open);
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  ["dragenter", "dragover"].forEach((type) =>
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    })
  );
  ["dragleave", "dragend"].forEach((type) =>
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    })
  );
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    onFiles(Array.from(event.dataTransfer?.files || []));
  });
  input.addEventListener("change", () => {
    onFiles(Array.from(input.files || []));
    input.value = "";
  });
  return { dropzone, input };
}
