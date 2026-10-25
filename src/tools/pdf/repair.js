import { PDFDocument, openPdfJs, renderPageToCanvas, savePdf } from "../../lib/pdf.js";
import { canvasToBlob, sanitizeFilename, yieldToUi } from "../../lib/utils.js";

async function rasterize(file, dpi, password, progress) {
  const source = await openPdfJs(file, password);
  try {
    const target = await PDFDocument.create();
    const total = source.numPages;
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      progress((pageNumber - 1) / total, `Rebuilding page ${pageNumber} of ${total}…`);
      const page = await source.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const { canvas } = await renderPageToCanvas(page, dpi / 72);
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
      const image = await target.embedJpg(await blob.arrayBuffer());
      const newPage = target.addPage([viewport.width, viewport.height]);
      newPage.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height });
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
      await yieldToUi();
    }
    const bytes = await savePdf(target);
    return new Blob([bytes], { type: "application/pdf" });
  } finally {
    await source.destroy().catch(() => {});
  }
}

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
      } catch (error) {
        if (options.rasterizeFallback !== false) {
          const blob = await rasterize(file, Number(options.fallbackDpi) || 120, options.password, (fraction, message) =>
            progress?.((index + fraction) / files.length, message)
          );
          outputs.push({
            blob,
            name: `${sanitizeFilename(file.name, "document")}-repaired.pdf`
          });
          continue;
        }
        throw new Error(
          `“${file.name}” could not be parsed. The file is too damaged for local recovery.`
        );
      }
      if (!source.getPageCount()) {
        if (options.rasterizeFallback !== false) {
          const blob = await rasterize(file, Number(options.fallbackDpi) || 120, options.password, (fraction, message) =>
            progress?.((index + fraction) / files.length, message)
          );
          outputs.push({ blob, name: `${sanitizeFilename(file.name, "document")}-repaired.pdf` });
          continue;
        }
        throw new Error(`“${file.name}” contains no readable pages.`);
      }
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
