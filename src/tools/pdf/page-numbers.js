import { StandardFonts, hexColor, openPdf, savePdf, withDisplaySpace } from "../../lib/pdf.js";
import { collectBatch } from "../../lib/batch.js";
import { parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

const FONTS = {
  helvetica: StandardFonts.Helvetica,
  "helvetica-bold": StandardFonts.HelveticaBold,
  times: StandardFonts.TimesRoman,
  "times-bold": StandardFonts.TimesRomanBold,
  courier: StandardFonts.Courier,
  "courier-bold": StandardFonts.CourierBold
};

export default {
  async process(files, options, { progress }) {
    const outputs = await collectBatch(files, async (file, index) => {
      progress?.((index / files.length) * 0.9, `Numbering ${file.name}…`);
      const doc = await openPdf(file, options.password);
      const font = await doc.embedFont(FONTS[options.font] || StandardFonts.Helvetica);
      const total = doc.getPageCount();
      const pages = parsePageRanges(options.pages, total);
      const format = String(options.format || "{n} / {total}");
      const start = options.start === "" || options.start === undefined ? 1 : Number(options.start);
      const size = Number(options.size) || 12;
      const margin = Number(options.margin) || 24;
      const opacity = Math.max(0.1, Math.min(1, Number(options.opacity) || 1));
      const color = hexColor(options.color, { r: 63, g: 61, b: 86 });
      const boxColor = hexColor(options.boxColor, { r: 255, g: 255, b: 255 });
      const prefix = String(options.prefix || "");
      const suffix = String(options.suffix || "");
      const position = options.position || "bottom-center";
      try {
        pages.forEach((pageIndex, pagePosition) => {
          if (options.skipFirst && pagePosition === 0) return;
          const page = doc.getPage(pageIndex);
          const text = `${prefix}${format
            .replaceAll("{n}", String(start + pagePosition))
            .replaceAll("{total}", String(total))}${suffix}`;
          const width = font.widthOfTextAtSize(text, size);
          const height = font.heightAtSize(size);
          withDisplaySpace(page, ({ width: pageWidth, height: pageHeight }) => {
            const align = options.alignMode === "position" ? null : options.alignMode;
            const isLeft = align === "left" || (!align && position.endsWith("left"));
            const isRight = align === "right" || (!align && position.endsWith("right"));
            let x = pageWidth / 2 - width / 2;
            if (isLeft) x = margin;
            if (isRight) x = pageWidth - width - margin;
            let y = margin;
            if (position.startsWith("top")) y = pageHeight - margin - height;
            if (options.box) {
              page.drawRectangle({
                x: x - 6,
                y: y - 3,
                width: width + 12,
                height: height + 6,
                color: boxColor,
                opacity: 0.82
              });
            }
            page.drawText(text, { x, y, size, font, color, opacity });
          });
        });
      } catch (error) {
        if (/encode|winansi|character|glyph/i.test(String(error?.message))) {
          throw new Error(
            "The number format contains unsupported characters. Use Latin letters, numbers and symbols like {n}."
          );
        }
        throw error;
      }
      const bytes = await savePdf(doc);
      return {
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-numbered.pdf`
      };
    });
    progress?.(1, "Done");
    return outputs;
  }
};
