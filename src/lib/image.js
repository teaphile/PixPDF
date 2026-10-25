import JSZip from "jszip";
import {
  A4,
  LETTER,
  canvasToBlob,
  clamp,
  hexToRgb,
  mmToPt,
  sanitizeFilename,
  yieldToUi
} from "./utils.js";

const MAX_CANVAS_SIDE = 13_000;
const MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  avif: "image/avif",
  svg: "image/svg+xml"
};

export function formatFromFile(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (MIME[ext]) return ext === "svg" ? "png" : ext;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "png";
}

export function mimeFor(format) {
  return MIME[format] || "image/png";
}

export async function loadImageSource(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close?.()
    };
  } catch {
    /* SVG and a few exotic formats need the <img> path. */
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(
          new Error(
            "This image could not be decoded. Try JPG, PNG, WebP, GIF, BMP or SVG."
          )
        );
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      dispose: () => URL.revokeObjectURL(url)
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(clamp(width, 1, MAX_CANVAS_SIDE)));
  canvas.height = Math.max(1, Math.round(clamp(height, 1, MAX_CANVAS_SIDE)));
  return canvas;
}

export function drawSource(context, source, x, y, width, height) {
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, x, y, width, height);
}

export async function drawFileToCanvas(file, targetWidth, targetHeight, background) {
  const loaded = await loadImageSource(file);
  try {
    const canvas = makeCanvas(targetWidth || loaded.width, targetHeight || loaded.height);
    const context = canvas.getContext("2d");
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    return { canvas, width: loaded.width, height: loaded.height };
  } finally {
    loaded.dispose();
  }
}

function outputName(file, suffix, format) {
  const base = sanitizeFilename(file.name, "image");
  return `${base}${suffix}.${format}`;
}

function resolveFormat(file, option) {
  if (!option || option === "keep") return formatFromFile(file);
  return option;
}

function canvasOutputFormat(format) {
  if (format === "jpg" || format === "jpeg") return "jpg";
  if (format === "webp") return "webp";
  return "png";
}


function parseChoiceBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return !["false", "0", "no", "off"].includes(String(value).toLowerCase());
}

function applyGrayscale(context, canvas, enabled) {
  if (!enabled) return canvas;
  const gray = makeCanvas(canvas.width, canvas.height);
  const ctx = gray.getContext("2d");
  ctx.filter = "grayscale(100%)";
  ctx.drawImage(canvas, 0, 0);
  return gray;
}

function applySharpen(canvas, amount) {
  const strength = Math.min(1, Math.max(0, Number(amount) || 0));
  if (strength <= 0.01) return canvas;
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  const copy = makeCanvas(width, height);
  copy.getContext("2d").drawImage(canvas, 0, 0);
  const source = copy.getContext("2d").getImageData(0, 0, width, height);
  const output = context.getImageData(0, 0, width, height);
  const factor = strength * 0.9;
  const kernel = [0, -factor, 0, -factor, 1 + 4 * factor, -factor, 0, -factor, 0];
  const data = source.data;
  const out = output.data;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const pIndex = (py * width + px) * 4;
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];
          r += data[pIndex] * weight;
          g += data[pIndex + 1] * weight;
          b += data[pIndex + 2] * weight;
        }
      }
      out[index] = Math.max(0, Math.min(255, r));
      out[index + 1] = Math.max(0, Math.min(255, g));
      out[index + 2] = Math.max(0, Math.min(255, b));
    }
  }
  context.putImageData(output, 0, 0);
  return canvas;
}

function drawingSourceSize(source) {
  return { width: source.width || source.naturalWidth, height: source.height || source.naturalHeight };
}

export async function processCompress(file, options, { progress } = {}) {
  progress?.(0.1);
  const loaded = await loadImageSource(file);
  try {
    let width = loaded.width;
    let height = loaded.height;
    const maxWidth = Number(options.maxWidth) || 0;
    const maxHeight = Number(options.maxHeight) || 0;
    const roundTo = Math.max(1, Number(options.roundTo) || 1);
    if (maxWidth > 0 && width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    if (maxHeight > 0 && height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }
    if (roundTo > 1) {
      width = Math.max(1, Math.round(width / roundTo) * roundTo);
      height = Math.max(1, Math.round(height / roundTo) * roundTo);
    }
    const format = canvasOutputFormat(resolveFormat(file, options.format));
    let canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    if (format === "jpg") {
      context.fillStyle = options.background || "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    if (options.grayscale) canvas = applyGrayscale(context, canvas, true);
    if (options.sharpness) canvas = applySharpen(canvas, Number(options.sharpness) / 100);
    progress?.(0.65);
    const quality = options.quality === undefined ? 0.75 : Number(options.quality);
    let blob = await canvasToBlob(canvas, mimeFor(format), quality);
    let usedFormat = format;
    if (options.keepOriginalIfLarger !== false && blob.size >= file.size && format === formatFromFile(file)) {
      progress?.(0.95);
      return {
        blob: file,
        name: file.name,
        width: loaded.width,
        height: loaded.height,
        originalKept: true
      };
    }
    return {
      blob,
      name: outputName(file, "-compressed", usedFormat),
      width: canvas.width,
      height: canvas.height
    };
  } finally {
    loaded.dispose();
  }
}

export async function processResize(file, options, { progress } = {}) {
  progress?.(0.1);
  const loaded = await loadImageSource(file);
  try {
    const sourceWidth = loaded.width;
    const sourceHeight = loaded.height;
    const noUpscale = options.noUpscale === true;
    let width;
    let height;
    const mode = options.fit || (options.mode === "percent" ? "percent" : "fit");

    if (mode === "percent" || options.mode === "percent") {
      const ratio = (Number(options.percent) || 100) / 100;
      width = Math.round(sourceWidth * ratio);
      height = Math.round(sourceHeight * ratio);
    } else {
      const requestedWidth = Number(options.width) || 0;
      const requestedHeight = Number(options.height) || 0;
      if (!requestedWidth && !requestedHeight) {
        throw new Error("Enter a width, a height, or both.");
      }
      if (mode === "exact" || mode === "cover" || options.lock === false && requestedWidth && requestedHeight) {
        width = requestedWidth || requestedHeight;
        height = requestedHeight || requestedWidth;
      } else if (requestedWidth && requestedHeight) {
        const ratio = Math.min(requestedWidth / sourceWidth, requestedHeight / sourceHeight);
        width = Math.round(sourceWidth * ratio);
        height = Math.round(sourceHeight * ratio);
      } else if (requestedWidth) {
        width = requestedWidth;
        height = Math.round((sourceHeight * requestedWidth) / sourceWidth);
      } else {
        height = requestedHeight;
        width = Math.round((sourceWidth * requestedHeight) / sourceHeight);
      }
    }

    if (noUpscale) {
      const ratio = Math.min(1, width / sourceWidth, height / sourceHeight);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));

    const format = canvasOutputFormat(resolveFormat(file, options.format));
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = options.resample !== "pixel";
    context.imageSmoothingQuality = "high";
    if (format === "jpg" || options.allowPadding) {
      context.fillStyle = options.background || "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (mode === "cover") {
      const scale = Math.max(width / sourceWidth, height / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      context.drawImage(loaded.source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    } else if (options.allowPadding) {
      const scale = Math.min(width / sourceWidth, height / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      context.drawImage(loaded.source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    } else {
      drawSource(context, loaded.source, 0, 0, width, height);
    }

    progress?.(0.7);
    const quality = Number(options.outputJpegQuality) || 0.92;
    const blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : quality);
    progress?.(0.95);
    return {
      blob,
      name: outputName(file, `-${canvas.width}x${canvas.height}`, format),
      width: canvas.width,
      height: canvas.height
    };
  } finally {
    loaded.dispose();
  }
}

export async function processConvert(file, options, { progress } = {}) {
  progress?.(0.1);
  const loaded = await loadImageSource(file);
  try {
    const format = options.format || "jpg";
    const flatten = format === "jpg";
    const requestedWidth = Number(options.width) || 0;
    const requestedHeight = Number(options.height) || 0;
    let width = requestedWidth || loaded.width;
    let height = requestedHeight || loaded.height;
    if (options.keepAspect !== false && requestedWidth && !requestedHeight) {
      height = Math.round((loaded.height * requestedWidth) / loaded.width);
    } else if (options.keepAspect !== false && requestedHeight && !requestedWidth) {
      width = Math.round((loaded.width * requestedHeight) / loaded.height);
    }
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    if (flatten) {
      context.fillStyle = options.background || "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (options.grayscale) context.filter = "grayscale(100%)";
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    context.filter = "none";
    progress?.(0.65);
    const blob = await canvasToBlob(
      canvas,
      mimeFor(format),
      format === "png" ? undefined : Number(options.quality) || 0.9
    );
    progress?.(0.95);
    return {
      blob,
      name: outputName(file, "", format),
      width: canvas.width,
      height: canvas.height
    };
  } finally {
    loaded.dispose();
  }
}

export async function processRotate(file, options, { progress } = {}) {
  progress?.(0.15);
  const loaded = await loadImageSource(file);
  try {
    const custom = Number(options.customAngle) || 0;
    const angle = custom || Number(options.angle) || 0;
    const radians = (angle * Math.PI) / 180;
    const quarter = angle % 90 === 0;
    const swap = quarter ? angle % 180 !== 0 : false;
    const expanded = options.expand !== false || !quarter;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const width = expanded
      ? Math.ceil(loaded.width * cos + loaded.height * sin)
      : swap
        ? loaded.height
        : loaded.width;
    const height = expanded
      ? Math.ceil(loaded.width * sin + loaded.height * cos)
      : swap
        ? loaded.width
        : loaded.height;
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    const format = canvasOutputFormat(resolveFormat(file, options.format));
    if (format === "jpg" || !expanded || !quarter) {
      context.fillStyle = options.background || "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.translate(width / 2, height / 2);
    context.rotate(radians);
    context.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
    context.imageSmoothingQuality = "high";
    context.drawImage(loaded.source, -loaded.width / 2, -loaded.height / 2, loaded.width, loaded.height);
    progress?.(0.9);
    const quality = Number(options.jpegQuality) || 0.92;
    const blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : quality);
    return { blob, name: outputName(file, "-rotated", format), width, height };
  } finally {
    loaded.dispose();
  }
}

export async function processWatermark(file, options, { progress } = {}) {
  progress?.(0.1);
  const loaded = await loadImageSource(file);
  try {
    let canvas = makeCanvas(loaded.width, loaded.height);
    const context = canvas.getContext("2d");
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    const text = String(options.text || "").trim();
    if (!text) throw new Error("Enter some watermark text.");
    const fontSize = Math.max(12, Math.round((canvas.width * Number(options.size || 5)) / 100));
    const opacity = Math.min(1, Number(options.opacity) || 0.5);
    const margin = Math.max(18, canvas.width * (Number(options.margin) || 3.5) / 100);
    const family = options.font === "serif" ? "Georgia, serif" : options.font === "mono" ? "monospace" : '"Plus Jakarta Sans", system-ui, sans-serif';
    const weight = options.bold === false ? 400 : 700;
    context.save();
    context.globalAlpha = opacity;
    context.fillStyle = options.color || "#ffffff";
    context.strokeStyle = options.strokeColor || "#000000";
    context.lineWidth = Math.max(1, fontSize * 0.045);
    context.font = `${weight} ${fontSize}px ${family}`;
    context.textBaseline = "middle";
    if (options.shadow) {
      context.shadowColor = "rgba(0,0,0,0.45)";
      context.shadowBlur = Math.max(3, fontSize * 0.18);
      context.shadowOffsetY = 1;
    }
    const metrics = context.measureText(text);
    const textWidth = metrics.width;

    const paint = (x, y, rotation) => {
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      if (options.stroke) context.strokeText(text, 0, 0);
      context.fillText(text, 0, 0);
      context.restore();
    };

    const rotation = ((Number(options.rotation) || 0) * Math.PI) / 180;

    if (options.position === "tile") {
      const gapScale = Math.max(0.2, (Number(options.tileGap) || 100) / 100);
      const tileAngle = ((Number(options.tileRotation) ?? -28) * Math.PI) / 180;
      const stepX = (textWidth + fontSize * 3) * gapScale;
      const stepY = fontSize * 5.2 * gapScale;
      for (let y = -canvas.height; y <= canvas.height * 1.5; y += stepY) {
        for (let x = -canvas.width; x <= canvas.width * 1.5; x += stepX) {
          paint(x, y, tileAngle);
        }
      }
    } else {
      const positions = {
        "top-left": [margin, margin + fontSize / 2],
        "top-right": [canvas.width - margin, margin + fontSize / 2],
        "bottom-left": [margin, canvas.height - margin - fontSize / 2],
        "bottom-right": [canvas.width - margin, canvas.height - margin - fontSize / 2],
        "top-center": [canvas.width / 2, margin + fontSize / 2],
        "bottom-center": [canvas.width / 2, canvas.height - margin - fontSize / 2],
        "middle-left": [margin, canvas.height / 2],
        "middle-right": [canvas.width - margin, canvas.height / 2],
        center: [canvas.width / 2, canvas.height / 2]
      };
      const [x, y] = positions[options.position] || positions["bottom-right"];
      const align = options.position.endsWith("right")
        ? "right"
        : options.position === "center" || options.position.includes("center")
          ? "center"
          : "left";
      context.textAlign = align;
      paint(x, y, rotation);
    }
    context.restore();
    if (options.grayscale) canvas = applyGrayscale(context, canvas, true);
    const format = canvasOutputFormat(resolveFormat(file, options.format));
    const quality = Number(options.jpegQuality) || 0.92;
    const blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : quality);
    progress?.(0.95);
    return { blob, name: outputName(file, "-watermarked", format) };
  } finally {
    loaded.dispose();
  }
}

function cornerColor(canvas) {
  const context = canvas.getContext("2d");
  const spots = [
    [2, 2],
    [canvas.width - 3, 2],
    [2, canvas.height - 3],
    [canvas.width - 3, canvas.height - 3]
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of spots) {
    const pixel = context.getImageData(x, y, 1, 1).data;
    r += pixel[0];
    g += pixel[1];
    b += pixel[2];
  }
  return { r: r / spots.length, g: g / spots.length, b: b / spots.length };
}

export async function processRemoveBackground(file, options, { progress } = {}) {
  progress?.(0.1);
  const loaded = await loadImageSource(file);
  try {
    const canvas = makeCanvas(loaded.width, loaded.height);
    const context = canvas.getContext("2d");
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const auto = options.autoDetect === true;
    const key = auto ? cornerColor(canvas) : hexToRgb(options.color || "#ffffff");
    const tolerance = (Number(options.tolerance) || 0) * 4.42;
    const softness = (Number(options.feather) || 0) * 4;
    const inner = tolerance;
    const outer = tolerance + softness;
    const minAlpha = ((Number(options.minAlpha) || 0) / 100) * 255;
    progress?.(0.35);
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let found = false;

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const dr = data[index] - key.r;
        const dg = data[index + 1] - key.g;
        const db = data[index + 2] - key.b;
        const distance = Math.sqrt(dr * dr + dg * dg + db * db);
        let alpha = data[index + 3];
        if (distance <= inner) {
          alpha = 0;
        } else if (distance < outer && outer > inner) {
          const ratio = (distance - inner) / (outer - inner);
          alpha = Math.round(alpha * ratio);
        } else if (options.defringe !== false && distance < outer * 1.35) {
          // Pull the key colour out of the fringe so edges do not glow.
          const blend = 1 - Math.min(1, (distance - outer) / (outer * 0.35));
          data[index] = Math.round(data[index] * (1 - blend * 0.6) + 255 * blend * 0.6 * (key.r / 255));
          data[index + 1] = Math.round(data[index + 1] * (1 - blend * 0.6) + 255 * blend * 0.6 * (key.g / 255));
          data[index + 2] = Math.round(data[index + 2] * (1 - blend * 0.6) + 255 * blend * 0.6 * (key.b / 255));
        }
        if (alpha < minAlpha) alpha = 0;
        data[index + 3] = alpha;
        if (alpha > 8) {
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    context.putImageData(imageData, 0, 0);
    progress?.(0.8);
    let output = canvas;
    if (options.cropTransparent && found) {
      const padding = Math.max(0, Math.round(Number(options.padding) || 0));
      const x = Math.max(0, minX - padding);
      const y = Math.max(0, minY - padding);
      const width = Math.min(canvas.width - x, maxX - minX + 1 + padding * 2);
      const height = Math.min(canvas.height - y, maxY - minY + 1 + padding * 2);
      const cropped = makeCanvas(width, height);
      cropped.getContext("2d").drawImage(canvas, x, y, width, height, 0, 0, width, height);
      output = cropped;
    }
    const blob = await canvasToBlob(output, "image/png");
    progress?.(0.95);
    return { blob, name: outputName(file, "-transparent", "png") };
  } finally {
    loaded.dispose();
  }
}

export async function processFavicons(file, options = {}, { progress } = {}) {
  const zip = new JSZip();
  const loaded = await loadImageSource(file);
  try {
    const requested = String(options.sizes || "16, 32, 48, 64, 180, 192, 512")
      .split(/[,;\s]+/)
      .map((value) => Math.round(Number(value)))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 1024);
    const sizes = [...new Set(requested)].sort((a, b) => a - b);
    if (!sizes.length) throw new Error("Add at least one icon size between 1 and 1024 px.");
    const side = Math.min(1024, Math.max(512, Math.max(loaded.width, loaded.height)));
    const square = makeCanvas(side, side);
    const squareContext = square.getContext("2d");
    const transparent = options.transparentBackground === true;
    if (!transparent) {
      squareContext.fillStyle = options.background || "#7c5cff";
      squareContext.fillRect(0, 0, side, side);
    }
    const shape = options.shape || "square";
    if (shape !== "square") {
      squareContext.save();
      squareContext.beginPath();
      if (shape === "circle") {
        squareContext.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
      } else {
        const radius = (Math.min(50, Math.max(0, Number(options.radius) || 22)) / 100) * side;
        squareContext.roundRect(0, 0, side, side, radius);
      }
      squareContext.clip();
      if (!transparent) {
        squareContext.fillStyle = options.background || "#7c5cff";
        squareContext.fillRect(0, 0, side, side);
      }
      const padding = (Math.min(40, Math.max(0, Number(options.padding) || 0)) / 100) * side;
      const scale = Math.min((side - padding * 2) / loaded.width, (side - padding * 2) / loaded.height);
      const drawWidth = loaded.width * scale;
      const drawHeight = loaded.height * scale;
      squareContext.imageSmoothingQuality = "high";
      squareContext.drawImage(loaded.source, (side - drawWidth) / 2, (side - drawHeight) / 2, drawWidth, drawHeight);
      squareContext.restore();
    } else {
      const padding = (Math.min(40, Math.max(0, Number(options.padding) || 0)) / 100) * side;
      const scale = Math.min((side - padding * 2) / loaded.width, (side - padding * 2) / loaded.height);
      const drawWidth = loaded.width * scale;
      const drawHeight = loaded.height * scale;
      squareContext.imageSmoothingQuality = "high";
      squareContext.drawImage(loaded.source, (side - drawWidth) / 2, (side - drawHeight) / 2, drawWidth, drawHeight);
    }

    const pngBlobs = {};
    for (let index = 0; index < sizes.length; index += 1) {
      const dimension = sizes[index];
      const canvas = makeCanvas(dimension, dimension);
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, dimension, dimension);
      drawSource(context, square, 0, 0, dimension, dimension);
      const blob = await canvasToBlob(canvas, "image/png");
      pngBlobs[dimension] = blob;
      const name =
        dimension === 180
          ? "apple-touch-icon.png"
          : dimension === 192
            ? "android-chrome-192x192.png"
            : dimension === 512
              ? "android-chrome-512x512.png"
              : `favicon-${dimension}x${dimension}.png`;
      zip.file(name, blob);
      progress?.((index / sizes.length) * 0.75);
      await yieldToUi();
    }
    const icoSizes = [16, 32, 48].filter((size) => pngBlobs[size]);
    if (options.includeIco !== false && icoSizes.length) {
      zip.file("favicon.ico", await buildIco(icoSizes.map((size) => pngBlobs[size]), icoSizes));
    }
    if (options.includeManifest !== false) {
      const siteName = String(options.siteName || "My site").trim() || "My site";
      const manifestIcons = [192, 512].filter((size) => pngBlobs[size]).map((size) => ({
        src: `/${size === 192 ? "android-chrome-192x192.png" : "android-chrome-512x512.png"}`,
        sizes: `${size}x${size}`,
        type: "image/png"
      }));
      zip.file(
        "site.webmanifest",
        JSON.stringify(
          {
            name: siteName,
            short_name: siteName.slice(0, 12),
            icons: manifestIcons,
            theme_color: options.themeColor || "#7c5cff",
            background_color: transparent ? "#ffffff" : options.background || "#7c5cff",
            display: "standalone"
          },
          null,
          2
        )
      );
      zip.file(
        "README.txt",
        `PixPDF favicon kit
==================

Files included
${sizes.map((size) => `- favicon-${size}x${size}.png`).join("\n")}
${options.includeIco !== false ? "- favicon.ico (multi-size)" : ""}
- site.webmanifest

Paste this into your <head>:

<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />

Generated locally with PixPDF — your logo never left your device.
`
      );
    }
    progress?.(0.95);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, name: "favicon-kit.zip" };
  } finally {
    loaded.dispose();
  }
}

async function buildIco(blobs, dimensions = [16, 32, 48]) {
  const buffers = await Promise.all(blobs.map((blob) => blob.arrayBuffer()));
  const headerSize = 6 + buffers.length * 16;
  const total = headerSize + buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const output = new Uint8Array(total);
  const view = new DataView(output.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, buffers.length, true);
  let entryOffset = 6;
  let dataOffset = headerSize;
  buffers.forEach((buffer, index) => {
    const dimension = dimensions[index] || 16;
    view.setUint8(entryOffset, dimension === 256 ? 0 : dimension);
    view.setUint8(entryOffset + 1, dimension === 256 ? 0 : dimension);
    view.setUint8(entryOffset + 2, 0);
    view.setUint8(entryOffset + 3, 0);
    view.setUint16(entryOffset + 4, 1, true);
    view.setUint16(entryOffset + 6, 32, true);
    view.setUint32(entryOffset + 8, buffer.byteLength, true);
    view.setUint32(entryOffset + 12, dataOffset, true);
    output.set(new Uint8Array(buffer), dataOffset);
    entryOffset += 16;
    dataOffset += buffer.byteLength;
  });
  return new Blob([output], { type: "image/x-icon" });
}

const PDF_PAGE_SIZES = {
  a4: A4,
  letter: LETTER,
  legal: { width: 612, height: 1008 },
  a5: { width: 419.53, height: 595.28 },
  square: { width: 595.28, height: 595.28 }
};

export async function imagesToPdf(files, options, { progress } = {}) {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const doc = await PDFDocument.create();
  const margin = mmToPt(Number(options.margin) || 0);
  const marginSide = options.marginSide || "all";
  const margins = {
    left: marginSide === "vertical" ? 0 : margin,
    right: marginSide === "vertical" ? 0 : margin,
    top: marginSide === "horizontal" ? 0 : margin,
    bottom: marginSide === "horizontal" ? 0 : margin
  };
  const pageSize = options.pageSize || "fit";
  const extra = options.customPageSize || "preset";
  const quality = Math.max(0.2, Math.min(1, Number(options.jpegQuality) || 0.9));
  const background = options.background || "#ffffff";
  const grayscale = Boolean(options.grayscaleImages);
  const centered = options.centerImages !== false;

  const sizeFor = (imageWidth, imageHeight) => {
    if (pageSize === "fit" && extra === "preset") return null;
    let base;
    if (extra === "custom") {
      base = {
        width: mmToPt(Number(options.customWidth) || 210),
        height: mmToPt(Number(options.customHeight) || 297)
      };
    } else if (extra !== "preset") {
      base = PDF_PAGE_SIZES[extra] || A4;
    } else {
      base = PDF_PAGE_SIZES[pageSize] || A4;
    }
    const landscape =
      options.orientation === "landscape" ||
      (options.orientation !== "portrait" && options.autoRotate !== false && imageWidth > imageHeight);
    return landscape ? { width: base.height, height: base.width } : { ...base };
  };

  const renderCanvas = (loaded, width, height, flatten) => {
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    if (flatten) {
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (grayscale) context.filter = "grayscale(100%)";
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    context.filter = "none";
    return canvas;
  };

  const embedImage = async (loaded, preferPng) => {
    const canvas = renderCanvas(loaded, loaded.width, loaded.height, !preferPng);
    const blob = await canvasToBlob(canvas, preferPng ? "image/png" : "image/jpeg", preferPng ? undefined : quality);
    const bytes = await blob.arrayBuffer();
    return preferPng ? doc.embedPng(bytes) : doc.embedJpg(bytes);
  };

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    progress?.((index / files.length) * 0.9, `Adding image ${index + 1} of ${files.length}…`);
    const loaded = await loadImageSource(file);
    try {
      const imageWidth = loaded.width;
      const imageHeight = loaded.height;
      const preferPng =
        file.type === "image/png" ||
        file.type === "image/webp" ||
        file.type === "image/gif" ||
        /\.(png|webp|gif|svg|avif)$/i.test(file.name);
      const size = sizeFor(imageWidth, imageHeight);

      if (!size) {
        const embedded = await embedImage(loaded, preferPng);
        const pageWidth = Math.max(1, imageWidth * 0.75 + margins.left + margins.right);
        const pageHeight = Math.max(1, imageHeight * 0.75 + margins.top + margins.bottom);
        const page = doc.addPage([pageWidth, pageHeight]);
        if (margins.left || margins.top || background !== "#ffffff") {
          page.drawRectangle({
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
            color: hexToPdfColor(background)
          });
        }
        page.drawImage(embedded, {
          x: margins.left,
          y: margins.bottom,
          width: pageWidth - margins.left - margins.right,
          height: pageHeight - margins.top - margins.bottom
        });
      } else {
        const page = doc.addPage([size.width, size.height]);
        const availableWidth = Math.max(1, size.width - margins.left - margins.right);
        const availableHeight = Math.max(1, size.height - margins.top - margins.bottom);
        page.drawRectangle({
          x: 0,
          y: 0,
          width: size.width,
          height: size.height,
          color: hexToPdfColor(background)
        });

        if (options.fit === "cover") {
          const targetAspect = availableWidth / availableHeight;
          const imageAspect = imageWidth / imageHeight;
          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = imageWidth;
          let sourceHeight = imageHeight;
          if (imageAspect > targetAspect) {
            sourceWidth = imageHeight * targetAspect;
            sourceX = (imageWidth - sourceWidth) / 2;
          } else {
            sourceHeight = imageWidth / targetAspect;
            sourceY = (imageHeight - sourceHeight) / 2;
          }
          const canvas = makeCanvas(sourceWidth, sourceHeight);
          const context = canvas.getContext("2d");
          context.fillStyle = background;
          context.fillRect(0, 0, canvas.width, canvas.height);
          if (grayscale) context.filter = "grayscale(100%)";
          context.drawImage(loaded.source, -sourceX, -sourceY, imageWidth, imageHeight);
          context.filter = "none";
          const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
          const embedded = await doc.embedJpg(await jpeg.arrayBuffer());
          page.drawImage(embedded, {
            x: margins.left,
            y: margins.bottom,
            width: availableWidth,
            height: availableHeight
          });
        } else {
          const embedded = await embedImage(loaded, preferPng);
          const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
          const drawWidth = imageWidth * scale;
          const drawHeight = imageHeight * scale;
          const x = centered ? margins.left + (availableWidth - drawWidth) / 2 : margins.left;
          const y = centered ? margins.bottom + (availableHeight - drawHeight) / 2 : margins.bottom;
          page.drawImage(embedded, { x, y, width: drawWidth, height: drawHeight });
        }
        if (options.pageBorder) {
          page.drawRectangle({
            x: Math.max(0, margins.left - 1),
            y: Math.max(0, margins.bottom - 1),
            width: availableWidth + 2,
            height: availableHeight + 2,
            borderColor: hexToPdfColor("#b7b2cc"),
            borderWidth: 0.6
          });
        }
      }
    } finally {
      loaded.dispose();
    }
    await yieldToUi();
  }
  progress?.(0.95, "Writing PDF…");
  const bytes = await doc.save({ useObjectStreams: true });
  progress?.(1, "Done");
  return { blob: new Blob([bytes], { type: "application/pdf" }), name: "images.pdf" };
}

function hexToPdfColor(hex) {
  const value = String(hex || "#ffffff").replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return { type: "RGB", red: 1, green: 1, blue: 1 };
  // This matches pdf-lib's rgb() shape, without pulling pdf-lib into the
  // main bundle just for a colour helper.
  return {
    type: "RGB",
    red: parseInt(full.slice(0, 2), 16) / 255,
    green: parseInt(full.slice(2, 4), 16) / 255,
    blue: parseInt(full.slice(4, 6), 16) / 255
  };
}

export async function cropImage(file, crop, { format = "png", quality = 0.92, background } = {}) {
  const loaded = await loadImageSource(file);
  try {
    const sourceWidth = loaded.width;
    const sourceHeight = loaded.height;
    const x = Math.max(0, Math.min(sourceWidth - 1, Math.round(Number(crop.x) || 0)));
    const y = Math.max(0, Math.min(sourceHeight - 1, Math.round(Number(crop.y) || 0)));
    const width = Math.max(1, Math.min(sourceWidth - x, Math.round(Number(crop.width) || sourceWidth)));
    const height = Math.max(1, Math.min(sourceHeight - y, Math.round(Number(crop.height) || sourceHeight)));
    const targetWidth = Math.max(1, Math.round(Number(crop.targetWidth) || width));
    const targetHeight = Math.max(1, Math.round(Number(crop.targetHeight) || height));
    const canvas = makeCanvas(targetWidth, targetHeight);
    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    if (format === "jpg") {
      context.fillStyle = background || "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(loaded.source, x, y, width, height, 0, 0, canvas.width, canvas.height);
    let blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : quality);
    if (Number(crop.maxKb) > 0 && blob.size > Number(crop.maxKb) * 1024 && format !== "png") {
      let low = 0.2;
      let high = Math.min(1, quality);
      let bestBlob = blob;
      for (let step = 0; step < 7; step += 1) {
        const q = (low + high) / 2;
        const attempt = await canvasToBlob(canvas, mimeFor(format), q);
        if (attempt.size <= Number(crop.maxKb) * 1024) {
          bestBlob = attempt;
          low = q;
        } else {
          high = q;
        }
      }
      blob = bestBlob;
    }
    return {
      blob,
      name: outputName(file, "-cropped", format),
      width: canvas.width,
      height: canvas.height
    };
  } finally {
    loaded.dispose();
  }
}

export async function editImage(file, edits, { format = "png", quality = 0.92 } = {}) {
  const loaded = await loadImageSource(file);
  try {
    const angle = Number(edits.rotate) || 0;
    const swap = angle === 90 || angle === 270;
    let width = swap ? loaded.height : loaded.width;
    let height = swap ? loaded.width : loaded.height;
    const targetWidth = Number(edits.targetWidth) || 0;
    const targetHeight = Number(edits.targetHeight) || 0;
    const scale = Number(edits.exportScale) || 0;
    if (targetWidth || targetHeight) {
      const ratio = Math.min(
        targetWidth ? targetWidth / width : Infinity,
        targetHeight ? targetHeight / height : Infinity
      );
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    } else if (scale > 0) {
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    const filter = [
      `brightness(${edits.brightness}%)`,
      `contrast(${edits.contrast}%)`,
      `saturate(${edits.saturation}%)`,
      `sepia(${edits.warmth}%)`,
      `grayscale(${edits.grayscale}%)`,
      `blur(${Number(edits.blur) * (width / loaded.width)}px)`,
      `hue-rotate(${edits.hue}deg)`
    ].join(" ");
    if (format === "jpg") {
      context.fillStyle = edits.background || "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate((angle * Math.PI) / 180);
    context.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
    context.filter = filter;
    drawSource(context, loaded.source, -width / 2, -height / 2, width, height);
    context.restore();
    if (edits.sharpen) applySharpen(canvas, Number(edits.sharpen) / 100);
    if (edits.vignette) {
      const strength = Math.min(1, Number(edits.vignette) / 100);
      const gradient = context.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.35,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, `rgba(0,0,0,${0.65 * strength})`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
    const blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : quality);
    return {
      blob,
      name: outputName(file, "-edited", format),
      width,
      height
    };
  } finally {
    loaded.dispose();
  }
}

export async function processCompressToTarget(file, options, { progress } = {}) {
  const loaded = await loadImageSource(file);
  try {
    const format = canvasOutputFormat(options.format || "jpg");
    const unit = options.unit === "MB" ? 1024 * 1024 : 1024;
    const target = Math.max(1, Number(options.target) || 100) * unit;
    const tolerance = 1 + Math.max(0, Number(options.tolerance) || 0) / 100;
    const requestedWidth = Number(options.maxWidth) || loaded.width;
    let width = Math.min(loaded.width, requestedWidth);
    let height = options.keepAspect === false
      ? Math.max(1, Number(options.height) || Math.round((loaded.height * width) / loaded.width))
      : Math.max(1, Math.round((loaded.height * width) / loaded.width));
    const minWidth = Math.max(16, Number(options.minWidth) || 32);
    const allowResize = options.allowResize !== false;
    const mime = mimeFor(format);
    const background = format === "jpg" ? options.background || "#ffffff" : null;
    const allowUpscale = options.allowUpscale === true;
    let best = null;

    const encode = async (w, h, quality) => {
      const canvas = makeCanvas(w, h);
      const context = canvas.getContext("2d");
      if (background) {
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (options.grayscale) context.filter = "grayscale(100%)";
      drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, mime, format === "png" ? undefined : quality);
      canvas.width = 1;
      canvas.height = 1;
      return blob;
    };

    if (format === "png") {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const blob = await encode(width, height, undefined);
        best = { blob, width, height };
        if (blob.size <= target * tolerance || !allowResize || width <= minWidth) break;
        const ratio = Math.max(0.5, Math.min(0.92, Math.sqrt(target / blob.size) * 0.96));
        width = Math.max(minWidth, Math.round(width * ratio));
        height = Math.max(1, Math.round((loaded.height * width) / loaded.width));
        progress?.(0.15 + attempt * 0.07, `Trying ${width} × ${height}…`);
      }
    } else {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        let low = 0.12;
        let high = 0.97;
        let candidate = null;
        for (let step = 0; step < 8; step += 1) {
          const quality = (low + high) / 2;
          const blob = await encode(width, height, quality);
          if (blob.size <= target * tolerance) {
            candidate = { blob, width, height, quality };
            low = quality;
          } else {
            high = quality;
          }
        }
        if (candidate) {
          best = candidate;
          const cap = allowUpscale ? loaded.width : Math.min(loaded.width, requestedWidth);
          const canGrow = width < cap && candidate.blob.size < target * 0.82;
          if (canGrow) {
            const ratio = Math.min(1.18, Math.sqrt(target / candidate.blob.size));
            width = Math.min(cap, Math.round(width * ratio));
            height = Math.max(1, Math.round((loaded.height * width) / loaded.width));
            continue;
          }
          break;
        }
        const smallest = await encode(width, height, 0.12);
        best = { blob: smallest, width, height, quality: 0.12 };
        if (!allowResize || width <= minWidth) break;
        const ratio = Math.max(0.5, Math.min(0.88, Math.sqrt(target / smallest.size) * 0.94));
        width = Math.max(minWidth, Math.round(width * ratio));
        height = Math.max(1, Math.round((loaded.height * width) / loaded.width));
        progress?.(0.15 + attempt * 0.07, `Reducing to ${width} × ${height}…`);
      }
    }

    if (!best) throw new Error("Could not encode this image.");
    let blob = best.blob;
    const overshoot = best.blob.size > target * tolerance;
    if (options.exact && best.blob.size < target && format !== "png") {
      // Pad with a trailing comment segment so strict forms accept the upload.
      const original = new Uint8Array(await blob.arrayBuffer());
      const padding = new Uint8Array(Math.max(0, target - original.length - 2));
      const padded = new Uint8Array(original.length + padding.length);
      padded.set(original, 0);
      padded.set(padding, original.length);
      blob = new Blob([padded], { type: blob.type });
    }
    const label = options.unit === "MB" ? `${options.target}MB` : `${options.target}KB`;
    const suffix = overshoot ? `-near-${label}` : `-${label}`;
    progress?.(1, "Done");
    return {
      blob,
      name: outputName(file, suffix, format),
      width: best.width,
      height: best.height,
      underTarget: blob.size <= target * tolerance,
      notes: overshoot ? [`Could not reach ${label} — the smallest possible file is ${(blob.size / 1024).toFixed(0)} KB.`] : []
    };
  } finally {
    loaded.dispose();
  }
}

const SOCIAL_PRESETS = {
  "instagram-post": [1080, 1080],
  "instagram-portrait": [1080, 1350],
  story: [1080, 1920],
  "youtube-thumb": [1280, 720],
  "youtube-banner": [2560, 1440],
  "x-post": [1600, 900],
  linkedin: [1200, 627],
  facebook: [1200, 630],
  whatsapp: [500, 500],
  "a4-print": [2480, 3508]
};

export async function processSocialResize(file, options, { progress } = {}) {
  const loaded = await loadImageSource(file);
  try {
    const preset = SOCIAL_PRESETS[options.preset];
    const width = Math.max(1, Math.round(Number(options.customWidth) || preset?.[0] || 1080));
    const height = Math.max(1, Math.round(Number(options.customHeight) || preset?.[1] || 1080));
    const format = canvasOutputFormat(options.format || "jpg");
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    context.fillStyle = options.background || "#ffffff";
    context.fillRect(0, 0, width, height);
    const padding = Math.max(0, Number(options.padding) || 0);
    const innerWidth = Math.max(1, width - padding * 2);
    const innerHeight = Math.max(1, height - padding * 2);
    const cover = options.fit !== "contain";
    const scale = cover
      ? Math.max(innerWidth / loaded.width, innerHeight / loaded.height)
      : Math.min(innerWidth / loaded.width, innerHeight / loaded.height);
    const drawWidth = loaded.width * scale;
    const drawHeight = loaded.height * scale;
    const anchorX = options.anchorX === "left" ? 0 : options.anchorX === "right" ? 1 : 0.5;
    const anchorY = options.anchorY === "top" ? 0 : options.anchorY === "bottom" ? 1 : 0.5;
    const x = padding + (innerWidth - drawWidth) * anchorX;
    const y = padding + (innerHeight - drawHeight) * anchorY;
    context.save();
    context.beginPath();
    context.rect(padding, padding, innerWidth, innerHeight);
    context.clip();
    if (options.grayscale) context.filter = "grayscale(100%)";
    drawSource(context, loaded.source, x, y, drawWidth, drawHeight);
    context.restore();
    if (options.sharpen) applySharpen(canvas, 0.35);
    progress?.(0.8);
    const quality = Number(options.jpegQuality) || 0.92;
    const blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : quality);
    return {
      blob,
      name: outputName(file, `-${options.preset || `${width}x${height}`}`, format),
      width,
      height
    };
  } finally {
    loaded.dispose();
  }
}

export async function processBorder(file, options, { progress } = {}) {
  const loaded = await loadImageSource(file);
  try {
    const format = canvasOutputFormat(options.format || "png");
    const border = Math.max(0, Math.round(Number(options.width) || 0));
    const padding = Math.max(0, Math.round(Number(options.padding) || 0));
    const color = options.color || "#ffffff";
    const style = options.style || "solid";
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = loaded.width;
    let sourceHeight = loaded.height;
    if (style === "circle") {
      const side = Math.min(loaded.width, loaded.height);
      sourceX = (loaded.width - side) / 2;
      sourceY = (loaded.height - side) / 2;
      sourceWidth = side;
      sourceHeight = side;
    }
    let canvasWidth = sourceWidth + (border + padding) * 2;
    let canvasHeight = sourceHeight + (border + padding) * 2;
    if (options.squareCanvas) {
      const side = Math.max(canvasWidth, canvasHeight);
      canvasWidth = side;
      canvasHeight = side;
    }
    const inset = border + padding;
    const canvas = makeCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext("2d");
    if (format === "jpg" || !["circle", "rounded"].includes(style)) {
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (options.shadow) {
      context.save();
      context.shadowColor = "rgba(15, 12, 40, 0.35)";
      context.shadowBlur = Number(options.shadowBlur) || 24;
      context.shadowOffsetY = Math.max(2, (Number(options.shadowBlur) || 24) / 3);
      context.fillStyle = "rgba(0,0,0,0.9)";
      context.beginPath();
      if (style === "circle") {
        context.arc(canvas.width / 2, canvas.height / 2, sourceWidth / 2, 0, Math.PI * 2);
      } else if (style === "rounded") {
        const radius = Math.min(Number(options.radius) || 0, sourceWidth / 2, sourceHeight / 2);
        context.roundRect((canvas.width - sourceWidth) / 2, (canvas.height - sourceHeight) / 2, sourceWidth, sourceHeight, radius);
      } else {
        context.rect((canvas.width - sourceWidth) / 2, (canvas.height - sourceHeight) / 2, sourceWidth, sourceHeight);
      }
      context.fill();
      context.restore();
    }
    context.save();
    if (style === "circle") {
      context.beginPath();
      context.arc(canvas.width / 2, canvas.height / 2, sourceWidth / 2, 0, Math.PI * 2);
      context.clip();
    } else if (style === "rounded") {
      const radius = Math.min(Number(options.radius) || 0, sourceWidth / 2, sourceHeight / 2);
      context.beginPath();
      context.roundRect(inset, inset, sourceWidth, sourceHeight, radius);
      context.clip();
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(
      loaded.source,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      inset,
      inset,
      sourceWidth,
      sourceHeight
    );
    context.restore();

    context.strokeStyle = color;
    context.lineWidth = border;
    const half = border / 2;
    if (style === "circle") {
      context.beginPath();
      context.arc(canvas.width / 2, canvas.height / 2, sourceWidth / 2 + half, 0, Math.PI * 2);
      context.stroke();
    } else if (style === "dashed" || style === "dotted") {
      context.setLineDash(style === "dotted" ? [border * 0.35, border * 1.1] : [border * 2.2, border * 1.3]);
      context.strokeRect(half, half, canvas.width - border, canvas.height - border);
    } else if (style === "double") {
      context.strokeRect(border / 3, border / 3, canvas.width - (border * 2) / 3, canvas.height - (border * 2) / 3);
      context.lineWidth = Math.max(1, border / 4);
      context.strokeRect(inset, inset, sourceWidth, sourceHeight);
    } else if (style === "solid") {
      context.strokeRect(half, half, canvas.width - border, canvas.height - border);
    }
    progress?.(0.9);
    const quality = Number(options.jpegQuality) || 0.92;
    const blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : quality);
    return {
      blob,
      name: outputName(file, `-${style}`, format),
      width: canvas.width,
      height: canvas.height
    };
  } finally {
    loaded.dispose();
  }
}

export async function zipOutputs(outputs, filename = "pixpdf-results.zip") {
  const zip = new JSZip();
  const used = new Set();
  for (const output of outputs) {
    let name = output.name;
    let count = 2;
    while (used.has(name)) {
      const dot = name.lastIndexOf(".");
      name =
        dot > 0
          ? `${name.slice(0, dot)}-${count}${name.slice(dot)}`
          : `${name}-${count}`;
      count += 1;
    }
    used.add(name);
    zip.file(name, output.blob);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  return { blob, name: filename };
}

export function downloadNameFromFile(file, suffix, extension) {
  return `${sanitizeFilename(file.name, "image")}${suffix}.${extension}`;
}
