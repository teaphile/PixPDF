import { compressPdfLossless, compressPdfStrong, copyPdfMetadata, openPdf, savePdf } from "../../lib/pdf.js";
import { formatBytes, sanitizeFilename } from "../../lib/utils.js";

const readableTarget = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    const notes = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const base = sanitizeFilename(file.name, "document");
      const wrapper = (fraction, message) =>
        progress?.(
          (index + fraction) / files.length,
          files.length > 1 ? `File ${index + 1}/${files.length}: ${message}` : message
        );

      const result =
        options.mode === "lossless"
          ? await compressPdfLossless(file, options, {
              progress: wrapper,
              password: options.password
            })
          : await compressPdfStrong(file, options, {
              progress: wrapper,
              password: options.password
            });

      let blob = result.blob;
      const name = result.originalKept ? file.name : `${base}-compressed.pdf`;

      // Copy the source's title/author/subject/keywords onto a rasterised
      // rebuild — but never at the cost of growing past the original file.
      if (!result.originalKept && options.keepMetadata !== false) {
        try {
          const original = await openPdf(file, options.password);
          const rebuilt = await openPdf(new Blob([await blob.arrayBuffer()], { type: "application/pdf" }));
          copyPdfMetadata(original, rebuilt);
          const withMeta = new Blob([await savePdf(rebuilt)], { type: "application/pdf" });
          if (withMeta.size <= file.size) blob = withMeta;
        } catch {
          /* metadata is best effort — compression already succeeded */
        }
      }

      if (result.failed) {
        notes.push(`${file.name} could not be rebuilt in lossless mode — the original was kept.`);
      } else if (result.originalKept) {
        notes.push(
          `${file.name} is already optimised — the original file was kept (${formatBytes(file.size)}).`
        );
      } else if (result.reachedTarget === false) {
        notes.push(
          `${file.name}: could not reach ${readableTarget(result.targetBytes)} — the smallest possible was ${formatBytes(
            blob.size
          )}. Try JPEG pages, a lower resolution, or fewer pages.`
        );
      }

      outputs.push({ blob, name });
    }
    outputs.notes = notes;
    progress?.(1, "Done");
    return outputs;
  }
};
