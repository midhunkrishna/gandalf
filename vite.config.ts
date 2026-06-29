import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

// `gandalf build` writes a JSON file ({ lesson, lessons }), points GANDALF_LESSON_FILE at it,
// and sets GANDALF_SINGLEFILE=1 to inline everything into one portable, offline HTML.
const lessonFile = process.env.GANDALF_LESSON_FILE;
let injected: { lesson: unknown; lessons: unknown } = { lesson: null, lessons: [] };
if (lessonFile && existsSync(lessonFile)) {
  injected = JSON.parse(readFileSync(lessonFile, "utf8"));
}
const singleFile = process.env.GANDALF_SINGLEFILE === "1";
const outDir = process.env.GANDALF_OUT_DIR
  ? resolve(process.env.GANDALF_OUT_DIR)
  : resolve(import.meta.dirname, "dist/web");

// Serialize for esbuild `define`. Escape `</script` so a lesson blob (e.g. an index.html
// containing `</script>`) can't prematurely close the inlined single-file <script>.
const inject = (v: unknown) => JSON.stringify(v).replace(/<\/(script)/gi, "<\\/$1");

// The viewer lives in ./web; the engine (src/core) is shared by relative import.
export default defineConfig({
  root: resolve(import.meta.dirname, "web"),
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "web/src"),
      "@engine": resolve(import.meta.dirname, "src"),
    },
  },
  css: {
    postcss: { plugins: [tailwindcss(), autoprefixer()] },
  },
  define: {
    __GANDALF_LESSON__: inject(injected.lesson ?? null),
    __GANDALF_LESSONS__: inject(injected.lessons ?? []),
  },
  build: {
    outDir,
    emptyOutDir: true,
  },
});
