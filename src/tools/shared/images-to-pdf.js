import { imagesToPdf } from "../../lib/image.js";
import { sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const result = await imagesToPdf(files, options, { progress });
    const base =
      files.length === 1 ? sanitizeFilename(files[0].name, "image") : "images";
    return {
      blob: result.blob,
      name: `${base}.pdf`
    };
  }
};
