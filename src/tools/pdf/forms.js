import {
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField
} from "@cantoo/pdf-lib";
import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { bindDropzone, dropzoneMarkup, renderResult } from "../../ui/result.js";
import { advancedPanelMarkup, mountAdvancedPanel } from "../../ui/advanced-panel.js";
import { openPdf, renderPdfPagePreview, savePdf } from "../../lib/pdf.js";
import {
  errorMessage,
  escapeHtml,
  formatBytes,
  isPdfFile,
  sanitizeFilename
} from "../../lib/utils.js";

const typeName = (field) => {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFOptionList) return "optionlist";
  return "other";
};

export default {
  async mount(root, { tool }) {
    let file = null;
    let doc = null;
    let form = null;
    let fields = [];
    let pages = [];
    let pageCount = 0;
    let currentPage = 0;
    let values = {};
    let flatten = false;
    let busy = false;
    let advanced = null;
    let previewUrl = null;

    const renderInitial = () => {
      root.innerHTML = `<div class="workspace-card">
        ${dropzoneMarkup({
          accept: ".pdf,application/pdf",
          title: "Drop a PDF form",
          subtitle: 'or <span class="text-link">browse your device</span> · one file at a time',
          hint: "Fill interactive AcroForm fields privately on this device"
        })}
        <div class="organize-empty-note">${icon("Keyboard", {
          size: 15
        })} Works with text fields, checkboxes, radio buttons, dropdowns and lists.</div>
      </div>`;
      bindDropzone(root, (files) => {
        const pdf = files.find(isPdfFile);
        if (!pdf) {
          toast("Please choose a PDF file.", { type: "error" });
          return;
        }
        load(pdf);
      });
    };

    const load = async (selected) => {
      file = selected;
      root.innerHTML = `<div class="workspace-card">
        <div class="custom-loading">${icon("LoaderCircle", { size: 22, className: "spin" })} Detecting form fields…</div>
      </div>`;
      try {
        doc = await openPdf(file);
        pages = doc.getPages();
        pageCount = pages.length;
        form = doc.getForm();
        fields = form.getFields().map((field) => {
          const type = typeName(field);
          const name = field.getName();
          const widgets = field.acroField.getWidgets().map((widget) => {
            const rect = widget.getRectangle();
            const pageIndex = pages.findIndex((page) => page.ref === widget.P());
            return { rect, pageIndex };
          });
          let initial = "";
          try {
            if (type === "text") initial = field.getText() || "";
            if (type === "checkbox") initial = field.isChecked();
            if (type === "radio") initial = field.getSelected() || "";
            if (type === "dropdown") initial = field.getSelected()?.[0] || "";
            if (type === "optionlist") initial = field.getSelected() || [];
          } catch {
            /* ignore malformed field values */
          }
          values[name] = initial;
          return {
            field,
            type,
            name,
            widgets,
            options:
              type === "radio" || type === "dropdown" || type === "optionlist"
                ? (() => {
                    try {
                      return field.getOptions();
                    } catch {
                      return [];
                    }
                  })()
                : []
          };
        });
        if (!fields.length) {
          root.innerHTML = `<div class="workspace-card">
            <div class="inline-error">${icon("TriangleAlert", {
              size: 18
            })}<div><strong>No fillable fields found</strong><p>This PDF is flat or scanned. Use <a href="#/tools/edit-pdf">Edit PDF</a> to place text over the page instead.</p></div></div>
            <div class="run-zone"><button type="button" class="button button-ghost" data-retry>${icon(
              "ArrowLeft",
              { size: 16 }
            )} Try another PDF</button></div>
          </div>`;
          root.querySelector("[data-retry]").addEventListener("click", () => {
            doc = null;
            form = null;
            fields = [];
            renderInitial();
          });
          return;
        }
        renderWorkspace();
      } catch (error) {
        console.error(error);
        toast(
          /password|encrypted/i.test(String(error?.message))
            ? "This form is password-protected. Unlock it first, then fill it."
            : errorMessage(error),
          { type: "error", duration: 7000 }
        );
        renderInitial();
      }
    };

    const pageFields = () =>
      fields.filter((item) => item.widgets.some((widget) => widget.pageIndex === currentPage));

    const controlFor = (item, widgetIndex) => {
      const value = values[item.name];
      if (item.type === "text") {
        return `<input class="form-overlay-input" type="text" value="${escapeHtml(value)}" data-form-field="${escapeHtml(
          item.name
        )}" />`;
      }
      if (item.type === "checkbox") {
        return `<input class="form-overlay-check" type="checkbox" ${value ? "checked" : ""} data-form-field="${escapeHtml(
          item.name
        )}" />`;
      }
      if (item.type === "radio" || item.type === "dropdown") {
        return `<select class="form-overlay-select" data-form-field="${escapeHtml(item.name)}">
          <option value="">—</option>
          ${item.options
            .map(
              (option) =>
                `<option value="${escapeHtml(option)}" ${
                  String(option) === String(value) ? "selected" : ""
                }>${escapeHtml(option)}</option>`
            )
            .join("")}
        </select>`;
      }
      if (item.type === "optionlist") {
        const selected = Array.isArray(value) ? value : [];
        return `<select class="form-overlay-select" multiple size="${Math.min(4, Math.max(2, item.options.length))}" data-form-field="${escapeHtml(
          item.name
        )}">
          ${item.options
            .map(
              (option) =>
                `<option value="${escapeHtml(option)}" ${
                  selected.includes(option) ? "selected" : ""
                }>${escapeHtml(option)}</option>`
            )
            .join("")}
        </select>`;
      }
      return "";
    };

    const renderWorkspace = async () => {
      root.innerHTML = `<div class="workspace-card forms-card">
        <div class="organize-toolbar">
          <div class="organize-file">
            <span class="organize-file-icon">${icon("Keyboard", { size: 22 })}</span>
            <div>
              <strong>${escapeHtml(file.name)}</strong>
              <span>${fields.length} field${fields.length === 1 ? "" : "s"} · ${pageCount} page${
                pageCount === 1 ? "" : "s"
              } · ${formatBytes(file.size)}</span>
            </div>
          </div>
          <button type="button" class="button button-ghost button-sm" data-replace>${icon("RefreshCw", {
            size: 15
          })} Change PDF</button>
          <input type="file" accept=".pdf,application/pdf" hidden data-replace-input />
        </div>

        <div class="forms-layout">
          <div class="forms-stage">
            <div class="forms-page-nav">
              <button type="button" class="icon-button icon-button-sm" data-prev aria-label="Previous page">${icon(
                "ArrowLeft",
                { size: 17 }
              )}</button>
              <strong data-page-label>Page 1 of ${pageCount}</strong>
              <button type="button" class="icon-button icon-button-sm" data-next aria-label="Next page">${icon(
                "ArrowRight",
                { size: 17 }
              )}</button>
            </div>
            <div class="forms-page" data-forms-page>
              <span class="preview-loading">${icon("LoaderCircle", { size: 18, className: "spin" })}</span>
            </div>
          </div>
          <aside class="editor-controls">
            <div class="editor-group">
              <span class="editor-group-title">${icon("Keyboard", { size: 15 })} Form options</span>
              <p class="editor-hint">Fill the highlighted fields on the page. Use the arrows to move between pages.</p>
              <label class="switch-row" for="forms-flatten">
                <input id="forms-flatten" type="checkbox" ${flatten ? "checked" : ""} data-flatten />
                <span class="switch" aria-hidden="true"></span>
                <span>Flatten answers when saving</span>
              </label>
              <p class="editor-hint">Flattening makes answers permanent and prevents later edits.</p>
              <button type="button" class="button button-primary button-lg button-block" data-run>${icon(
                "Keyboard",
                { size: 18 }
              )} ${escapeHtml(tool.action)}</button>
            </div>
            <div class="editor-group">
              <span class="editor-group-title">${icon("Info", { size: 15 })} This page</span>
              <div class="forms-field-list" data-field-list></div>
            </div>
          </aside>
        </div>
        ${advancedPanelMarkup(tool)}
        <div data-result></div>
      </div>`;
      bindWorkspace();
      advanced = mountAdvancedPanel(root, tool);
      await renderPage();
    };

    const renderPage = async () => {
      const target = root.querySelector("[data-forms-page]");
      if (!target) return;
      root.querySelector("[data-page-label]").textContent = `Page ${currentPage + 1} of ${pageCount}`;
      root.querySelector("[data-prev]").disabled = currentPage === 0;
      root.querySelector("[data-next]").disabled = currentPage === pageCount - 1;
      const onPage = pageFields();
      root.querySelector("[data-field-list]").innerHTML = onPage.length
        ? onPage
            .map(
              (item) =>
                `<span class="forms-field-chip">${escapeHtml(item.name)}<em>${item.type}</em></span>`
            )
            .join("")
        : `<span class="editor-hint">No fields on this page.</span>`;
      target.innerHTML = `<span class="preview-loading">${icon("LoaderCircle", {
        size: 18,
        className: "spin"
      })}</span>`;
      try {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = await renderPdfPagePreview(file, currentPage + 1, 1200);
        const page = pages[currentPage];
        const size = page.getSize();
        const overlays = [];
        for (const item of onPage) {
          item.widgets
            .filter((widget) => widget.pageIndex === currentPage)
            .forEach((widget) => {
              const rect = widget.rect;
              const left = (rect.x / size.width) * 100;
              const top = ((size.height - rect.y - rect.height) / size.height) * 100;
              const width = (rect.width / size.width) * 100;
              const height = (rect.height / size.height) * 100;
              const control = controlFor(item, 0);
              if (!control) return;
              overlays.push(`<div class="form-field-box" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%" title="${escapeHtml(
                item.name
              )}">${control}</div>`);
            });
        }
        target.innerHTML = `<div class="forms-page-inner" style="aspect-ratio:${size.width}/${size.height}">
          <img src="${previewUrl}" alt="Page ${currentPage + 1}" />
          <div class="forms-overlay">${overlays.join("")}</div>
        </div>`;
        bindOverlays();
      } catch (error) {
        target.innerHTML = `<div class="inline-error">${icon("TriangleAlert", {
          size: 18
        })}<div><p>${escapeHtml(errorMessage(error))}</p></div></div>`;
      }
    };

    const saveOverlayValues = () => {
      root.querySelectorAll("[data-form-field]").forEach((input) => {
        const name = input.dataset.formField;
        const item = fields.find((field) => field.name === name);
        if (!item) return;
        if (input.type === "checkbox") values[name] = input.checked;
        else if (input.multiple) values[name] = Array.from(input.selectedOptions).map((option) => option.value);
        else values[name] = input.value;
      });
    };

    const bindOverlays = () => {
      root.querySelectorAll("[data-form-field]").forEach((input) => {
        const sync = () => {
          saveOverlayValues();
          root.querySelectorAll("[data-form-field]").forEach((other) => {
            if (other === input || other.dataset.formField !== input.dataset.formField) return;
            if (input.type === "checkbox") other.checked = input.checked;
            else if (other.tagName === "SELECT" && input.tagName === "SELECT") {
              Array.from(other.options).forEach((option) => {
                option.selected = Array.from(input.selectedOptions).some(
                  (selected) => selected.value === option.value
                );
              });
            } else other.value = input.value;
          });
        };
        input.addEventListener("input", sync);
        input.addEventListener("change", sync);
      });
    };

    const bindWorkspace = () => {
      const replaceInput = root.querySelector("[data-replace-input]");
      root.querySelector("[data-replace]").addEventListener("click", () => replaceInput.click());
      replaceInput.addEventListener("change", () => {
        const selected = replaceInput.files?.[0];
        if (selected) {
          doc = null;
          form = null;
          fields = [];
          load(selected);
        }
        replaceInput.value = "";
      });
      root.querySelector("[data-prev]").addEventListener("click", async () => {
        saveOverlayValues();
        currentPage = Math.max(0, currentPage - 1);
        await renderPage();
      });
      root.querySelector("[data-next]").addEventListener("click", async () => {
        saveOverlayValues();
        currentPage = Math.min(pageCount - 1, currentPage + 1);
        await renderPage();
      });
      root.querySelector("[data-flatten]").addEventListener("change", (event) => {
        flatten = event.target.checked;
      });
      root.querySelector("[data-run]").addEventListener("click", run);
    };

    const run = async () => {
      if (busy) return;
      saveOverlayValues();
      busy = true;
      const button = root.querySelector("[data-run]");
      const previous = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("LoaderCircle", { size: 18, className: "spin" })} Saving form…`;
      const started = performance.now();
      try {
        for (const item of fields) {
          const value = values[item.name];
          try {
            if (item.type === "text") item.field.setText(String(value ?? ""));
            if (item.type === "checkbox") {
              if (value) item.field.check();
              else item.field.uncheck();
            }
            if (item.type === "radio" || item.type === "dropdown") {
              if (value) item.field.select(String(value));
              else if (item.type === "radio") item.field.clear();
            }
            if (item.type === "optionlist") {
              item.field.select(Array.isArray(value) ? value : value ? [String(value)] : []);
            }
          } catch (error) {
            throw new Error(`Could not fill “${item.name}”: ${error.message || "invalid value"}`);
          }
        }
        if (flatten) form.flatten();
        const bytes = await savePdf(doc);
        const blob = new Blob([bytes], { type: "application/pdf" });
        renderResult(
          root.querySelector("[data-result]"),
          [{ blob, name: `${sanitizeFilename(file.name, "form")}-filled.pdf` }],
          { tool, inputs: file.size, duration: performance.now() - started, outputOptions: advanced?.values }
        );
      } catch (error) {
        toast(errorMessage(error), { type: "error", duration: 7000 });
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
      doc = null;
      form = null;
      fields = [];
    };
  }
};
