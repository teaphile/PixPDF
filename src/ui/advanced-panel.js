/**
 * Collapsible "More options" panel for the hand-built (visual) tools.
 *
 * The visual workspaces have their own layout, so instead of the
 * GenericWorkspace option grid they mount this panel. It renders exactly the
 * same `tool.options` catalogue (tool specific extras + shared output & PDF
 * metadata controls) and hands the values to `renderResult`, which applies
 * them through lib/output-options.js.
 */
import { icon } from "./icons.js";
import { bindOptionsPanel, defaultsFor } from "./fields.js";
import { clearToolSettings, getToolSettings, saveToolSettings } from "../lib/storage.js";
import { escapeHtml } from "../lib/utils.js";

export function advancedPanelMarkup(tool, { open = false, title = "More options" } = {}) {
  if (!tool?.options?.length) return "";
  return `<details class="advanced-panel" ${open ? "open" : ""}>
    <summary>${icon("SlidersHorizontal", { size: 16 })}<span>${escapeHtml(title)}</span><em>${tool.options.filter(
      (option) => option.type !== "heading"
    ).length} controls</em>${icon("ChevronDown", { size: 16, className: "advanced-chevron" })}</summary>
    <div class="custom-options" data-advanced-options></div>
    <div class="advanced-actions">
      <button type="button" class="text-button" data-advanced-reset>${icon("RotateCcw", {
        size: 14
      })} Reset to defaults</button>
    </div>
  </details>`;
}

/**
 * Mount the panel inside `root` (must contain `[data-advanced-options]`).
 * Returns { values, refresh, apply } where `apply` is a ready-made
 * `outputOptions` object for renderResult.
 */
export function mountAdvancedPanel(root, tool) {
  const container = root.querySelector("[data-advanced-options]");
  if (!container) return { values: defaultsFor(tool.options || []), apply: null, refresh() {} };
  const stored = getToolSettings(tool.slug);
  const filtered = {};
  (tool.options || []).forEach((option) => {
    if (option.type !== "heading" && stored[option.key] !== undefined) filtered[option.key] = stored[option.key];
  });
  const panel = bindOptionsPanel(container, tool.options || [], filtered, () => {
    saveToolSettings(tool.slug, panel.values);
  });
  container.parentElement
    ?.querySelector("[data-advanced-reset]")
    ?.addEventListener("click", () => {
      clearToolSettings(tool.slug);
      panel.refresh(defaultsFor(tool.options || []));
      saveToolSettings(tool.slug, panel.values);
    });
  return {
    values: panel.values,
    refresh: panel.refresh,
    get outputOptions() {
      return panel.values;
    }
  };
}

/** Reset button helper for custom toolbars. */
export function resetAdvanced(root) {
  const details = root.querySelector(".advanced-panel");
  if (details) details.open = true;
}
