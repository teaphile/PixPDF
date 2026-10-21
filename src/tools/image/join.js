import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import {
  canvasToBlob,
  errorMessage,
  escapeHtml,
  formatBytes,
  isImageFile,
  sanitizeFilename,
  uid
} from "../../lib/utils.js";
import {
  drawSource,
  loadImageSource,
  makeCanvas,
  mimeFor
} from "../../lib/image.js";

export default {
  async mount(root, { tool }) {
    let entries = [];
    let direction = "vertical";
    let gap = 16;
    let background = "#ffffff";
    let format = "jpg";
    let quality = 0.92;
    let busy = false;
    let dragIndex = null;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: "image/*",
          multiple: true,
          title: "Drop images to join",
          subtitle: 'or <span class="text-link">browse your device</span> · up to 20 images',
          hint: "Arrange screenshots, receipts or photos into one image"
        })}
        <div class="organize-empty-note">${icon("Combine", {
          size: 15
        })} Add two or more images. You can reorder them before joining.</div>
      </div>`;
      bindDropzone(root, (files) => addFiles(files, true));
    };

    const addFiles = (files, replace = false) => {
      const incoming = files.filter(isImageFile);
      if (!incoming.length) {
        toast("Please choose image files.", { type: "error" });
        return;
      }
      if (replace) {
        entries.forEach((entry) => URL.revokeObjectURL(entry.url));
        entries = [];
      }
      for (const file of incoming) {
        if (entries.length >= 20) {
          toast("You can join up to 20 images at once.", { type: "error" });
          break;
        }
        if (entries.some((entry) => entry.file.name === file.name && entry.file.size === file.size)) continue;
        entries.push({ id: uid(), file, url: URL.createObjectURL(file) });
      }
      renderWorkspace();
    };

    const renderWorkspace = () => {
      root.innerHTML = `<div class="workspace-card join-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("Images", { size: 22 })}</span>
            <div>
              <strong>${entries.length} image${entries.length === 1 ? "" : "s"}</strong>
              <span>${formatBytes(entries.reduce((sum, entry) => sum + entry.file.size, 0))} total</span>
            </div>
          </div>
          <div class="organize-toolbar-actions">
            <button type="button" class="button button-ghost button-sm" data-add>${icon("Plus", {
              size: 15
            })} Add images</button>
            <button type="button" class="icon-button icon-button-sm" data-reset aria-label="Start over">${icon(
              "RotateCcw",
              { size: 17 }
            )}</button>
          </div>
          <input type="file" accept="image/*" multiple hidden data-add-input />
        </div>

        <div class="join-layout">
          <div class="join-list" data-join-list></div>
          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("Combine", { size: 15 })} Layout</span>
              <div class="choice-group">
                <label class="choice"><input type="radio" name="join-direction" value="vertical" ${
                  direction === "vertical" ? "checked" : ""
                } data-direction /><span>Vertical</span></label>
                <label class="choice"><input type="radio" name="join-direction" value="horizontal" ${
                  direction === "horizontal" ? "checked" : ""
                } data-direction /><span>Horizontal</span></label>
              </div>
              <div class="field field-range">
                <div class="range-head">
                  <label class="field-label" for="join-gap">Spacing</label>
                  <output data-gap-value>${gap} px</output>
                </div>
                <input id="join-gap" type="range" min="0" max="120" step="2" value="${gap}" data-gap />
              </div>
              <div class="field field-color">
                <label class="field-label" for="join-background">Background</label>
                <div class="color-row">
                  <input id="join-background" type="color" value="${background}" data-background />
                  <span class="color-hex">${background}</span>
                </div>
              </div>
            </div>

            <div class="editor-group">
              <span class="editor-group-title">${icon("ImageDown", { size: 15 })} Output</span>
              <div class="field">
                <label class="field-label" for="join-format">Format</label>
                <div class="select-wrap">
                  <select id="join-format" data-format>
                    <option value="jpg">JPG</option>
                    <option value="png">PNG</option>
                    <option value="webp">WebP</option>
                  </select>
                  ${icon("ChevronDown", { size: 16 })}
                </div>
              </div>
              <div class="field field-range" data-quality-field>
                <div class="range-head">
                  <label class="field-label" for="join-quality">Quality</label>
                  <output data-quality-value>${Math.round(quality * 100)}%</output>
                </div>
                <input id="join-quality" type="range" min="0.5" max="1" step="0.02" value="${quality}" data-quality />
              </div>
              <button type="button" class="button button-primary button-lg button-block" data-run>${icon(
                "Combine",
                { size: 18 }
              )} ${escapeHtml(tool.action)}</button>
            </div>
          </aside>
        </div>
        <div data-result></div>
      </div>`;
      bindWorkspace();
      renderList();
    };

    const renderList = () => {
      const list = root.querySelector("[data-join-list]");
      if (!list) return;
      list.innerHTML = entries
        .map(
          (entry, index) => `<div class="join-item" draggable="true" data-entry="${entry.id}">
            <span class="join-order">${index + 1}</span>
            <img src="${entry.url}" alt="" />
            <div class="join-item-info">
              <strong title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</strong>
              <span>${formatBytes(entry.file.size)}</span>
            </div>
            <div class="file-move">
              <button type="button" class="icon-button icon-button-xs" data-up="${entry.id}" aria-label="Move up" ${
                index === 0 ? "disabled" : ""
              }>${icon("ChevronsUp", { size: 16 })}</button>
              <button type="button" class="icon-button icon-button-xs" data-down="${entry.id}" aria-label="Move down" ${
                index === entries.length - 1 ? "disabled" : ""
              }>${icon("ChevronsDown", { size: 16 })}</button>
            </div>
            <button type="button" class="icon-button icon-button-sm" data-remove="${entry.id}" aria-label="Remove image">${icon(
              "X",
              { size: 15 }
            )}</button>
          </div>`
        )
        .join("");
    };

    const bindWorkspace = () => {
      const input = root.querySelector("[data-add-input]");
      root.querySelector("[data-add]").addEventListener("click", () => input.click());
      input.addEventListener("change", () => {
        addFiles(Array.from(input.files || []));
        input.value = "";
      });
      root.querySelector("[data-reset]").addEventListener("click", () => {
        entries.forEach((entry) => URL.revokeObjectURL(entry.url));
        entries = [];
        renderInitial();
      });
      root.querySelectorAll("[data-direction]").forEach((radio) => {
        radio.addEventListener("change", () => {
          direction = radio.value;
        });
      });
      const gapInput = root.querySelector("[data-gap]");
      gapInput.addEventListener("input", () => {
        gap = Number(gapInput.value);
        root.querySelector("[data-gap-value]").textContent = `${gap} px`;
      });
      root.querySelector("[data-background]").addEventListener("input", (event) => {
        background = event.target.value;
        root.querySelector(".color-hex").textContent = background;
      });
      root.querySelector("[data-format]").addEventListener("change", (event) => {
        format = event.target.value;
        root.querySelector("[data-quality-field]").style.opacity = format === "png" ? "0.45" : "1";
      });
      root.querySelector("[data-quality]").addEventListener("input", (event) => {
        quality = Number(event.target.value);
        root.querySelector("[data-quality-value]").textContent = `${Math.round(quality * 100)}%`;
      });
      const list = root.querySelector("[data-join-list]");
      list.addEventListener("click", (event) => {
        const remove = event.target.closest("[data-remove]");
        if (remove) {
          const index = entries.findIndex((entry) => entry.id === remove.dataset.remove);
          if (index >= 0) {
            URL.revokeObjectURL(entries[index].url);
            entries.splice(index, 1);
            if (!entries.length) renderInitial();
            else {
              renderList();
            }
          }
          return;
        }
        const up = event.target.closest("[data-up]");
        const down = event.target.closest("[data-down]");
        if (!up && !down) return;
        const id = (up || down).dataset.up || (up || down).dataset.down;
        const index = entries.findIndex((entry) => entry.id === id);
        const target = index + (up ? -1 : 1);
        if (index < 0 || target < 0 || target >= entries.length) return;
        const [entry] = entries.splice(index, 1);
        entries.splice(target, 0, entry);
        renderList();
      });
      list.addEventListener("dragstart", (event) => {
        const item = event.target.closest("[data-entry]");
        if (!item) return;
        dragIndex = entries.findIndex((entry) => entry.id === item.dataset.entry);
        item.classList.add("is-dragged");
        event.dataTransfer.effectAllowed = "move";
      });
      list.addEventListener("dragend", (event) => {
        event.target.closest("[data-entry]")?.classList.remove("is-dragged");
        dragIndex = null;
      });
      list.addEventListener("dragover", (event) => {
        if (event.target.closest("[data-entry]")) event.preventDefault();
      });
      list.addEventListener("drop", (event) => {
        const item = event.target.closest("[data-entry]");
        if (!item || dragIndex === null) return;
        event.preventDefault();
        let target = entries.findIndex((entry) => entry.id === item.dataset.entry);
        if (target < 0 || target === dragIndex) return;
        if (dragIndex < target) target -= 1;
        const [entry] = entries.splice(dragIndex, 1);
        entries.splice(target, 0, entry);
        dragIndex = null;
        renderList();
      });
      root.querySelector("[data-run]").addEventListener("click", run);
    };

    const run = async () => {
      if (busy || entries.length < 2) {
        toast("Add at least two images to join.", { type: "error" });
        return;
      }
      busy = true;
      const button = root.querySelector("[data-run]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Joining…`;
      const started = performance.now();
      const loadedList = [];
      try {
        for (const entry of entries) {
          loadedList.push({ entry, loaded: await loadImageSource(entry.file) });
        }
        let scale = 1;
        let totalWidth;
        let totalHeight;
        if (direction === "horizontal") {
          const maxHeight = Math.max(...loadedList.map((item) => item.loaded.height));
          const widths = loadedList.map((item) => (item.loaded.width * maxHeight) / item.loaded.height);
          totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (loadedList.length - 1);
          totalHeight = maxHeight;
          if (totalWidth > 12000) scale = 12000 / totalWidth;
        } else {
          const maxWidth = Math.max(...loadedList.map((item) => item.loaded.width));
          const heights = loadedList.map((item) => (item.loaded.height * maxWidth) / item.loaded.width);
          totalWidth = maxWidth;
          totalHeight = heights.reduce((sum, height) => sum + height, 0) + gap * (loadedList.length - 1);
          if (totalHeight > 12000) scale = 12000 / totalHeight;
        }
        const canvas = makeCanvas(totalWidth * scale, totalHeight * scale);
        const context = canvas.getContext("2d");
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        let offset = 0;
        for (const { loaded } of loadedList) {
          let width;
          let height;
          if (direction === "horizontal") {
            height = loaded.height * scale;
            width = (loaded.width * height) / loaded.height;
            drawSource(context, loaded.source, offset, 0, width, height);
            offset += width + gap * scale;
          } else {
            width = loaded.width * scale;
            height = (loaded.height * width) / loaded.width;
            drawSource(context, loaded.source, 0, offset, width, height);
            offset += height + gap * scale;
          }
        }
        const blob = await canvasToBlob(
          canvas,
          mimeFor(format),
          format === "png" ? undefined : quality
        );
        renderResult(
          root.querySelector("[data-result]"),
          [
            {
              blob,
              name: `${sanitizeFilename(entries[0].file.name, "images")}-joined.${format}`
            }
          ],
          { tool, inputs: entries.reduce((sum, entry) => sum + entry.file.size, 0), duration: performance.now() - started }
        );
      } catch (error) {
        toast(errorMessage(error), { type: "error" });
      } finally {
        loadedList.forEach((item) => item.loaded.dispose());
        busy = false;
        button.disabled = false;
        button.innerHTML = previous;
      }
    };

    renderInitial();
    return () => {
      entries.forEach((entry) => URL.revokeObjectURL(entry.url));
      entries = [];
    };
  }
};
