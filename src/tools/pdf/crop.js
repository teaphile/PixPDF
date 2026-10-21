import { openPdf, savePdf } from "../../lib/pdf.js";
import { mmToPt, parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const margins = {
      top: mmToPt(Number(options.top) || 0),
      bottom: mmToPt(Number(options.bottom) || 0),
      left: mmToPt(Number(options.left) || 0),
      right: mmToPt(Number(options.right) || 0)
    };
    if (!margins.top && !margins.bottom && !margins.left && !margins.right) {
      throw new Error("Set at least one margin greater than 0 mm to crop.");
    }
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Cropping ${file.name}…`);
      const doc = await openPdf(file, options.password);
      const pages = parsePageRanges(options.pages, doc.getPageCount());
      pages.forEach((pageIndex) => {
        const page = doc.getPage(pageIndex);
        const box = page.getMediaBox();
        const width = box.width - margins.left - margins.right;
        const height = box.height - margins.top - margins.bottom;
        if (width < 10 || height < 10) {
          throw new Error("Those margins would remove the entire page. Reduce them and try again.");
        }
        const x = box.x + margins.left;
        const y = box.y + margins.bottom;
        page.setMediaBox(x, y, width, height);
        page.setCropBox(x, y, width, height);
      });
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
