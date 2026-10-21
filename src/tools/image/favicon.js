import { processFavicons } from "../../lib/image.js";

export default {
  async process(files, _options, { progress }) {
    const result = await processFavicons(files[0], { progress });
    return result;
  }
};
