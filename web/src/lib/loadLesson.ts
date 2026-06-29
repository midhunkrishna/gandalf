import fixture from "@/fixtures/sample-lesson.json";
import type { LessonBundle, LessonMeta } from "@engine/core/schemas.ts";

/** Bundled sample so the viewer renders instantly in dev (`npm run dev`) with no server. */
export const fallbackLesson = fixture as unknown as LessonBundle;

/** A `gandalf build` static export inlines its lesson here (vite `define`); null otherwise. */
const EMBEDDED: LessonBundle | null =
  typeof __GANDALF_LESSON__ !== "undefined" ? __GANDALF_LESSON__ : null;
const EMBEDDED_LIST: LessonMeta[] =
  typeof __GANDALF_LESSONS__ !== "undefined" ? __GANDALF_LESSONS__ : [];

/**
 * Fetch a lesson. Order of precedence:
 *  1. an inlined lesson (static `gandalf build` export — works fully offline),
 *  2. the `gandalf serve` lesson API,
 *  3. the bundled sample (dev with no server).
 */
export async function fetchLesson(id?: string): Promise<LessonBundle> {
  if (EMBEDDED && (!id || id === EMBEDDED.meta.id)) return EMBEDDED;
  try {
    const res = await fetch(`/api/lesson${id ? `/${id}` : ""}`);
    if (res.ok) return (await res.json()) as LessonBundle;
  } catch {
    /* no server (dev) — use the fallback */
  }
  return EMBEDDED ?? fallbackLesson;
}

/** Fetch the persisted lesson library (newest first). Inlined for static exports; empty when offline. */
export async function fetchLessonList(): Promise<LessonMeta[]> {
  if (EMBEDDED_LIST.length) return EMBEDDED_LIST;
  try {
    const res = await fetch("/api/lessons");
    if (res.ok) return (await res.json()) as LessonMeta[];
  } catch {
    /* no server */
  }
  return [];
}
