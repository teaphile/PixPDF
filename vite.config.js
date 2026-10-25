import { defineConfig } from "vite";

// The preview runs behind a proxy (Arena, Cloudflare tunnels, localhost).
// Both the dev server and the preview server must accept those hostnames or
// the browser gets Vite's "Blocked request. This host is not allowed" page.
const allowedHosts = [
  ".e2b.app",
  ".trycloudflare.com",
  ".vercel.app",
  "localhost",
  "127.0.0.1"
];

export default defineConfig({
  build: {
    manifest: "manifest.json"
  },
  server: {
    host: "0.0.0.0",
    allowedHosts
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts
  }
});
