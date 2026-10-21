import { degrees, openPdf, savePdf } from "../../lib/pdf.js";
import { parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Rotating ${file.name}…`);
      const doc = await openPdf(file, options.password);
      const pages = parsePageRanges(options.pages, doc.getPageCount());
      const angle = Number(options.angle) || 90;
      pages.forEach((pageIndex) => {
        const page = doc.getPage(pageIndex);
        page.setRotation(degrees((page.getRotation().angle + angle) % 360));
      });
      const bytes = await savePdf(doc);
      outputs.push({
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-rotated.pdf`
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
