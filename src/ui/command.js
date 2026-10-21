import { icon } from "./icons.js";
import { escapeHtml, debounce } from "../lib/utils.js";
import { POPULAR_SLUGS, getTool, searchTools, tools } from "../data/tools.js";
import { getRecent } from "../lib/storage.js";

export function initCommandPalette() {
  const dialog = document.createElement("dialog");
  dialog.className = "command-dialog";
  dialog.setAttribute("aria-label", "Search PixPDF tools");
  dialog.innerHTML = `
    <div class="command-box">
      <div class="command-search">
        ${icon("Search", { size: 20 })}
        <input type="text" placeholder="Search all ${tools.length} tools…" aria-label="Search tools" autocomplete="off" spellcheck="false" />
        <kbd>Esc</kbd>
      </div>
      <div class="command-results" role="listbox" aria-label="Search results"></div>
      <div class="command-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span class="command-privacy">${icon("Lock", { size: 12 })} Local tools only</span>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  const input = dialog.querySelector("input");
  const resultsEl = dialog.querySelector(".command-results");
  let activeIndex = 0;
  let results = [];

  const commands = [
    { name: "Home", href: "#/", icon: "Sparkles", meta: "Landing page" },
    { name: "All tools", href: "#/tools", icon: "LayoutGrid", meta: "Browse everything" },
    { name: "PDF tools", href: "#/pdf", icon: "FileText", meta: "16 document tools" },
    { name: "Image tools", href: "#/image", icon: "ImagePlus", meta: "10 image tools" },
    { name: "Help & FAQ", href: "#/faq", icon: "BookOpen", meta: "Answers and tips" }
  ];

  function render(query = "") {
    const trimmed = query.trim();
    let items = [];
    if (!trimmed) {
      const recent = getRecent()
        .map((slug) => getTool(slug))
        .filter(Boolean)
        .slice(0, 4);
      const recentSlugs = new Set(recent.map((tool) => tool.slug));
      const popular = POPULAR_SLUGS.map((slug) => getTool(slug))
        .filter((tool) => tool && !recentSlugs.has(tool.slug))
        .slice(0, 5);
      items = [
        ...recent.map((tool) => ({ ...tool, meta: "Recently used", href: `#/tool/${tool.slug}` })),
        ...(recent.length ? [{ heading: "Popular tools" }] : []),
        ...popular.map((tool) => ({
          name: tool.name,
          icon: tool.icon,
          meta: tool.short,
          href: `#/tool/${tool.slug}`,
          badge: tool.category === "pdf" ? "PDF" : "Image"
        })),
        { heading: "Pages" },
        ...commands
      ];
    } else {
      const matches = searchTools(trimmed).slice(0, 8);
      items = matches.map((tool) => ({
        name: tool.name,
        icon: tool.icon,
        meta: tool.short,
        href: `#/tool/${tool.slug}`,
        badge: tool.category === "pdf" ? "PDF" : "Image"
      }));
      const pageMatches = commands.filter((command) =>
        command.name.toLowerCase().includes(trimmed.toLowerCase())
      );
      if (pageMatches.length) {
        if (matches.length) items.push({ heading: "Pages" });
        items.push(...pageMatches);
      }
      if (!items.length) {
        items = [{ empty: `No tools match “${trimmed}”. Try “merge”, “compress” or “crop”.` }];
      }
    }
    const openable = items.filter((item) => !item.heading && !item.empty);
    if (activeIndex >= openable.length) activeIndex = 0;
    results = items;
    let openIndex = 0;
    resultsEl.innerHTML = items
      .map((item) => {
        if (item.heading) return `<div class="command-heading">${escapeHtml(item.heading)}</div>`;
        if (item.empty) return `<div class="command-empty">${escapeHtml(item.empty)}</div>`;
        const index = openIndex;
        openIndex += 1;
        return `<a class="command-item ${index === activeIndex ? "is-active" : ""}" href="${
          item.href
        }" role="option" aria-selected="${index === activeIndex}" data-command-index="${index}">
          <span class="command-item-icon">${icon(item.icon || "Search", { size: 18 })}</span>
          <span class="command-item-text">
            <span class="command-item-name">${escapeHtml(item.name)}</span>
            <span class="command-item-meta">${escapeHtml(item.meta || "")}</span>
          </span>
          ${item.badge ? `<span class="command-badge">${escapeHtml(item.badge)}</span>` : ""}
          <span class="command-enter">↵</span>
        </a>`;
      })
      .join("");
  }

  function setActive(index) {
    const openable = results.filter((item) => !item.heading && !item.empty);
    if (!openable.length) return;
    activeIndex = (index + openable.length) % openable.length;
    resultsEl.querySelectorAll(".command-item").forEach((element, itemIndex) => {
      const isActive = itemIndex === activeIndex;
      element.classList.toggle("is-active", isActive);
      element.setAttribute("aria-selected", String(isActive));
      if (isActive) element.scrollIntoView({ block: "nearest" });
    });
  }

  function open() {
    if (dialog.open) return;
    activeIndex = 0;
    input.value = "";
    render("");
    dialog.showModal();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  document.addEventListener("pixpdf:open-search", open);
  document.addEventListener("keydown", (event) => {
    const isTyping =
      event.target instanceof HTMLElement &&
      (event.target.matches("input, textarea, select") || event.target.isContentEditable);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (dialog.open) close();
      else open();
    } else if (event.key === "/" && !isTyping && !dialog.open) {
      event.preventDefault();
      open();
    }
  });

  input.addEventListener(
    "input",
    debounce(() => {
      activeIndex = 0;
      render(input.value);
    }, 80)
  );

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Enter") {
      const openable = results.filter((item) => !item.heading && !item.empty);
      const item = openable[activeIndex];
      if (item) {
        event.preventDefault();
        close();
        window.location.hash = item.href.replace(/^#/, "");
      }
    } else if (event.key === "Escape") {
      close();
    }
  });

  resultsEl.addEventListener("click", (event) => {
    const item = event.target.closest(".command-item");
    if (item) close();
  });

  resultsEl.addEventListener("mousemove", (event) => {
    const item = event.target.closest(".command-item");
    if (!item) return;
    const index = Number(item.dataset.commandIndex);
    if (Number.isFinite(index) && index !== activeIndex) setActive(index);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("command-open");
  });
  dialog.addEventListener("show", () => document.body.classList.add("command-open"));
}
