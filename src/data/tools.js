import { newTools } from "./tool-additions.js";

export const tools = [
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    category: "pdf",
    icon: "Combine",
    tone: "violet",
    short: "Combine multiple PDFs into one tidy document, in any order you like.",
    description:
      "Stitch contracts, scans, tickets and reports into a single PDF. Drag files to reorder them before merging — everything happens locally in your browser.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 30,
    action: "Merge PDFs",
    output: "merged.pdf",
    badge: "Popular",
    options: [],
    tips: [
      "Drag the file cards to arrange the final page order.",
      "Merged files keep their original quality and text layer.",
      "Need only a few pages? Try Extract pages instead."
    ]
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    category: "pdf",
    icon: "Scissors",
    tone: "rose",
    short: "Split by custom ranges, fixed chunks, or pull every page apart.",
    description:
      "Turn one big PDF into smaller, shareable files. Split by page ranges, every N pages, or export each page as its own document.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Split PDF",
    output: "split.zip",
    badge: "Popular",
    options: [
      {
        key: "mode",
        label: "Split mode",
        type: "select",
        default: "all",
        choices: [
          { value: "all", label: "Every page separately" },
          { value: "every", label: "Every N pages" },
          { value: "ranges", label: "Custom ranges" }
        ]
      },
      {
        key: "ranges",
        label: "Page ranges",
        type: "text",
        default: "1-3, 4-6",
        placeholder: "e.g. 1-3, 5, 8-10",
        help: "Each comma-separated range becomes its own PDF.",
        showIf: { key: "mode", equals: "ranges" }
      },
      {
        key: "every",
        label: "Pages per file",
        type: "number",
        default: 2,
        min: 1,
        max: 500,
        showIf: { key: "mode", equals: "every" }
      }
    ],
    tips: [
      "Use ranges like 1-3, 7, 10-12 — spaces are optional.",
      "Multiple output files are delivered as a single ZIP.",
      "Chapter numbers on odd pages? Choose Every page separately."
    ]
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    category: "pdf",
    icon: "FileArchive",
    tone: "orange",
    short: "Shrink heavy PDFs for email and upload without leaving the browser.",
    description:
      "Reduce file size with strong page rasterization or a lossless optimization pass. Tune quality and resolution to hit the sweet spot.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Compress PDF",
    output: "compressed.pdf",
    badge: "Popular",
    options: [
      {
        key: "mode",
        label: "Compression",
        type: "select",
        default: "strong",
        choices: [
          { value: "strong", label: "Strong — rasterize pages (smallest)" },
          { value: "lossless", label: "Lossless — keep text and vectors" }
        ],
        help: "Strong mode converts pages to images. Perfect for scans; use lossless for crisp text."
      },
      {
        key: "dpi",
        label: "Resolution",
        type: "select",
        default: "150",
        choices: [
          { value: "110", label: "110 DPI — smallest" },
          { value: "150", label: "150 DPI — balanced" },
          { value: "200", label: "200 DPI — sharper" },
          { value: "300", label: "300 DPI — print" }
        ],
        showIf: { key: "mode", equals: "strong" }
      },
      {
        key: "quality",
        label: "Image quality",
        type: "range",
        default: 0.7,
        min: 0.3,
        max: 0.95,
        step: 0.05,
        format: (v) => `${Math.round(v * 100)}%`,
        showIf: { key: "mode", equals: "strong" }
      }
    ],
    tips: [
      "Strong mode is ideal for scanned documents and image-heavy decks.",
      "Lossless mode preserves selectable text but may save less.",
      "For the smallest email attachment, try 110 DPI at 60% quality."
    ]
  },
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    category: "pdf",
    icon: "Images",
    tone: "amber",
    short: "Turn PDF pages into sharp JPG or PNG images, ready to share.",
    description:
      "Render every page of your PDF as a high-quality image. Pick the format, resolution and page range, then download one file or a ZIP.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Convert to images",
    output: "pdf-images.zip",
    options: [
      {
        key: "format",
        label: "Image format",
        type: "select",
        default: "jpg",
        choices: [
          { value: "jpg", label: "JPG — small file" },
          { value: "png", label: "PNG — lossless" }
        ]
      },
      {
        key: "scale",
        label: "Resolution",
        type: "select",
        default: "2",
        choices: [
          { value: "1", label: "1× — screen" },
          { value: "1.5", label: "1.5× — balanced" },
          { value: "2", label: "2× — sharp" },
          { value: "3", label: "3× — print" }
        ]
      },
      {
        key: "quality",
        label: "JPG quality",
        type: "range",
        default: 0.9,
        min: 0.5,
        max: 1,
        step: 0.05,
        format: (v) => `${Math.round(v * 100)}%`,
        showIf: { key: "format", equals: "jpg" }
      },
      {
        key: "pages",
        label: "Pages",
        type: "text",
        default: "",
        placeholder: "All pages",
        help: "Leave empty for all pages, or enter e.g. 1-3, 5."
      }
    ],
    tips: [
      "Pages are named pdf-page-1.jpg, pdf-page-2.jpg and so on.",
      "Use PNG when the page contains diagrams or transparency.",
      "2× resolution is usually perfect for slides and social posts."
    ]
  },
  {
    slug: "jpg-to-pdf",
    name: "JPG to PDF",
    category: "pdf",
    icon: "FileImage",
    tone: "lime",
    short: "Bundle photos and scans into one polished, correctly-sized PDF.",
    description:
      "Convert JPG, PNG, WebP and other images into a single PDF. Choose a page size, orientation, margins and how images fit.",
    accept: "image/*",
    multiple: true,
    maxFiles: 60,
    action: "Create PDF",
    output: "images.pdf",
    options: [
      {
        key: "pageSize",
        label: "Page size",
        type: "select",
        default: "fit",
        choices: [
          { value: "fit", label: "Fit to each image" },
          { value: "a4", label: "A4" },
          { value: "letter", label: "US Letter" }
        ]
      },
      {
        key: "orientation",
        label: "Orientation",
        type: "select",
        default: "auto",
        choices: [
          { value: "auto", label: "Auto" },
          { value: "portrait", label: "Portrait" },
          { value: "landscape", label: "Landscape" }
        ],
        showIf: { key: "pageSize", not: "fit" }
      },
      {
        key: "fit",
        label: "Image fit",
        type: "select",
        default: "contain",
        choices: [
          { value: "contain", label: "Contain — show everything" },
          { value: "cover", label: "Cover — fill the page" }
        ],
        showIf: { key: "pageSize", not: "fit" }
      },
      {
        key: "margin",
        label: "Margin",
        type: "range",
        default: 0,
        min: 0,
        max: 60,
        step: 2,
        format: (v) => `${v} mm`,
        showIf: { key: "pageSize", not: "fit" }
      }
    ],
    tips: [
      "Drag image cards to control the page order.",
      "Fit to each image keeps original dimensions — great for scans.",
      "For a photo book, pick A4 + cover + a 10 mm margin."
    ]
  },
  {
    slug: "rotate-pdf",
    name: "Rotate PDF",
    category: "pdf",
    icon: "RotateCw",
    tone: "teal",
    short: "Fix sideways scans and upside-down pages in a couple of clicks.",
    description:
      "Rotate all pages or a specific selection by 90°, 180° or 270°. The change is baked into a fresh PDF that works everywhere.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Rotate PDF",
    output: "rotated.pdf",
    options: [
      {
        key: "angle",
        label: "Rotation",
        type: "choice",
        default: "90",
        choices: [
          { value: "90", label: "90° right" },
          { value: "180", label: "180°" },
          { value: "270", label: "90° left" }
        ]
      },
      {
        key: "pages",
        label: "Pages",
        type: "text",
        default: "",
        placeholder: "All pages",
        help: "Leave empty for every page, or enter e.g. 1, 4-6."
      }
    ],
    tips: [
      "Use 180° for pages that were scanned upside down.",
      "Page selection supports ranges: 1-2, 5, 8-9.",
      "Rotate PDF changes page rotation without re-rendering quality."
    ]
  },
  {
    slug: "watermark-pdf",
    name: "Watermark PDF",
    category: "pdf",
    icon: "Droplets",
    tone: "sky",
    short: "Stamp text watermarks on any page with full control over style.",
    description:
      "Add CONFIDENTIAL, DRAFT, your brand or a custom message. Control size, colour, opacity, angle and position — or tile it across the page.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Add watermark",
    output: "watermarked.pdf",
    options: [
      {
        key: "text",
        label: "Watermark text",
        type: "text",
        default: "CONFIDENTIAL",
        placeholder: "Your watermark"
      },
      {
        key: "position",
        label: "Position",
        type: "select",
        default: "center",
        choices: [
          { value: "center", label: "Center" },
          { value: "top-left", label: "Top left" },
          { value: "top-center", label: "Top center" },
          { value: "top-right", label: "Top right" },
          { value: "middle-left", label: "Middle left" },
          { value: "middle-right", label: "Middle right" },
          { value: "bottom-left", label: "Bottom left" },
          { value: "bottom-center", label: "Bottom center" },
          { value: "bottom-right", label: "Bottom right" }
        ]
      },
      {
        key: "size",
        label: "Font size",
        type: "range",
        default: 54,
        min: 12,
        max: 140,
        step: 2,
        format: (v) => `${v} pt`
      },
      {
        key: "opacity",
        label: "Opacity",
        type: "range",
        default: 0.22,
        min: 0.05,
        max: 1,
        step: 0.05,
        format: (v) => `${Math.round(v * 100)}%`
      },
      {
        key: "rotation",
        label: "Angle",
        type: "range",
        default: 45,
        min: -90,
        max: 90,
        step: 5,
        format: (v) => `${v}°`
      },
      {
        key: "color",
        label: "Colour",
        type: "color",
        default: "#6c4df6"
      },
      {
        key: "tile",
        label: "Repeat across the whole page",
        type: "checkbox",
        default: false
      },
      {
        key: "pages",
        label: "Pages",
        type: "text",
        default: "",
        placeholder: "All pages"
      }
    ],
    tips: [
      "A 20–30% opacity diagonal watermark looks professional.",
      "Use a short, bold phrase so it stays legible when tiled.",
      "Watermarks are embedded into the PDF, not overlaid separately."
    ]
  },
  {
    slug: "page-numbers-pdf",
    name: "Page numbers",
    category: "pdf",
    icon: "Hash",
    tone: "indigo",
    short: "Add clean page numbers with custom formats and placement.",
    description:
      "Number every page of a PDF with formats like 1, Page 1 of 12 or 1 / 12. Choose the start number, font size, colour and margin.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Add page numbers",
    output: "numbered.pdf",
    options: [
      {
        key: "position",
        label: "Position",
        type: "select",
        default: "bottom-center",
        choices: [
          { value: "bottom-left", label: "Bottom left" },
          { value: "bottom-center", label: "Bottom center" },
          { value: "bottom-right", label: "Bottom right" },
          { value: "top-left", label: "Top left" },
          { value: "top-center", label: "Top center" },
          { value: "top-right", label: "Top right" }
        ]
      },
      {
        key: "format",
        label: "Format",
        type: "text",
        default: "{n} / {total}",
        help: "Use {n} for the page number and {total} for the page count."
      },
      {
        key: "start",
        label: "Start at",
        type: "number",
        default: 1,
        min: -999,
        max: 9999
      },
      {
        key: "size",
        label: "Font size",
        type: "range",
        default: 12,
        min: 7,
        max: 36,
        step: 1,
        format: (v) => `${v} pt`
      },
      {
        key: "margin",
        label: "Margin",
        type: "range",
        default: 24,
        min: 8,
        max: 80,
        step: 2,
        format: (v) => `${v} pt`
      },
      {
        key: "color",
        label: "Colour",
        type: "color",
        default: "#3f3d56"
      },
      {
        key: "pages",
        label: "Pages",
        type: "text",
        default: "",
        placeholder: "All pages"
      }
    ],
    tips: [
      "Use “Page {n} of {total}” for a polished report.",
      "Start at 0 or even -1 when the cover page should not count.",
      "24 pt margin keeps numbers clear of most printer edges."
    ]
  },
  {
    slug: "protect-pdf",
    name: "Protect PDF",
    category: "pdf",
    icon: "Lock",
    tone: "emerald",
    short: "Lock a PDF with real AES-256 encryption and permissions.",
    description:
      "Add a password that opens the document, plus optional restrictions on printing and copying. Encryption happens privately on your device.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Protect PDF",
    output: "protected.pdf",
    badge: "Private",
    options: [
      {
        key: "password",
        label: "Password",
        type: "text",
        default: "",
        placeholder: "Choose a strong password",
        help: "You will need this password to open the PDF. It cannot be recovered."
      },
      {
        key: "allowPrinting",
        label: "Allow printing",
        type: "checkbox",
        default: true
      },
      {
        key: "allowCopying",
        label: "Allow copying text",
        type: "checkbox",
        default: false
      }
    ],
    tips: [
      "AES-256 encryption is applied before the file leaves the browser tab.",
      "Store the password in a manager — PixPDF cannot recover it.",
      "Printing and copying restrictions are respected by common PDF readers."
    ]
  },
  {
    slug: "unlock-pdf",
    name: "Unlock PDF",
    category: "pdf",
    icon: "LockOpen",
    tone: "green",
    short: "Remove a password you own and save an unrestricted copy.",
    description:
      "Open a password-protected PDF with the password you know, then save a fresh copy without encryption. Only use this on documents you own.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Unlock PDF",
    output: "unlocked.pdf",
    options: [
      {
        key: "password",
        label: "Current password",
        type: "text",
        default: "",
        placeholder: "Password for the PDF"
      }
    ],
    tips: [
      "The password is used only in memory and is never sent anywhere.",
      "If the password is wrong, the file simply cannot be opened.",
      "You must have permission to modify the document."
    ]
  },
  {
    slug: "extract-pages",
    name: "Extract pages",
    category: "pdf",
    icon: "FileOutput",
    tone: "cyan",
    short: "Pull the pages you need into a brand-new PDF.",
    description:
      "Pick pages by number or range and export them as a clean, standalone PDF. The original document stays untouched.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Extract pages",
    output: "extracted.pdf",
    options: [
      {
        key: "pages",
        label: "Pages to extract",
        type: "text",
        default: "1",
        placeholder: "e.g. 1-3, 7, 10"
      }
    ],
    tips: [
      "Pages appear in the order you type them.",
      "Use 1-3, 7, 10 to build a custom packet.",
      "Need every page as its own file? Use Split PDF."
    ]
  },
  {
    slug: "delete-pages",
    name: "Delete pages",
    category: "pdf",
    icon: "Trash2",
    tone: "red",
    short: "Remove unwanted pages and keep the rest exactly as they were.",
    description:
      "Type the pages you want gone — like 2, 5-7 — and download a cleaned-up PDF. At least one page must remain.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Delete pages",
    output: "cleaned.pdf",
    options: [
      {
        key: "pages",
        label: "Pages to delete",
        type: "text",
        default: "1",
        placeholder: "e.g. 2, 5-7"
      }
    ],
    tips: [
      "Page numbers refer to the original document.",
      "You can remove up to all but one page.",
      "Use Organize PDF for visual, drag-and-drop editing."
    ]
  },
  {
    slug: "organize-pdf",
    name: "Organize PDF",
    category: "pdf",
    icon: "LayoutGrid",
    tone: "blue",
    short: "Visually reorder, rotate or delete pages with live thumbnails.",
    description:
      "See every page, drag them into the perfect order, rotate sideways scans and remove mistakes. Then export a fresh, organised PDF.",
    accept: ".pdf,application/pdf",
    multiple: false,
    maxFiles: 1,
    action: "Save organised PDF",
    output: "organized.pdf",
    custom: "organize",
    badge: "Advanced",
    options: [],
    tips: [
      "Drag page thumbnails, or use the arrow buttons on touch screens.",
      "Rotate individual pages without affecting the others.",
      "Deleted pages stay in your original file — nothing is overwritten."
    ]
  },
  {
    slug: "crop-pdf",
    name: "Crop PDF",
    category: "pdf",
    icon: "Crop",
    tone: "purple",
    short: "Trim margins and unwanted edges from every page.",
    description:
      "Crop white space, scanner borders or headers by setting top, right, bottom and left margins. Applied to all or selected pages.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Crop PDF",
    output: "cropped.pdf",
    options: [
      {
        key: "top",
        label: "Top margin",
        type: "range",
        default: 0,
        min: 0,
        max: 100,
        step: 1,
        format: (v) => `${v} mm`
      },
      {
        key: "bottom",
        label: "Bottom margin",
        type: "range",
        default: 0,
        min: 0,
        max: 100,
        step: 1,
        format: (v) => `${v} mm`
      },
      {
        key: "left",
        label: "Left margin",
        type: "range",
        default: 0,
        min: 0,
        max: 100,
        step: 1,
        format: (v) => `${v} mm`
      },
      {
        key: "right",
        label: "Right margin",
        type: "range",
        default: 0,
        min: 0,
        max: 100,
        step: 1,
        format: (v) => `${v} mm`
      },
      {
        key: "pages",
        label: "Pages",
        type: "text",
        default: "",
        placeholder: "All pages"
      }
    ],
    tips: [
      "Use Crop PDF to remove a scanner's black border.",
      "Margins are measured in millimetres.",
      "Cropping changes the visible page area, not the page quality."
    ]
  },
  {
    slug: "sign-pdf",
    name: "Sign PDF",
    category: "pdf",
    icon: "PenTool",
    tone: "fuchsia",
    short: "Draw your signature and place it on any page — privately.",
    description:
      "Draw with a finger, mouse or stylus, then stamp your signature onto the PDF. Choose the page, size and corner.",
    accept: ".pdf,application/pdf",
    multiple: false,
    maxFiles: 1,
    action: "Sign PDF",
    output: "signed.pdf",
    custom: "sign",
    badge: "New",
    options: [],
    tips: [
      "Sign on a touchscreen with a stylus for the smoothest lines.",
      "The signature is embedded as a transparent PNG.",
      "This is a visual signature, not a certificate-based digital signature."
    ]
  },
  {
    slug: "pdf-to-text",
    name: "PDF to Text",
    category: "pdf",
    icon: "FileText",
    tone: "slate",
    short: "Extract selectable text from a PDF into a clean .txt file.",
    description:
      "Copy-friendly text extraction powered by PDF.js. Great for notes, research and documents that need to be searched or translated.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Extract text",
    output: "extracted-text.zip",
    options: [
      {
        key: "pages",
        label: "Pages",
        type: "text",
        default: "",
        placeholder: "All pages"
      }
    ],
    tips: [
      "Scanned images need OCR first — this tool reads real text layers.",
      "Multiple PDFs are exported as a ZIP of .txt files.",
      "Page breaks are preserved in the output."
    ]
  },
  {
    slug: "compress-image",
    name: "Compress image",
    category: "image",
    icon: "ImageDown",
    tone: "emerald",
    short: "Make photos and screenshots lighter without losing the good stuff.",
    description:
      "Compress JPG, PNG and WebP images with a live quality control. Resize gigantic photos in the same pass and download the whole batch as a ZIP.",
    accept: "image/*",
    multiple: true,
    maxFiles: 60,
    action: "Compress images",
    output: "compressed-images.zip",
    badge: "Popular",
    options: [
      {
        key: "quality",
        label: "Quality",
        type: "range",
        default: 0.75,
        min: 0.1,
        max: 1,
        step: 0.05,
        format: (v) => `${Math.round(v * 100)}%`
      },
      {
        key: "maxWidth",
        label: "Max width",
        type: "number",
        default: 0,
        min: 0,
        max: 12000,
        help: "Pixels. Use 0 to keep the original width."
      },
      {
        key: "format",
        label: "Output format",
        type: "select",
        default: "keep",
        choices: [
          { value: "keep", label: "Keep original" },
          { value: "jpeg", label: "JPG" },
          { value: "webp", label: "WebP (smaller)" },
          { value: "png", label: "PNG (lossless)" }
        ]
      }
    ],
    tips: [
      "75% quality is usually invisible and dramatically smaller.",
      "WebP often beats JPG by 25–35% at the same quality.",
      "Set a max width of 1920 px for web-ready photos."
    ]
  },
  {
    slug: "resize-image",
    name: "Resize image",
    category: "image",
    icon: "Scaling",
    tone: "teal",
    short: "Resize by pixels or percentage while keeping proportions perfect.",
    description:
      "Scale images up or down for websites, marketplaces and print. Lock the aspect ratio or set exact dimensions.",
    accept: "image/*",
    multiple: true,
    maxFiles: 60,
    action: "Resize images",
    output: "resized-images.zip",
    options: [
      {
        key: "mode",
        label: "Resize by",
        type: "choice",
        default: "pixels",
        choices: [
          { value: "pixels", label: "Pixels" },
          { value: "percent", label: "Percentage" }
        ]
      },
      {
        key: "width",
        label: "Width",
        type: "number",
        default: 0,
        min: 0,
        max: 16000,
        placeholder: "Auto",
        showIf: { key: "mode", equals: "pixels" }
      },
      {
        key: "height",
        label: "Height",
        type: "number",
        default: 0,
        min: 0,
        max: 16000,
        placeholder: "Auto",
        showIf: { key: "mode", equals: "pixels" }
      },
      {
        key: "percent",
        label: "Scale",
        type: "range",
        default: 100,
        min: 5,
        max: 400,
        step: 5,
        format: (v) => `${v}%`,
        showIf: { key: "mode", equals: "percent" }
      },
      {
        key: "lock",
        label: "Keep aspect ratio",
        type: "checkbox",
        default: true
      }
    ],
    tips: [
      "Leave width or height as 0 to calculate it automatically.",
      "Upscaling cannot invent detail — start with a larger original when possible.",
      "Batch resize exports a handy ZIP archive."
    ]
  },
  {
    slug: "convert-image",
    name: "Convert image",
    category: "image",
    icon: "RefreshCw",
    tone: "sky",
    short: "Switch between JPG, PNG and WebP with quality control.",
    description:
      "Convert images to the format your site, store or printer needs. Transparent PNGs get a clean background when exported as JPG.",
    accept: "image/*",
    multiple: true,
    maxFiles: 60,
    action: "Convert images",
    output: "converted-images.zip",
    options: [
      {
        key: "format",
        label: "Convert to",
        type: "choice",
        default: "jpg",
        choices: [
          { value: "jpg", label: "JPG" },
          { value: "png", label: "PNG" },
          { value: "webp", label: "WebP" }
        ]
      },
      {
        key: "quality",
        label: "Quality",
        type: "range",
        default: 0.9,
        min: 0.3,
        max: 1,
        step: 0.05,
        format: (v) => `${Math.round(v * 100)}%`,
        showIf: { key: "format", not: "png" }
      },
      {
        key: "background",
        label: "Background for JPG",
        type: "color",
        default: "#ffffff",
        showIf: { key: "format", equals: "jpg" }
      }
    ],
    tips: [
      "PNG is best for logos, screenshots and transparency.",
      "JPG is best for photographs and small file sizes.",
      "WebP is supported by every modern browser."
    ]
  },
  {
    slug: "crop-image",
    name: "Crop image",
    category: "image",
    icon: "Crop",
    tone: "purple",
    short: "Crop with a draggable frame and handy aspect-ratio presets.",
    description:
      "Drag the crop frame, pull the handles, and lock to square, 4:3, 16:9 or a custom ratio. Export a pixel-perfect crop.",
    accept: "image/*",
    multiple: false,
    maxFiles: 1,
    action: "Crop image",
    output: "cropped.png",
    custom: "crop",
    options: [],
    tips: [
      "Tap a preset like 1:1 for avatars and product shots.",
      "The crop frame can be dragged from its centre.",
      "Originals are never modified — you download a new file."
    ]
  },
  {
    slug: "rotate-image",
    name: "Rotate & flip",
    category: "image",
    icon: "RotateCw",
    tone: "orange",
    short: "Rotate by quarter turns and mirror images horizontally or vertically.",
    description:
      "Fix sideways phone photos, flip a mirror selfie or create a mirrored version. Batch-process as many images as you like.",
    accept: "image/*",
    multiple: true,
    maxFiles: 60,
    action: "Rotate images",
    output: "rotated-images.zip",
    options: [
      {
        key: "angle",
        label: "Rotation",
        type: "choice",
        default: "90",
        choices: [
          { value: "90", label: "90° clockwise" },
          { value: "180", label: "180°" },
          { value: "270", label: "90° counter-clockwise" }
        ]
      },
      {
        key: "flipH",
        label: "Flip horizontally",
        type: "checkbox",
        default: false
      },
      {
        key: "flipV",
        label: "Flip vertically",
        type: "checkbox",
        default: false
      }
    ],
    tips: [
      "Combining rotation and flips is a quick way to fix scanned photos.",
      "PNGs stay PNG and JPGs stay JPG.",
      "Exports are lossless for the chosen format."
    ]
  },
  {
    slug: "watermark-image",
    name: "Watermark image",
    category: "image",
    icon: "Stamp",
    tone: "rose",
    short: "Protect photos with a text watermark in the perfect spot.",
    description:
      "Add your name, handle or copyright notice to images. Control the position, opacity, size and colour — or tile it everywhere.",
    accept: "image/*",
    multiple: true,
    maxFiles: 60,
    action: "Watermark images",
    output: "watermarked-images.zip",
    options: [
      {
        key: "text",
        label: "Watermark text",
        type: "text",
        default: "© Your Name",
        placeholder: "© Your Name"
      },
      {
        key: "position",
        label: "Position",
        type: "select",
        default: "bottom-right",
        choices: [
          { value: "center", label: "Center" },
          { value: "top-left", label: "Top left" },
          { value: "top-right", label: "Top right" },
          { value: "bottom-left", label: "Bottom left" },
          { value: "bottom-right", label: "Bottom right" },
          { value: "tile", label: "Tile across image" }
        ]
      },
      {
        key: "size",
        label: "Text size",
        type: "range",
        default: 5,
        min: 2,
        max: 20,
        step: 0.5,
        format: (v) => `${v}% of width`
      },
      {
        key: "opacity",
        label: "Opacity",
        type: "range",
        default: 0.5,
        min: 0.05,
        max: 1,
        step: 0.05,
        format: (v) => `${Math.round(v * 100)}%`
      },
      {
        key: "color",
        label: "Colour",
        type: "color",
        default: "#ffffff"
      },
      {
        key: "shadow",
        label: "Add a soft shadow for readability",
        type: "checkbox",
        default: true
      }
    ],
    tips: [
      "A 40–60% white watermark stays subtle on most photos.",
      "Use the tiled option for stock photos and proofs.",
      "Batch exports keep each image's original dimensions."
    ]
  },
  {
    slug: "remove-background",
    name: "Remove background",
    category: "image",
    icon: "Eraser",
    tone: "lime",
    short: "Erase solid backgrounds — white, green screen or any colour.",
    description:
      "Pick the background colour or sample it from the image, then remove it with a transparent PNG result. Adjustment sliders handle tough edges.",
    accept: "image/*",
    multiple: true,
    maxFiles: 20,
    action: "Remove background",
    output: "transparent-images.zip",
    options: [
      {
        key: "color",
        label: "Background colour",
        type: "color",
        default: "#ffffff"
      },
      {
        key: "tolerance",
        label: "Tolerance",
        type: "range",
        default: 18,
        min: 0,
        max: 100,
        step: 1,
        format: (v) => `${v}`
      },
      {
        key: "feather",
        label: "Edge softness",
        type: "range",
        default: 2,
        min: 0,
        max: 15,
        step: 1,
        format: (v) => `${v} px`
      }
    ],
    tips: [
      "For product photos on white, tolerance between 10 and 25 works well.",
      "Higher tolerance removes more, but may eat into the subject.",
      "Use edge softness to smooth jagged borders.",
      "This is a colour-key tool, not AI object detection."
    ]
  },
  {
    slug: "photo-editor",
    name: "Photo editor",
    category: "image",
    icon: "SlidersHorizontal",
    tone: "amber",
    short: "Brightness, contrast, saturation, warmth and more — live.",
    description:
      "A fast, distraction-free editor with real-time previews. Tune light and colour, rotate or flip, then export a high-quality image.",
    accept: "image/*",
    multiple: false,
    maxFiles: 1,
    action: "Export image",
    output: "edited.png",
    custom: "editor",
    options: [],
    badge: "New",
    tips: [
      "Every slider updates the preview instantly.",
      "Reset at any time to return to the original look.",
      "Export as PNG for lossless, JPG for smaller files."
    ]
  },
  {
    slug: "favicon-generator",
    name: "Favicon generator",
    category: "image",
    icon: "Globe",
    tone: "blue",
    short: "Generate every favicon size plus a manifest in one ZIP.",
    description:
      "Upload a square logo and receive favicon.ico, Apple touch icons, Android icons, a web manifest and ready-to-paste HTML.",
    accept: "image/*",
    multiple: false,
    maxFiles: 1,
    action: "Generate favicons",
    output: "favicon-kit.zip",
    options: [],
    tips: [
      "A simple, high-contrast square logo reads best at 16 px.",
      "The ZIP includes a README with copy-paste install steps.",
      "All icons are generated locally at full quality."
    ]
  },
  {
    slug: "image-to-pdf",
    name: "Image to PDF",
    category: "image",
    icon: "FileImage",
    tone: "violet",
    short: "Turn one or many images into a neat, print-ready PDF.",
    description:
      "The image-focused twin of JPG to PDF. Order your photos, pick a page size and margins, and download a single document.",
    accept: "image/*",
    multiple: true,
    maxFiles: 60,
    action: "Create PDF",
    output: "images.pdf",
    options: [
      {
        key: "pageSize",
        label: "Page size",
        type: "select",
        default: "fit",
        choices: [
          { value: "fit", label: "Fit to each image" },
          { value: "a4", label: "A4" },
          { value: "letter", label: "US Letter" }
        ]
      },
      {
        key: "orientation",
        label: "Orientation",
        type: "select",
        default: "auto",
        choices: [
          { value: "auto", label: "Auto" },
          { value: "portrait", label: "Portrait" },
          { value: "landscape", label: "Landscape" }
        ],
        showIf: { key: "pageSize", not: "fit" }
      },
      {
        key: "fit",
        label: "Image fit",
        type: "select",
        default: "contain",
        choices: [
          { value: "contain", label: "Contain — show everything" },
          { value: "cover", label: "Cover — fill the page" }
        ],
        showIf: { key: "pageSize", not: "fit" }
      },
      {
        key: "margin",
        label: "Margin",
        type: "range",
        default: 0,
        min: 0,
        max: 60,
        step: 2,
        format: (v) => `${v} mm`,
        showIf: { key: "pageSize", not: "fit" }
      }
    ],
    tips: [
      "Reorder images before creating the PDF.",
      "A4 + contain + 10 mm margin is a safe default for printing.",
      "Photos are embedded at their original resolution."
    ]
  },
  ...newTools
];

export const categories = [
  {
    id: "pdf",
    name: "PDF tools",
    tagline: "Merge, shrink, sign and reshape documents.",
    icon: "FileText",
    tone: "violet"
  },
  {
    id: "image",
    name: "Image tools",
    tagline: "Compress, convert, crop and perfect every pixel.",
    icon: "ImagePlus",
    tone: "rose"
  }
];

export const getTool = (slug) => tools.find((tool) => tool.slug === slug);

export const toolsByCategory = (category) => tools.filter((tool) => tool.category === category);

export const POPULAR_SLUGS = [
  "edit-pdf",
  "compress-to-size",
  "annotate-image",
  "merge-pdf",
  "compress-pdf",
  "split-pdf",
  "pdf-to-jpg",
  "jpg-to-pdf",
  "compress-image",
  "remove-background",
  "sign-pdf"
];

export function searchTools(query) {
  const q = query.trim().toLowerCase();
  if (!q) return tools;
  return tools.filter((tool) =>
    `${tool.name} ${tool.short} ${tool.category} ${tool.description}`.toLowerCase().includes(q)
  );
}

export const toolCount = tools.length;
