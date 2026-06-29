import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { LessonBundle, LessonMeta } from "./schemas.ts";

/** Default location for the persisted, accumulating lesson library (inside the analyzed repo). */
export function defaultLessonsDir(repoCwd: string): string {
  return join(repoCwd, ".gandalf", "lessons");
}

export async function saveLesson(bundle: LessonBundle, lessonsDir: string): Promise<string> {
  const dir = join(lessonsDir, bundle.meta.id);
  await mkdir(dir, { recursive: true });
  const file = join(dir, "lesson.json");
  await writeFile(file, JSON.stringify(bundle, null, 2), "utf8");
  return file;
}

export async function loadLesson(lessonsDir: string, id: string): Promise<LessonBundle> {
  const file = join(lessonsDir, id, "lesson.json");
  const raw = await readFile(file, "utf8");
  return LessonBundle.parse(JSON.parse(raw));
}

/** List persisted lessons (newest first) by reading each bundle's meta. */
export async function listLessons(lessonsDir: string): Promise<LessonMeta[]> {
  let entries: string[];
  try {
    entries = await readdir(lessonsDir);
  } catch {
    return [];
  }
  const metas: LessonMeta[] = [];
  for (const id of entries) {
    try {
      const raw = await readFile(join(lessonsDir, id, "lesson.json"), "utf8");
      const parsed = LessonBundle.parse(JSON.parse(raw));
      metas.push(parsed.meta);
    } catch {
      /* skip unreadable */
    }
  }
  return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
