import { pdfToMarkdown } from "../../lib/markdown.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      progress?.((index / files.length) * 0.9, `Converting ${files[index].name}…`);
      outputs.push(
        await pdfToMarkdown(files[index], options, {
          password: options.password,
          progress: (fraction, message) => progress?.((index + fraction) / files.length, message)
        })
      );
    }
    progress?.(1, "Done");
    return outputs;
  }
};
