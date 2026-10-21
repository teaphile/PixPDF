import { PDFDocument, openPdf, savePdf } from "../../lib/pdf.js";
import { parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Extracting pages from ${file.name}…`);
      const source = await openPdf(file, options.password);
      const pages = parsePageRanges(options.pages, source.getPageCount(), {
        allowEmptyAll: false
      });
      const output = await PDFDocument.create();
      const copied = await output.copyPages(source, pages);
      copied.forEach((page) => output.addPage(page));
      const bytes = await savePdf(output);
      outputs.push({
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-extracted.pdf`
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
