const loaders = {
  "merge-pdf": () => import("./pdf/merge.js"),
  "split-pdf": () => import("./pdf/split.js"),
  "compress-pdf": () => import("./pdf/compress.js"),
  "pdf-to-jpg": () => import("./pdf/pdf-to-jpg.js"),
  "jpg-to-pdf": () => import("./shared/images-to-pdf.js"),
  "rotate-pdf": () => import("./pdf/rotate.js"),
  "watermark-pdf": () => import("./pdf/watermark.js"),
  "page-numbers-pdf": () => import("./pdf/page-numbers.js"),
  "protect-pdf": () => import("./pdf/protect.js"),
  "unlock-pdf": () => import("./pdf/unlock.js"),
  "extract-pages": () => import("./pdf/extract-pages.js"),
  "delete-pages": () => import("./pdf/delete-pages.js"),
  "organize-pdf": () => import("./pdf/organize.js"),
  "crop-pdf": () => import("./pdf/crop.js"),
  "sign-pdf": () => import("./pdf/sign.js"),
  "pdf-to-text": () => import("./pdf/pdf-to-text.js"),
  "compress-image": () => import("./image/compress.js"),
  "resize-image": () => import("./image/resize.js"),
  "convert-image": () => import("./image/convert.js"),
  "crop-image": () => import("./image/crop.js"),
  "rotate-image": () => import("./image/rotate.js"),
  "watermark-image": () => import("./image/watermark.js"),
  "remove-background": () => import("./image/remove-background.js"),
  "photo-editor": () => import("./image/editor.js"),
  "favicon-generator": () => import("./image/favicon.js"),
  "image-to-pdf": () => import("./shared/images-to-pdf.js"),
  "edit-pdf": () => import("./pdf/edit.js"),
  "fill-pdf-forms": () => import("./pdf/forms.js"),
  "redact-pdf": () => import("./pdf/redact.js"),
  "compare-pdf": () => import("./pdf/compare.js"),
  "pdf-to-markdown": () => import("./pdf/pdf-to-markdown.js"),
  "repair-pdf": () => import("./pdf/repair.js"),
  "compress-to-size": () => import("./image/compress-to-size.js"),
  "passport-photo": () => import("./image/passport.js"),
  "signature-maker": () => import("./image/signature.js"),
  "image-metadata": () => import("./image/metadata.js"),
  "split-image": () => import("./image/split-image.js"),
  "join-images": () => import("./image/join.js"),
  "social-resize": () => import("./image/social-resize.js"),
  "image-border": () => import("./image/border.js"),
  "annotate-image": () => import("./image/annotate.js"),
}

const moduleCache = new Map();

export async function loadToolModule(slug) {
  if (moduleCache.has(slug)) return moduleCache.get(slug);
  const loader = loaders[slug];
  if (!loader) throw new Error(`Unknown tool: ${slug}`);
  const loaded = loader().then((module) => module.default || module);
  moduleCache.set(slug, loaded);
  return loaded;
}
