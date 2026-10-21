import { PDFDocument, savePdf } from "../../lib/pdf.js";
import { sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Rebuilding ${file.name}…`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      let source;
      try {
        source = await PDFDocument.load(bytes, {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
          updateMetadata: false,
          capNumbers: true
        });
      } catch {
        throw new Error(
          `“${file.name}” could not be parsed. The file is too damaged for local recovery.`
        );
      }
      if (!source.getPageCount()) throw new Error(`“${file.name}” contains no readable pages.`);
      const rebuilt = await PDFDocument.create();
      const copied = await rebuilt.copyPages(source, source.getPageIndices());
      copied.forEach((page) => rebuilt.addPage(page));
      if (options.keepMetadata !== false) {
        const title = source.getTitle();
        const author = source.getAuthor();
        const subject = source.getSubject();
        const keywords = source.getKeywords();
        if (title) rebuilt.setTitle(title);
        if (author) rebuilt.setAuthor(author);
        if (subject) rebuilt.setSubject(subject);
        if (keywords?.length) rebuilt.setKeywords(keywords);
      }
      rebuilt.setProducer("PixPDF Repair");
      const out = await savePdf(rebuilt);
      outputs.push({
        blob: new Blob([out], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-repaired.pdf`
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
