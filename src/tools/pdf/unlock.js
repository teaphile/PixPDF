import { openPdf, savePdf, stripStaleEncryption } from "../../lib/pdf.js";
import { sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const password = String(options.password || "");
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Unlocking ${file.name}…`);
      let doc;
      try {
        doc = await openPdf(file, password);
      } catch (error) {
        if (/password|encrypt/i.test(String(error?.message))) {
          throw new Error(
            password
              ? "That password did not work for this PDF."
              : "This PDF is password-protected. Enter its password to unlock it."
          );
        }
        throw error;
      }
      if (options.flattenForms) {
        try {
          const form = doc.getForm();
          if (form.getFields().length) form.flatten();
        } catch {
          /* malformed forms can be ignored */
        }
      }
      if (options.keepMetadata === false) {
        try {
          doc.setTitle("");
          doc.setAuthor("");
          doc.setSubject("");
          doc.setKeywords([]);
          doc.setCreator("");
          doc.setProducer("");
        } catch {
          /* metadata is optional */
        }
      }
      const bytes = await savePdf(stripStaleEncryption(doc));
      outputs.push({
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-unlocked.pdf`
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
