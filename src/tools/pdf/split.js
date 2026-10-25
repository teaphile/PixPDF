import { PDFDocument, openPdf, savePdf } from "../../lib/pdf.js";
import { parsePageRangeGroups, sanitizeFilename, yieldToUi } from "../../lib/utils.js";
import { zipOutputs } from "../../lib/zip.js";

function copyMetadata(source, target, enabled) {
  if (!enabled) return;
  try {
    const title = source.getTitle();
    const author = source.getAuthor();
    const subject = source.getSubject();
    const keywords = source.getKeywords();
    if (title) target.setTitle(title);
    if (author) target.setAuthor(author);
    if (subject) target.setSubject(subject);
    if (keywords?.length) target.setKeywords(keywords);
  } catch {
    /* metadata is optional */
  }
}

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    const totalWork = files.length;
    const startNumber = Number(options.startNumber) || 1;
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
          fileIndex / totalWork + (groupIndex / groups.length) * (1 / totalWork),
          `Splitting ${file.name} — part ${groupIndex + 1} of ${groups.length}…`
        );
        const group = groups[groupIndex];
        const part = await PDFDocument.create();
        copyMetadata(source, part, options.preserveMetadata !== false);
        const pages = await part.copyPages(source, group);
        pages.forEach((page) => part.addPage(page));
        const bytes = await savePdf(part);
        const number = String(startNumber + groupIndex).padStart(2, "0");
        let suffix = `part-${number}`;
        if (options.naming === "pages") {
          const first = group[0] + 1;
          const last = group[group.length - 1] + 1;
          suffix = first === last ? `page-${first}` : `pages-${first}-${last}`;
        } else if (options.naming === "source") {
          suffix = `source-${number}`;
        }
        outputs.push({
          blob: new Blob([bytes], { type: "application/pdf" }),
          name: `${base}-${suffix}.pdf`
        });
        await yieldToUi();
      }
    }
    if (!outputs.length) throw new Error("Nothing could be split. Check your page ranges.");
    progress?.(0.98, "Packing your files…");
    if (options.zipParts !== false && outputs.length > 1) {
      const zip = await zipOutputs(outputs, options.outputName ? `${sanitizeFilename(options.outputName)}.zip` : "split.zip");
      progress?.(1, "Done");
      return [{ blob: zip.blob, name: zip.name }];
    }
    progress?.(1, "Done");
    return outputs;
  }
};
