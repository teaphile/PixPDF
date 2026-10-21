import { processCompress } from "../../lib/image.js";
import { collectBatch } from "../../lib/batch.js";

export default {
  async process(files, options, { progress }) {
    const outputs = await collectBatch(files, async (file, index) => {
      progress?.((index / files.length) * 0.9, `Compressing ${file.name}…`);
      return processCompress(file, options, {
        progress: (fraction) =>
          progress?.((index + fraction) / files.length, `Compressing ${file.name}…`)
      });
    });
    progress?.(1, "Done");
    return outputs;
  }
};
