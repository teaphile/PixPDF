import { degrees, openPdf, savePdf } from "../../lib/pdf.js";
import { parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

export default {
  async process(files, options, { progress }) {
    const outputs = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      progress?.((index / files.length) * 0.9, `Rotating ${file.name}…`);
      const doc = await openPdf(file, options.password);
      let pages = parsePageRanges(options.pages, doc.getPageCount());
      const custom = Number(options.customAngle) || 0;
      let angle = custom || Number(options.angle) || 90;
      if (options.snapTo90 !== false && Math.abs(custom) > 0) angle = Math.round(angle / 90) * 90;
      if (options.scope === "odd") pages = pages.filter((page) => (page + 1) % 2 === 1);
      if (options.scope === "even") pages = pages.filter((page) => (page + 1) % 2 === 0);
      pages.forEach((pageIndex, position) => {
        const page = doc.getPage(pageIndex);
        const current = page.getRotation().angle;
        const direction = options.alternate && position % 2 === 1 ? -angle : angle;
        const next = options.mode === "absolute" ? angle : current + direction;
        page.setRotation(degrees(((next % 360) + 360) % 360));
      });
      const bytes = await savePdf(doc);
      outputs.push({
        blob: new Blob([bytes], { type: "application/pdf" }),
        name: `${sanitizeFilename(file.name, "document")}-rotated.pdf`
      });
    }
    progress?.(1, "Done");
    return outputs;
  }
};
