// Keep the PDF engine usable in browsers that lack the newest Map helpers.
import "./polyfills.js";
import { PDFDocument, StandardFonts, degrees, rgb } from "@cantoo/pdf-lib";
import { withDisplaySpace } from "./pdf-rotation.js";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "./pdf-worker.js?worker&url";
import { canvasToBlob, parsePageRanges, yieldToUi } from "./utils.js";

/**
 * Point PDF.js at our own worker bootstrap (src/lib/pdf-worker.js). PDF.js
 * still creates and terminates workers itself, but every worker now installs
 * the newest Map/Math helpers before the engine starts — the decryptor needs
 * Math.sumPrecise, which older browsers do not have.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
function pdfWorkerPort() {
  return workerUrl;
}

const thumbCache = new WeakMap();
const MAX_RENDER_PIXELS = 36_000_000;

export { PDFDocument, StandardFonts, degrees, rgb, pdfjsLib };

export async function fileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

const PASSWORD_PATTERN = /password|encrypt|decrypt/i;
const isPasswordError = (error) => PASSWORD_PATTERN.test(String(error?.message || error || ""));

/**
 * pdf-lib is strict about cross-reference tables, while a lot of real-world
 * PDFs (scanner output, exported reports, files edited by other web tools)
 * have slightly broken offsets. Retry with the tolerant parser before giving
 * up so merge / split / rotate work on those files too.
 */
export async function openPdfBytes(bytes, password, extra = {}) {
  const attempts = [
    { password, updateMetadata: false, ...extra },
    {
      password,
      updateMetadata: false,
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      capNumbers: true,
      ...extra
    }
  ];
  let lastError;
  for (const options of attempts) {
    try {
      return await PDFDocument.load(bytes, options);
    } catch (error) {
      lastError = error;
      // Never hide a wrong-password error behind a tolerant retry.
      if (isPasswordError(error)) throw error;
    }
  }
  throw lastError || new Error("This PDF could not be read.");
}

export async function openPdf(file, password, extra) {
  const bytes = await fileBytes(file);
  return openPdfBytes(bytes, password, extra);
}

/**
 * PDF.js v6 removed `PDFDocumentProxy.destroy()`; the loading task owns the
 * worker now. Almost every tool in this app calls `doc.destroy()` in a finally
 * block, so we expose a compatible shim instead of touching 15 call sites.
 */
async function openPdfJsTask(task) {
  const doc = await task.promise;
  if (typeof doc.destroy !== "function") {
    let destroyed = false;
    doc.destroy = async () => {
      if (destroyed) return;
      destroyed = true;
      try {
        await task.destroy();
      } catch {
        /* The worker may already be gone; nothing else to clean up. */
      }
    };
  }
  return doc;
}

export async function openPdfJs(file, password) {
  pdfWorkerPort();
  const bytes = await fileBytes(file);
  const task = pdfjsLib.getDocument({
    data: bytes,
    password,
    isEvalSupported: false,
    useSystemFonts: true
  });
  return openPdfJsTask(task);
}

export async function openPdfJsBytes(bytes, password) {
  pdfWorkerPort();
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    password,
    isEvalSupported: false,
    useSystemFonts: true
  });
  return openPdfJsTask(task);
}

/** Safe cleanup for any PDF.js document proxy (v4, v5 or v6). */
export async function destroyPdfJs(doc) {
  if (!doc) return;
  try {
    if (typeof doc.destroy === "function") await doc.destroy();
    else if (typeof doc.cleanup === "function") await doc.cleanup();
  } catch {
    /* best-effort cleanup */
  }
}

export async function savePdf(doc, options) {
  return doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    ...options
  });
}

export { stripStaleEncryption } from "./pdf-security.js";
export { pageDisplayTransform, withDisplaySpace } from "./pdf-rotation.js";
export { A4, LETTER } from "./utils.js";

export function pdfBlob(bytes) {
  return new Blob([bytes], { type: "application/pdf" });
}

export async function pdfThumbnail(file, { width = 164, password } = {}) {
  const cacheKey = `${width}:${password || ""}`;
  const cached = thumbCache.get(file);
  if (cached && cached[cacheKey]) return cached[cacheKey];
  let doc;
  try {
    doc = await openPdfJs(file, password);
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(width / base.width, (width * 1.35) / base.height, 2);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    const entry = cached || {};
    entry[cacheKey] = dataUrl;
    thumbCache.set(file, entry);
    page.cleanup();
    return dataUrl;
  } catch {
    return null;
  } finally {
    await destroyPdfJs(doc);
  }
}

export async function renderPageToCanvas(page, scale = 2, background = "#ffffff") {
  let safeScale = scale;
  const base = page.getViewport({ scale: 1 });
  const pixels = base.width * safeScale * base.height * safeScale;
  if (pixels > MAX_RENDER_PIXELS) {
    safeScale *= Math.sqrt(MAX_RENDER_PIXELS / pixels);
  }
  const viewport = page.getViewport({ scale: safeScale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, background }).promise;
  return { canvas, viewport, scale: safeScale };
}

export async function pdfPageToBlob(page, { scale = 2, format = "jpg", quality = 0.9 } = {}) {
  const { canvas } = await renderPageToCanvas(page, scale);
  if (format === "png") return canvasToBlob(canvas, "image/png");
  return canvasToBlob(canvas, "image/jpeg", quality);
}

export async function pdfToImages(file, options, { progress = () => {}, password } = {}) {
  const doc = await openPdfJs(file, password);
  try {
    const total = doc.numPages;
    const pages = parsePageRanges(options.pages, total);
    const outputs = [];
    const base = file.name.replace(/\.pdf$/i, "") || "pdf";
    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = pages[index];
      progress((index / pages.length) * 0.92, `Rendering page ${pageNumber + 1} of ${total}…`);
      const page = await doc.getPage(pageNumber + 1);
      const viewport = page.getViewport({ scale: 1 });
      let scale = Number(options.scale) || 2;
      if (options.dpiMode === "dpi") scale = (Number(options.renderDpi) || 150) / 72;
      if (options.dpiMode === "width") scale = (Number(options.targetWidth) || 1600) / viewport.width;
      let { canvas } = await renderPageToCanvas(page, scale, options.background || "#ffffff");
      if (options.grayscale) {
        const gray = document.createElement("canvas");
        gray.width = canvas.width;
        gray.height = canvas.height;
        const context = gray.getContext("2d", { alpha: false });
        context.filter = "grayscale(100%)";
        context.drawImage(canvas, 0, 0);
        canvas.width = 1;
        canvas.height = 1;
        canvas = gray;
      }
      const format = options.format === "png" ? "png" : "jpg";
      const blob = await canvasToBlob(
        canvas,
        format === "png" ? "image/png" : "image/jpeg",
        format === "png" ? undefined : Number(options.quality) || 0.9
      );
      outputs.push({
        blob,
        name: `${base}-page-${String(pageNumber + 1).padStart(2, "0")}.${format}`
      });
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
      await yieldToUi();
    }
    progress(1, "Done");
    return outputs;
  } finally {
    await destroyPdfJs(doc);
  }
}

export async function compressPdfStrong(file, options, { progress = () => {}, password } = {}) {
  const source = await openPdfJs(file, password);
  try {
    const total = source.numPages;
    const dpi = Number(options.customDpi) > 0 ? Number(options.customDpi) : Number(options.dpi) || 150;
    const scale = dpi / 72;
    const requestedQuality = Math.max(0.1, Math.min(1, Number(options.quality) || 0.7));
    const pages = options.pages && String(options.pages).trim()
      ? parsePageRanges(options.pages, total)
      : Array.from({ length: total }, (_, index) => index);
    const grayscale = options.colorMode === "grayscale";
    const usePng = options.imageFormat === "png";
    const background = options.background || "#ffffff";

    const build = async (quality) => {
      const target = await PDFDocument.create();
      for (let index = 0; index < pages.length; index += 1) {
        const pageNumber = pages[index] + 1;
        progress((index / pages.length) * 0.94, `Compressing page ${pageNumber} of ${total}…`);
        const page = await source.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        let { canvas } = await renderPageToCanvas(page, scale, background);
        if (grayscale) {
          const gray = document.createElement("canvas");
          gray.width = canvas.width;
          gray.height = canvas.height;
          const ctx = gray.getContext("2d", { alpha: false });
          ctx.filter = "grayscale(100%)";
          ctx.drawImage(canvas, 0, 0);
          canvas.width = 1;
          canvas.height = 1;
          canvas = gray;
        }
        const blob = await canvasToBlob(
          canvas,
          usePng ? "image/png" : "image/jpeg",
          usePng ? undefined : quality
        );
        const image = usePng
          ? await target.embedPng(await blob.arrayBuffer())
          : await target.embedJpg(await blob.arrayBuffer());
        const newPage = target.addPage([baseViewport.width, baseViewport.height]);
        newPage.drawImage(image, {
          x: 0,
          y: 0,
          width: baseViewport.width,
          height: baseViewport.height
        });
        page.cleanup();
        canvas.width = 1;
        canvas.height = 1;
        await yieldToUi();
      }
      progress(0.97, "Writing PDF…");
      return { bytes: await savePdf(target), quality };
    };

    let result = await build(requestedQuality);
    const targetBytes = options.targetEnabled ? (Number(options.targetSizeKb) || 500) * 1024 : 0;
    // Only JPEG reacts to quality; for PNG the resolution preset is the lever.
    if (targetBytes > 0 && result.bytes.byteLength > targetBytes && !usePng) {
      const steps = [0.7, 0.55, 0.42, 0.32, 0.24, 0.18, 0.12];
      for (const step of steps) {
        if (step >= requestedQuality) continue;
        const attempt = await build(Math.min(step, requestedQuality));
        if (attempt.bytes.byteLength <= result.bytes.byteLength) result = attempt;
        if (result.bytes.byteLength <= targetBytes) break;
      }
    }
    progress(1, "Done");
    return new Blob([result.bytes], { type: "application/pdf" });
  } finally {
    await destroyPdfJs(source);
  }
}

/** Scale a page's content so it fits neatly inside a new page size. */
export function fitPageToSize(page, size) {
  if (!size) return;
  const box = page.getMediaBox();
  const scale = Math.min(size.width / box.width, size.height / box.height);
  if (!Number.isFinite(scale) || scale <= 0) return;
  const padX = (size.width - box.width * scale) / 2;
  const padY = (size.height - box.height * scale) / 2;
  try {
    page.scaleContent(scale, scale);
    page.translateContent(padX - box.x * scale, padY - box.y * scale);
    page.setMediaBox(0, 0, size.width, size.height);
    page.setCropBox(0, 0, size.width, size.height);
  } catch {
    /* keep the original geometry if the content stream refuses the transform */
  }
}

/** Copy the standard Info dictionary fields to a freshly created document. */
export function copyPdfMetadata(source, target) {
  try {
    const title = source.getTitle();
    const author = source.getAuthor();
    const subject = source.getSubject();
    const keywords = source.getKeywords();
    if (title) target.setTitle(title);
    if (author) target.setAuthor(author);
    if (subject) target.setSubject(subject);
    if (keywords?.length) target.setKeywords(keywords);
  } catch {
    /* metadata is optional */
  }
}

export async function compressPdfLossless(file, { progress = () => {}, password } = {}) {
  progress(0.3, "Reading document…");
  const doc = await openPdf(file, password);
  progress(0.7, "Optimizing object streams…");
  const bytes = await savePdf(doc);
  progress(1, "Done");
  return new Blob([bytes], { type: "application/pdf" });
}

export async function extractText(file, options, { progress = () => {}, password } = {}) {
  const doc = await openPdfJs(file, password);
  try {
    const total = doc.numPages;
    const pages = parsePageRanges(options.pages, total);
    const parts = [];
    const layout = options.layout || "lines";
    const separator = String(options.pageSeparator ?? "\n\n\n").replace(/\\n/g, "\n");
    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = pages[index] + 1;
      progress((index / pages.length) * 0.95, `Reading page ${pageNumber} of ${total}…`);
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = "";
      let lastY = null;
      for (const item of content.items) {
        if (typeof item.str !== "string") continue;
        if (layout === "raw") {
          text += `${item.str}\n`;
          continue;
        }
        if (lastY !== null && Math.abs((item.transform?.[5] ?? 0) - lastY) > 2) {
          text += "\n";
        }
        text += item.str;
        if (item.hasEOL) text += "\n";
        lastY = item.transform?.[5] ?? lastY;
      }
      if (layout === "paragraphs") {
        text = text.replace(/([^.!?:\n])\n(?!\n)/g, "$1 ");
      }
      if (options.trimLines !== false) {
        text = text
          .split("\n")
          .map((line) => line.replace(/[ \t]+$/g, ""))
          .join("\n");
      }
      if (options.normalizeSpaces) text = text.replace(/[ \t]{2,}/g, " ");
      text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      parts.push(options.pageHeaders === false ? text : `--- Page ${pageNumber} ---\n\n${text}`);
      page.cleanup();
      await yieldToUi();
    }
    progress(1, "Done");
    return parts.join(separator);
  } finally {
    await destroyPdfJs(doc);
  }
}

export async function getPdfPageCount(file, password) {
  try {
    const doc = await openPdfJs(file, password);
    const count = doc.numPages;
    await destroyPdfJs(doc);
    return count;
  } catch {
    // PDF.js is stricter about some malformed headers; pdf-lib can still read
    // the page tree in those cases.
    const doc = await openPdf(file, password);
    return doc.getPageCount();
  }
}

export async function getLibPageCount(file, password) {
  const doc = await openPdf(file, password);
  return doc.getPageCount();
}

export async function renderPdfPagePreview(file, pageNumber = 1, width = 640, password) {
  const doc = await openPdfJs(file, password);
  try {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(width / base.width, 3);
    const { canvas } = await renderPageToCanvas(page, scale);
    const dataUrl = canvas.toDataURL("image/png");
    page.cleanup();
    return dataUrl;
  } finally {
    await destroyPdfJs(doc);
  }
}

export function hexColor(hex, fallback = { r: 0, g: 0, b: 0 }) {
  const value = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return rgb(fallback.r, fallback.g, fallback.b);
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255
  );
}

export function drawWatermark(page, text, options, font) {
  return withDisplaySpace(page, ({ width, height }) => {
    const size = Number(options.size) || 54;
    const opacity = Math.min(1, (Number(options.opacity) || 0.22) + (Number(options.textOpacityBoost) || 0));
    const angle = Number(options.rotation) || 0;
    const color = hexColor(options.color, { r: 108, g: 77, b: 246 });
    const fontRef = font;
    const lines = options.multiline
      ? String(text).split(/\r?\n/).filter((line) => line.trim())
      : [text];
    const widest = Math.max(...lines.map((line) => fontRef.widthOfTextAtSize(line, size)), 1);
    const lineHeight = fontRef.heightAtSize(size) * 1.25;

    const paint = (line, x, y, fill, alpha, rotation = angle) => {
      page.drawText(line, {
        x,
        y,
        size,
        font: fontRef,
        color: fill,
        opacity: alpha,
        rotate: degrees(rotation)
      });
    };

    const outline = (line, x, y) => {
      const halo = rgb(1, 1, 1);
      for (const [dx, dy] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) {
        paint(line, x + dx, y + dy, halo, Math.min(0.85, opacity + 0.25));
      }
    };

    if (options.tile) {
      const gap = Number(options.tileGap) || 0;
      const stepX = Math.max(widest + 70 + gap, 180);
      const stepY = Math.max(lineHeight * lines.length + 110 + gap, 170);
      for (let y = -height; y < height * 1.6; y += stepY) {
        for (let x = -width; x < width * 1.6; x += stepX) {
          lines.forEach((line, lineIndex) => {
            if (options.outline) outline(line, x, y - lineIndex * lineHeight);
            paint(line, x, y - lineIndex * lineHeight, color, opacity);
          });
        }
      }
      return;
    }

    let x = options.useManual
      ? (Number(options.manualX) / 100) * width - widest / 2
      : width / 2 - widest / 2;
    let y = options.useManual
      ? (Number(options.manualY) / 100) * height - lineHeight / 2
      : height / 2 - lineHeight / 2;
    const marginX = Math.max(24, width * 0.045);
    const marginY = Math.max(24, height * 0.05);
    const position = options.position || "center";

    if (!options.useManual) {
      if (position.startsWith("top")) y = height - lineHeight - marginY - (lines.length - 1) * lineHeight;
      if (position.startsWith("bottom")) y = marginY + (lines.length - 1) * lineHeight;
      if (position.endsWith("left")) x = marginX;
      if (position.endsWith("right")) x = width - widest - marginX;
    }
    x = Math.max(-widest, Math.min(width, x));
    y = Math.max(-lineHeight, Math.min(height, y));

    lines.forEach((line, lineIndex) => {
      const lineY = y - lineIndex * lineHeight;
      if (options.outline) outline(line, x, lineY);
      paint(line, x, lineY, color, opacity);
    });
  });
}

export async function embedSignatureImage(doc, dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bytes = await blob.arrayBuffer();
  if (blob.type === "image/jpeg") return doc.embedJpg(bytes);
  return doc.embedPng(bytes);
}
