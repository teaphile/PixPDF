import { processFavicons } from "../../lib/image.js";

export default {
  async process(files, options, { progress }) {
    return processFavicons(files[0], options, { progress });
  }
};
