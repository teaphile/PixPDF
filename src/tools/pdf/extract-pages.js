import { PDFDocument, copyPdfMetadata, openPdf, savePdf } from "../../lib/pdf.js";
import { parsePageRangeGroups, parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Extracting pages from ${file.name}…`);
      const source = await openPdf(file, options.password);
      const base = sanitizeFilename(String(options.namePrefix || "").trim() || file.name, "document");
      let groups;
      if (options.outputMode === "zip") {
        groups = parsePageRanges(options.pages, source.getPageCount(), { allowEmptyAll: false }).map((page) => [page]);
      } else if (options.outputMode === "groups") {
        groups = parsePageRangeGroups(options.pages, source.getPageCount());
      } else {
        groups = [parsePageRanges(options.pages, source.getPageCount(), { allowEmptyAll: false })];
      }
      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        const group = [...groups[groupIndex]];
        if (options.reverse) group.reverse();
        const output = await PDFDocument.create();
        if (options.preserveMetadata !== false) copyPdfMetadata(source, output);
        const copied = await output.copyPages(source, group);
        copied.forEach((page) => output.addPage(page));
        const bytes = await savePdf(output);
        const suffix = groups.length === 1
          ? "extracted"
          : `page-${String(group[0] + 1).padStart(2, "0")}`;
        outputs.push({
          blob: new Blob([bytes], { type: "application/pdf" }),
          name: `${base}-${suffix}.pdf`
        });
      }
    }
    progress?.(1, "Done");
    return outputs;
  }
};
