import "@fontsource-variable/plus-jakarta-sans";
import "./styles/main.css";

import { renderShell, updateNav, setMeta } from "./ui/layout.js";
import { initCommandPalette } from "./ui/command.js";
import { renderHome } from "./pages/home.js";
import { renderTools } from "./pages/tools.js";
import { renderToolPage } from "./pages/tool.js";
import { renderStatic, renderNotFound } from "./pages/static.js";
import { loadToolModule } from "./tools/registry.js";
import { getTool, toolCount } from "./data/tools.js";
import { toggleFavorite } from "./lib/storage.js";
import { toast } from "./ui/toast.js";
import { icon } from "./ui/icons.js";

const app = document.querySelector("#app");
const main = renderShell(app);
initCommandPalette();

let cleanup = null;
let renderToken = 0;

function parseRoute() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0].replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return { name: "home" };
  if (parts[0] === "tools") return { name: "tools" };
  if (parts[0] === "pdf" || parts[0] === "image") return { name: "category", category: parts[0] };
  if (parts[0] === "tool" && parts[1]) {
    const tool = getTool(parts[1]);
    return tool ? { name: "tool", tool } : { name: "notfound" };
  }
  if (["about", "faq", "privacy", "terms"].includes(parts[0])) {
    return { name: "static", slug: parts[0] };
  }
  return { name: "notfound" };
}

function showLoading() {
  document.title = "Loading… · PixPDF";
  main.innerHTML = `<div class="route-loading">
    <span class="route-loader">${icon("LoaderCircle", { size: 24, className: "spin" })}</span>
    <p>Opening your private workspace…</p>
  </div>`;
}

async function render() {
  const token = ++renderToken;
  cleanup?.();
  cleanup = null;
  const route = parseRoute();
  updateNav(route);
  window.scrollTo({ top: 0, behavior: "instant" });

  if (route.name === "home") {
    cleanup = renderHome(main);
    setMeta({
      title: "PixPDF — Every PDF & image tool, 100% private",
      description:
        `Merge, split, compress, convert, sign and edit PDFs and images right in your browser. ${toolCount} free tools. No uploads, no accounts, no watermark.`
    });
  } else if (route.name === "tools") {
    renderTools(main);
    setMeta({
      title: `All ${toolCount} PDF & image tools · PixPDF`,
      description:
        "Browse every PixPDF tool: merge and split PDFs, compress files, convert images, remove backgrounds, create favicons and more. All processed locally."
    });
  } else if (route.name === "category") {
    renderTools(main, { category: route.category });
    setMeta({
      title: route.category === "pdf" ? "Free private PDF tools · PixPDF" : "Free private image tools · PixPDF",
      description:
        route.category === "pdf"
          ? "Merge, split, compress, watermark, sign and organise PDFs locally in your browser. No uploads, no sign-up."
          : "Compress, resize, crop, convert and watermark images in your browser. Background remover, photo editor and favicon generator included."
    });
  } else if (route.name === "tool") {
    showLoading();
    try {
      const implementation = await loadToolModule(route.tool.slug);
      if (token !== renderToken) return;
      showLoading();
      cleanup = await renderToolPage(main, route.tool, implementation);
      if (token !== renderToken) {
        cleanup?.();
        cleanup = null;
        return;
      }
      setMeta({
        title: `${route.tool.name} — free & private · PixPDF`,
        description: `${route.tool.short} Runs entirely in your browser — your files are never uploaded.`
      });
    } catch (error) {
      console.error(error);
      if (token !== renderToken) return;
      renderNotFound(main);
      setMeta({ title: "Tool unavailable · PixPDF" });
    }
  } else if (route.name === "static") {
    renderStatic(main, route.slug);
    const meta = {
      about: {
        title: "About PixPDF — local-first file tools",
        description:
          "Why PixPDF processes every PDF and image inside your browser, and the open-source engines that make it possible."
      },
      faq: {
        title: "Help & FAQ · PixPDF",
        description:
          "Answers about PixPDF privacy, file limits, offline mode, passwords, compression and supported formats."
      },
      privacy: {
        title: "Privacy policy · PixPDF",
        description:
          "PixPDF does not upload your files. Learn exactly what happens in your browser and what data is (not) collected."
      },
      terms: {
        title: "Terms of use · PixPDF",
        description: "Plain-language terms for using PixPDF's local PDF and image tools."
      }
    }[route.slug];
    if (meta) setMeta(meta);
  } else {
    renderNotFound(main);
    setMeta({
      title: "Page not found · PixPDF",
      description: `This page could not be found. Browse all ${toolCount} private PDF and image tools instead.`
    });
  }

  main.focus({ preventScroll: true });
}

window.addEventListener("hashchange", render);

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const slug = button.dataset.favorite;
  const tool = getTool(slug);
  const active = toggleFavorite(slug);
  document.querySelectorAll(`[data-favorite="${slug}"]`).forEach((element) => {
    element.classList.toggle("is-active", active);
    element.setAttribute("aria-pressed", String(active));
    if (element.classList.contains("favorite-button")) {
      element.querySelector("span").textContent = active ? "Saved" : "Save tool";
    }
    element.setAttribute(
      "aria-label",
      active
        ? `Remove ${tool?.name || "tool"} from favourites`
        : `Add ${tool?.name || "tool"} to favourites`
    );
  });
  window.dispatchEvent(new CustomEvent("pixpdf:favorites", { detail: { slug, active } }));
  toast(
    active ? `${tool?.name || "Tool"} saved to your shortcuts.` : `${tool?.name || "Tool"} removed from shortcuts.`,
    { type: active ? "success" : "info", duration: 2600 }
  );
});

if (!window.location.hash) {
  window.history.replaceState(null, "", "#/");
}

render();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

let wasOffline = !navigator.onLine;
window.addEventListener("offline", () => {
  wasOffline = true;
  toast("You're offline — local tools will keep working.", { type: "info", duration: 5000 });
});
window.addEventListener("online", () => {
  if (wasOffline) {
    wasOffline = false;
    toast("Back online. Your files never left your device anyway.", { type: "success" });
  }
});
