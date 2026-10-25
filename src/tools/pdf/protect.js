import { openPdf, savePdf } from "../../lib/pdf.js";
import { sanitizeFilename } from "../../lib/utils.js";

function randomPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export default {
  async process(files, options, { progress }) {
    let password = String(options.password || "").trim();
    const notes = [];
    if (options.confirmPassword && password !== options.confirmPassword) {
      throw new Error("The two passwords do not match. Please check and try again.");
    }
    if (!password && options.generatePassword !== false) {
      password = randomPassword();
      notes.push(`Generated password: ${password} — save it now, it cannot be recovered.`);
    }
    if (!password) throw new Error("Choose a password before protecting the PDF.");
    if (password.length < 4) throw new Error("Use a password with at least 4 characters.");

    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Encrypting ${file.name}…`);
      const doc = await openPdf(file);
      doc.encrypt({
        algorithm: options.strength === "aes128" ? "AES-128" : "AES-256",
        userPassword: password,
        ownerPassword: String(options.ownerPassword || "").trim() || `${password}:owner`,
        permissions: {
          printing: options.allowPrinting ? "highResolution" : false,
          copying: Boolean(options.allowCopying),
          modifying: Boolean(options.allowModifying),
          annotating: Boolean(options.allowAnnotating),
          fillingForms: Boolean(options.allowForms),
          contentAccessibility: options.allowAccessibility !== false,
          documentAssembly: Boolean(options.allowAssembly)
        }
      });
      const bytes = await savePdf(doc);
      outputs.push({
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-protected.pdf`
      });
    }
    outputs.notes = notes;
    progress?.(1, "Done");
    return outputs;
  }
};
