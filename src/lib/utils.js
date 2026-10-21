export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function formatBytes(bytes, decimals = 1) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  const fixed = index === 0 || value >= 100 ? 0 : decimals;
  return `${value.toFixed(fixed)} ${units[index]}`;
}

export function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function sanitizeFilename(name, fallback = "file") {
  const cleaned = String(name || "")
    .replace(/\.[^./\\]+$/, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
  return cleaned || fallback;
}

export function extensionOf(name = "") {
  const match = /\.([a-z0-9]{1,6})$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function nextFrame() {
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export async function canvasToBlob(canvas, type = "image/png", quality) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error("Your browser could not export this image. Try a different format.");
  return blob;
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(blob);
  });
}

export function readText(file) {
  return file.text();
}

export function hexToRgb(hex) {
  let value = String(hex || "#000000").replace("#", "").trim();
  if (value.length === 3) value = value.split("").map((char) => char + char).join("");
  if (!/^[0-9a-f]{6}$/i.test(value)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mmToPt(mm) {
  return (Number(mm) || 0) * 2.834645669;
}

export const A4 = { width: 595.28, height: 841.89 };
export const LETTER = { width: 612, height: 792 };

export function parsePageRanges(input, totalPages, { allowEmptyAll = true } = {}) {
  const text = String(input ?? "").trim();
  if (!text) {
    if (!allowEmptyAll) throw new Error("Enter at least one page.");
    return Array.from({ length: totalPages }, (_, index) => index);
  }
  if (totalPages < 1) throw new Error("This PDF has no pages.");
  const pages = [];
  const seen = new Set();
  const chunks = text.match(/\d+\s*[-–]\s*\d+|\d+/g) || [];
  const leftover = text.replace(/\d+\s*[-–]\s*\d+|\d+/g, "").replace(/[,;\s]+/g, "");
  if (!chunks.length || leftover) {
    throw new Error("Use page numbers and ranges such as 1-3, 7, 10-12.");
  }
  for (const chunk of chunks) {
    const rangeMatch = /^(\d+)\s*[-–]\s*(\d+)$/.exec(chunk);
    const singleMatch = /^(\d+)$/.exec(chunk);
    if (rangeMatch) {
      let start = Number(rangeMatch[1]);
      let end = Number(rangeMatch[2]);
      if (start > end) [start, end] = [end, start];
      if (start < 1 || end > totalPages) {
        throw new Error(`Page range “${chunk}” is outside this PDF (1–${totalPages}).`);
      }
      for (let page = start; page <= end; page += 1) {
        if (!seen.has(page)) {
          seen.add(page);
          pages.push(page - 1);
        }
      }
    } else {
      const page = Number(singleMatch[1]);
      if (page < 1 || page > totalPages) {
        throw new Error(`Page ${page} is outside this PDF (1–${totalPages}).`);
      }
      if (!seen.has(page)) {
        seen.add(page);
        pages.push(page - 1);
      }
    }
  }
  if (!pages.length) throw new Error("No valid pages were selected.");
  return pages;
}

export function parsePageRangeGroups(input, totalPages) {
  const groups = String(input ?? "")
    .split(/[,;\n]+/)
    .map((group) => group.trim())
    .filter(Boolean);
  if (!groups.length) throw new Error("Enter at least one page range.");
  return groups.map((group) => parsePageRanges(group, totalPages, { allowEmptyAll: false }));
}

export function pageLabel(indices) {
  if (!indices.length) return "no pages";
  const first = indices[0] + 1;
  const last = indices[indices.length - 1] + 1;
  return indices.length === 1 ? `page ${first}` : `pages ${first}–${last}`;
}

export function debounce(fn, wait = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function isPdfFile(file) {
  return (
    file.type === "application/pdf" ||
    /\.pdf$/i.test(file.name || "")
  );
}

export function isImageFile(file) {
  return (
    (file.type && file.type.startsWith("image/")) ||
    /\.(jpe?g|png|webp|gif|bmp|avif|svg|heic|heif|tiff?)$/i.test(file.name || "")
  );
}

export function acceptMatches(file, accept) {
  if (!accept) return true;
  const rules = accept.split(",").map((rule) => rule.trim().toLowerCase()).filter(Boolean);
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export function errorMessage(error) {
  if (!error) return "Something went wrong. Please try again.";
  const message = String(error.message || error);
  if (/password/i.test(message)) {
    return "This PDF is password-protected. Add the correct password and try again.";
  }
  if (/encrypted/i.test(message)) {
    return "This PDF is encrypted. Use Unlock PDF with the password first.";
  }
  if (/invalid pdf|parse|trailer|header/i.test(message)) {
    return "This file does not look like a valid PDF, or it may be damaged.";
  }
  if (/memory|allocation/i.test(message)) {
    return "The file is too large for this device's memory. Try a smaller file or lower resolution.";
  }
  return message.length > 220 ? `${message.slice(0, 217)}…` : message;
}
