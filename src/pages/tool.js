import { icon } from "../ui/icons.js";
import { privacyCard, relatedTools } from "../ui/cards.js";
import { GenericWorkspace } from "../ui/workspace.js";
import { escapeHtml } from "../lib/utils.js";
import { generalFaqs } from "../data/faqs.js";
import { getFavorites } from "../lib/storage.js";
import { tools } from "../data/tools.js";

export async function renderToolPage(main, tool, implementation) {
  const favorite = getFavorites().includes(tool.slug);
  const faqs = [generalFaqs[0], generalFaqs[3], generalFaqs[5]];
  const isPdf = tool.category === "pdf";
  const accepts = isPdf
    ? "PDF"
    : "JPG · PNG · WebP · GIF · BMP · SVG";

  main.innerHTML = `
    <section class="tool-hero tone-${tool.tone}">
      <div class="tool-hero-glow" aria-hidden="true"></div>
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="#/">Home</a> ${icon("ChevronRight", { size: 13 })}
          <a href="#/${tool.category}">${isPdf ? "PDF tools" : "Image tools"}</a>
          ${icon("ChevronRight", { size: 13 })}
          <span>${escapeHtml(tool.name)}</span>
        </nav>
        <div class="tool-hero-row">
          <div class="tool-heading">
            <span class="tool-icon tool-icon-lg">${icon(tool.icon, { size: 30 })}</span>
            <div>
              <div class="tool-title-row">
                <h1>${escapeHtml(tool.name)}</h1>
                ${tool.badge ? `<span class="pill-badge">${escapeHtml(tool.badge)}</span>` : ""}
              </div>
              <p>${escapeHtml(tool.description)}</p>
              <div class="tool-meta-row">
                <span>${icon("Lock", { size: 13 })} 100% local</span>
                <span>${icon("Zap", { size: 13 })} Instant</span>
                <span>${icon("Heart", { size: 13 })} Free</span>
                <span class="meta-formats">${icon("File", { size: 13 })} ${escapeHtml(accepts)}</span>
              </div>
            </div>
          </div>
          <button type="button" class="favorite-button ${favorite ? "is-active" : ""}" data-favorite="${
            tool.slug
          }" aria-pressed="${favorite}">
            ${icon("Star", { size: 17 })} <span>${favorite ? "Saved" : "Save tool"}</span>
          </button>
        </div>
      </div>
    </section>

    <section class="tool-body">
      <div class="container tool-layout">
        <div class="tool-main">
          <div class="workspace-mount" data-workspace-mount></div>

          <div class="tool-info-grid">
            <article class="info-card">
              <h2>${icon("Sparkles", { size: 18 })} How it works</h2>
              <ol class="number-list">
                <li><span>1</span><div><strong>Add your file${tool.multiple ? "s" : ""}</strong><p>Drop ${escapeHtml(
                  accepts
                )} into the workspace or browse your device.</p></div></li>
                <li><span>2</span><div><strong>Set your options</strong><p>Use the ready-made defaults or fine-tune the result.</p></div></li>
                <li><span>3</span><div><strong>Download</strong><p>Your new file is created locally and saved straight to your device.</p></div></li>
              </ol>
            </article>
            <article class="info-card">
              <h2>${icon("Zap", { size: 18 })} Good to know</h2>
              <ul class="check-list">
                ${tool.tips.map((tip) => `<li>${icon("Check", { size: 14 })}<span>${escapeHtml(tip)}</span></li>`).join("")}
                <li>${icon("ShieldCheck", { size: 14 })}<span>No files are ever uploaded.</span></li>
              </ul>
            </article>
          </div>

          <div class="tool-faq">
            <h2>${escapeHtml(tool.name)} — questions</h2>
            <div class="faq-list">
              ${faqs
                .map(
                  (faq, index) => `<details class="faq-item" ${index === 0 ? "open" : ""}>
                    <summary>${escapeHtml(faq.q)} ${icon("Plus", { size: 17 })}</summary>
                    <p>${escapeHtml(faq.a)}</p>
                  </details>`
                )
                .join("")}
            </div>
          </div>
        </div>

        <aside class="tool-side">
          ${privacyCard()}
          <div class="side-card">
            <h3>${icon("LayoutGrid", { size: 18 })} More ${isPdf ? "PDF" : "image"} tools</h3>
            <div class="related-list">
              ${relatedTools(tool, tools, 5)}
            </div>
            <a class="text-link side-link" href="#/${tool.category}">View all ${isPdf ? "PDF" : "image"} tools ${icon(
              "ArrowRight",
              { size: 14 }
            )}</a>
          </div>
        </aside>
      </div>
    </section>
  `;

  const mountEl = main.querySelector("[data-workspace-mount]");
  let workspace = null;
  let customCleanup = null;

  if (implementation.mount) {
    mountEl.innerHTML = `<div class="custom-loading">${icon("LoaderCircle", {
      size: 22,
      className: "spin"
    })} Preparing the workspace…</div>`;
    try {
      const cleanup = await implementation.mount(mountEl, { tool });
      if (typeof cleanup === "function") customCleanup = cleanup;
    } catch (error) {
      console.error(error);
      mountEl.innerHTML = `<div class="inline-error">${icon("TriangleAlert", {
        size: 18
      })}<div><strong>This tool could not start</strong><p>${escapeHtml(
        error.message || "Please refresh and try again."
      )}</p></div></div>`;
    }
  } else {
    workspace = new GenericWorkspace(tool, implementation, mountEl);
    workspace.mount();
  }

  return () => {
    workspace?.destroy();
    customCleanup?.();
  };
}
