import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  CircleCheck,
  Coffee,
  CloudOff,
  Combine,
  Copy,
  Crop,
  Download,
  Droplets,
  Eraser,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileOutput,
  FilePlus2,
  FileText,
  Files,
  FlipHorizontal2,
  FlipVertical2,
  Folder,
  Gauge,
  Globe,
  GripVertical,
  Hash,
  Heart,
  ImageDown,
  ImagePlus,
  Images,
  Info,
  Keyboard,
  Layers,
  LayoutGrid,
  LoaderCircle,
  Lock,
  LockOpen,
  Maximize2,
  Menu,
  Minus,
  MonitorSmartphone,
  Moon,
  MousePointerClick,
  Palette,
  PenTool,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanText,
  Scaling,
  Scissors,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Star,
  Sun,
  Timer,
  Trash,
  Trash2,
  TriangleAlert,
  Type,
  Upload,
  WifiOff,
  X,
  Zap
} from "lucide";

const iconNodes = {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  CircleCheck,
  Coffee,
  CloudOff,
  Combine,
  Copy,
  Crop,
  Download,
  Droplets,
  Eraser,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileOutput,
  FilePlus2,
  FileText,
  Files,
  FlipHorizontal2,
  FlipVertical2,
  Folder,
  Gauge,
  Globe,
  GripVertical,
  Hash,
  Heart,
  ImageDown,
  ImagePlus,
  Images,
  Info,
  Keyboard,
  Layers,
  LayoutGrid,
  LoaderCircle,
  Lock,
  LockOpen,
  Maximize2,
  Menu,
  Minus,
  MonitorSmartphone,
  Moon,
  MousePointerClick,
  Palette,
  PenTool,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanText,
  Scaling,
  Scissors,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Star,
  Sun,
  Timer,
  Trash,
  Trash2,
  TriangleAlert,
  Type,
  Upload,
  WifiOff,
  X,
  Zap
};

const escapeAttr = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const attrsToString = (attrs) =>
  Object.entries(attrs)
    .map(([key, value]) => {
      const name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return `${name}="${escapeAttr(value)}"`;
    })
    .join(" ");

export function icon(name, options = {}) {
  const node = iconNodes[name] || iconNodes.File;
  const { size = 20, className = "", strokeWidth = 1.9, label = "" } = options;
  const children = node
    .map(([tag, attrs]) => `<${tag} ${attrsToString(attrs)} />`)
    .join("");
  const a11y = label
    ? `role="img" aria-label="${escapeAttr(label)}"`
    : 'aria-hidden="true" focusable="false"';
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${children}</svg>`;
}

export function brandMark(size = 34, withSpark = true) {
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="brandGrad${size}" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
        <stop stop-color="#7c5cff" />
        <stop offset="1" stop-color="#ff5c8a" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="14" fill="url(#brandGrad${size})" />
    <path d="M15.5 11.5h11.2l7.3 7.3v15.7a2 2 0 0 1-2 2H15.5a2 2 0 0 1-2-2v-21a2 2 0 0 1 2-2Z" fill="#fff" />
    <path d="M26.7 11.5v5.2a2 2 0 0 0 2 2h5.3" fill="none" stroke="#d9d0ff" stroke-width="2" />
    <path d="M19 26.5h10M19 31h6.6" stroke="#7c5cff" stroke-width="2.5" stroke-linecap="round" />
    ${
      withSpark
        ? `<path d="M34.5 9.2c.35 1.85 1.45 2.95 3.3 3.3-1.85.35-2.95 1.45-3.3 3.3-.35-1.85-1.45-2.95-3.3-3.3 1.85-.35 2.95-1.45 3.3-3.3Z" fill="#fff" opacity=".95" />`
        : ""
    }
  </svg>`;
}

export const toneIcons = {
  pdf: "FileText",
  image: "ImagePlus"
};
