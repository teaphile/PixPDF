import { pdfToImages } from "../../lib/pdf.js";
import { sanitizeFilename } from "../../lib/utils.js";
import { zipOutputs } from "../../lib/zip.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const base = sanitizeFilename(
        String(options.prefix || "").trim() ? options.prefix : file.name,
        "document"
      );
      const results = await pdfToImages(file, options, {
        password: options.password,
        progress: (fraction, message) =>
          progress?.(
            (index + fraction) / files.length,
            files.length > 1 ? `File ${index + 1}/${files.length}: ${message}` : message
          )
      });
      results.forEach((result) => {
        const extension = options.format === "png" ? "png" : "jpg";
        const pageMatch = /-page-(\d+)\./.exec(result.name);
        const page = pageMatch ? pageMatch[1] : "01";
        outputs.push({ ...result, name: `${base}-page-${page}.${extension}` });
      });
    }
    progress?.(0.97, "Packing images…");
    if (options.oneZip !== false && outputs.length > 1) {
      const zip = await zipOutputs(outputs, options.outputName ? `${sanitizeFilename(options.outputName)}.zip` : "pdf-images.zip");
      progress?.(1, "Done");
      return [{ blob: zip.blob, name: zip.name }];
    }
    progress?.(1, "Done");
    return outputs;
  }
};
