import { PDFDocument, openPdf, savePdf } from "../../lib/pdf.js";
import { parsePageRangeGroups, sanitizeFilename, yieldToUi } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    const totalWork = files.length;
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      const source = await openPdf(file, options.password);
      const totalPages = source.getPageCount();
      if (!totalPages) continue;
      const base = sanitizeFilename(file.name, "document");
      const groups = [];

      if (options.mode === "all") {
        for (let page = 0; page < totalPages; page += 1) groups.push([page]);
      } else if (options.mode === "every") {
        const size = Math.max(1, Math.trunc(Number(options.every) || 1));
        for (let start = 0; start < totalPages; start += size) {
          groups.push(
            Array.from(
              { length: Math.min(size, totalPages - start) },
              (_, offset) => start + offset
            )
          );
        }
      } else {
        groups.push(...parsePageRangeGroups(options.ranges, totalPages));
      }

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        progress?.(
          (fileIndex / totalWork) + (groupIndex / groups.length) * (1 / totalWork),
          `Splitting ${file.name} — part ${groupIndex + 1} of ${groups.length}…`
        );
        const part = await PDFDocument.create();
        const pages = await part.copyPages(source, groups[groupIndex]);
        pages.forEach((page) => part.addPage(page));
        const bytes = await savePdf(part);
        outputs.push({
          blob: new Blob([bytes], { type: "application/pdf" }),
          name: `${base}-part-${String(groupIndex + 1).padStart(2, "0")}.pdf`
        });
        await yieldToUi();
      }
    }
    if (!outputs.length) throw new Error("Nothing could be split. Check your page ranges.");
    progress?.(1, "Done");
    return outputs;
  }
};
