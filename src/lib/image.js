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

export async function processCompress(file, options, { progress } = {}) {
  progress?.(0.1);
  const loaded = await loadImageSource(file);
  try {
    let width = loaded.width;
    let height = loaded.height;
    const maxWidth = Number(options.maxWidth) || 0;
    if (maxWidth > 0 && width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    const format = canvasOutputFormat(resolveFormat(file, options.format));
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    if (format === "jpg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    progress?.(0.65);
    const blob = await canvasToBlob(
      canvas,
      mimeFor(format),
      options.quality === undefined ? 0.75 : Number(options.quality)
    );
    progress?.(0.95);
    return {
      blob,
      name: outputName(file, "-compressed", format),
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
    let width;
    let height;
    if (options.mode === "percent") {
      const ratio = (Number(options.percent) || 100) / 100;
      width = Math.round(loaded.width * ratio);
      height = Math.round(loaded.height * ratio);
    } else {
      const requestedWidth = Number(options.width) || 0;
      const requestedHeight = Number(options.height) || 0;
      if (!requestedWidth && !requestedHeight) {
        throw new Error("Enter a width, a height, or both.");
      }
      if (requestedWidth && requestedHeight) {
        if (options.lock === false) {
          width = requestedWidth;
          height = requestedHeight;
        } else {
          const ratio = Math.min(requestedWidth / loaded.width, requestedHeight / loaded.height);
          width = Math.round(loaded.width * ratio);
          height = Math.round(loaded.height * ratio);
        }
      } else if (requestedWidth) {
        width = requestedWidth;
        height = Math.round((loaded.height * requestedWidth) / loaded.width);
      } else {
        height = requestedHeight;
        width = Math.round((loaded.width * requestedHeight) / loaded.height);
      }
    }
    const format = canvasOutputFormat(resolveFormat(file, options.format));
    const flatten = format === "jpg";
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    if (flatten) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    progress?.(0.7);
    const blob = await canvasToBlob(canvas, mimeFor(format), 0.92);
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
    const canvas = makeCanvas(loaded.width, loaded.height);
    const context = canvas.getContext("2d");
    if (flatten) {
      context.fillStyle = options.background || "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
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
    const angle = Number(options.angle) || 0;
    const swap = angle === 90 || angle === 270;
    const width = swap ? loaded.height : loaded.width;
    const height = swap ? loaded.width : loaded.height;
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    context.translate(width / 2, height / 2);
    context.rotate((angle * Math.PI) / 180);
    context.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
    drawSource(context, loaded.source, -loaded.width / 2, -loaded.height / 2, loaded.width, loaded.height);
    const format = canvasOutputFormat(formatFromFile(file));
    if (format === "jpg") {
      const flattened = makeCanvas(width, height);
      const ctx = flattened.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(canvas, 0, 0);
      progress?.(0.9);
      const blob = await canvasToBlob(flattened, "image/jpeg", 0.92);
      return { blob, name: outputName(file, "-rotated", "jpg"), width, height };
    }
    progress?.(0.9);
    const blob = await canvasToBlob(canvas, mimeFor(format), 0.92);
    return { blob, name: outputName(file, "-rotated", format), width, height };
  } finally {
    loaded.dispose();
  }
}

export async function processWatermark(file, options, { progress } = {}) {
  progress?.(0.1);
  const loaded = await loadImageSource(file);
  try {
    const canvas = makeCanvas(loaded.width, loaded.height);
    const context = canvas.getContext("2d");
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    const text = String(options.text || "").trim();
    if (!text) throw new Error("Enter some watermark text.");
    const fontSize = Math.max(12, Math.round((canvas.width * Number(options.size || 5)) / 100));
    const opacity = Number(options.opacity) || 0.5;
    const margin = Math.max(18, canvas.width * 0.035);
    context.save();
    context.globalAlpha = opacity;
    context.fillStyle = options.color || "#ffffff";
    context.font = `700 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    context.textBaseline = "middle";
    if (options.shadow) {
      context.shadowColor = "rgba(0,0,0,0.45)";
      context.shadowBlur = Math.max(3, fontSize * 0.18);
      context.shadowOffsetY = 1;
    }
    const metrics = context.measureText(text);
    const textWidth = metrics.width;

    if (options.position === "tile") {
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((-28 * Math.PI) / 180);
      const stepX = textWidth + fontSize * 3;
      const stepY = fontSize * 5.2;
      for (let y = -canvas.height; y <= canvas.height; y += stepY) {
        for (let x = -canvas.width; x <= canvas.width; x += stepX) {
          context.fillText(text, x, y);
        }
      }
    } else {
      const positions = {
        "top-left": [margin, margin + fontSize / 2, "left"],
        "top-right": [canvas.width - margin, margin + fontSize / 2, "right"],
        "bottom-left": [margin, canvas.height - margin - fontSize / 2, "left"],
        "bottom-right": [canvas.width - margin, canvas.height - margin - fontSize / 2, "right"],
        center: [canvas.width / 2, canvas.height / 2, "center"]
      };
      const [x, y, align] = positions[options.position] || positions["bottom-right"];
      context.textAlign = align;
      context.fillText(text, x, y);
    }
    context.restore();
    const format = canvasOutputFormat(formatFromFile(file));
    if (format === "jpg") {
      const flattened = makeCanvas(canvas.width, canvas.height);
      const ctx = flattened.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(canvas, 0, 0);
      progress?.(0.9);
      const blob = await canvasToBlob(flattened, "image/jpeg", 0.92);
      return { blob, name: outputName(file, "-watermarked", "jpg") };
    }
    progress?.(0.9);
    const blob = await canvasToBlob(canvas, mimeFor(format), 0.92);
    return { blob, name: outputName(file, "-watermarked", format) };
  } finally {
    loaded.dispose();
  }
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
    const key = hexToRgb(options.color || "#ffffff");
    const tolerance = (Number(options.tolerance) || 0) * 4.42;
    const softness = (Number(options.feather) || 0) * 4;
    const inner = tolerance;
    const outer = tolerance + softness;
    progress?.(0.35);
    for (let index = 0; index < data.length; index += 4) {
      const dr = data[index] - key.r;
      const dg = data[index + 1] - key.g;
      const db = data[index + 2] - key.b;
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);
      if (distance <= inner) {
        data[index + 3] = 0;
      } else if (distance < outer) {
        const ratio = (distance - inner) / (outer - inner);
        data[index + 3] = Math.round(data[index + 3] * ratio);
      }
    }
    context.putImageData(imageData, 0, 0);
    progress?.(0.8);
    const blob = await canvasToBlob(canvas, "image/png");
    progress?.(0.95);
    return { blob, name: outputName(file, "-transparent", "png") };
  } finally {
    loaded.dispose();
  }
}

export async function processFavicons(file, { progress } = {}) {
  const zip = new JSZip();
  const loaded = await loadImageSource(file);
  try {
    const side = Math.min(1024, Math.max(loaded.width, loaded.height));
    const square = makeCanvas(side, side);
    const squareContext = square.getContext("2d");
    squareContext.clearRect(0, 0, side, side);
    const scale = Math.min((side * 0.92) / loaded.width, (side * 0.92) / loaded.height);
    const drawWidth = loaded.width * scale;
    const drawHeight = loaded.height * scale;
    squareContext.drawImage(
      loaded.source,
      (side - drawWidth) / 2,
      (side - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
    const sizes = [16, 32, 48, 64, 180, 192, 512];
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
      progress?.((index / sizes.length) * 0.8);
      await yieldToUi();
    }
    zip.file("favicon.ico", await buildIco([pngBlobs[16], pngBlobs[32], pngBlobs[48]]));
    zip.file(
      "site.webmanifest",
      JSON.stringify(
        {
          name: "My site",
          short_name: "My site",
          icons: [
            { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
          ],
          theme_color: "#7c5cff",
          background_color: "#ffffff",
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
- favicon.ico (16, 32 and 48 px)
- favicon-16x16.png, favicon-32x32.png, favicon-48x48.png, favicon-64x64.png
- apple-touch-icon.png (180 px)
- android-chrome-192x192.png, android-chrome-512x512.png
- site.webmanifest

Paste this into your <head>:

<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />

Generated locally with PixPDF — your logo never left your device.
`
    );
    progress?.(0.95);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, name: "favicon-kit.zip" };
  } finally {
    loaded.dispose();
  }
}

async function buildIco(blobs) {
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
    const dimension = [16, 32, 48][index] || 16;
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

export async function imagesToPdf(files, options, { progress } = {}) {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const doc = await PDFDocument.create();
  const margin = mmToPt(Number(options.margin) || 0);
  const pageSize = options.pageSize || "fit";

  const embedImage = async (loaded, preferPng) => {
    const canvas = makeCanvas(loaded.width, loaded.height);
    const context = canvas.getContext("2d");
    drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(
      canvas,
      preferPng ? "image/png" : "image/jpeg",
      preferPng ? undefined : 0.92
    );
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

      if (pageSize === "fit") {
        const embedded = await embedImage(loaded, preferPng);
        const pageWidth = imageWidth * 0.75;
        const pageHeight = imageHeight * 0.75;
        const page = doc.addPage([pageWidth, pageHeight]);
        page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
      } else {
        const base = pageSize === "letter" ? LETTER : A4;
        let width = base.width;
        let height = base.height;
        const isLandscape =
          options.orientation === "landscape" ||
          (options.orientation !== "portrait" && imageWidth > imageHeight);
        if (isLandscape) [width, height] = [height, width];
        const page = doc.addPage([width, height]);
        const availableWidth = Math.max(1, width - margin * 2);
        const availableHeight = Math.max(1, height - margin * 2);

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
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          drawSource(context, loaded.source, -sourceX, -sourceY, imageWidth, imageHeight);
          const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.92);
          const embedded = await doc.embedJpg(await jpeg.arrayBuffer());
          page.drawImage(embedded, {
            x: margin,
            y: margin,
            width: availableWidth,
            height: availableHeight
          });
        } else {
          const embedded = await embedImage(loaded, preferPng);
          const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
          const drawWidth = imageWidth * scale;
          const drawHeight = imageHeight * scale;
          const x = margin + (availableWidth - drawWidth) / 2;
          const y = margin + (availableHeight - drawHeight) / 2;
          page.drawImage(embedded, { x, y, width: drawWidth, height: drawHeight });
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

export async function cropImage(file, crop, { format = "png", quality = 0.92 } = {}) {
  const loaded = await loadImageSource(file);
  try {
    const canvas = makeCanvas(crop.width, crop.height);
    const context = canvas.getContext("2d");
    if (format === "jpg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(
      loaded.source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : quality);
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
    const width = swap ? loaded.height : loaded.width;
    const height = swap ? loaded.width : loaded.height;
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    const filter = [
      `brightness(${edits.brightness}%)`,
      `contrast(${edits.contrast}%)`,
      `saturate(${edits.saturation}%)`,
      `sepia(${edits.warmth}%)`,
      `grayscale(${edits.grayscale}%)`,
      `blur(${edits.blur}px)`,
      `hue-rotate(${edits.hue}deg)`
    ].join(" ");
    if (format === "jpg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate((angle * Math.PI) / 180);
    context.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
    context.filter = filter;
    drawSource(context, loaded.source, -loaded.width / 2, -loaded.height / 2, loaded.width, loaded.height);
    context.restore();
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
    const target = Math.max(1, Number(options.target) || 100) * (options.unit === "MB" ? 1024 * 1024 : 1024);
    const requestedWidth = Number(options.maxWidth) || loaded.width;
    let width = Math.min(loaded.width, requestedWidth);
    let height = Math.max(1, Math.round((loaded.height * width) / loaded.width));
    const allowResize = options.allowResize !== false;
    const mime = mimeFor(format);
    const background = format === "jpg" ? options.background || "#ffffff" : null;
    let best = null;

    const encode = async (w, h, quality) => {
      const canvas = makeCanvas(w, h);
      const context = canvas.getContext("2d");
      if (background) {
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      drawSource(context, loaded.source, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, mime, format === "png" ? undefined : quality);
      canvas.width = 1;
      canvas.height = 1;
      return blob;
    };

    if (format === "png") {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const blob = await encode(width, height, undefined);
        best = { blob, width, height };
        if (blob.size <= target || !allowResize || width <= 32) break;
        const ratio = Math.max(0.55, Math.min(0.92, Math.sqrt(target / blob.size) * 0.96));
        width = Math.max(32, Math.round(width * ratio));
        height = Math.max(1, Math.round((loaded.height * width) / loaded.width));
        progress?.(0.15 + attempt * 0.08, `Trying ${width} × ${height}…`);
      }
    } else {
      for (let attempt = 0; attempt < 9; attempt += 1) {
        let low = 0.15;
        let high = 0.96;
        let candidate = null;
        for (let step = 0; step < 7; step += 1) {
          const quality = (low + high) / 2;
          const blob = await encode(width, height, quality);
          if (blob.size <= target) {
            candidate = { blob, width, height, quality };
            low = quality;
          } else {
            high = quality;
          }
        }
        if (candidate) {
          best = candidate;
          const canGrow = width < Math.min(loaded.width, requestedWidth) && candidate.blob.size < target * 0.82;
          if (canGrow) {
            const ratio = Math.min(1.18, Math.sqrt(target / candidate.blob.size));
            width = Math.min(loaded.width, Math.round(width * ratio));
            height = Math.max(1, Math.round((loaded.height * width) / loaded.width));
            continue;
          }
          break;
        }
        const smallest = await encode(width, height, 0.15);
        best = { blob: smallest, width, height, quality: 0.15 };
        if (!allowResize || width <= 32) break;
        const ratio = Math.max(0.5, Math.min(0.88, Math.sqrt(target / smallest.size) * 0.94));
        width = Math.max(32, Math.round(width * ratio));
        height = Math.max(1, Math.round((loaded.height * width) / loaded.width));
        progress?.(0.15 + attempt * 0.08, `Reducing to ${width} × ${height}…`);
      }
    }

    if (!best) throw new Error("Could not encode this image.");
    const label = options.unit === "MB" ? `${options.target}MB` : `${options.target}KB`;
    const suffix = best.blob.size <= target ? `-${label}` : `-near-${label}`;
    progress?.(1, "Done");
    return {
      blob: best.blob,
      name: outputName(file, suffix, format),
      width: best.width,
      height: best.height,
      underTarget: best.blob.size <= target
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
    if (options.fit === "contain") {
      const scale = Math.min(width / loaded.width, height / loaded.height);
      const drawWidth = loaded.width * scale;
      const drawHeight = loaded.height * scale;
      drawSource(context, loaded.source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    } else {
      const scale = Math.max(width / loaded.width, height / loaded.height);
      const drawWidth = loaded.width * scale;
      const drawHeight = loaded.height * scale;
      drawSource(context, loaded.source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    }
    progress?.(0.8);
    const blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : 0.92);
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
    const canvas = makeCanvas(sourceWidth + border * 2, sourceHeight + border * 2);
    const context = canvas.getContext("2d");
    if (format === "jpg" || ["solid", "double", "dashed", "dotted"].includes(style)) {
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.save();
    if (style === "circle") {
      context.beginPath();
      context.arc(canvas.width / 2, canvas.height / 2, sourceWidth / 2, 0, Math.PI * 2);
      context.clip();
    } else if (style === "rounded") {
      const radius = Math.min(Number(options.radius) || 0, sourceWidth / 2, sourceHeight / 2);
      const x = border;
      const y = border;
      context.beginPath();
      context.roundRect(x, y, sourceWidth, sourceHeight, radius);
      context.clip();
    }
    context.drawImage(
      loaded.source,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      border,
      border,
      sourceWidth,
      sourceHeight
    );
    context.restore();

    context.strokeStyle = color;
    context.lineWidth = border;
    if (style === "circle") {
      context.beginPath();
      context.arc(canvas.width / 2, canvas.height / 2, sourceWidth / 2 + border / 2, 0, Math.PI * 2);
      context.stroke();
    } else if (style === "dashed" || style === "dotted") {
      context.setLineDash(style === "dotted" ? [border * 0.35, border * 1.1] : [border * 2.2, border * 1.3]);
      context.strokeRect(border / 2, border / 2, canvas.width - border, canvas.height - border);
    } else if (style === "double") {
      context.strokeRect(border / 3, border / 3, canvas.width - (border * 2) / 3, canvas.height - (border * 2) / 3);
      context.lineWidth = Math.max(1, border / 4);
      context.strokeRect(border, border, sourceWidth, sourceHeight);
    } else if (style === "solid") {
      context.strokeRect(border / 2, border / 2, canvas.width - border, canvas.height - border);
    }
    progress?.(0.9);
    const blob = await canvasToBlob(canvas, mimeFor(format), format === "png" ? undefined : 0.92);
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
