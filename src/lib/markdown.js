import { openPdfJs } from "./pdf.js";
import { parsePageRanges, sanitizeFilename, yieldToUi } from "./utils.js";

const escapeMd = (text) =>
  text
    .replace(/([\\`*_{}[\]()#+.!|>])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim();

function buildLines(items) {
  const lines = [];
  for (const item of items) {
    const text = String(item.str ?? "").replace(/\s+/g, " ").trim();
    if (!text || !Array.isArray(item.transform)) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const size = Math.abs(item.transform[3]) || item.height || 10;
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= Math.max(2, size * 0.38));
    if (!line) {
      line = { y, items: [], size: 0 };
      lines.push(line);
    }
    line.items.push({ text, x, size });
    line.size = Math.max(line.size, size);
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      line.items.sort((a, b) => a.x - b.x);
      let text = "";
      let lastEnd = null;
      for (const item of line.items) {
        if (lastEnd !== null && item.x - lastEnd > item.size * 0.22) text += " ";
        text += item.text;
        lastEnd = item.x + item.text.length * item.size * 0.48;
      }
      return { text: text.trim(), size: line.size, y: line.y };
    })
    .filter((line) => line.text);
}

function median(values) {
  if (!values.length) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function lineToMarkdown(line, medianSize, headings) {
  const raw = line.text;
  if (!raw) return "";
  if (/^[•●▪◦‣·]\s+/.test(raw)) return `- ${escapeMd(raw.replace(/^[•●▪◦‣·]\s+/, ""))}`;
  if (/^\d+[.)]\s+/.test(raw)) return escapeMd(raw).replace(/^(\d+[.)])\\/, "$1");
  if (headings && raw.length < 120) {
    const ratio = line.size / Math.max(medianSize, 1);
    let level = 0;
    if (ratio >= 1.65) level = 1;
    else if (ratio >= 1.35) level = 2;
    else if (ratio >= 1.15) level = 3;
    if (level) return `${"#".repeat(level)} ${escapeMd(raw)}`;
    if (raw.length < 70 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) {
      return `## ${escapeMd(raw)}`;
    }
  }
  return escapeMd(raw);
}

export async function pdfToMarkdown(file, options, { progress = () => {}, password } = {}) {
  const doc = await openPdfJs(file, password);
  try {
    const total = doc.numPages;
    const pages = parsePageRanges(options.pages, total);
    const sections = [];
    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = pages[index] + 1;
      progress((index / pages.length) * 0.92, `Reading page ${pageNumber} of ${total}…`);
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = buildLines(content.items);
      const baseSize = median(lines.map((line) => line.size));
      const paragraphs = [];
      for (const line of lines) {
        const block = lineToMarkdown(line, baseSize, options.headings !== false);
        if (block) paragraphs.push(block);
      }
      const body = paragraphs.join("\n").trim();
      sections.push(
        options.pageBreaks === false
          ? body
          : `${index > 0 ? "---\n\n" : ""}${body}`
      );
      page.cleanup();
      await yieldToUi();
    }
    progress(1, "Done");
    const base = sanitizeFilename(file.name, "document");
    return {
      blob: new Blob([sections.join("\n\n").trim() + "\n"], {
        type: "text/markdown;charset=utf-8"
      }),
      name: `${base}.md`
    };
  } finally {
    await doc.destroy();
  }
}
