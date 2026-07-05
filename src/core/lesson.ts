import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { LessonBundle, LessonMeta } from "./schemas.ts";
import { gandalfHome, type GandalfConfig } from "./config.ts";
import { rootCommit } from "./git.ts";

/** Default location for the persisted, accumulating lesson library (inside the analyzed repo). */
export function defaultLessonsDir(repoCwd: string): string {
  return join(repoCwd, ".gandalf", "lessons");
}

/** Path-safe slug — same character policy as pipeline.ts makeId. */
function safeSegment(s: string): string {
  return s.replace(/[^A-Za-z0-9_.-]/g, "_");
}

/** `<project-name>-<root-commit-sha12>` — the home-dir store key for a repo. */
export function storeKey(repoRootDir: string, rootSha: string): string {
  return `${safeSegment(basename(repoRootDir))}-${rootSha.slice(0, 12)}`;
}

export interface ResolvedStore {
  /** Where lesson bundles live (`…/lessons`). */
  lessonsDir: string;
  /** The store directory (parent of lessons/) — watch state lives here. */
  storeDir: string;
  /** How the location was decided, for doctor/debug output. */
  source: "out-dir" | "home-dir" | "project-wd" | "project-wd (empty repo fallback)";
}

/**
 * Decide where a repo's lessons live. Precedence:
 *   1. an explicit --out-dir flag (also hosts watch state directly),
 *   2. config `lesson_location: "project-wd"` -> <repo>/.gandalf/lessons,
 *   3. config/default "home-dir" -> ~/.gandalf/<name>-<rootsha12>/lessons.
 * A repo with no commits yet has no root-commit identity — fall back to
 * project-wd so behavior stays deterministic (callers may warn via `source`).
 */
export async function resolveLessonsDir(
  repoRootDir: string,
  config: GandalfConfig,
  outDirFlag?: string,
): Promise<ResolvedStore> {
  if (outDirFlag) {
    const dir = resolve(outDirFlag);
    return { lessonsDir: dir, storeDir: dir, source: "out-dir" };
  }
  if (config.lesson_location === "project-wd") {
    return {
      lessonsDir: defaultLessonsDir(repoRootDir),
      storeDir: join(repoRootDir, ".gandalf"),
      source: "project-wd",
    };
  }
  const rootSha = await rootCommit(repoRootDir);
  if (!rootSha) {
    return {
      lessonsDir: defaultLessonsDir(repoRootDir),
      storeDir: join(repoRootDir, ".gandalf"),
      source: "project-wd (empty repo fallback)",
    };
  }
  const storeDir = join(gandalfHome(), storeKey(repoRootDir, rootSha));
  return { lessonsDir: join(storeDir, "lessons"), storeDir, source: "home-dir" };
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
