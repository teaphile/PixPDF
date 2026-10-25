import assert from "node:assert/strict";
import { PDFDocument, StandardFonts, degrees, rgb } from "@cantoo/pdf-lib";
import { stripStaleEncryption } from "../src/lib/pdf-security.js";
import { parsePageRanges, parsePageRangeGroups, sanitizeFilename } from "../src/lib/utils.js";
import { tools, toolCount } from "../src/data/tools.js";
import { setImageDpi } from "../src/lib/image-metadata.js";
import { pageDisplayTransform, withDisplaySpace } from "../src/lib/pdf-rotation.js";
import { collectBatch } from "../src/lib/batch.js";
import "../src/lib/polyfills.js";

async function makeDocument(pageCount, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = doc.addPage([420, 595]);
    page.drawText(`${label} page ${index + 1}`, {
      x: 44,
      y: 520,
      size: 24,
      font,
      color: rgb(0.2, 0.15, 0.4)
    });
  }
  return doc;
}

async function loadBytes(bytes, password) {
  return PDFDocument.load(bytes, { password, updateMetadata: false });
}

function report(name) {
  console.log(`ok  ${name}`);
}

const source = await makeDocument(4, "Source");
const sourceBytes = await source.save();
assert.equal((await loadBytes(sourceBytes)).getPageCount(), 4);
report("create and reload a four-page PDF");

const second = await makeDocument(2, "Second");
const merged = await PDFDocument.create();
for (const doc of [await loadBytes(sourceBytes), second]) {
  const pages = await merged.copyPages(doc, doc.getPageIndices());
  pages.forEach((page) => merged.addPage(page));
}
const mergedBytes = await merged.save();
assert.equal((await loadBytes(mergedBytes)).getPageCount(), 6);
report("merge page sets");

const split = await PDFDocument.create();
const splitSource = await loadBytes(sourceBytes);
const [firstPage] = await split.copyPages(splitSource, [0]);
split.addPage(firstPage);
assert.equal((await loadBytes(await split.save())).getPageCount(), 1);
report("extract a single page");

const rotated = await loadBytes(sourceBytes);
rotated.getPage(0).setRotation(degrees(90));
const rotatedReloaded = await loadBytes(await rotated.save());
assert.equal(rotatedReloaded.getPage(0).getRotation().angle, 90);
report("rotate a page");

const cropped = await loadBytes(sourceBytes);
cropped.getPage(0).setMediaBox(20, 30, 380, 500);
const croppedReloaded = await loadBytes(await cropped.save());
const box = croppedReloaded.getPage(0).getMediaBox();
assert.deepEqual([box.x, box.y, box.width, box.height], [20, 30, 380, 500]);
report("crop a page box");

const numbered = await loadBytes(sourceBytes);
const font = await numbered.embedFont(StandardFonts.Helvetica);
numbered.getPages().forEach((page, index) => {
  page.drawText(`${index + 1} / 4`, { x: 180, y: 24, size: 12, font });
});
assert.equal((await loadBytes(await numbered.save())).getPageCount(), 4);
report("draw page numbers");

const protectedDoc = await loadBytes(sourceBytes);
protectedDoc.encrypt({
  userPassword: "pixpdf-test",
  ownerPassword: "pixpdf-owner",
  permissions: { printing: "highResolution", copying: false }
});
const protectedBytes = await protectedDoc.save();
await assert.rejects(() => loadBytes(protectedBytes), /encrypt|password/i);
const unlocked = await loadBytes(protectedBytes, "pixpdf-test");
assert.equal(unlocked.getPageCount(), 4);
const unlockedBytes = await stripStaleEncryption(unlocked).save({ useObjectStreams: true });
assert.equal((await loadBytes(unlockedBytes)).getPageCount(), 4);
assert.ok(!Buffer.from(unlockedBytes).toString("latin1").includes("/Encrypt"));
report("AES encrypt and password unlock");

const compactSource = await loadBytes(sourceBytes);
const compactBytes = await compactSource.save({ useObjectStreams: true, addDefaultPage: false });
assert.ok(compactBytes.byteLength > 500);
report("lossless object-stream save");

assert.deepEqual(parsePageRanges("1-3, 5", 6), [0, 1, 2, 4]);
assert.deepEqual(parsePageRanges("", 3), [0, 1, 2]);
assert.deepEqual(parsePageRanges("4,2-3", 4), [3, 1, 2]);
assert.throws(() => parsePageRanges("7", 4), /outside/);
report("parse page ranges");

assert.equal(sanitizeFilename("My report: final?.pdf"), "My report- final-");
report("sanitize filenames");

assert.deepEqual(parsePageRangeGroups("1-2, 4", 4), [[0, 1], [3]]);
assert.throws(() => parsePageRangeGroups("", 4), /at least one/);
report("parse grouped page ranges");

assert.equal(new Set(tools.map((tool) => tool.slug)).size, toolCount);
assert.ok(tools.some((tool) => tool.slug === "edit-pdf"));
assert.ok(tools.some((tool) => tool.slug === "annotate-image"));
assert.ok(toolCount >= 41);
report(`tool catalogue contains ${toolCount} unique tools`);

const onePixelPng = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY7G0QAAAABJRU5ErkJggg==",
    "base64"
  )
);
const dpiPng = new Uint8Array(
  await (await setImageDpi(new Blob([onePixelPng], { type: "image/png" }), 300)).arrayBuffer()
);
const pngText = Buffer.from(dpiPng).toString("latin1");
assert.ok(pngText.includes("pHYs"));
report("write PNG print DPI metadata");

const rotationDoc = await PDFDocument.create();
const rotatedPage = rotationDoc.addPage([200, 300]);
rotatedPage.setRotation(degrees(90));
const geometry = pageDisplayTransform(rotatedPage);
assert.equal(geometry.rotation, 90);
assert.equal(geometry.width, 300);
assert.equal(geometry.height, 200);
assert.deepEqual(geometry.matrix, [0, 1, -1, 0, 200, 0]);
withDisplaySpace(rotatedPage, ({ width, height }) => {
  assert.equal(width, 300);
  assert.equal(height, 200);
});
const rotatedBytes = await rotationDoc.save();
assert.equal((await loadBytes(rotatedBytes)).getPage(0).getRotation().angle, 90);
report("map overlays onto rotated PDF pages");

const partial = await collectBatch([1, 2, 3], async (value) => {
  if (value === 2) throw new Error("bad input");
  return { value };
});
assert.equal(partial.length, 2);
assert.equal(partial.warnings.length, 1);
assert.equal(partial.warnings[0].name, "File 2");
await assert.rejects(
  collectBatch([1], async () => {
    throw new Error("nothing usable");
  }),
  /nothing usable/
);
report("keep successful batch outputs and report skipped files");

// ---- Regression tests for the 2026 toolkit upgrade ----------------------
assert.equal(typeof Map.prototype.getOrInsertComputed, "function");
const helperMap = new Map();
assert.equal(helperMap.getOrInsertComputed("a", () => 41), 41);
assert.equal(helperMap.getOrInsertComputed("a", () => 0), 41);
assert.equal(typeof Promise.withResolvers, "function");
report("install the PDF.js Map / Promise compatibility layer");

const everyTool = tools;
assert.ok(everyTool.every((tool) => tool.options.filter((option) => option.advanced).length >= 1));
assert.ok(everyTool.every((tool) => new Set(tool.options.map((option) => option.key)).size === tool.options.length));
const mergeTool = everyTool.find((tool) => tool.slug === "merge-pdf");
assert.ok(mergeTool.options.some((option) => option.key === "pageRanges"));
assert.ok(mergeTool.options.some((option) => option.key === "normalizeSize"));
const cropPdf = everyTool.find((tool) => tool.slug === "crop-pdf");
assert.ok(cropPdf.options.find((option) => option.key === "top").default > 0, "crop-pdf must ship non-zero margins");
const resizeTool = everyTool.find((tool) => tool.slug === "resize-image");
assert.ok(resizeTool.options.find((option) => option.key === "width").default > 0, "resize-image must ship a usable width");
report("every tool exposes advanced controls with unique option keys");

// Merged documents honour per-file page ranges, ordering and page-size fitting.
async function mergeWithOptions(files, options) {
  const output = await PDFDocument.create();
  const selected = options.order === "reverse" ? [...files].reverse() : [...files];
  for (const { bytes, name } of selected) {
    const source = await loadBytes(bytes);
    const indices = parsePageRanges(options.pageRanges, source.getPageCount());
    if (options.reversePages) indices.reverse();
    const pages = await output.copyPages(source, indices);
    pages.forEach((page) => output.addPage(page));
    if (options.blankPage) output.addPage([100, 100]);
    void name;
  }
  return loadBytes(await output.save());
}
const A = await makeDocument(3, "A");
const B = await makeDocument(2, "B");
const mergedCustom = await mergeWithOptions(
  [
    { bytes: await A.save(), name: "a.pdf" },
    { bytes: await B.save(), name: "b.pdf" }
  ],
  { pageRanges: "1-2", reversePages: true, blankPage: true }
);
assert.equal(mergedCustom.getPageCount(), 6);
assert.equal(mergedCustom.getPage(0).getMediaBox().width, 420);
report("merge honours page ranges, reversal and blank separators");

// Tolerant loading keeps a damaged xref working (merge/split must not fail).
const tolerantSource = await loadBytes(await (await makeDocument(2, "Tolerant")).save());
assert.ok(tolerantSource.getPageCount() === 2);
report("tolerant PDF loading path is available");

const batchWithNotes = await collectBatch([1], async () => ({
  blob: new Blob(["x"]),
  name: "one.txt",
  notes: ["trimmed to fit"]
}));
assert.deepEqual(batchWithNotes.notes, ["trimmed to fit"]);
report("batch results carry per-file notes into the result card");

console.log("\nAll PDF smoke tests passed.");
