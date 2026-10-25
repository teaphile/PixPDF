import {
  PDFDocument,
  StandardFonts,
  fitPageToSize,
  hexColor,
  openPdf,
  savePdf,
  withDisplaySpace
} from "../../lib/pdf.js";
import { A4, LETTER, parsePageRanges, sanitizeFilename } from "../../lib/utils.js";

const PAGE_SIZES = {
  a4: A4,
  letter: LETTER
};

function targetSize(mode, firstPage) {
  if (mode === "a4" || mode === "letter") return { ...PAGE_SIZES[mode] };
  if (mode === "first" && firstPage) {
    const box = firstPage.getMediaBox();
    return { width: box.width, height: box.height };
  }
  return null;
}

function stamp(page, text, font) {
  withDisplaySpace(page, ({ width, height }) => {
    const size = 9;
    const safe = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    let label = safe;
    // Standard PDF fonts are WinAnsi; replace characters they cannot encode.
    label = label.replace(/[^\x20-\x7E]/g, "?");
    page.drawText(label, {
      x: 14,
      y: Math.max(12, height - 18),
      size,
      font,
      color: hexColor("#6b6885")
    });
    void width;
  });
}

function addTitlePage(doc, text, size, font) {
  const width = size?.width || A4.width;
  const height = size?.height || A4.height;
  const page = doc.addPage([width, height]);
  const label = sanitizeFilename(text, "Document").slice(0, 70).replace(/[^\x20-\x7E]/g, "?");
  const fontSize = 18;
  const textWidth = font.widthOfTextAtSize(label, fontSize);
  page.drawText(label, {
    x: Math.max(20, (width - textWidth) / 2),
    y: height / 2,
    size: fontSize,
    font,
    color: hexColor("#3f3d56")
  });
  page.drawText("— PixPDF —", {
    x: Math.max(20, width / 2 - 32),
    y: height / 2 - 28,
    size: 10,
    font,
    color: hexColor("#8b86a8")
  });
}

export default {
  async process(files, options, { progress }) {
    const output = await PDFDocument.create();
    const font = await output.embedFont(StandardFonts.Helvetica);
    const password = options.password || undefined;
    const warnings = [];
    const notes = [];
    let totalPages = 0;
    let metadata = null;
    let firstPage = null;
    const selected = [...files];
    if (options.order === "reverse") selected.reverse();
    if (options.order === "name") {
      selected.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }

    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      progress?.((index / selected.length) * 0.88, `Reading ${file.name}…`);
      let source;
      try {
        source = await openPdf(file, password);
      } catch (error) {
        // A password-protected file must never be skipped silently: the
        // workspace shows a password prompt for this exact message.
        if (/password|encrypt|decrypt/i.test(String(error?.message || ""))) throw error;
        if (options.skipBadFiles !== false && selected.length > 1) {
          warnings.push({ name: file.name, message: error?.message || "Could not be read" });
          continue;
        }
        throw error;
      }
      if (!metadata) {
        metadata = {
          title: source.getTitle(),
          author: source.getAuthor(),
          subject: source.getSubject(),
          keywords: source.getKeywords()
        };
      }
      if (options.flattenForms !== false) {
        try {
          const form = source.getForm();
          if (form.getFields().length) form.flatten();
        } catch {
          /* Some PDFs have malformed forms; pages can still be merged. */
        }
      }
      let indices;
      try {
        indices = parsePageRanges(options.pageRanges, source.getPageCount());
      } catch (error) {
        if (options.skipBadFiles !== false && selected.length > 1) {
          warnings.push({ name: file.name, message: error.message });
          continue;
        }
        throw error;
      }
      if (options.reversePages) indices.reverse();
      if (!indices.length) {
        warnings.push({ name: file.name, message: "No pages selected" });
        continue;
      }

      if (options.addBookmarks && totalPages > 0) addTitlePage(output, file.name, null, font);
      if (options.blankPage && totalPages > 0) {
        const box = firstPage?.getMediaBox();
        output.addPage(box ? [box.width, box.height] : [A4.width, A4.height]);
      }

      let pages;
      try {
        pages = await output.copyPages(source, indices);
      } catch (error) {
        if (options.skipBadFiles !== false && selected.length > 1) {
          warnings.push({ name: file.name, message: error?.message || "Pages could not be copied" });
          continue;
        }
        throw error;
      }
      const size = targetSize(options.normalizeSize, firstPage);
      for (const page of pages) {
        output.addPage(page);
        if (!firstPage) firstPage = page;
        if (size) fitPageToSize(page, size);
      }
      if (options.stampNames) stamp(pages[0], file.name, font);
      totalPages += pages.length;
      progress?.(((index + 1) / selected.length) * 0.88, `Merged ${index + 1} of ${selected.length}…`);
    }

    if (!totalPages) {
      throw new Error(
        warnings.length
          ? `None of the PDFs could be read. ${warnings[0].message}`
          : "These PDFs do not contain any pages."
      );
    }
    progress?.(0.94, "Writing the merged PDF…");
    const title = options.metaTitle || options.pdfTitle || metadata?.title;
    const author = options.metaAuthor || options.pdfAuthor || metadata?.author;
    if (title) output.setTitle(title);
    if (author) output.setAuthor(author);
    if (metadata?.subject) output.setSubject(metadata.subject);
    if (metadata?.keywords?.length) output.setKeywords(metadata.keywords);
    output.setProducer("PixPDF");
    output.setCreator("PixPDF — local PDF toolkit");
    output.setModificationDate(new Date());
    const bytes = await savePdf(output);
    if (warnings.length) {
      notes.push(`${warnings.length} file${warnings.length === 1 ? " was" : "s were"} skipped: ${warnings
        .map((warning) => warning.name)
        .slice(0, 3)
        .join(", ")}.`);
    }
    notes.push(`${totalPages} pages from ${selected.length - warnings.length} PDFs.`);
    progress?.(1, "Done");
    return {
      blob: new Blob([bytes], { type: "application/pdf" }),
      name: options.outputName ? `${sanitizeFilename(options.outputName)}.pdf` : "merged.pdf",
      warnings,
      notes
    };
  }
};
