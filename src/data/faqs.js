import { toolCount } from "./tools.js";

export const generalFaqs = [
  {
    q: "Are my files really private?",
    a: "Yes. Every tool opens and edits your file using JavaScript inside this browser tab. There is no upload endpoint, no cloud storage and no account. You can even disconnect from the internet after the page loads and keep working."
  },
  {
    q: "Is PixPDF free?",
    a: `All ${toolCount} tools are free with no daily limits, no watermarks and no sign-up. There are no premium tiers or hidden restrictions.`
  },
  {
    q: "Do you keep copies of my files?",
    a: "No. PixPDF has no server-side file storage. When you close or refresh the tab, the in-memory copies are released by the browser."
  },
  {
    q: "How large can my files be?",
    a: "There is no artificial file-size limit. The practical limit is your device's available memory. For very large PDFs or 50 MP photos on a phone, try one file at a time or lower the resolution."
  },
  {
    q: "Does it work on phones and tablets?",
    a: "Yes. PixPDF is responsive and touch-friendly. The signature pad, image cropper and page organiser all support touch gestures."
  },
  {
    q: "Can I use PixPDF offline?",
    a: "After your first visit, the app is cached by a service worker. Most tools continue to work without a connection, and your files never need the network anyway."
  },
  {
    q: "Is there a file-format catch?",
    a: "PDFs must be valid PDF files. Password-protected files need the password (or the Unlock tool). Images can be JPG, PNG, WebP, GIF, BMP or SVG; HEIC/HEIF support depends on your browser's decoder."
  },
  {
    q: "How does the compressor work?",
    a: "Strong compression renders each PDF page at your chosen resolution and rebuilds a compact document from JPEG pages. It is excellent for scans and image-heavy files. Lossless mode keeps text and vector graphics but usually saves less."
  },
  {
    q: "Why can't I recover a protected PDF's password?",
    a: "The password is used locally to encrypt the file and is never stored. If you lose it, no one — including us — can recover it. Keep a copy in a password manager."
  },
  {
    q: "Is the signature legally binding?",
    a: "PixPDF creates a visual signature image embedded in the PDF. It is not a certificate-based digital signature. For contracts that require verified identity or tamper evidence, use a qualified e-signature provider."
  }
];
