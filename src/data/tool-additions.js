export const newTools = [
  {
    slug: "edit-pdf",
    name: "Edit PDF",
    category: "pdf",
    icon: "PenTool",
    tone: "violet",
    short: "Add text, images, shapes, signatures and freehand marks to any page.",
    description:
      "A visual PDF canvas: place text, pictures, boxes, ellipses, lines and freehand notes on any page. Move, resize, restyle and undo without flattening the rest of the document.",
    accept: ".pdf,application/pdf",
    multiple: false,
    maxFiles: 1,
    action: "Save edited PDF",
    output: "edited.pdf",
    custom: "pdf-editor",
    badge: "Advanced",
    options: [],
    tips: [
      "Use Select to move, resize or rotate any object.",
      "Text uses standard PDF fonts; Latin text is the safest choice.",
      "Annotations are written as a new layer — existing text stays intact."
    ]
  },
  {
    slug: "fill-pdf-forms",
    name: "Fill PDF forms",
    category: "pdf",
    icon: "Keyboard",
    tone: "cyan",
    short: "Fill interactive PDF fields, then download or flatten the form.",
    description:
      "Detect text fields, checkboxes, radios, dropdowns and lists in an AcroForm PDF. Fill them in a clean form view and either keep them editable or flatten the result.",
    accept: ".pdf,application/pdf",
    multiple: false,
    maxFiles: 1,
    action: "Save filled form",
    output: "filled-form.pdf",
    custom: "pdf-forms",
    options: [],
    tips: [
      "Works with standard AcroForm PDFs, not scanned paper forms.",
      "Flattening makes the answers permanent and prevents later edits.",
      "If a form has no fields, use Edit PDF to place text instead."
    ]
  },
  {
    slug: "redact-pdf",
    name: "Redact PDF",
    category: "pdf",
    icon: "ScanText",
    tone: "red",
    short: "Permanently black out sensitive text or areas, including hidden text.",
    description:
      "Search for words or draw boxes over private information. PixPDF rasterizes the marked pages so the underlying text and metadata are removed, not merely covered.",
    accept: ".pdf,application/pdf",
    multiple: false,
    maxFiles: 1,
    action: "Apply redactions",
    output: "redacted.pdf",
    custom: "pdf-redact",
    badge: "Privacy",
    options: [],
    tips: [
      "Redaction is destructive by design: review every mark before saving.",
      "Search is case-insensitive and matches text on the current page.",
      "Rasterized pages lose selectable text and links — that is the privacy trade-off."
    ]
  },
  {
    slug: "compare-pdf",
    outputs: "html",
    name: "Compare PDF",
    category: "pdf",
    icon: "Files",
    tone: "blue",
    short: "See page-by-page text changes and spot differences fast.",
    description:
      "Load two versions of a PDF, review them side by side and get word-level additions and removals with a change summary for every page.",
    accept: ".pdf,application/pdf",
    multiple: false,
    maxFiles: 2,
    action: "Compare PDFs",
    output: "comparison-report.html",
    custom: "pdf-compare",
    options: [],
    tips: [
      "Best results need selectable text; scanned pages compare as images only.",
      "Green marks additions and red marks removals.",
      "Use page navigation to jump to changed pages."
    ]
  },
  {
    slug: "pdf-to-markdown",
    outputs: "markdown",
    name: "PDF to Markdown",
    category: "pdf",
    icon: "FileOutput",
    tone: "green",
    short: "Turn PDF text into clean Markdown with headings, lists and page breaks.",
    description:
      "Extract the text layer and rebuild it as portable Markdown. Headings, bullet lists and numbered lists are detected from layout cues, with optional page separators.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Convert to Markdown",
    output: "markdown.zip",
    options: [
      {
        key: "pages",
        label: "Pages",
        type: "text",
        default: "",
        placeholder: "Leave blank for all pages, or e.g. 1-3, 7"
      },
      {
        key: "headings",
        label: "Detect headings from font size",
        type: "checkbox",
        default: true
      },
      {
        key: "pageBreaks",
        label: "Add horizontal page separators",
        type: "checkbox",
        default: true
      }
    ],
    tips: [
      "Works on PDFs that contain a text layer; use OCR first for scans.",
      "Tables are flattened to readable text rather than complex Markdown tables.",
      "Markdown is ideal for notes, documentation and LLM workflows."
    ]
  },
  {
    slug: "repair-pdf",
    name: "Repair PDF",
    category: "pdf",
    icon: "RefreshCw",
    tone: "orange",
    short: "Rebuild a damaged PDF page tree and recover readable content.",
    description:
      "Attempt a lenient re-parse of a damaged PDF, rebuild its pages into a fresh document and write a clean file. Forms, links and some advanced structures may not survive.",
    accept: ".pdf,application/pdf",
    multiple: true,
    maxFiles: 10,
    action: "Repair PDF",
    output: "repaired.pdf",
    badge: "Beta",
    options: [
      {
        key: "keepMetadata",
        label: "Keep title and author metadata",
        type: "checkbox",
        default: true
      }
    ],
    tips: [
      "This is a best-effort repair, not forensic recovery.",
      "Save a copy of the original before replacing anything.",
      "If a file cannot be parsed at all, it cannot be repaired locally."
    ]
  },
  {
    slug: "compress-to-size",
    name: "Compress to size",
    category: "image",
    icon: "Gauge",
    tone: "lime",
    short: "Hit an exact KB or MB target with automatic quality and size search.",
    description:
      "Choose the maximum file size you need — 20 KB, 100 KB, 500 KB, 1 MB or any custom target — and PixPDF searches quality and dimensions to get as close as possible.",
    accept: "image/*",
    multiple: true,
    maxFiles: 20,
    action: "Compress to target",
    output: "compressed-to-size.zip",
    badge: "Popular",
    options: [
      {
        key: "target",
        label: "Target size",
        type: "number",
        default: 100,
        min: 1,
        max: 10000,
        placeholder: "100"
      },
      {
        key: "unit",
        label: "Unit",
        type: "select",
        default: "KB",
        choices: [
          { value: "KB", label: "KB" },
          { value: "MB", label: "MB" }
        ]
      },
      {
        key: "maxWidth",
        label: "Maximum width (optional)",
        type: "number",
        default: "",
        min: 0,
        max: 20000,
        placeholder: "Keep original",
        help: "Set 0 or leave blank to keep the original dimensions."
      },
      {
        key: "allowResize",
        label: "Allow automatic downscaling to reach the target",
        type: "checkbox",
        default: true
      },
      {
        key: "format",
        label: "Output format",
        type: "select",
        default: "jpg",
        choices: [
          { value: "jpg", label: "JPG — best for target sizes" },
          { value: "webp", label: "WebP — smaller" },
          { value: "png", label: "PNG — lossless" }
        ]
      },
      {
        key: "background",
        label: "Background for transparent images",
        type: "color",
        default: "#ffffff",
        showIf: { key: "format", equals: "jpg" }
      }
    ],
    tips: [
      "Small targets are easier to hit by reducing dimensions first.",
      "The result never exceeds the target when mathematically possible.",
      "JPG and WebP support quality search; PNG is re-encoded losslessly."
    ]
  },
  {
    slug: "passport-photo",
    name: "Passport photo",
    category: "image",
    icon: "Scaling",
    tone: "purple",
    short: "Make ID photos in official sizes with a printable sheet.",
    description:
      "Crop a portrait to passport, visa or ID dimensions at 300 DPI, choose a white or custom background, and download a single photo or an A4 print sheet.",
    accept: "image/*",
    multiple: false,
    maxFiles: 1,
    action: "Create passport photo",
    output: "passport-photo.png",
    custom: "passport",
    badge: "New",
    options: [],
    tips: [
      "Use a straight-on portrait with space around the head.",
      "35 × 45 mm at 300 DPI is a common passport size.",
      "Print sheets include crop guides so you can cut precisely."
    ]
  },
  {
    slug: "signature-maker",
    name: "Signature maker",
    category: "image",
    icon: "PenTool",
    tone: "rose",
    short: "Draw or type a clean signature with a transparent background.",
    description:
      "Create a reusable signature for documents: draw with a finger, mouse or stylus, or type your name in a handwriting style. Export transparent PNG or JPG.",
    accept: "image/*",
    multiple: false,
    maxFiles: 1,
    action: "Download signature",
    output: "signature.png",
    custom: "signature",
    badge: "New",
    options: [],
    tips: [
      "Transparent PNG works best inside PDFs and documents.",
      "Use a thicker pen for scans and a thinner pen for elegant forms.",
      "Use Caveat for a relaxed look and Dancing Script for elegant forms."
    ]
  },
  {
    slug: "image-metadata",
    name: "Metadata & DPI",
    category: "image",
    icon: "Info",
    tone: "blue",
    short: "View EXIF/GPS data, strip privacy metadata or change DPI.",
    description:
      "Inspect camera, date, GPS and colour information; remove all hidden metadata in one click; or rewrite the DPI and physical print size of JPG, PNG and WebP images.",
    accept: "image/*",
    multiple: false,
    maxFiles: 1,
    action: "Save image",
    output: "metadata-cleaned.png",
    custom: "metadata",
    options: [],
    tips: [
      "GPS coordinates can reveal where a photo was taken.",
      "Removing metadata is a good default before sharing online.",
      "DPI affects print size, not the pixel dimensions of the image."
    ]
  },
  {
    slug: "split-image",
    name: "Split image",
    category: "image",
    icon: "LayoutGrid",
    tone: "cyan",
    short: "Cut an image into a grid for Instagram, puzzles or print.",
    description:
      "Split any image into equal rows and columns. Use the 3 × 3 preset for an Instagram grid, preview every tile and download the complete pack as a ZIP.",
    accept: "image/*",
    multiple: false,
    maxFiles: 1,
    action: "Split image",
    output: "split-images.zip",
    custom: "split-image",
    options: [],
    tips: [
      "3 × 3 is the classic Instagram profile grid.",
      "Switch between JPG and PNG output.",
      "The image is cropped to an exact grid before splitting."
    ]
  },
  {
    slug: "join-images",
    name: "Join images",
    category: "image",
    icon: "Combine",
    tone: "violet",
    short: "Stitch photos together horizontally or vertically with clean spacing.",
    description:
      "Combine screenshots, receipts, photos or before/after shots into one image. Choose direction, spacing, background colour and output format.",
    accept: "image/*",
    multiple: true,
    maxFiles: 20,
    action: "Join images",
    output: "joined-image.jpg",
    custom: "join-images",
    options: [],
    tips: [
      "Drag the file cards to set the exact order.",
      "Vertical works well for chats and long screenshots.",
      "Use a small gap or border to separate the images."
    ]
  },
  {
    slug: "social-resize",
    name: "Social resize",
    category: "image",
    icon: "MonitorSmartphone",
    tone: "rose",
    short: "Resize and pad images for Instagram, YouTube, LinkedIn and more.",
    description:
      "Turn any photo into the right dimensions for social platforms. Crop to fill or fit the whole image on a custom background, then export in one click.",
    accept: "image/*",
    multiple: true,
    maxFiles: 20,
    action: "Resize for social",
    output: "social-images.zip",
    options: [
      {
        key: "preset",
        label: "Preset",
        type: "select",
        default: "instagram-post",
        choices: [
          { value: "instagram-post", label: "Instagram post — 1080 × 1080" },
          { value: "instagram-portrait", label: "Instagram portrait — 1080 × 1350" },
          { value: "story", label: "Story / Reel — 1080 × 1920" },
          { value: "youtube-thumb", label: "YouTube thumbnail — 1280 × 720" },
          { value: "youtube-banner", label: "YouTube banner — 2560 × 1440" },
          { value: "x-post", label: "X / Twitter post — 1600 × 900" },
          { value: "linkedin", label: "LinkedIn post — 1200 × 627" },
          { value: "facebook", label: "Facebook post — 1200 × 630" },
          { value: "whatsapp", label: "WhatsApp DP — 500 × 500" },
          { value: "a4-print", label: "A4 print — 2480 × 3508" },
          { value: "custom", label: "Custom size" }
        ]
      },
      {
        key: "customWidth",
        label: "Width",
        type: "number",
        default: 1080,
        min: 16,
        max: 12000,
        showIf: { key: "preset", equals: "custom" }
      },
      {
        key: "customHeight",
        label: "Height",
        type: "number",
        default: 1080,
        min: 16,
        max: 12000,
        showIf: { key: "preset", equals: "custom" }
      },
      {
        key: "fit",
        label: "Fit",
        type: "select",
        default: "cover",
        choices: [
          { value: "cover", label: "Cover — fill the frame and crop" },
          { value: "contain", label: "Contain — show the whole image" }
        ]
      },
      {
        key: "background",
        label: "Background",
        type: "color",
        default: "#ffffff"
      },
      {
        key: "format",
        label: "Format",
        type: "select",
        default: "jpg",
        choices: [
          { value: "jpg", label: "JPG" },
          { value: "png", label: "PNG" },
          { value: "webp", label: "WebP" }
        ]
      }
    ],
    tips: [
      "Cover crops; contain adds a background instead of cutting the photo.",
      "Keep faces near the centre when cropping to a tall story size.",
      "Batch output is delivered as a ZIP."
    ]
  },
  {
    slug: "image-border",
    name: "Border & corners",
    category: "image",
    icon: "Maximize2",
    tone: "orange",
    short: "Add frames, rounded corners or a circle mask in seconds.",
    description:
      "Frame photos with solid, double, dashed or dotted borders. Round all corners or create a perfect circle with a transparent or coloured background.",
    accept: "image/*",
    multiple: true,
    maxFiles: 20,
    action: "Add border",
    output: "bordered-images.zip",
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "solid",
        choices: [
          { value: "solid", label: "Solid border" },
          { value: "double", label: "Double border" },
          { value: "dashed", label: "Dashed border" },
          { value: "dotted", label: "Dotted border" },
          { value: "rounded", label: "Rounded corners" },
          { value: "circle", label: "Circle crop" }
        ]
      },
      {
        key: "width",
        label: "Border width",
        type: "range",
        default: 24,
        min: 0,
        max: 300,
        step: 2,
        format: (v) => `${v} px`
      },
      {
        key: "radius",
        label: "Corner radius",
        type: "range",
        default: 80,
        min: 0,
        max: 500,
        step: 4,
        format: (v) => `${v} px`,
        showIf: { key: "style", equals: "rounded" }
      },
      {
        key: "color",
        label: "Border / background",
        type: "color",
        default: "#ffffff"
      },
      {
        key: "format",
        label: "Format",
        type: "select",
        default: "png",
        choices: [
          { value: "png", label: "PNG — transparent" },
          { value: "jpg", label: "JPG — white background" },
          { value: "webp", label: "WebP" }
        ]
      }
    ],
    tips: [
      "PNG keeps transparent corners and circle edges.",
      "Use a thin dark border to make white screenshots pop.",
      "Circle crop is perfect for avatars and profile photos."
    ]
  },
  {
    slug: "annotate-image",
    name: "Annotate image",
    category: "image",
    icon: "PenTool",
    tone: "lime",
    short: "Add text, arrows, shapes, stickers and freehand marks to photos.",
    description:
      "A visual markup studio for screenshots and photos. Add text boxes, rectangles, ellipses, arrows, images and freehand drawing, then export at full resolution with undo and redo.",
    accept: "image/*",
    multiple: false,
    maxFiles: 1,
    action: "Export annotated image",
    output: "annotated.png",
    custom: "image-annotate",
    badge: "New",
    options: [],
    tips: [
      "Use the select tool to move, resize and rotate objects.",
      "Arrows are ideal for tutorials and support screenshots.",
      "Export PNG for crisp text or JPG for a smaller file."
    ]
  }
];
