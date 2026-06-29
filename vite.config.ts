import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { resolve } from "node:path";

// The viewer lives in ./web; the engine (src/core) is shared by relative import.
export default defineConfig({
  root: resolve(import.meta.dirname, "web"),
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "web/src") },
  },
  css: {
    postcss: { plugins: [tailwindcss(), autoprefixer()] },
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist/web"),
    emptyOutDir: true,
  },
});
