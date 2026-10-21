import { PDFDocument, StandardFonts, degrees, rgb } from "@cantoo/pdf-lib";
import { withDisplaySpace } from "./pdf-rotation.js";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { canvasToBlob, parsePageRanges, yieldToUi } from "./utils.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const thumbCache = new WeakMap();
const MAX_RENDER_PIXELS = 36_000_000;

export { PDFDocument, StandardFonts, degrees, rgb, pdfjsLib };

export async function fileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

export async function openPdf(file, password) {
  const bytes = await fileBytes(file);
  return PDFDocument.load(bytes, { password, updateMetadata: false });
}

export async function openPdfBytes(bytes, password) {
  return PDFDocument.load(bytes, { password, updateMetadata: false });
}

export async function openPdfJs(file, password) {
  const bytes = await fileBytes(file);
  const task = pdfjsLib.getDocument({
    data: bytes,
    password,
    isEvalSupported: false,
    useSystemFonts: true
  });
  return task.promise;
}

export async function openPdfJsBytes(bytes, password) {
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    password,
    isEvalSupported: false,
    useSystemFonts: true
  });
  return task.promise;
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
    await doc?.destroy();
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
      const blob = await pdfPageToBlob(page, options);
      const extension = options.format === "png" ? "png" : "jpg";
      outputs.push({
        blob,
        name: `${base}-page-${String(pageNumber + 1).padStart(2, "0")}.${extension}`
      });
      page.cleanup();
      await yieldToUi();
    }
    progress(1, "Done");
    return outputs;
  } finally {
    await doc.destroy();
  }
}

export async function compressPdfStrong(file, options, { progress = () => {}, password } = {}) {
  const source = await openPdfJs(file, password);
  try {
    const target = await PDFDocument.create();
    const total = source.numPages;
    const dpi = Number(options.dpi) || 150;
    const scale = dpi / 72;
    const quality = Number(options.quality) || 0.7;
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      progress(((pageNumber - 1) / total) * 0.94, `Compressing page ${pageNumber} of ${total}…`);
      const page = await source.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const { canvas } = await renderPageToCanvas(page, scale);
      const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
      const image = await target.embedJpg(await jpeg.arrayBuffer());
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
    const bytes = await savePdf(target);
    progress(1, "Done");
    return new Blob([bytes], { type: "application/pdf" });
  } finally {
    await source.destroy();
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
    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = pages[index] + 1;
      progress((index / pages.length) * 0.95, `Reading page ${pageNumber} of ${total}…`);
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = "";
      let lastY = null;
      for (const item of content.items) {
        if (typeof item.str !== "string") continue;
        if (lastY !== null && Math.abs((item.transform?.[5] ?? 0) - lastY) > 2) {
          text += "\n";
        }
        text += item.str;
        if (item.hasEOL) text += "\n";
        lastY = item.transform?.[5] ?? lastY;
      }
      parts.push(`--- Page ${pageNumber} ---\n\n${text.replace(/[ \t]+\n/g, "\n").trim()}`);
      page.cleanup();
      await yieldToUi();
    }
    progress(1, "Done");
    return parts.join("\n\n\n");
  } finally {
    await doc.destroy();
  }
}

export async function getPdfPageCount(file, password) {
  const doc = await openPdfJs(file, password);
  const count = doc.numPages;
  await doc.destroy();
  return count;
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
    await doc.destroy();
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
  const opacity = Number(options.opacity) || 0.22;
  const angle = Number(options.rotation) || 0;
  const color = hexColor(options.color, { r: 108, g: 77, b: 246 });
  const fontRef = font;
  const textWidth = fontRef.widthOfTextAtSize(text, size);
  const textHeight = fontRef.heightAtSize(size);

  if (options.tile) {
    const stepX = Math.max(textWidth + 70, 180);
    const stepY = Math.max(textHeight + 110, 170);
    for (let y = -height; y < height * 1.6; y += stepY) {
      for (let x = -width; x < width * 1.6; x += stepX) {
        page.drawText(text, {
          x,
          y,
          size,
          font: fontRef,
          color,
          opacity,
          rotate: degrees(angle)
        });
      }
    }
    return;
  }

  let x = width / 2 - textWidth / 2;
  let y = height / 2 - textHeight / 2;
  const marginX = Math.max(24, width * 0.045);
  const marginY = Math.max(24, height * 0.05);
  const position = options.position || "center";

  if (position.startsWith("top")) y = height - textHeight - marginY;
  if (position.startsWith("bottom")) y = marginY;
  if (position.endsWith("left")) x = marginX;
  if (position.endsWith("right")) x = width - textWidth - marginX;

  page.drawText(text, {
    x,
    y,
    size,
    font: fontRef,
    color,
    opacity,
    rotate: degrees(angle)
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
