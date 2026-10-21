import { icon } from "./icons.js";
import { escapeHtml } from "../lib/utils.js";
import { getFavorites } from "../lib/storage.js";

export function toolCard(tool, { compact = false } = {}) {
  const favorite = getFavorites().includes(tool.slug);
  return `<article class="tool-card tone-${tool.tone} ${compact ? "is-compact" : ""}">
    <a class="tool-card-link" href="#/tool/${tool.slug}">
      <span class="tool-icon">${icon(tool.icon, { size: compact ? 21 : 24 })}</span>
      <span class="tool-card-text">
        <span class="tool-name">${escapeHtml(tool.name)}</span>
        <span class="tool-short">${escapeHtml(tool.short)}</span>
      </span>
      <span class="tool-go">${icon("ArrowRight", { size: 17 })}</span>
    </a>
    <button type="button" class="tool-fav ${favorite ? "is-active" : ""}" data-favorite="${
      tool.slug
    }" aria-label="${favorite ? "Remove" : "Add"} ${escapeHtml(tool.name)} ${
      favorite ? "from" : "to"
    } favorites" aria-pressed="${favorite}">
      ${icon("Star", { size: 15 })}
    </button>
    ${tool.badge ? `<span class="tool-badge">${escapeHtml(tool.badge)}</span>` : ""}
  </article>`;
}

export function toolGrid(tools, options = {}) {
  return `<div class="tool-grid ${options.compact ? "tool-grid-compact" : ""}">
    ${tools.map((tool) => toolCard(tool, options)).join("")}
  </div>`;
}

export function categoryCard(category, tools) {
  return `<a class="category-card tone-${category.tone}" href="#/${category.id}">
    <span class="category-icon">${icon(category.icon, { size: 28 })}</span>
    <span class="category-name">${escapeHtml(category.name)}</span>
    <span class="category-tagline">${escapeHtml(category.tagline)}</span>
    <span class="category-count">${tools.length} tools ${icon("ArrowRight", { size: 16 })}</span>
  </a>`;
}

export function relatedTools(current, all, limit = 4) {
  const related = all
    .filter((tool) => tool.slug !== current.slug && tool.category === current.category)
    .slice(0, limit);
  return related.map((tool) => toolCard(tool, { compact: true })).join("");
}

export function privacyCard() {
  return `<div class="side-card privacy-side">
    <span class="side-icon">${icon("ShieldCheck", { size: 22 })}</span>
    <h3>Private by architecture</h3>
    <p>Your files are opened with JavaScript on this device. They are never sent to a server, and we have no way to see them.</p>
    <ul class="check-list">
      <li>${icon("Check", { size: 14 })} No file uploads</li>
      <li>${icon("Check", { size: 14 })} No accounts or tracking pixels</li>
      <li>${icon("Check", { size: 14 })} Works offline after first load</li>
    </ul>
  </div>`;
}
