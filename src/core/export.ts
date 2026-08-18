import type { LessonBundle, LessonMeta } from "./schemas.ts";

// Offline single-file export via the prebuilt template (issue #3).
//
// The npm package ships dist/template/index.html: the viewer compiled once (at
// publish time) with string sentinels where vite.config.ts normally defines the
// lesson data. `gandalf build` becomes a string substitution of those sentinels
// with real JSON — same output as the from-source Vite build, but with no build
// toolchain at runtime.

/** Sentinel literals compiled into the template — must match vite.config.ts. */
const LESSON_SENTINEL = "__GANDALF_TPL_LESSON__";
const LESSONS_SENTINEL = "__GANDALF_TPL_LESSONS__";

/**
 * Same serialization the Vite build uses for its `define` values: escape
 * `</script` so a lesson blob can't prematurely close the inlined <script>.
 */
function inject(v: unknown): string {
  return JSON.stringify(v).replace(/<\/(script)/gi, "<\\/$1");
}

/**
 * Replace one sentinel string literal (whichever quote style the minifier
 * chose) with serialized JSON. The replacement is a function so `$` sequences
 * inside lesson content are never interpreted as replacement patterns.
 */
function substitute(html: string, sentinel: string, value: unknown): string {
  const literal = new RegExp(`["']${sentinel}["']`, "g");
  return html.replace(literal, () => inject(value));
}

/** Fill the compiled template with a lesson + the library list. */
export function renderTemplate(templateHtml: string, lesson: LessonBundle, lessons: LessonMeta[]): string {
  if (!templateHtml.includes(LESSON_SENTINEL)) {
    throw new Error("template is missing the lesson sentinel — rebuild it with `npm run build:template`");
  }
  const withLesson = substitute(templateHtml, LESSON_SENTINEL, lesson);
  return substitute(withLesson, LESSONS_SENTINEL, lessons);
}
