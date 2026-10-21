import { icon } from "../ui/icons.js";
import { toolCard } from "../ui/cards.js";
import {
  categories,
  getTool,
  searchTools,
  toolCount,
  tools,
  toolsByCategory
} from "../data/tools.js";
import { escapeHtml } from "../lib/utils.js";

export function renderTools(main, { category = null } = {}) {
  const activeCategory = category ? categories.find((item) => item.id === category) : null;
  const initialTools = category ? toolsByCategory(category) : tools;
  const title = activeCategory ? activeCategory.name : "All tools";
  const description = activeCategory
    ? activeCategory.tagline
    : "Every PDF and image tool in one private workspace. Search, pick a tool and get to work — no uploads.";
  let query = "";
  let filter = category || "all";

  main.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="#/">Home</a> ${icon("ChevronRight", { size: 13 })}
          ${activeCategory ? `<a href="#/tools">Tools</a> ${icon("ChevronRight", { size: 13 })} <span>${escapeHtml(title)}</span>` : `<span>All tools</span>`}
        </nav>
        <div class="page-hero-row">
          <div>
            <span class="eyebrow">${icon(activeCategory?.icon || "LayoutGrid", { size: 15 })} ${
              activeCategory ? `${initialTools.length} ${activeCategory.name.toLowerCase()}` : `${toolCount} tools, one workspace`
            }</span>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(description)}</p>
          </div>
          <div class="page-hero-badge">${icon("ShieldCheck", { size: 18 })}<span><strong>Private by default</strong><small>Files never leave your device</small></span></div>
        </div>
        <div class="tools-toolbar">
          <label class="search-field">
            ${icon("Search", { size: 18 })}
            <input type="search" placeholder="Search by task, file type or keyword…" aria-label="Search tools" data-tool-search />
            <kbd>Ctrl K</kbd>
          </label>
          <div class="filter-chips" role="group" aria-label="Filter by category">
            <button type="button" class="chip ${!category ? "is-active" : ""}" data-filter="all">All</button>
            ${categories
              .map(
                (item) =>
                  `<button type="button" class="chip ${category === item.id ? "is-active" : ""}" data-filter="${item.id}">${escapeHtml(
                    item.name
                  )} <span>${toolsByCategory(item.id).length}</span></button>`
              )
              .join("")}
          </div>
        </div>
      </div>
    </section>

    <section class="section section-tools-list">
      <div class="container">
        <div class="list-meta">
          <span data-result-count>${initialTools.length} tools</span>
          <span class="list-meta-note">${icon("Lock", { size: 13 })} No uploads · no account</span>
        </div>
        <div class="tool-grid" data-tools-grid>${initialTools.map((tool) => toolCard(tool)).join("")}</div>
        <div class="empty-state" data-empty hidden>
          <span class="empty-icon">${icon("Search", { size: 26 })}</span>
          <h2>No tools found</h2>
          <p>Try a shorter keyword like “merge”, “image”, “sign” or “compress”.</p>
          <button type="button" class="button button-ghost" data-clear-search>Clear search</button>
        </div>
      </div>
    </section>
  `;

  const grid = main.querySelector("[data-tools-grid]");
  const input = main.querySelector("[data-tool-search]");
  const count = main.querySelector("[data-result-count]");
  const empty = main.querySelector("[data-empty]");

  const update = () => {
    let pool = filter === "all" ? tools : toolsByCategory(filter);
    if (query.trim()) {
      const matches = new Set(searchTools(query).map((tool) => tool.slug));
      pool = pool.filter((tool) => matches.has(tool.slug));
    }
    count.textContent = `${pool.length} tool${pool.length === 1 ? "" : "s"}`;
    grid.innerHTML = pool.map((tool) => toolCard(tool)).join("");
    grid.hidden = pool.length === 0;
    empty.hidden = pool.length !== 0;
  };

  input.addEventListener("input", () => {
    query = input.value;
    update();
  });

  main.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      main.querySelectorAll("[data-filter]").forEach((chip) => {
        chip.classList.toggle("is-active", chip === button);
      });
      update();
    });
  });

  main.querySelector("[data-clear-search]").addEventListener("click", () => {
    input.value = "";
    query = "";
    update();
    input.focus();
  });
}
