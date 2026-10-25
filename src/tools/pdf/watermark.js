import { StandardFonts, drawWatermark, openPdf, savePdf } from "../../lib/pdf.js";
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
    const text = String(options.text || "").replace(/\r/g, "").trim();
    if (!text) throw new Error("Enter some watermark text.");
    const outputs = await collectBatch(files, async (file, index) => {
      progress?.((index / files.length) * 0.9, `Watermarking ${file.name}…`);
      const doc = await openPdf(file, options.password);
      const font = await doc.embedFont(FONTS[options.font] || StandardFonts.HelveticaBold);
      const pages = parsePageRanges(options.pages, doc.getPageCount());
      try {
        pages.forEach((pageIndex) => {
          drawWatermark(doc.getPage(pageIndex), text, options, font);
        });
      } catch (error) {
        if (/encode|winansi|character|glyph/i.test(String(error?.message))) {
          throw new Error(
            "The watermark contains characters the built-in PDF font cannot draw. Try Latin letters, numbers or symbols."
          );
        }
        throw error;
      }
      const bytes = await savePdf(doc);
      return {
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-watermarked.pdf`
      };
    });
    progress?.(1, "Done");
    return outputs;
  }
};
