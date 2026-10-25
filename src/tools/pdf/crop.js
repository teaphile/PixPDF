import { openPdf, savePdf } from "../../lib/pdf.js";
import { parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

const TO_POINTS = { mm: 2.834645669, cm: 28.34645669, in: 72, pt: 1 };

const PRESETS = {
  equal5: { top: 5, bottom: 5, left: 5, right: 5, unit: "mm" },
  equal10: { top: 10, bottom: 10, left: 10, right: 10, unit: "mm" },
  headerFooter: { top: 18, bottom: 18, left: 0, right: 0, unit: "mm" },
  half: { top: 0, bottom: "50%", left: 0, right: 0, unit: "percent" },
  leftHalf: { top: 0, bottom: 0, left: 0, right: "50%", unit: "percent" }
};

export default {
  async process(files, options, { progress }) {
    const preset = PRESETS[options.preset] || null;
    const unit = preset?.unit || options.unit || "mm";
    const raw = preset || {
      top: options.top,
      bottom: options.bottom,
      left: options.left,
      right: options.right
    };
    const extra = {
      top: Number(options.customTop) || 0,
      bottom: Number(options.customBottom) || 0,
      left: Number(options.customLeft) || 0,
      right: Number(options.customRight) || 0
    };
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Cropping ${file.name}…`);
      const doc = await openPdf(file, options.password);
      const total = doc.getPageCount();
      const pages = options.cropContent === false
        ? parsePageRanges(options.pages, total)
        : doc.getPageIndices();
      let changed = false;
      for (const pageIndex of pages) {
        const page = doc.getPage(pageIndex);
        const box = page.getMediaBox();
        const convert = (value, dimension) => {
          if (typeof value === "string" && value.endsWith("%")) {
            return (Number.parseFloat(value) / 100) * dimension;
          }
          const amount = Number(value) || 0;
          if (unit === "percent") return (amount / 100) * dimension;
          return amount * (TO_POINTS[unit] || TO_POINTS.mm);
        };
        const margins = {
          top: convert(raw.top, box.height) + convert(extra.top, box.height),
          bottom: convert(raw.bottom, box.height) + convert(extra.bottom, box.height),
          left: convert(raw.left, box.width) + convert(extra.left, box.width),
          right: convert(raw.right, box.width) + convert(extra.right, box.width)
        };
        if (!margins.top && !margins.bottom && !margins.left && !margins.right) continue;
        const width = box.width - margins.left - margins.right;
        const height = box.height - margins.top - margins.bottom;
        if (width < 10 || height < 10) {
          throw new Error("Those margins would remove the entire page. Reduce them and try again.");
        }
        const x = box.x + margins.left;
        const y = box.y + margins.bottom;
        if (options.keepSize) {
          page.setCropBox(x, y, width, height);
        } else {
          page.setMediaBox(x, y, width, height);
          page.setCropBox(x, y, width, height);
        }
        changed = true;
      }
      if (!changed) {
        outputs.push({
          blob: new Blob([await savePdf(doc)], { type: "application/pdf" }),
          name: `${sanitizeFilename(file.name, "document")}-uncropped.pdf`
        });
        continue;
      }
      const bytes = await savePdf(doc);
      outputs.push({
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-cropped.pdf`
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
