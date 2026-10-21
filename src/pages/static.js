import { icon } from "../ui/icons.js";
import { generalFaqs } from "../data/faqs.js";
import { escapeHtml } from "../lib/utils.js";
import { toolCount } from "../data/tools.js";

export function renderStatic(main, slug) {
  if (slug === "faq") return renderFaq(main);
  if (slug === "privacy") return renderPrivacy(main);
  if (slug === "terms") return renderTerms(main);
  return renderAbout(main);
}

function pageHero(title, lead, kicker = "PixPDF") {
  return `<section class="page-hero page-hero-simple">
    <div class="container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Home</a> ${icon("ChevronRight", { size: 13 })} <span>${escapeHtml(title)}</span>
      </nav>
      <span class="eyebrow">${icon("Sparkles", { size: 15 })} ${escapeHtml(kicker)}</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${lead}</p>
    </div>
  </section>`;
}

function renderAbout(main) {
  main.innerHTML = `
    ${pageHero(
      "Tools that keep your files yours",
      "PixPDF is a local-first toolkit built on a simple belief: your documents should not have to leave your device just to get smaller, signed or converted.",
      "Our story"
    )}
    <section class="section">
      <div class="container prose-layout">
        <div class="prose">
          <h2>Why we built it</h2>
          <p>
            Most online PDF sites ask you to upload private contracts, medical records and family photos to
            an unknown server. Then they show ads, add watermarks or hide the download behind a subscription.
            The whole dance exists because the processing happens far away.
          </p>
          <p>
            Modern browsers are extraordinarily capable. They can parse PDFs, render pages, embed fonts, encrypt
            documents, resize photos and zip results — all without a server. PixPDF is an attempt to take that
            capability seriously and wrap it in an interface that feels effortless.
          </p>
          <div class="pull-quote">
            ${icon("Lock", { size: 22 })}
            <p>If a tool can run on your device, it should. Privacy is not a feature you toggle — it is the architecture.</p>
          </div>
          <h2>What powers the tools</h2>
          <p>
            The document engine is <strong>pdf-lib</strong>, the rendering engine is <strong>PDF.js</strong> (the
            same open-source project behind Firefox's PDF viewer), and image tools use the Canvas API. Packaging
            is handled in-browser with JSZip. No analytics scripts, no advertising pixels, no third-party uploads.
          </p>
          <h2>What we believe</h2>
          <ul class="check-list check-list-lg">
            <li>${icon("Check", { size: 16 })}<span><strong>Local first.</strong> The network should be a last resort, not a requirement.</span></li>
            <li>${icon("Check", { size: 16 })}<span><strong>No dark patterns.</strong> No forced sign-ups, fake countdowns or “download” buttons that are ads.</span></li>
            <li>${icon("Check", { size: 16 })}<span><strong>Honest tools.</strong> If a result loses quality, we say so. If a signature is visual rather than certified, we say that too.</span></li>
            <li>${icon("Check", { size: 16 })}<span><strong>Fast by default.</strong> Sensible settings, instant previews and zero queueing.</span></li>
          </ul>
        </div>
        <aside class="about-side">
          <div class="stat-card">
            <strong>${toolCount}</strong>
            <span>tools in one workspace</span>
          </div>
          <div class="stat-card">
            <strong>0</strong>
            <span>bytes uploaded</span>
          </div>
          <div class="stat-card">
            <strong>0</strong>
            <span>accounts, cookies or trackers</span>
          </div>
          <div class="side-card">
            <h3>${icon("Heart", { size: 18 })} Made for the open web</h3>
            <p>PixPDF is a static site. After the first load, most of it works without a connection.</p>
            <a class="button button-ghost button-block" href="#/tools">Explore the tools ${icon("ArrowRight", {
              size: 15
            })}</a>
          </div>
        </aside>
      </div>
    </section>
    <section class="section section-tinted">
      <div class="container">
        <div class="cta-band">
          <div class="cta-glow" aria-hidden="true"></div>
          <div>
            <span class="section-kicker">${icon("Sparkles", { size: 14 })} Try it yourself</span>
            <h2>See how fast local can feel.</h2>
            <p>Open a tool, drop a file and watch the result appear. No upload bar included.</p>
          </div>
          <div class="cta-actions">
            <a class="button button-white button-lg" href="#/tools">Browse tools ${icon("ArrowRight", { size: 17 })}</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderFaq(main) {
  main.innerHTML = `
    ${pageHero(
      "Help & FAQ",
      "Honest answers about privacy, limits, formats and how each tool behaves. Can't find what you need? Every answer below is written to be useful, not legal filler.",
      "Support"
    )}
    <section class="section">
      <div class="container faq-layout faq-layout-wide">
        <div class="faq-intro">
          <span class="section-kicker">${icon("BookOpen", { size: 14 })} Quick links</span>
          <h2>Jump to a topic</h2>
          <div class="faq-nav">
            <a href="#/faq">General</a>
            <a href="#/privacy">Privacy & security</a>
            <a href="#/tool/compress-pdf">Compressing PDFs</a>
            <a href="#/tool/remove-background">Removing backgrounds</a>
            <a href="#/terms">Terms of use</a>
          </div>
          <div class="side-card help-card">
            <h3>${icon("Keyboard", { size: 18 })} Work faster</h3>
            <p>Press <kbd>Ctrl</kbd> + <kbd>K</kbd> anywhere to search all tools, or <kbd>/</kbd> to jump straight in.</p>
          </div>
        </div>
        <div class="faq-list faq-list-all">
          ${generalFaqs
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
  `;
}

function renderPrivacy(main) {
  main.innerHTML = `
    ${pageHero(
      "Privacy, without the fine print",
      "PixPDF does not upload your files. There is no file server, no cloud bucket and no account database to breach. Here is exactly what that means.",
      "Privacy"
    )}
    <section class="section">
      <div class="container prose-layout">
        <div class="prose">
          <div class="privacy-highlight">
            ${icon("ShieldCheck", { size: 24 })}
            <div>
              <strong>The short version</strong>
              <p>Your files are processed in your browser's memory. They never travel to PixPDF or any third party. When you close the tab, they are gone.</p>
            </div>
          </div>
          <h2>What happens when you add a file</h2>
          <p>
            The browser reads the file into memory using the File API. JavaScript libraries parse and modify it
            locally. When you click download, the browser creates a local object URL and saves the result to your
            device. At no point does the file content pass through a network request.
          </p>
          <h2>What we do not collect</h2>
          <ul class="check-list check-list-lg">
            <li>${icon("Check", { size: 16 })}<span>No uploaded files or thumbnails.</span></li>
            <li>${icon("Check", { size: 16 })}<span>No account names, email addresses or passwords.</span></li>
            <li>${icon("Check", { size: 16 })}<span>No advertising trackers or cross-site pixels.</span></li>
            <li>${icon("Check", { size: 16 })}<span>No file names sent to an analytics service.</span></li>
          </ul>
          <h2>Local storage</h2>
          <p>
            The app stores two small preferences in your browser: your light/dark theme and your favourite tools.
            These stay on your device and can be cleared from your browser settings at any time. They contain no
            information about your files.
          </p>
          <h2>Service worker & offline mode</h2>
          <p>
            A service worker caches the app's static assets so it can load without a network connection. This cache
            contains code, fonts and icons only — never your documents. You can clear it with your browser's site
            data controls.
          </p>
          <h2>Third-party libraries</h2>
          <p>
            The tools use open-source libraries (pdf-lib, PDF.js, JSZip and Lucide icons) that are bundled with the
            site. They run locally and do not make network requests while processing files.
          </p>
          <h2>Children's privacy</h2>
          <p>
            PixPDF has no accounts and no data collection, so it does not knowingly collect personal information
            from anyone, including children.
          </p>
          <h2>Contact</h2>
          <p>
            This is a static, privacy-first project. For privacy questions, open an issue on the project's source
            repository if one is available, or consult the operator of the domain you loaded this copy from.
          </p>
          <p class="prose-note">Last updated: ${new Date().toLocaleDateString("en", {
            year: "numeric",
            month: "long",
            day: "numeric"
          })}</p>
        </div>
        <aside class="about-side">
          <div class="side-card privacy-side">
            <span class="side-icon">${icon("CloudOff", { size: 22 })}</span>
            <h3>Test it yourself</h3>
            <p>Load a tool, then switch your device to airplane mode. Most tools will keep working — proof that the network is not involved.</p>
          </div>
          <div class="side-card">
            <h3>${icon("Lock", { size: 18 })} Encryption</h3>
            <p>Protect PDF adds AES-256 encryption locally. Passwords are never transmitted or stored by PixPDF.</p>
            <a class="text-link" href="#/tool/protect-pdf">Protect a PDF ${icon("ArrowRight", { size: 14 })}</a>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function renderTerms(main) {
  main.innerHTML = `
    ${pageHero(
      "Terms of use",
      "Plain-language terms for using this local-first toolkit. Use it responsibly, and keep backups of anything important.",
      "Legal"
    )}
    <section class="section">
      <div class="container prose-layout">
        <div class="prose">
          <h2>1. Using PixPDF</h2>
          <p>
            PixPDF is provided as a free utility. You may use it for personal or commercial documents that you
            have the right to modify. You are responsible for the files you process and for keeping backups.
          </p>
          <h2>2. No warranty</h2>
          <p>
            The tools are provided “as is” without warranties of any kind. While we aim for reliable results,
            file conversion is complex and unexpected output is possible. Always verify important documents before
            sending or relying on them.
          </p>
          <h2>3. Your responsibilities</h2>
          <ul class="check-list check-list-lg">
            <li>${icon("Check", { size: 16 })}<span>Only process files you own or have permission to edit.</span></li>
            <li>${icon("Check", { size: 16 })}<span>Do not use the tools to remove protections from documents you do not control.</span></li>
            <li>${icon("Check", { size: 16 })}<span>Keep backups of originals; overwriting is never automatic but mistakes happen.</span></li>
          </ul>
          <h2>4. Passwords and protected files</h2>
          <p>
            Protect PDF encrypts files locally. PixPDF cannot recover lost passwords. Unlock PDF is intended for
            documents you own or are authorised to modify.
          </p>
          <h2>5. Third-party names</h2>
          <p>
            Any product names or trademarks mentioned belong to their respective owners. PixPDF is an independent
            project and is not endorsed by the authors of the open-source libraries it uses.
          </p>
          <h2>6. Changes</h2>
          <p>
            These terms may be updated as the app evolves. The current version is always available on this page.
          </p>
          <p class="prose-note">Last updated: ${new Date().toLocaleDateString("en", {
            year: "numeric",
            month: "long",
            day: "numeric"
          })}</p>
        </div>
        <aside class="about-side">
          <div class="side-card">
            <h3>${icon("ShieldCheck", { size: 18 })} Your files stay yours</h3>
            <p>Every operation happens locally. There is no server-side copy, no storage and no account to close.</p>
            <a class="text-link" href="#/privacy">Read the privacy page ${icon("ArrowRight", { size: 14 })}</a>
          </div>
        </aside>
      </div>
    </section>
  `;
}

export function renderNotFound(main) {
  main.innerHTML = `
    <section class="not-found">
      <div class="container">
        <span class="not-found-code">404</span>
        <h1>This page went missing</h1>
        <p>The link may be old, or the tool may have moved. The good news: all ${toolCount} tools are still right here.</p>
        <div class="not-found-actions">
          <a class="button button-primary button-lg" href="#/tools">Browse all tools ${icon("ArrowRight", {
            size: 17
          })}</a>
          <a class="button button-ghost button-lg" href="#/">Back home</a>
        </div>
        <div class="not-found-tools">
          <a href="#/tool/merge-pdf">${icon("Combine", { size: 16 })} Merge PDF</a>
          <a href="#/tool/compress-pdf">${icon("FileArchive", { size: 16 })} Compress PDF</a>
          <a href="#/tool/compress-image">${icon("ImageDown", { size: 16 })} Compress image</a>
          <a href="#/tool/sign-pdf">${icon("PenTool", { size: 16 })} Sign PDF</a>
        </div>
      </div>
    </section>
  `;
}
