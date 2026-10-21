import { defineConfig } from "vite";

export default defineConfig({
  build: {
    manifest: "manifest.json"
  },
  preview: {
    allowedHosts: [".trycloudflare.com", "localhost", "127.0.0.1"]
  }
});
