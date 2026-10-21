import { StandardFonts, hexColor, openPdf, savePdf, withDisplaySpace } from "../../lib/pdf.js";
import { collectBatch } from "../../lib/batch.js";
import { parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = await collectBatch(files, async (file, index) => {
      progress?.((index / files.length) * 0.9, `Numbering ${file.name}…`);
      const doc = await openPdf(file, options.password);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const total = doc.getPageCount();
      const pages = parsePageRanges(options.pages, total);
      const format = String(options.format || "{n} / {total}");
      const start = options.start === "" || options.start === undefined ? 1 : Number(options.start);
      const size = Number(options.size) || 12;
      const margin = Number(options.margin) || 24;
      const color = hexColor(options.color, { r: 63, g: 61, b: 86 });
      try {
        pages.forEach((pageIndex, position) => {
          const page = doc.getPage(pageIndex);
          const text = format
            .replaceAll("{n}", String(start + position))
            .replaceAll("{total}", String(total));
          const width = font.widthOfTextAtSize(text, size);
          const height = font.heightAtSize(size);
          withDisplaySpace(page, ({ width: pageWidth, height: pageHeight }) => {
            let x = pageWidth / 2 - width / 2;
            let y = margin;
            if (options.position === "top-left" || options.position === "top-center" || options.position === "top-right") {
              y = pageHeight - margin - height;
            }
            if (options.position.endsWith("left")) x = margin;
            if (options.position.endsWith("right")) x = pageWidth - width - margin;
            page.drawText(text, { x, y, size, font, color });
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
