import { processRotate } from "../../lib/image.js";
import { collectBatch } from "../../lib/batch.js";

export default {
  async process(files, options, { progress }) {
    const outputs = await collectBatch(files, async (file, index) => {
      progress?.((index / files.length) * 0.9, `Rotating ${file.name}…`);
      return processRotate(file, options, {
        progress: (fraction) =>
          progress?.((index + fraction) / files.length, `Rotating ${file.name}…`)
      });
    });
    progress?.(1, "Done");
    return outputs;
  }
};
