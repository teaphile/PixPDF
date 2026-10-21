import { compressPdfLossless, compressPdfStrong } from "../../lib/pdf.js";
import { sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const base = sanitizeFilename(file.name, "document");
      const wrapper = (fraction, message) =>
        progress?.(
          (index + fraction) / files.length,
          files.length > 1 ? `File ${index + 1}/${files.length}: ${message}` : message
        );
      let blob;
      if (options.mode === "lossless") {
        blob = await compressPdfLossless(file, { progress: wrapper, password: options.password });
      } else {
        blob = await compressPdfStrong(file, options, { progress: wrapper, password: options.password });
      }
      outputs.push({
        blob,
        name: `${base}-compressed.pdf`,
        originalSize: file.size
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
