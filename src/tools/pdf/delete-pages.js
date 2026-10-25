import { PDFDocument, copyPdfMetadata, openPdf, savePdf } from "../../lib/pdf.js";
import { parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Cleaning ${file.name}…`);
      const source = await openPdf(file, options.password);
      const total = source.getPageCount();
      const remove = new Set(parsePageRanges(options.pages, total, { allowEmptyAll: false }));
      if (remove.size >= total) {
        throw new Error("You cannot delete every page. At least one page must remain.");
      }
      const keep = source.getPageIndices().filter((page) => !remove.has(page));
      const output = await PDFDocument.create();
      if (options.preserveMetadata !== false) copyPdfMetadata(source, output);
      const copied = await output.copyPages(source, keep);
      copied.forEach((page) => output.addPage(page));
      const bytes = await savePdf(output);
      const suffix = options.renumber ? `${keep.length}-pages` : "cleaned";
      outputs.push({
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-${suffix}.pdf`
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
