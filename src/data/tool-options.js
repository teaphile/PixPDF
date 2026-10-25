/**
 * Extra manual controls for every tool.
 *
 * `tools.js` composes its base definitions with `extraOptions` and
 * `commonOptions`. Keeping the catalogue here means the 41 tool cards stay
 * readable while every tool gets a deep, consistent set of real (wired-up)
 * settings instead of cosmetic sliders.
 */
import { DPI_CHOICES, OUTPUT_FORMATS } from "../lib/output-options.js";

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" }
];

const range = (key, label, defaultValue, min, max, step = 1, help = "") => ({
  key,
  label,
  type: "range",
  default: defaultValue,
  min,
  max,
  step,
  help
});

const number = (key, label, defaultValue, min, max, extra = {}) => ({
  key,
  label,
  type: "number",
  default: defaultValue,
  min,
  max,
  step: 1,
  ...extra
});

const text = (key, label, defaultValue = "", extra = {}) => ({
  key,
  label,
  type: "text",
  default: defaultValue,
  ...extra
});

const toggle = (key, label, defaultValue = false, help = "") => ({
  key,
  label,
  type: "checkbox",
  default: defaultValue,
  help
});

const select = (key, label, defaultValue, choices, help = "") => ({
  key,
  label,
  type: "select",
  default: defaultValue,
  choices,
  help
});

const heading = (label) => ({ key: `heading-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label, type: "heading" });

const PAGE_FONTS = [
  { value: "helvetica", label: "Helvetica — clean sans" },
  { value: "helvetica-bold", label: "Helvetica Bold" },
  { value: "times", label: "Times — classic serif" },
  { value: "times-bold", label: "Times Bold" },
  { value: "courier", label: "Courier — typewriter" },
  { value: "courier-bold", label: "Courier Bold" }
];

const IMAGE_BACKGROUND = { key: "background", label: "Background colour", type: "color", default: "#ffffff" };

const QUALITY_RANGE = range("quality", "Image quality", 0.9, 0.3, 1, 0.02);

const fitChoices = [
  { value: "contain", label: "Fit inside (letterbox)" },
  { value: "cover", label: "Fill & crop" },
  { value: "stretch", label: "Stretch exactly" },
  { value: "original", label: "Keep original size, centred" }
];

export const extraOptions = {
  /* ------------------------------------------------------------------ PDF */
  "merge-pdf": [
    heading("Merge behaviour"),
    text("pageRanges", "Pages from each file", "", {
      placeholder: "e.g. 1-3, 5, 8-10 · blank = all pages",
      help: "The same page selection is applied to every input PDF."
    }),
    select("order", "File order", "queue", [
      { value: "queue", label: "As arranged in the list" },
      { value: "reverse", label: "Reverse file order" },
      { value: "name", label: "Sort A → Z by name" }
    ]),
    toggle("reversePages", "Reverse the pages inside each file", false),
    toggle("blankPage", "Insert a blank page between files", false),
    toggle("flattenForms", "Flatten form fields before merging", true, "Prevents field-name collisions between documents."),
    toggle("skipBadFiles", "Skip files that cannot be read", true, "Useful for large batches with one damaged scan."),
    select("normalizeSize", "Uniform page size", "keep", [
      { value: "keep", label: "Keep each original size" },
      { value: "a4", label: "Fit everything to A4" },
      { value: "letter", label: "Fit everything to US Letter" },
      { value: "first", label: "Match the first page's size" }
    ]),
    toggle("stampNames", "Stamp each source file name on its first page", false),
    toggle("addBookmarks", "Insert a titled separator page before each file", false)
  ],

  "split-pdf": [
    heading("Split output"),
    select("naming", "Name the parts", "part", [
      { value: "part", label: "…part-01.pdf" },
      { value: "pages", label: "…pages-1-3.pdf" },
      { value: "source", label: "…source-01.pdf" }
    ]),
    number("startNumber", "First part number", 1, 0, 9999),
    toggle("preserveMetadata", "Keep title, author and keywords", true),
    toggle("zipParts", "Deliver parts in a ZIP", true, "Turn off to download the first part only.")
  ],

  "compress-pdf": [
    heading("Raster compression"),
    select("customDpi", "Custom resolution", "0", [
      { value: "0", label: "Use the preset above" },
      { value: "72", label: "72 DPI" },
      { value: "96", label: "96 DPI" },
      { value: "120", label: "120 DPI" },
      { value: "180", label: "180 DPI" },
      { value: "240", label: "240 DPI" },
      { value: "300", label: "300 DPI" }
    ], "Overrides the resolution preset when set."),
    select("colorMode", "Colour mode", "color", [
      { value: "color", label: "Full colour" },
      { value: "grayscale", label: "Grayscale — smaller" }
    ]),
    select("imageFormat", "Page image format", "jpg", [
      { value: "jpg", label: "JPEG — best for scans" },
      { value: "png", label: "PNG — best for line art" }
    ]),
    { key: "background", label: "Page background", type: "color", default: "#ffffff" },
    text("pages", "Only these pages", "", { placeholder: "e.g. 1-5, 9 · blank = all" }),
    toggle("keepMetadata", "Keep title, author and keywords", true),
    toggle("targetEnabled", "Aim for a target file size", false),
    number("targetSizeKb", "Target size", 500, 10, 102400, { suffix: "KB", help: "Quality is reduced automatically until the PDF fits." })
  ],

  "pdf-to-jpg": [
    heading("Image rendering"),
    select("dpiMode", "Resolution mode", "scale", [
      { value: "scale", label: "By scale" },
      { value: "dpi", label: "By print DPI" },
      { value: "width", label: "By exact pixel width" }
    ]),
    select("renderDpi", "Print DPI", "150", DPI_CHOICES.slice(1)),
    number("targetWidth", "Output width", 1600, 16, 12000, { suffix: "px" }),
    { key: "background", label: "Page background", type: "color", default: "#ffffff" },
    toggle("grayscale", "Convert to grayscale", false),
    text("prefix", "File name prefix", "", { placeholder: "Blank = original file name" }),
    toggle("oneZip", "Bundle images in a ZIP", true)
  ],

  "jpg-to-pdf": [
    heading("Page layout"),
    select("customPageSize", "Extra page sizes", "preset", [
      { value: "preset", label: "Use the page size above" },
      { value: "legal", label: "US Legal (216 × 356 mm)" },
      { value: "a5", label: "A5 (148 × 210 mm)" },
      { value: "square", label: "Square (210 × 210 mm)" },
      { value: "custom", label: "Custom millimetres" }
    ]),
    number("customWidth", "Custom page width", 210, 20, 2000, { suffix: "mm" }),
    number("customHeight", "Custom page height", 297, 20, 2000, { suffix: "mm" }),
    select("marginSide", "Margin style", "all", [
      { value: "all", label: "Same margin on every side" },
      { value: "horizontal", label: "Left & right only" },
      { value: "vertical", label: "Top & bottom only" }
    ]),
    { key: "background", label: "Page background", type: "color", default: "#ffffff" },
    range("jpegQuality", "Photo quality", 0.9, 0.3, 1, 0.02),
    toggle("grayscaleImages", "Convert photos to grayscale", false),
    toggle("centerImages", "Centre images on the page", true),
    toggle("pageBorder", "Draw a thin border around each photo", false),
    toggle("autoRotate", "Auto-rotate landscape photos", true)
  ],

  "rotate-pdf": [
    heading("Rotation"),
    select("mode", "Rotation mode", "relative", [
      { value: "relative", label: "Add to current rotation" },
      { value: "absolute", label: "Set an exact angle" }
    ]),
    number("customAngle", "Custom angle", 0, -360, 360, { suffix: "°", help: "Non-zero overrides the preset (90/180/270)." }),
    select("scope", "Apply to", "all", [
      { value: "all", label: "Selected pages" },
      { value: "odd", label: "Odd selected pages only" },
      { value: "even", label: "Even selected pages only" }
    ]),
    toggle("snapTo90", "Snap custom angles to 90° steps", true, "Keeps viewers that only understand 0/90/180/270 happy."),
    toggle("alternate", "Alternate direction on every other page", false)
  ],

  "watermark-pdf": [
    heading("Text styling"),
    select("font", "Font", "helvetica-bold", PAGE_FONTS),
    toggle("multiline", "Treat text as multiple lines", false, "Splits on line breaks for a centered stamp."),
    range("tileGap", "Tile spacing", 0, -60, 120, 5),
    range("textOpacityBoost", "Extra opacity", 0, 0, 0.5, 0.01),
    heading("Placement"),
    number("manualX", "Manual X position", 50, 0, 100, { suffix: "%" }),
    number("manualY", "Manual Y position", 50, 0, 100, { suffix: "%" }),
    toggle("useManual", "Use manual X / Y (overrides position)", false),
    toggle("outline", "Draw a subtle outline behind the text", false)
  ],

  "page-numbers-pdf": [
    heading("Number style"),
    select("font", "Font", "helvetica", PAGE_FONTS),
    range("opacity", "Opacity", 1, 0.1, 1, 0.02),
    text("prefix", "Prefix", "", { placeholder: "e.g. Page " }),
    text("suffix", "Suffix", "", { placeholder: "e.g.  · draft" }),
    select("alignMode", "Horizontal alignment", "position", [
      { value: "position", label: "Follow position setting" },
      { value: "left", label: "Always left" },
      { value: "center", label: "Always centre" },
      { value: "right", label: "Always right" }
    ]),
    toggle("skipFirst", "Skip the first page", false),
    toggle("box", "Draw a soft background box", false),
    { key: "boxColor", label: "Box colour", type: "color", default: "#ffffff" }
  ],

  "protect-pdf": [
    heading("Encryption"),
    select("strength", "Encryption strength", "aes256", [
      { value: "aes128", label: "AES-128 (compatible)" },
      { value: "aes256", label: "AES-256 (strongest)" }
    ]),
    toggle("generatePassword", "Generate a strong password if empty", true, "The generated password is shown after processing — save it!"),
    text("ownerPassword", "Owner password (optional)", "", { placeholder: "Blank = derived from user password" }),
    text("confirmPassword", "Repeat user password", "", { placeholder: "Must match exactly" }),
    heading("Permissions"),
    toggle("allowModifying", "Allow editing", false),
    toggle("allowAnnotating", "Allow comments", false),
    toggle("allowForms", "Allow filling forms", false),
    toggle("allowAssembly", "Allow rearranging pages", false),
    toggle("allowAccessibility", "Allow screen readers", true)
  ],

  "unlock-pdf": [
    toggle("keepMetadata", "Keep document metadata", true),
    toggle("flattenForms", "Flatten form fields", false)
  ],

  "extract-pages": [
    heading("Extraction"),
    select("outputMode", "Output", "single", [
      { value: "single", label: "One PDF with all selected pages" },
      { value: "zip", label: "One PDF per page (ZIP)" },
      { value: "groups", label: "One PDF per range (ZIP)" }
    ]),
    toggle("reverse", "Reverse page order", false),
    toggle("preserveMetadata", "Keep document metadata", true),
    text("namePrefix", "File name prefix", "", { placeholder: "Blank = original name" })
  ],

  "delete-pages": [
    toggle("preserveMetadata", "Keep document metadata", true),
    toggle("renumber", "Show a page count in the file name", false)
  ],

  "crop-pdf": [
    heading("Crop geometry"),
    select("unit", "Unit", "mm", [
      { value: "mm", label: "Millimetres" },
      { value: "cm", label: "Centimetres" },
      { value: "in", label: "Inches" },
      { value: "pt", label: "PDF points" },
      { value: "percent", label: "Percent of page" }
    ]),
    select("preset", "Quick preset", "custom", [
      { value: "custom", label: "Manual margins" },
      { value: "equal5", label: "5 mm on every side" },
      { value: "equal10", label: "10 mm on every side" },
      { value: "headerFooter", label: "Remove header & footer (18 mm)" },
      { value: "half", label: "Keep top half only" },
      { value: "leftHalf", label: "Keep left half only" }
    ]),
    number("customTop", "Extra top", 0, 0, 2000, { suffix: "units" }),
    number("customBottom", "Extra bottom", 0, 0, 2000, { suffix: "units" }),
    number("customLeft", "Extra left", 0, 0, 2000, { suffix: "units" }),
    number("customRight", "Extra right", 0, 0, 2000, { suffix: "units" }),
    toggle("cropContent", "Apply to all pages", true, "Off = only the pages selected below."),
    toggle("keepSize", "Keep the original page size (mask content)", false)
  ],

  "edit-pdf": [],
  "fill-pdf-forms": [],
  "redact-pdf": [
    heading("Redaction style"),
    { key: "redactColor", label: "Box colour", type: "color", default: "#000000" },
    toggle("redactBorder", "Draw a thin outline", false),
    number("redactExpand", "Expand boxes", 0, -10, 40, { suffix: "pt" }),
    toggle("keepPageSize", "Keep page size when rebuilding", true),
    select("rebuildDpi", "Rebuild resolution", "150", [
      { value: "110", label: "110 DPI — smallest" },
      { value: "150", label: "150 DPI — balanced" },
      { value: "200", label: "200 DPI — sharper" },
      { value: "300", label: "300 DPI — print" }
    ])
  ],
  "compare-pdf": [
    heading("Comparison"),
    select("compareMode", "Mode", "auto", [
      { value: "auto", label: "Auto — text plus visual check" },
      { value: "text", label: "Text only (fastest)" },
      { value: "visual", label: "Visual only — for scans" }
    ], "Visual mode compares rendered pixels, so scanned documents work too."),
    toggle("ignoreCase", "Ignore letter case", false),
    toggle("ignoreWhitespace", "Ignore extra whitespace", true),
    range("pixelTolerance", "Visual tolerance", 1, 0, 30, 0.5, "Percent of pixels that may differ before a page counts as changed."),
    toggle("reportIncludeSame", "Include unchanged pages in the report", false)
  ],
  "organize-pdf": [
    heading("Saving"),
    number("blankEvery", "Insert a blank page every", 0, 0, 100, { suffix: "pages", help: "0 = never insert blanks." }),
    toggle("flattenForms", "Flatten form fields", false),
    toggle("preserveMetadata", "Keep document metadata", true),
    select("normalizeSize", "Uniform page size", "keep", [
      { value: "keep", label: "Keep each page size" },
      { value: "a4", label: "Fit everything to A4" },
      { value: "letter", label: "Fit everything to US Letter" },
      { value: "first", label: "Match the first page" }
    ])
  ],
  "sign-pdf": [
    heading("Signature look"),
    toggle("addDateStamp", "Add a date stamp under the signature", false),
    toggle("drawSignatureBorder", "Draw a light signature box", false),
    range("signatureOpacity", "Signature opacity", 100, 30, 100, 1)
  ],

  "pdf-to-text": [
    heading("Text layout"),
    select("layout", "Layout", "lines", [
      { value: "lines", label: "Preserve line breaks" },
      { value: "paragraphs", label: "Join lines into paragraphs" },
      { value: "raw", label: "One item per line (raw)" }
    ]),
    toggle("pageHeaders", "Add “--- Page N ---” headers", true),
    toggle("trimLines", "Trim trailing spaces", true),
    text("pageSeparator", "Text between pages", "\n\n\n", { placeholder: "Use \\n for a new line" }),
    toggle("normalizeSpaces", "Collapse repeated spaces", false)
  ],

  "repair-pdf": [
    heading("Recovery"),
    toggle("rasterizeFallback", "Rasterise pages if the structure is unreadable", true, "Last-resort recovery for badly damaged scans."),
    select("fallbackDpi", "Fallback resolution", "120", [
      { value: "72", label: "72 DPI — smallest" },
      { value: "120", label: "120 DPI" },
      { value: "150", label: "150 DPI" },
      { value: "200", label: "200 DPI" }
    ]),

  ],

  "pdf-to-markdown": [
    heading("Markdown style"),
    toggle("bulletLists", "Detect bullet & numbered lists", true),
    toggle("escapeSpecial", "Escape Markdown characters", true),
    text("title", "Document title (adds a H1)", "", { placeholder: "Blank = no title" }),
    toggle("pageHeadings", "Add a heading for each page", false),
    toggle("blankLines", "Blank line between every paragraph", false),
    toggle("preserveCase", "Keep ALL CAPS as plain text", false)
  ],

  /* ---------------------------------------------------------------- IMAGE */
  "compress-image": [
    heading("Compression"),
    number("maxHeight", "Max height", 0, 0, 16000, { suffix: "px", help: "0 = unlimited. Width is scaled proportionally." }),
    { key: "background", label: "Matte colour", type: "color", default: "#ffffff" },
    toggle("keepOriginalIfLarger", "Keep original if compression makes it bigger", true),
    toggle("grayscale", "Convert to grayscale", false),
    range("sharpness", "Sharpen after resize", 0, 0, 100, 1),
    number("roundTo", "Round dimensions to", 1, 1, 64, { suffix: "px" })
  ],

  "resize-image": [
    heading("Sizing"),
    select("fit", "Fit mode", "fit", [
      { value: "fit", label: "Fit inside (keep aspect)" },
      { value: "exact", label: "Exact width × height" },
      { value: "cover", label: "Fill & crop to size" },
      { value: "percent", label: "Scale by percent" }
    ]),
    { key: "background", label: "Canvas background", type: "color", default: "#ffffff" },
    select("resample", "Resampling", "smooth", [
      { value: "smooth", label: "High quality (smooth)" },
      { value: "pixel", label: "Nearest neighbour (pixel art)" }
    ]),
    toggle("noUpscale", "Never enlarge small images", false),
    toggle("allowPadding", "Pad to exact size instead of stretching", false),
    select("format", "Output format", "keep", OUTPUT_FORMATS),
    range("outputJpegQuality", "JPG / WebP quality", 0.92, 0.3, 1, 0.02)
  ],

  "convert-image": [
    heading("Conversion"),
    number("width", "Resize width", 0, 0, 16000, { suffix: "px", help: "0 = keep original width." }),
    number("height", "Resize height", 0, 0, 16000, { suffix: "px" }),
    toggle("keepAspect", "Keep aspect ratio", true),
    toggle("grayscale", "Convert to grayscale", false),
    toggle("autoOrient", "Honour EXIF orientation", true, "Browser decoding applies the camera's orientation automatically.")
  ],

  "rotate-image": [
    heading("Rotation"),
    number("customAngle", "Custom angle", 0, -360, 360, { suffix: "°", help: "Non-zero overrides the preset." }),
    toggle("expand", "Expand canvas for arbitrary angles", true, "Avoids cutting off corners."),
    { key: "background", label: "Background for empty corners", type: "color", default: "#ffffff" },
    select("format", "Output format", "keep", OUTPUT_FORMATS),
    range("jpegQuality", "JPG / WebP quality", 0.92, 0.3, 1, 0.02)
  ],

  "watermark-image": [
    heading("Text styling"),
    select("font", "Font family", "sans", [
      { value: "sans", label: "Sans-serif" },
      { value: "serif", label: "Serif" },
      { value: "mono", label: "Monospace" }
    ]),
    toggle("bold", "Bold text", true),
    range("rotation", "Text rotation", 0, -180, 180, 1),
    range("tileRotation", "Tiled watermark angle", -28, -90, 90, 1),
    range("tileGap", "Tile spacing", 100, 20, 300, 5, "Percent of the default gap."),
    toggle("stroke", "Add a contrasting outline", false),
    { key: "strokeColor", label: "Outline colour", type: "color", default: "#000000" },
    range("margin", "Edge margin", 3.5, 0, 20, 0.5, "Percent of image width."),
    select("format", "Output format", "keep", OUTPUT_FORMATS),
    range("jpegQuality", "JPG / WebP quality", 0.92, 0.3, 1, 0.02)
  ],

  "remove-background": [
    heading("Keying"),
    toggle("autoDetect", "Auto-detect the corner colour", false, "Samples the four corners instead of using the swatch."),
    toggle("defringe", "Remove colour spill on edges", true),
    toggle("cropTransparent", "Crop to the visible subject", false),
    range("padding", "Padding around subject", 0, 0, 200, 2, "Used when cropping to the subject."),
    range("minAlpha", "Minimum opacity threshold", 0, 0, 100, 1)
  ],

  "favicon-generator": [
    heading("Icon design"),
    text("sizes", "PNG sizes", "16, 32, 48, 64, 180, 192, 512", { help: "Comma-separated pixel sizes (1–1024)." }),
    select("shape", "Shape", "square", [
      { value: "square", label: "Square" },
      { value: "rounded", label: "Rounded corners" },
      { value: "circle", label: "Circle" }
    ]),
    range("radius", "Corner radius", 22, 0, 50, 1, "Percent of the icon size."),
    range("padding", "Padding around the logo", 4, 0, 40, 1, "Percent of the icon size."),
    { key: "background", label: "Background colour", type: "color", default: "#7c5cff" },
    toggle("transparentBackground", "Transparent background", false),
    toggle("includeIco", "Include favicon.ico", true),
    toggle("includeManifest", "Include site.webmanifest + README", true),
    text("siteName", "Site name for the manifest", "My site"),
    { key: "themeColor", label: "Theme colour", type: "color", default: "#7c5cff" }
  ],

  "image-to-pdf": [
    heading("Page layout"),
    select("customPageSize", "Extra page sizes", "preset", [
      { value: "preset", label: "Use the page size above" },
      { value: "legal", label: "US Legal (216 × 356 mm)" },
      { value: "a5", label: "A5 (148 × 210 mm)" },
      { value: "square", label: "Square (210 × 210 mm)" },
      { value: "custom", label: "Custom millimetres" }
    ]),
    number("customWidth", "Custom page width", 210, 20, 2000, { suffix: "mm" }),
    number("customHeight", "Custom page height", 297, 20, 2000, { suffix: "mm" }),
    { key: "background", label: "Page background", type: "color", default: "#ffffff" },
    range("jpegQuality", "Photo quality", 0.9, 0.3, 1, 0.02),
    toggle("grayscaleImages", "Convert photos to grayscale", false),
    toggle("centerImages", "Centre images on the page", true),
    toggle("pageBorder", "Draw a thin border around each photo", false),
    toggle("autoRotate", "Auto-rotate landscape photos", true)
  ],

  "compress-to-size": [
    heading("Target size"),
    number("tolerance", "Acceptable overshoot", 0, 0, 50, { suffix: "%" }),
    range("minWidth", "Smallest allowed width", 320, 32, 4000, 16),
    toggle("keepAspect", "Keep aspect ratio", true),
    toggle("grayscale", "Convert to grayscale", false),
    toggle("exact", "Pad the file to the exact target size", false, "Adds harmless metadata bytes for strict upload forms."),
    toggle("allowUpscale", "Allow enlarging if there is spare room", false)
  ],

  "social-resize": [
    heading("Canvas"),
    range("padding", "Inner padding", 0, 0, 400, 4, "Pixels around the photo."),
    select("anchorX", "Horizontal anchor", "center", [
      { value: "left", label: "Left" },
      { value: "center", label: "Centre" },
      { value: "right", label: "Right" }
    ]),
    select("anchorY", "Vertical anchor", "center", [
      { value: "top", label: "Top" },
      { value: "center", label: "Centre" },
      { value: "bottom", label: "Bottom" }
    ]),
    range("jpegQuality", "JPG / WebP quality", 0.92, 0.3, 1, 0.02),
    toggle("grayscale", "Grayscale output", false),
    toggle("sharpen", "Sharpen after resize", true)
  ],

  "image-border": [
    heading("Frame details"),
    range("padding", "Inner padding", 0, 0, 300, 2, "Extra background inside the frame."),
    { key: "background", label: "Background behind rounded corners", type: "color", default: "#ffffff" },
    range("jpegQuality", "JPG / WebP quality", 0.92, 0.3, 1, 0.02),
    toggle("shadow", "Add a subtle drop shadow", false),
    range("shadowBlur", "Shadow blur", 24, 0, 120, 2),
    toggle("squareCanvas", "Force a square output canvas", false)
  ],

  "crop-image": [],
  "photo-editor": [
    heading("Export size"),
    number("outputWidth", "Width", 0, 0, 16000, { suffix: "px", help: "0 = keep the edited size." }),
    number("outputHeight", "Height", 0, 0, 16000, { suffix: "px", help: "Only the limiting dimension scales; aspect stays intact." }),
    range("outputScale", "Scale", 100, 10, 200, 1, "Percent of the edited size. Output size wins when both are set."),
    heading("Finishing"),
    range("sharpen", "Sharpen", 0, 0, 100, 1),
    range("vignette", "Vignette", 0, 0, 100, 1)
  ],
  "annotate-image": [
    heading("Export"),
    range("exportScale", "Resolution scale", 100, 25, 200, 5, "Percent of the original image resolution."),
    { key: "exportBackground", label: "Matte for JPG", type: "color", default: "#ffffff" }
  ],
  "passport-photo": [
    heading("Print finish"),
    { key: "photoBackground", label: "Photo background", type: "color", default: "#ffffff" },
    toggle("photoBorder", "Draw a cut line around the photo", true),
    range("photoBorderWidth", "Cut line width", 1, 0, 6, 0.5),
  ],
  "signature-maker": [
    heading("Signature finish"),
    toggle("trimWhitespace", "Trim empty edges", true, "Crops transparent margins so the signature hugs the ink."),
    range("signaturePadding", "Padding", 8, 0, 80, 2, "Pixels around the ink after trimming."),
    number("signatureWidth", "Output width", 0, 0, 4000, { suffix: "px", help: "0 keeps the studio resolution." }),
    toggle("signatureOutline", "Add a signature guide line", false)
  ],
  "image-metadata": [
    heading("Rebuild"),
    number("maxWidth", "Resize width", 0, 0, 16000, { suffix: "px", help: "0 keeps the original resolution." })
  ],
  "split-image": [
    heading("Tiles"),
    number("overlap", "Overlap", 0, 0, 200, { suffix: "px", help: "Useful for puzzles and overlapping print tiles." }),
    toggle("squareTiles", "Pad tiles to squares", false)
  ],
  "join-images": [
    heading("Layout"),
    select("align", "Alignment", "center", [
      { value: "center", label: "Centre" },
      { value: "start", label: "Start (left / top)" },
      { value: "end", label: "End (right / bottom)" }
    ]),
    number("maxSize", "Longest side limit", 12000, 200, 12000, { suffix: "px" }),
    toggle("addBorder", "Add an outer border", false),
    { key: "borderColor", label: "Border colour", type: "color", default: "#ffffff" },
    range("borderWidth", "Border width", 12, 0, 120, 2)
  ]
};

/** Options added to every tool, with implementations in lib/output-options.js. */
export function commonOptions(tool) {
  const isPdf = tool.category === "pdf";
  const options = [];

  const hasOwnReader = Boolean(tool.custom);
  if (isPdf && !["protect-pdf", "unlock-pdf"].includes(tool.slug)) {
    options.push({ key: "heading-pdf-props", label: "PDF properties", type: "heading", advanced: true });
    if (!hasOwnReader) {
      options.push(
        text("password", "PDF password (if protected)", "", {
          placeholder: "Leave blank for unprotected files",
          help: "Passwords stay in this tab and are never uploaded."
        })
      );
    }
    options.push(
      text("pdfTitle", "Set PDF title", "", { placeholder: "Blank = keep existing" }),
      text("pdfAuthor", "Set PDF author", "", { placeholder: "Blank = keep existing" }),
      text("pdfSubject", "Set PDF subject", "", { placeholder: "Blank = keep existing" }),
      text("pdfKeywords", "Set PDF keywords", "", { placeholder: "Comma separated" })
    );
  }

  const groupHeading = { key: "heading-output", label: "Output & download", type: "heading", advanced: true };
  options.push(groupHeading);
  if (!isPdf) {
    options.push(
      select("outputFormat", "Override output format", "keep", OUTPUT_FORMATS, "Re-encodes any image this tool produces."),
      range("outputQuality", "Re-encode quality", 0.92, 0.3, 1, 0.02),
      { key: "outputBackground", label: "Matte colour for JPG", type: "color", default: "#ffffff" },
      toggle("outputGrayscale", "Grayscale output", false),
      number("targetSize", "Max file size", 0, 0, 102400, {
        suffix: "KB",
        help: "0 = no limit. Images are re-encoded and resized until they fit."
      }),
      select("dpi", "Print DPI metadata", "0", DPI_CHOICES)
    );
  }
  options.push(
    text("outputName", "Download file name", "", { placeholder: "Automatic name", help: "Multiple files get -01, -02 …; ZIPs use this name." })
  );
  // Everything from the shared block is rendered in the collapsible
  // "Output & more" panel so the tool's own controls stay front and centre.
  return options.map((option) => ({ ...option, advanced: true }));
}

/** Defaults that were wrong in the original catalogue (tools failed on first run). */
export const patchedDefaults = {
  "crop-pdf": { top: 10, bottom: 10, left: 10, right: 10 },
  "resize-image": { width: 1200, height: 0, mode: "pixels" },
  "protect-pdf": { password: "", generatePassword: true }
};
