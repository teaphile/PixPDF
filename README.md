# PixPDF

PixPDF is a browser-based PDF and image toolkit. File processing is performed locally in the browser; document contents are not uploaded to a PixPDF processing server.

## Features

The catalogue currently contains 41 tools.

### PDF

- Merge, split, extract, delete, reorder and rotate pages
- Compress, crop, watermark and number pages
- Convert PDF pages to JPG
- Extract selectable text or convert text content to Markdown
- Edit PDF content, fill forms, annotate and apply visual signatures
- Compare documents, redact visible content, protect and unlock password-protected PDFs
- Rebuild readable PDFs when their internal structure is damaged

### Images

- Compress, resize, crop, rotate, flip and convert images
- Add watermarks, borders and annotations
- Remove a sampled/selected background colour
- Edit image appearance, create favicons and prepare passport photos
- Create signature images, inspect metadata and write DPI metadata
- Split, join and resize images for social formats
- Fit raster images to a target file size

## Important limitations

- **OCR is not included.** PDF-to-text reads an existing selectable text layer. Scanned pages need OCR software before text extraction.
- **Background removal is colour-key based**, not AI subject segmentation. It works best with plain, consistently coloured backgrounds.
- **PDF signatures are visual signatures**, not certificate-backed cryptographic digital signatures.
- **PDF repair is best-effort.** Its raster fallback can discard selectable text, vector content, links, forms and some metadata. Keep the original and verify repaired output.
- **Compression is a trade-off.** Image-based or aggressive compression can reduce quality. Review output before relying on it.
- Password-protected files require a password you are authorised to use. PixPDF does not recover lost passwords.

## Local development

Requirements: Node.js 22 or a compatible supported version, and npm.

```bash
npm ci
npm run dev
```

## Validation

```bash
npm run test:pdf
npm run build
npm run preview
```

The smoke suite exercises core PDF operations and guards the tool catalogue, option wiring, batch handling, image metadata, PDF rotation, compatibility polyfills and retry behavior for failed lazy-loaded tool imports.

GitHub Actions runs the smoke suite and production build on pushes to `main`, the `hardening/**` branches, and pull requests targeting `main`.

## Architecture

- `src/data/`: tool catalogue, FAQs and shared option definitions
- `src/tools/`: lazy-loaded PDF and image tool implementations
- `src/lib/`: PDF/image engines, output processing, persistence and utilities
- `src/ui/` and `src/pages/`: interface and route rendering
- `public/sw.js`: app-shell caching for offline use
- `scripts/smoke-test.mjs`: Node-based regression suite

## Privacy model

The app does not require an account or a file-processing backend. PDF and image operations use browser-side JavaScript and browser APIs. The site still needs to load its static application assets initially; after those assets have been cached, supported tools can continue to work offline. Browser storage is used for non-file preferences such as theme, favourites and saved tool settings.
