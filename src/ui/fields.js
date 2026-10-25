/**
 * Small, dependency-free renderer for the advanced control panels used by the
 * visual tools (crop, passport, signature, editors, …). It deliberately uses
 * the same CSS classes as GenericWorkspace so the panels look native.
 */
import { icon } from "./icons.js";
import { clamp, escapeHtml } from "../lib/utils.js";

export function shouldShowField(condition, values) {
  if (!condition) return true;
  if (Array.isArray(condition.in)) return condition.in.map(String).includes(String(values[condition.key]));
  if (Array.isArray(condition.notIn)) return !condition.notIn.map(String).includes(String(values[condition.key]));
  if ("equals" in condition) return String(values[condition.key]) === String(condition.equals);
  if ("not" in condition) return String(values[condition.key]) !== String(condition.not);
  if ("truthy" in condition) return Boolean(values[condition.key]);
  return true;
}

export function defaultsFor(options = []) {
  const values = {};
  options.forEach((option) => {
    values[option.key] = option.default;
  });
  return values;
}

export function optionMarkup(option, value) {
  const id = `adv-${escapeHtml(option.key)}`;
  const label = `<label class="field-label" for="${id}">${escapeHtml(option.label)}</label>`;
  const help = option.help ? `<p class="field-help">${escapeHtml(option.help)}</p>` : "";
  const wide = ["text", "textarea", "range", "color", "checkbox", "choice", "chips", "heading"].includes(option.type);
  const wrap = (inner, extra = "") =>
    `<div class="field ${wide ? "field-wide" : ""} ${extra}" data-field="${escapeHtml(option.key)}">${inner}${help}</div>`;

  if (option.type === "heading") {
    return `<div class="field field-wide field-heading" data-field="${escapeHtml(option.key)}"><span>${escapeHtml(
      option.label
    )}</span></div>`;
  }
  if (option.type === "select") {
    return wrap(`${label}<div class="select-wrap"><select id="${id}" data-option="${escapeHtml(option.key)}">${option.choices
      .map(
        (choice) =>
          `<option value="${escapeHtml(choice.value)}" ${String(choice.value) === String(value) ? "selected" : ""}>${escapeHtml(
            choice.label
          )}</option>`
      )
      .join("")}</select>${icon("ChevronDown", { size: 16 })}</div>`);
  }
  if (option.type === "choice" || option.type === "chips") {
    return wrap(`<span class="field-label">${escapeHtml(option.label)}</span><div class="choice-group ${
      option.type === "chips" ? "choice-chips" : ""
    }" role="radiogroup">${option.choices
      .map(
        (choice) => `<label class="choice"><input type="radio" name="${id}" value="${escapeHtml(
          choice.value
        )}" data-option="${escapeHtml(option.key)}" ${String(choice.value) === String(value) ? "checked" : ""} /><span>${escapeHtml(
          choice.label
        )}</span></label>`
      )
      .join("")}</div>`);
  }
  if (option.type === "range") {
    const shown = option.format ? option.format(value) : `${value}${option.unit || ""}`;
    return wrap(
      `<div class="range-head">${label}<output class="range-value" data-range-value="${escapeHtml(
        option.key
      )}">${escapeHtml(shown)}</output></div><input id="${id}" type="range" min="${option.min}" max="${
        option.max
      }" step="${option.step || 1}" value="${escapeHtml(value)}" data-option="${escapeHtml(option.key)}" />`,
      "field-range"
    );
  }
  if (option.type === "number") {
    return wrap(`${label}<div class="input-with-suffix"><input id="${id}" class="input" type="number" value="${escapeHtml(
      value
    )}" min="${option.min ?? ""}" max="${option.max ?? ""}" step="${option.step || 1}" placeholder="${escapeHtml(
      option.placeholder || ""
    )}" data-option="${escapeHtml(option.key)}" />${
      option.suffix ? `<span class="input-suffix">${escapeHtml(option.suffix)}</span>` : ""
    }</div>`);
  }
  if (option.type === "color") {
    return wrap(
      `${label}<div class="color-row"><input id="${id}" type="color" value="${escapeHtml(
        value
      )}" data-option="${escapeHtml(option.key)}" /><span class="color-hex">${escapeHtml(value)}</span></div>`,
      "field-color"
    );
  }
  if (option.type === "checkbox") {
    return wrap(`<label class="switch-row" for="${id}"><input id="${id}" type="checkbox" ${
      value ? "checked" : ""
    } data-option="${escapeHtml(option.key)}" /><span class="switch" aria-hidden="true"></span><span>${escapeHtml(
      option.label
    )}</span></label>`);
  }
  if (option.type === "textarea") {
    return wrap(
      `${label}<textarea id="${id}" class="input textarea-input" rows="${option.rows || 2}" placeholder="${escapeHtml(
        option.placeholder || ""
      )}" data-option="${escapeHtml(option.key)}">${escapeHtml(value ?? "")}</textarea>`
    );
  }
  return wrap(
    `${label}<input id="${id}" class="input" type="text" value="${escapeHtml(
      value ?? ""
    )}" placeholder="${escapeHtml(option.placeholder || "")}" data-option="${escapeHtml(option.key)}" />`
  );
}

export function optionsMarkup(options, values) {
  return options.map((option) => optionMarkup(option, values[option.key])).join("");
}

function parseValue(option, input) {
  if (option.type === "checkbox") return input.checked;
  if (option.type === "number" || option.type === "range") {
    const parsed = input.value === "" ? "" : Number(input.value);
    if (parsed !== "" && Number.isFinite(parsed)) {
      return clamp(parsed, option.min ?? -Infinity, option.max ?? Infinity);
    }
    return parsed;
  }
  return input.value;
}

/**
 * Renders `options` into `container`, keeps a live `values` object and returns
 * helpers for reading / refreshing the panel.
 */
export function bindOptionsPanel(container, options, initial = {}, onChange = () => {}) {
  const values = { ...defaultsFor(options), ...initial };
  container.innerHTML = optionsMarkup(options, values);

  const updateVisibility = () => {
    options.forEach((option) => {
      const field = container.querySelector(`[data-field="${option.key}"]`);
      if (field) field.hidden = !shouldShowField(option.showIf, values);
    });
    container.querySelectorAll("[data-option]").forEach((input) => {
      if (input.type === "color") {
        const hex = input.closest(".field-color")?.querySelector(".color-hex");
        if (hex) hex.textContent = input.value;
      }
    });
  };

  const handle = (event) => {
    const input = event.target.closest("[data-option]");
    if (!input) return;
    const option = options.find((item) => item.key === input.dataset.option);
    if (!option) return;
    values[option.key] = parseValue(option, input);
    if (option.type === "range") {
      const output = container.querySelector(`[data-range-value="${option.key}"]`);
      if (output) output.textContent = option.format ? option.format(values[option.key]) : `${values[option.key]}${option.unit || ""}`;
    }
    updateVisibility();
    onChange(option.key, values[option.key], values);
  };
  container.addEventListener("input", handle);
  container.addEventListener("change", handle);
  updateVisibility();

  return {
    values,
    updateVisibility,
    refresh(next = {}) {
      Object.assign(values, next);
      options.forEach((option) => {
        const inputs = container.querySelectorAll(`[data-option="${option.key}"]`);
        inputs.forEach((input) => {
          if (input.type === "checkbox") input.checked = Boolean(values[option.key]);
          else if (input.type === "radio") input.checked = String(input.value) === String(values[option.key]);
          else input.value = values[option.key] ?? "";
        });
      });
      updateVisibility();
    }
  };
}

/** Standard advanced-output panel shared by the visual tools. */
export function advancedOutputOptions({ formats = true, size = true, dpi = true, name = true } = {}) {
  const options = [
    { key: "_outputHeading", label: "Output & export", type: "heading" }
  ];
  if (name) {
    options.push({
      key: "outputName",
      label: "File name",
      type: "text",
      default: "",
      placeholder: "Automatic name"
    });
  }
  if (formats) {
    options.push(
      {
        key: "outputFormat",
        label: "Override format",
        type: "select",
        default: "keep",
        choices: [
          { value: "keep", label: "Keep tool format" },
          { value: "png", label: "PNG — lossless" },
          { value: "jpg", label: "JPG — smaller" },
          { value: "webp", label: "WebP — modern" }
        ]
      },
      {
        key: "outputQuality",
        label: "Quality",
        type: "range",
        default: 0.92,
        min: 0.3,
        max: 1,
        step: 0.02,
        format: (value) => `${Math.round(Number(value) * 100)}%`
      },
      {
        key: "outputBackground",
        label: "Matte colour for JPG",
        type: "color",
        default: "#ffffff"
      }
    );
  }
  if (size) {
    options.push({
      key: "targetSize",
      label: "Max file size",
      type: "number",
      default: 0,
      min: 0,
      max: 102400,
      step: 1,
      suffix: "KB",
      help: "0 keeps the full quality. Images are re-encoded and resized to fit."
    });
  }
  if (dpi) {
    options.push({
      key: "dpi",
      label: "Print DPI metadata",
      type: "select",
      default: "0",
      choices: [
        { value: "0", label: "Keep original DPI" },
        { value: "72", label: "72 DPI" },
        { value: "96", label: "96 DPI" },
        { value: "150", label: "150 DPI" },
        { value: "300", label: "300 DPI" }
      ]
    });
  }
  return options;
}
