import { brandMark, icon } from "./icons.js";
import { getTheme, toggleTheme } from "../lib/storage.js";
import { toolCount } from "../data/tools.js";

export function renderShell(app) {
  app.innerHTML = `
    <div class="site-shell">
      <header class="site-header">
        <div class="container header-inner">
          <a class="brand" href="#/" aria-label="PixPDF home">
            ${brandMark(36)}
            <span class="brand-name">Pix<span>PDF</span></span>
          </a>
          <nav class="primary-nav" aria-label="Primary">
            <a href="#/pdf" data-nav="pdf">PDF tools</a>
            <a href="#/image" data-nav="image">Image tools</a>
            <a href="#/tools" data-nav="tools">All tools</a>
            <a href="#/about" data-nav="about">Why PixPDF</a>
          </nav>
          <div class="header-actions">
            <button type="button" class="search-trigger" data-open-search aria-label="Search tools">
              ${icon("Search", { size: 17 })}
              <span>Search ${toolCount} tools</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button type="button" class="icon-button theme-toggle" data-theme-toggle aria-label="Switch theme">
              ${icon(getTheme() === "dark" ? "Sun" : "Moon", { size: 19 })}
            </button>
            <a class="button button-primary button-sm header-cta" href="#/tools">${icon("LayoutGrid", {
              size: 16
            })} All tools</a>
            <button type="button" class="icon-button mobile-menu-button" data-mobile-menu aria-label="Open menu" aria-expanded="false">
              ${icon("Menu", { size: 21 })}
            </button>
          </div>
        </div>
        <div class="mobile-nav" data-mobile-nav hidden>
          <nav aria-label="Mobile">
            <a href="#/">Home ${icon("ArrowRight", { size: 16 })}</a>
            <a href="#/pdf">PDF tools ${icon("ArrowRight", { size: 16 })}</a>
            <a href="#/image">Image tools ${icon("ArrowRight", { size: 16 })}</a>
            <a href="#/tools">All tools ${icon("ArrowRight", { size: 16 })}</a>
            <a href="#/faq">Help & FAQ ${icon("ArrowRight", { size: 16 })}</a>
          </nav>
          <button type="button" class="button button-ghost button-block" data-open-search>${icon("Search", {
            size: 17
          })} Search tools</button>
        </div>
      </header>

      <main id="main" class="site-main" tabindex="-1"></main>

      <footer class="site-footer">
        <div class="container footer-top">
          <div class="footer-brand">
            <a class="brand" href="#/" aria-label="PixPDF home">
              ${brandMark(40)}
              <span class="brand-name">Pix<span>PDF</span></span>
            </a>
            <p>Every PDF and image tool you need, running quietly inside your browser.</p>
            <span class="footer-badge">${icon("ShieldCheck", { size: 15 })} 0 bytes uploaded</span>
          </div>
          <div class="footer-col">
            <h3>PDF tools</h3>
            <a href="#/tool/merge-pdf">Merge PDF</a>
            <a href="#/tool/split-pdf">Split PDF</a>
            <a href="#/tool/compress-pdf">Compress PDF</a>
            <a href="#/tool/sign-pdf">Sign PDF</a>
            <a href="#/pdf">All PDF tools</a>
          </div>
          <div class="footer-col">
            <h3>Image tools</h3>
            <a href="#/tool/compress-image">Compress image</a>
            <a href="#/tool/convert-image">Convert image</a>
            <a href="#/tool/remove-background">Remove background</a>
            <a href="#/tool/favicon-generator">Favicon generator</a>
            <a href="#/image">All image tools</a>
          </div>
          <div class="footer-col">
            <h3>Company</h3>
            <a href="#/about">About</a>
            <a href="#/faq">FAQ</a>
            <a href="#/privacy">Privacy</a>
            <a href="#/terms">Terms</a>
            <button type="button" class="footer-link-button" data-open-search>Search</button>
          </div>
        </div>
        <div class="container footer-bottom">
          <p>© ${new Date().getFullYear()} PixPDF. Built for people who value their privacy.</p>
          <p class="footer-note">${icon("Coffee", { size: 15 })} No accounts. No uploads. No nonsense.</p>
        </div>
      </footer>
    </div>
  `;

  const themeButton = app.querySelector("[data-theme-toggle]");
  const syncThemeButton = () => {
    themeButton.innerHTML = icon(getTheme() === "dark" ? "Sun" : "Moon", { size: 19 });
    themeButton.setAttribute(
      "aria-label",
      getTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
  };
  themeButton.addEventListener("click", () => {
    toggleTheme();
    syncThemeButton();
  });
  window.addEventListener("pixpdf:theme", syncThemeButton);

  const mobileButton = app.querySelector("[data-mobile-menu]");
  const mobileNav = app.querySelector("[data-mobile-nav]");
  const closeMobile = () => {
    mobileNav.hidden = true;
    mobileButton.setAttribute("aria-expanded", "false");
    mobileButton.innerHTML = icon("Menu", { size: 21 });
  };
  mobileButton.addEventListener("click", () => {
    const open = mobileNav.hidden;
    mobileNav.hidden = !open;
    mobileButton.setAttribute("aria-expanded", String(open));
    mobileButton.innerHTML = icon(open ? "X" : "Menu", { size: 21 });
  });
  mobileNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMobile();
  });
  window.addEventListener("hashchange", closeMobile);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobile();
  });

  app.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-search]")) {
      event.preventDefault();
      mobileNav.hidden = true;
      document.dispatchEvent(new CustomEvent("pixpdf:open-search"));
    }
  });

  return app.querySelector("#main");
}

export function updateNav(route) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const key = link.dataset.nav;
    const active =
      (route.name === "tools" && key === "tools") ||
      (route.name === "category" && key === route.category) ||
      (route.name === "tool" && key === route.tool.category) ||
      (route.name === "static" && route.slug === "about" && key === "about");
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

export function setMeta({ title, description }) {
  if (title) document.title = title;
  if (description) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }
}
