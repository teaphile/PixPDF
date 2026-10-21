import { PDFDocument, openPdf, savePdf } from "../../lib/pdf.js";

export default {
  async process(files, options, { progress }) {
    const output = await PDFDocument.create();
    let totalPages = 0;
    let metadata = null;
    for (let index = 0; index < files.length; index += 1) {
      progress?.((index / files.length) * 0.9, `Reading ${files[index].name}…`);
      const source = await openPdf(files[index], options.password);
      if (!metadata) {
        metadata = {
          title: source.getTitle(),
          author: source.getAuthor(),
          subject: source.getSubject(),
          keywords: source.getKeywords()
        };
      }
      try {
        const form = source.getForm();
        if (form.getFields().length) form.flatten();
      } catch {
        /* Some PDFs have malformed forms; pages can still be merged. */
      }
      const indices = source.getPageIndices();
      const pages = await output.copyPages(source, indices);
      pages.forEach((page) => output.addPage(page));
      totalPages += pages.length;
      progress?.(((index + 1) / files.length) * 0.9, `Merged ${index + 1} of ${files.length}…`);
    }
    if (!totalPages) throw new Error("These PDFs do not contain any pages.");
    progress?.(0.95, "Writing the merged PDF…");
    if (metadata?.title) output.setTitle(metadata.title);
    if (metadata?.author) output.setAuthor(metadata.author);
    if (metadata?.subject) output.setSubject(metadata.subject);
    if (metadata?.keywords?.length) output.setKeywords(metadata.keywords);
    output.setProducer("PixPDF");
    output.setCreator("PixPDF — local PDF toolkit");
    output.setModificationDate(new Date());
    const bytes = await savePdf(output);
    progress?.(1, "Done");
    return {
      blob: new Blob([bytes], { type: "application/pdf" }),
      name: "merged.pdf"
    };
  }
};
