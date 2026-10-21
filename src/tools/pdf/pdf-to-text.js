import { extractText } from "../../lib/pdf.js";
import { sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const text = await extractText(file, options, {
        password: options.password,
        progress: (fraction, message) =>
          progress?.(
            (index + fraction) / files.length,
            files.length > 1 ? `File ${index + 1}/${files.length}: ${message}` : message
          )
      });
      if (!text.trim()) {
        throw new Error(
          "No selectable text was found. This PDF may be a scan — it needs OCR before text extraction."
        );
      }
      outputs.push({
        blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
        name: `${sanitizeFilename(file.name, "document")}.txt`
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
