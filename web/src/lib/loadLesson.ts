import fixture from "@/fixtures/sample-lesson.json";
import type { LessonBundle, LessonMeta } from "@engine/core/schemas.ts";

/** Bundled sample so the viewer renders instantly in dev (`npm run dev`) with no server. */
export const fallbackLesson = fixture as unknown as LessonBundle;

/** Fetch a lesson from `gandalf serve`; fall back to the bundled sample when offline. */
export async function fetchLesson(id?: string): Promise<LessonBundle> {
  try {
    const res = await fetch(`/api/lesson${id ? `/${id}` : ""}`);
    if (res.ok) return (await res.json()) as LessonBundle;
  } catch {
    /* no server (dev) — use the fallback */
  }
  return fallbackLesson;
}

/** Fetch the persisted lesson library (newest first). Empty when offline. */
export async function fetchLessonList(): Promise<LessonMeta[]> {
  try {
    const res = await fetch("/api/lessons");
    if (res.ok) return (await res.json()) as LessonMeta[];
  } catch {
    /* no server */
  }
  return [];
}
