/**
 * Shared "output" controls for every tool.
 *
 * Instead of re-implementing file naming, format conversion, DPI tagging and
 * target-size compression in 41 places, every workspace exposes the same
 * advanced output options and this module applies them to the produced blobs.
 * Anything that is not an image (PDF, ZIP, TXT, MD, ICO) is left untouched
 * except for its name.
 */
import { setImageDpi } from "./image-metadata.js";
import { canvasToBlob, clamp, formatBytes, sanitizeFilename } from "./utils.js";

const IMAGE_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp"
};

const EXT_FOR_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp"
};

export const OUTPUT_FORMATS = [
  { value: "keep", label: "Keep original format" },
  { value: "png", label: "PNG — lossless" },
  { value: "jpg", label: "JPG — smallest" },
  { value: "webp", label: "WebP — modern" }
];

export const DPI_CHOICES = [
  { value: "0", label: "Keep original DPI" },
  { value: "72", label: "72 DPI — screen" },
  { value: "96", label: "96 DPI — Windows" },
  { value: "150", label: "150 DPI — draft print" },
  { value: "300", label: "300 DPI — print" },
  { value: "600", label: "600 DPI — archival" }
];

function isRaster(blob) {
  if (!blob) return false;
  const type = (blob.type || "").toLowerCase();
  return type.startsWith("image/") && !type.includes("svg") && type !== "image/x-icon";
}

function currentFormat(blob, name = "") {
  const type = (blob?.type || "").toLowerCase();
  if (EXT_FOR_MIME[type]) return EXT_FOR_MIME[type];
  const match = /\.([a-z0-9]{1,5})$/i.exec(name || "");
  return match ? match[1].toLowerCase() : "png";
}

function replaceExtension(name, extension) {
  const base = String(name || "output").replace(/\.[a-z0-9]{1,6}$/i, "");
  return `${base || "output"}.${extension}`;
}

async function decode(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      /* fall through to the <img> decoder */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("This image could not be decoded."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Read the pixel size of an encoded image without touching the DOM layout. */
async function pixelSize(blob) {
  try {
    const source = await decode(blob);
    const size = { width: source.width || source.naturalWidth, height: source.height || source.naturalHeight };
    source.close?.();
    return size;
  } catch {
    return null;
  }
}

/**
 * Tools bake the output size into the name (`photo-1600x1067.jpg`). When a
 * target-size search shrinks the image afterwards, that suffix is a lie —
 * keep it in sync with the bytes we are actually handing over.
 */
async function syncSizeInName(name, blob) {
  const match = /-(\d+)x(\d+)(\.[a-z0-9]{2,5})$/i.exec(name);
  if (!match) return name;
  const size = await pixelSize(blob);
  if (!size?.width || !size?.height) return name;
  if (Number(match[1]) === size.width && Number(match[2]) === size.height) return name;
  return name.replace(/-(\d+)x(\d+)(\.[a-z0-9]{2,5})$/i, `-${size.width}x${size.height}$3`);
}

async function encode(blob, { format, quality, background, grayscale, scale = 1 }) {
  const source = await decode(blob);
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const flatten = format !== "png" && format !== "webp";
    if (flatten || background) {
      context.fillStyle = background || "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (grayscale) context.filter = "grayscale(100%)";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    context.filter = "none";
    const mime = IMAGE_MIME[format] || blob.type || "image/png";
    return canvasToBlob(canvas, mime, format === "png" ? undefined : quality);
  } finally {
    source.close?.();
  }
}

/**
 * Universal PDF metadata editing. Applied after a tool produces its PDF so
 * every PDF tool gets manual Title / Author / Subject / Keywords controls.
 * Encrypted documents (e.g. Protect PDF output) are deliberately skipped.
 */
async function applyPdfMetadata(blob, values) {
  const fields = ["pdfTitle", "pdfAuthor", "pdfSubject", "pdfKeywords"];
  if (!fields.some((key) => String(values[key] || "").trim())) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const head = bytes.subarray(0, Math.min(bytes.length, 4096));
  let latin = "";
  for (let i = 0; i < head.length; i += 1) latin += String.fromCharCode(head[i]);
  if (latin.includes("/Encrypt")) return blob;
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  const title = String(values.pdfTitle || "").trim();
  const author = String(values.pdfAuthor || "").trim();
  const subject = String(values.pdfSubject || "").trim();
  const keywords = String(values.pdfKeywords || "").trim();
  if (title) doc.setTitle(title);
  if (author) doc.setAuthor(author);
  if (subject) doc.setSubject(subject);
  if (keywords) doc.setKeywords(keywords.split(",").map((part) => part.trim()).filter(Boolean));
  doc.setProducer("PixPDF");
  const saved = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  return new Blob([saved], { type: "application/pdf" });
}

async function fitToSize(blob, targetBytes, settings) {
  let best = blob;
  let scale = 1;
  const baseFormat = settings.format === "keep" ? currentFormat(blob) : settings.format;
  const format = baseFormat === "webp" || baseFormat === "png" ? "jpg" : baseFormat;
  const qualities = [settings.quality, 0.8, 0.65, 0.5, 0.4, 0.3, 0.22];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (best.size <= targetBytes) return best;
    const quality = qualities[Math.min(attempt, qualities.length - 1)];
    const next = await encode(blob, { ...settings, format, quality, scale });
    if (next.size < best.size || attempt === 0) best = next;
    if (next.size <= targetBytes) return next;
    scale *= clamp(Math.sqrt(targetBytes / next.size) * 0.94, 0.55, 0.92);
    if (scale < 0.08) break;
  }
  return best;
}

/** Pick a safe, human-readable download name. */
export function applyOutputName(outputs, outputName, { zip = false } = {}) {
  const name = sanitizeFilename(String(outputName || "").trim(), "");
  if (!name) return outputs;
  if (zip) return outputs; // handled by the ZIP packer
  const renamed =
    outputs.length === 1
      ? [
          {
            ...outputs[0],
            name: `${name}.${/\.([a-z0-9]{1,6})$/i.exec(outputs[0].name)?.[1] || "bin"}`
          }
        ]
      : outputs.map((output, index) => ({
          ...output,
          name: `${name}-${String(index + 1).padStart(2, "0")}.${
            /\.([a-z0-9]{1,6})$/i.exec(output.name)?.[1] || "bin"
          }`
        }));
  // A plain .map() would drop the notes/warnings attached to the array.
  renamed.notes = outputs.notes;
  renamed.warnings = outputs.warnings;
  return renamed;
}

/**
 * Apply the shared advanced output settings. Always resolves to a valid
 * outputs array — a failure on one file never breaks the whole download.
 */
export async function applyOutputOptions(outputs, values = {}) {
  if (!outputs?.length) return outputs;
  const result = [];
  const extraNotes = [];
  const format = values.outputFormat || "keep";
  const quality = clamp(Number(values.outputQuality ?? 0.92) || 0.92, 0.1, 1);
  const background = values.outputBackground || "#ffffff";
  const dpi = Number(values.dpi) || 0;
  const targetKb = Number(values.targetSize) || 0;
  const grayscale = Boolean(values.outputGrayscale);
  const settings = { format, quality, background, grayscale };

  for (const output of outputs) {
    let blob = output.blob;
    let name = output.name;
    try {
      if (blob?.type === "application/pdf" || /\.pdf$/i.test(name)) {
        blob = await applyPdfMetadata(blob, values);
      } else if (isRaster(blob)) {
        const sourceFormat = currentFormat(blob, name);
        const wantsFormat = format !== "keep" && format !== sourceFormat;
        if (wantsFormat || grayscale || (targetKb > 0 && blob.size > targetKb * 1024)) {
          blob = await encode(blob, {
            ...settings,
            format: format === "keep" ? (sourceFormat === "bmp" || sourceFormat === "gif" ? "png" : sourceFormat) : format
          });
          name = replaceExtension(name, currentFormat(blob));
        }
        if (targetKb > 0 && blob.size > targetKb * 1024) {
          blob = await fitToSize(blob, targetKb * 1024, {
            ...settings,
            quality,
            format: format === "keep" ? "jpg" : format
          });
          name = replaceExtension(name, currentFormat(blob));
          name = await syncSizeInName(name, blob);
          if (blob.size > targetKb * 1024 * 1.02) {
            extraNotes.push(
              `${name}: ${formatBytes(blob.size)} is the smallest this image can get — the ${targetKb} KB target could not be reached.`
            );
          }
        }
        if (dpi > 0) blob = await setImageDpi(blob, dpi);
      }
    } catch (error) {
      console.warn("Output option skipped:", error);
    }
    result.push({ ...output, blob, name });
  }
  const baseNotes = Array.isArray(outputs.notes) ? outputs.notes : [];
  result.notes = [...baseNotes, ...extraNotes];
  result.warnings = outputs.warnings;
  return applyOutputName(result, values.outputName);
}

export function zipNameFor(values, fallback = "pixpdf-results.zip") {
  const preferred = sanitizeFilename(String(values?.outputName || "").trim(), "");
  // The fallback is often the tool's single-file name ("passport-photo.png");
  // a ZIP containing that file must not masquerade as a .png download.
  const base = preferred || String(fallback || "pixpdf-results.zip");
  const cleaned = base.replace(/\.(zip|pdf|png|jpe?g|webp|gif|bmp|ico|svg|txt|md|csv|json|html)$/i, "");
  return `${cleaned || "pixpdf-results"}.zip`;
}
