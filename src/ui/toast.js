import { icon } from "./icons.js";
import { escapeHtml } from "../lib/utils.js";

let region;

function ensureRegion() {
  if (region && document.body.contains(region)) return region;
  region = document.createElement("div");
  region.className = "toast-region";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "false");
  document.body.appendChild(region);
  return region;
}

export function toast(message, { type = "info", duration = 4200, action } = {}) {
  const host = ensureRegion();
  const element = document.createElement("div");
  const glyph = type === "success" ? "CircleCheck" : type === "error" ? "TriangleAlert" : "Info";
  element.className = `toast toast-${type}`;
  element.setAttribute("role", type === "error" ? "alert" : "status");
  element.innerHTML = `
    <span class="toast-icon">${icon(glyph, { size: 19 })}</span>
    <div class="toast-body">${escapeHtml(message)}</div>
    ${
      action
        ? `<button type="button" class="toast-action">${escapeHtml(action.label)}</button>`
        : ""
    }
    <button type="button" class="toast-close" aria-label="Dismiss notification">${icon("X", {
      size: 16
    })}</button>
  `;
  const remove = () => {
    element.classList.add("toast-out");
    setTimeout(() => element.remove(), 180);
  };
  element.querySelector(".toast-close").addEventListener("click", remove);
  if (action) {
    element.querySelector(".toast-action").addEventListener("click", () => {
      action.onClick?.();
      remove();
    });
  }
  host.appendChild(element);
  requestAnimationFrame(() => element.classList.add("toast-in"));
  if (duration > 0) setTimeout(remove, duration);
  return { close: remove };
}
