import { icon } from "../ui/icons.js";
import { categoryCard, toolCard, toolGrid } from "../ui/cards.js";
import {
  POPULAR_SLUGS,
  categories,
  getTool,
  toolCount,
  tools,
  toolsByCategory
} from "../data/tools.js";
import { generalFaqs } from "../data/faqs.js";
import { stashFiles } from "../lib/stash.js";
import { isImageFile, isPdfFile } from "../lib/utils.js";
import { toast } from "../ui/toast.js";
import { getFavorites } from "../lib/storage.js";
import { escapeHtml } from "../lib/utils.js";

const SUGGESTIONS = {
  pdf: [
    { slug: "merge-pdf", why: "Combine everything into one document" },
    { slug: "compress-pdf", why: "Shrink the file for email or upload" },
    { slug: "pdf-to-jpg", why: "Turn pages into shareable images" },
    { slug: "split-pdf", why: "Break it into smaller files" },
    { slug: "organize-pdf", why: "Reorder or delete pages visually" },
    { slug: "protect-pdf", why: "Lock it with a password" }
  ],
  image: [
    { slug: "compress-image", why: "Make photos lighter in one click" },
    { slug: "image-to-pdf", why: "Bundle images into a PDF" },
    { slug: "remove-background", why: "Erase white or solid backgrounds" },
    { slug: "resize-image", why: "Resize for web, shops or print" },
    { slug: "convert-image", why: "Switch between JPG, PNG and WebP" },
    { slug: "watermark-image", why: "Add your name or copyright" }
  ]
};

export function renderHome(main) {
  const favorites = getFavorites().map((slug) => getTool(slug)).filter(Boolean);
  const popular = POPULAR_SLUGS.map((slug) => getTool(slug)).filter(Boolean);
  const pdfCount = toolsByCategory("pdf").length;
  const imageCount = toolsByCategory("image").length;

  main.innerHTML = `
    <section class="hero">
      <div class="hero-glow hero-glow-one" aria-hidden="true"></div>
      <div class="hero-glow hero-glow-two" aria-hidden="true"></div>
      <div class="container hero-inner">
        <div class="hero-copy">
          <span class="eyebrow">${icon("Sparkles", { size: 15 })} ${toolCount} tools. Zero uploads.</span>
          <h1>Every PDF &amp; image tool.<br /><span class="gradient-text">One private workspace.</span></h1>
          <p class="hero-lead">
            Merge, compress, convert, crop, sign and polish — without handing your files to a stranger's server.
            PixPDF does the work right here in your browser.
          </p>
          <div class="hero-actions">
            <a class="button button-primary button-lg" href="#/tools">Explore all ${toolCount} tools ${icon(
              "ArrowRight",
              { size: 18 }
            )}</a>
            <a class="button button-ghost button-lg" href="#how-it-works">${icon("MousePointerClick", {
              size: 18
            })} See how it works</a>
          </div>
          <div class="trust-row">
            <span>${icon("ShieldCheck", { size: 17 })}<strong>100% local</strong> processing</span>
            <span>${icon("Zap", { size: 17 })}<strong>Instant</strong> results</span>
            <span>${icon("Heart", { size: 17 })}<strong>Free</strong> forever</span>
          </div>
        </div>

        <div class="hero-visual">
          <div class="hero-panel">
            <div class="panel-top">
              <span class="live-dot"></span>
              <span>Private workspace</span>
              <span class="panel-badge">${icon("Lock", { size: 12 })} Local</span>
            </div>
            <div class="hero-drop" data-hero-drop role="button" tabindex="0" aria-label="Drop PDF or image files">
              <input type="file" accept=".pdf,image/*" multiple hidden data-hero-input />
              <span class="hero-drop-icon">${icon("Upload", { size: 27 })}</span>
              <h2>Drop your files here</h2>
              <p>PDFs or images · we'll suggest the right tool</p>
              <span class="button button-primary button-sm">${icon("Folder", { size: 16 })} Choose files</span>
              <span class="hero-drop-note">${icon("CloudOff", { size: 12 })} Nothing leaves this device</span>
            </div>
            <div class="quick-tools">
              <span class="quick-label">Jump straight in</span>
              <div class="quick-pills">
                <a href="#/tool/merge-pdf">${icon("Combine", { size: 14 })} Merge PDF</a>
                <a href="#/tool/compress-pdf">${icon("FileArchive", { size: 14 })} Compress</a>
                <a href="#/tool/sign-pdf">${icon("PenTool", { size: 14 })} Sign</a>
                <a href="#/tool/remove-background">${icon("Eraser", { size: 14 })} Remove BG</a>
              </div>
            </div>
            <div class="panel-foot">
              <span>${icon("Files", { size: 14 })} ${toolCount} tools</span>
              <span>${icon("ShieldCheck", { size: 14 })} 0 bytes uploaded</span>
            </div>
          </div>
          <div class="floating-chip floating-chip-a" aria-hidden="true">
            <span class="chip-icon">${icon("FileArchive", { size: 16 })}</span>
            <span><strong>Compressed</strong><small>8.4 MB → 1.1 MB</small></span>
          </div>
          <div class="floating-chip floating-chip-b" aria-hidden="true">
            <span class="chip-icon chip-icon-green">${icon("CircleCheck", { size: 16 })}</span>
            <span><strong>Done in 0.8s</strong><small>On your device</small></span>
          </div>
        </div>
      </div>
      <div class="container hero-stats">
        <div><strong>${toolCount}</strong><span>handcrafted tools</span></div>
        <div><strong>0</strong><span>files uploaded</span></div>
        <div><strong>0</strong><span>accounts required</span></div>
        <div><strong>100%</strong><span>free, no watermark</span></div>
      </div>
    </section>

    <section class="section section-favorites" data-favorites-section ${favorites.length ? "" : "hidden"}>
      <div class="container">
        <div class="section-head">
          <div>
            <span class="section-kicker">${icon("Star", { size: 14 })} Your shortcuts</span>
            <h2>Favourite tools, one tap away</h2>
          </div>
        </div>
        <div data-favorites-grid>${favorites.map((tool) => toolCard(tool, { compact: true })).join("")}</div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <span class="section-kicker">${icon("LayoutGrid", { size: 14 })} The whole toolbox</span>
            <h2>One workspace for every file</h2>
            <p>No switching between five sketchy websites. Every tool shares the same private, fast engine.</p>
          </div>
          <a class="button button-ghost" href="#/tools">Browse all ${toolCount} tools ${icon("ArrowRight", {
            size: 16
          })}</a>
        </div>
        <div class="category-grid">
          ${categories.map((category) => categoryCard(category, toolsByCategory(category.id))).join("")}
        </div>
        <div class="popular-head">
          <h3>${icon("Sparkles", { size: 17 })} Most-loved tools</h3>
          <span>${pdfCount} PDF · ${imageCount} image</span>
        </div>
        ${toolGrid(popular)}
      </div>
    </section>

    <section class="section section-tinted">
      <div class="container">
        <div class="section-head section-head-center">
          <div>
            <span class="section-kicker">${icon("ShieldCheck", { size: 14 })} Why PixPDF</span>
            <h2>Built like privacy actually matters</h2>
            <p>No server round-trips. No silent uploads. Just fast, local tools that respect your files.</p>
          </div>
        </div>
        <div class="feature-grid">
          <article class="feature-card">
            <span class="feature-icon tone-violet">${icon("ShieldCheck", { size: 24 })}</span>
            <h3>Private by architecture</h3>
            <p>Files are opened in your browser's memory. There is no upload endpoint to leak, log or sell.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon tone-orange">${icon("Zap", { size: 24 })}</span>
            <h3>No queue, no waiting</h3>
            <p>Your device does the processing. Skip the upload, the queue and the “your file is ready” email.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon tone-sky">${icon("WifiOff", { size: 24 })}</span>
            <h3>Works offline</h3>
            <p>After the first load, the app is cached. Edit a PDF on a plane, in a tunnel or on airplane Wi-Fi.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon tone-emerald">${icon("Heart", { size: 24 })}</span>
            <h3>Free, with no catch</h3>
            <p>No watermarks, no daily quota, no account wall. Use it once or a hundred times — it's genuinely free.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section" id="how-it-works">
      <div class="container">
        <div class="section-head section-head-center">
          <div>
            <span class="section-kicker">${icon("Sparkles", { size: 14 })} Simple by design</span>
            <h2>Three steps. That's it.</h2>
          </div>
        </div>
        <div class="steps">
          <article class="step-card">
            <span class="step-number">01</span>
            <span class="step-icon">${icon("Upload", { size: 23 })}</span>
            <h3>Drop a file</h3>
            <p>Choose a PDF or image from your device. Nothing starts uploading — because nothing uploads.</p>
          </article>
          <article class="step-card">
            <span class="step-number">02</span>
            <span class="step-icon">${icon("SlidersHorizontal", { size: 23 })}</span>
            <h3>Tune the details</h3>
            <p>Pick a quality, page range, watermark or destination format. Sensible defaults are ready to go.</p>
          </article>
          <article class="step-card">
            <span class="step-number">03</span>
            <span class="step-icon">${icon("Download", { size: 23 })}</span>
            <h3>Download instantly</h3>
            <p>Your result is generated locally and saved straight to your device. Close the tab when you're done.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section-tinted">
      <div class="container faq-layout">
        <div class="faq-intro">
          <span class="section-kicker">${icon("BookOpen", { size: 14 })} Good questions</span>
          <h2>Everything you might be wondering</h2>
          <p>Short, honest answers about privacy, limits and how the tools work.</p>
          <a class="button button-ghost" href="#/faq">Read the full FAQ ${icon("ArrowRight", { size: 16 })}</a>
        </div>
        <div class="faq-list">
          ${generalFaqs
            .slice(0, 5)
            .map(
              (faq, index) => `<details class="faq-item" ${index === 0 ? "open" : ""}>
                <summary>${escapeHtml(faq.q)} ${icon("Plus", { size: 17 })}</summary>
                <p>${escapeHtml(faq.a)}</p>
              </details>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="cta-band">
          <div class="cta-glow" aria-hidden="true"></div>
          <div>
            <span class="section-kicker">${icon("Sparkles", { size: 14 })} Ready when you are</span>
            <h2>Your next file task takes seconds.</h2>
            <p>Join the quiet rebellion against upload-and-wait tools. Everything you need is already in your browser.</p>
          </div>
          <div class="cta-actions">
            <a class="button button-white button-lg" href="#/tools">Browse all tools ${icon("ArrowRight", {
              size: 17
            })}</a>
            <a class="button button-glass button-lg" href="#/tool/compress-pdf">${icon("FileArchive", {
              size: 17
            })} Compress a PDF</a>
          </div>
        </div>
      </div>
    </section>
  `;

  bindHeroDrop(main);
  const removeFavoritesListener = bindFavorites(main);
  return () => {
    removeFavoritesListener();
    document.querySelectorAll(".chooser-dialog[open]").forEach((dialog) => dialog.close());
  };
}

function bindHeroDrop(main) {
  const drop = main.querySelector("[data-hero-drop]");
  const input = main.querySelector("[data-hero-input]");
  drop.addEventListener("click", (event) => {
    if (!event.target.closest(".button")) {
      input.click();
    }
  });
  drop.querySelector(".button").addEventListener("click", (event) => {
    event.stopPropagation();
    input.click();
  });
  drop.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  ["dragenter", "dragover"].forEach((type) =>
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add("is-dragging");
    })
  );
  ["dragleave", "dragend"].forEach((type) =>
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.remove("is-dragging");
    })
  );
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("is-dragging");
    handleIncoming(Array.from(event.dataTransfer?.files || []));
  });
  input.addEventListener("change", () => {
    handleIncoming(Array.from(input.files || []));
    input.value = "";
  });
}

function handleIncoming(files) {
  if (!files.length) return;
  const pdfs = files.filter(isPdfFile);
  const images = files.filter(isImageFile);
  const unknown = files.length - pdfs.length - images.length;
  if (unknown > 0) {
    toast("Please choose PDF or image files.", { type: "error" });
    if (!pdfs.length && !images.length) return;
  }
  if (pdfs.length && images.length) {
    toast("Drop PDFs or images separately so we can suggest the right tools.", {
      type: "error",
      duration: 5200
    });
    return;
  }
  const category = pdfs.length ? "pdf" : "image";
  const relevant = category === "pdf" ? pdfs : images;
  showChooser(relevant, category);
}

function showChooser(files, category) {
  const suggestions = SUGGESTIONS[category]
    .map((entry) => ({ ...entry, tool: getTool(entry.slug) }))
    .filter((entry) => entry.tool);
  const dialog = document.createElement("dialog");
  dialog.className = "chooser-dialog";
  dialog.innerHTML = `
    <div class="chooser-head">
      <span class="chooser-icon">${icon(category === "pdf" ? "FileText" : "ImagePlus", {
        size: 23
      })}</span>
      <div>
        <h2>${files.length} file${files.length === 1 ? "" : "s"} ready</h2>
        <p>What would you like to do?</p>
      </div>
      <button type="button" class="icon-button icon-button-sm" data-close aria-label="Close">${icon("X", {
        size: 18
      })}</button>
    </div>
    <div class="chooser-list">
      ${suggestions
        .map(
          (entry) => `<button type="button" class="chooser-option" data-pick="${entry.slug}">
            <span class="tool-icon tone-${entry.tool.tone}">${icon(entry.tool.icon, { size: 20 })}</span>
            <span><strong>${escapeHtml(entry.tool.name)}</strong><small>${escapeHtml(entry.why)}</small></span>
            ${icon("ChevronRight", { size: 17 })}
          </button>`
        )
        .join("")}
    </div>
    <div class="chooser-foot">
      <span>${icon("ShieldCheck", { size: 14 })} Files stay on this device</span>
      <a href="#/${category}" class="text-link">See all ${category === "pdf" ? "PDF" : "image"} tools</a>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => {
    dialog.close();
    setTimeout(() => dialog.remove(), 160);
  };
  dialog.querySelector("[data-close]").addEventListener("click", close);
  dialog.addEventListener("close", () => setTimeout(() => dialog.remove(), 160));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.querySelectorAll("[data-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      stashFiles(files);
      close();
      window.location.hash = `/tool/${button.dataset.pick}`;
    });
  });
  dialog.showModal();
  requestAnimationFrame(() => dialog.querySelector(".chooser-option")?.focus());
}

function bindFavorites(main) {
  const rerender = () => {
    const section = main.querySelector("[data-favorites-section]");
    const grid = main.querySelector("[data-favorites-grid]");
    if (!section || !grid) return;
    const favorites = getFavorites().map((slug) => getTool(slug)).filter(Boolean);
    section.hidden = favorites.length === 0;
    grid.innerHTML = favorites.map((tool) => toolCard(tool, { compact: true })).join("");
    grid.className = "tool-grid tool-grid-compact";
  };
  window.addEventListener("pixpdf:favorites", rerender);
  const grid = main.querySelector("[data-favorites-grid]");
  if (grid) grid.className = "tool-grid tool-grid-compact";
  return () => window.removeEventListener("pixpdf:favorites", rerender);
}
