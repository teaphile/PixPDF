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
  "annotate-image": () => import("./image/annotate.js")
};

export const registeredToolSlugs = Object.freeze(Object.keys(loaders));

/**
 * Create a lazy module loader with in-flight request de-duplication.
 *
 * A rejected dynamic import must not remain cached: chunk requests can fail
 * transiently (offline mode, interrupted deploy, flaky connection). Keeping
 * that rejected Promise permanently makes the tool unusable until a full
 * page reload. Successful imports stay cached; failed imports are evicted so
 * the next navigation can retry.
 */
export function createToolLoader(toolLoaders) {
  const moduleCache = new Map();

  return async function loadToolModule(slug) {
    if (moduleCache.has(slug)) return moduleCache.get(slug);

    const loader = toolLoaders[slug];
    if (typeof loader !== "function") throw new Error(`Unknown tool: ${slug}`);

    const pending = Promise.resolve()
      .then(loader)
      .then((module) => module?.default ?? module);

    moduleCache.set(slug, pending);

    try {
      return await pending;
    } catch (error) {
      // Do not delete a newer request if this loader was superseded.
      if (moduleCache.get(slug) === pending) moduleCache.delete(slug);
      throw error;
    }
  };
}

export const loadToolModule = createToolLoader(loaders);
