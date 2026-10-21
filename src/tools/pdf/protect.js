import { openPdf, savePdf } from "../../lib/pdf.js";
import { sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const password = String(options.password || "");
    if (!password) throw new Error("Choose a password before protecting the PDF.");
    if (password.length < 4) {
      throw new Error("Use a password with at least 4 characters.");
    }
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Encrypting ${file.name}…`);
      const doc = await openPdf(file);
      doc.encrypt({
        userPassword: password,
        ownerPassword: `${password}:owner`,
        permissions: {
          printing: options.allowPrinting ? "highResolution" : false,
          copying: Boolean(options.allowCopying),
          modifying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: true,
          documentAssembly: false
        }
      });
      const bytes = await savePdf(doc);
      outputs.push({
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-protected.pdf`
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
