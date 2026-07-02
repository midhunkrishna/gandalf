/**
 * Spaced-repetition schedule for retrieval questions, persisted per-user in localStorage.
 * Leitner boxes with expanding intervals — answering in the Recall tab seeds the schedule;
 * the Review overlay resurfaces due questions across the lesson library.
 */

export type Rating = "again" | "good" | "easy";

export interface Sched {
  box: number; // index into BOX_DAYS
  dueAt: string; // ISO date
  reps: number;
  lastRating: Rating;
}

const KEY = "gandalf:reviews";
const SEEN_KEY = "gandalf:seen";
const BOX_DAYS = [1, 3, 7, 16, 35, 70];

function load(): Record<string, Sched> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Sched>;
  } catch {
    return {};
  }
}

function save(map: Record<string, Sched>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

export function keyFor(lessonId: string, index: number): string {
  return `${lessonId}#${index}`;
}

export function parseKey(key: string): { lessonId: string; index: number } | null {
  const i = key.lastIndexOf("#");
  if (i < 0) return null;
  const index = Number(key.slice(i + 1));
  if (!Number.isInteger(index)) return null;
  return { lessonId: key.slice(0, i), index };
}

/** Record a self-rating and schedule the next review (expanding intervals; "again" resets). */
export function recordReview(lessonId: string, index: number, rating: Rating, now: Date = new Date()): void {
  const map = load();
  const k = keyFor(lessonId, index);
  const prevBox = map[k]?.box ?? 0;
  const box =
    rating === "again"
      ? 0
      : rating === "easy"
        ? Math.min(prevBox + 2, BOX_DAYS.length - 1)
        : Math.min(prevBox + 1, BOX_DAYS.length - 1);
  const due = new Date(now);
  due.setDate(due.getDate() + BOX_DAYS[box]!);
  map[k] = { box, dueAt: due.toISOString(), reps: (map[k]?.reps ?? 0) + 1, lastRating: rating };
  save(map);
}

export function getReview(lessonId: string, index: number): Sched | null {
  return load()[keyFor(lessonId, index)] ?? null;
}

function loadSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Register a lesson's recall questions as encountered. Seen-but-never-rated
 * questions count as due immediately, so a fresh lesson's questions enter the
 * Review queue without requiring a manual first rating in the Recall tab.
 */
export function registerQuestions(lessonId: string, count: number, now: Date = new Date()): void {
  if (count <= 0) return;
  const seen = loadSeen();
  let dirty = false;
  for (let i = 0; i < count; i++) {
    const k = keyFor(lessonId, i);
    if (!seen[k]) {
      seen[k] = now.toISOString();
      dirty = true;
    }
  }
  if (dirty) {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      /* private mode / quota — non-fatal */
    }
  }
}

/** Keys due now: scheduled reviews past their due date + seen-but-never-rated questions. */
export function dueKeys(now: Date = new Date()): string[] {
  const map = load();
  const t = now.getTime();
  const scheduled = Object.keys(map).filter((k) => new Date(map[k]!.dueAt).getTime() <= t);
  const unrated = Object.keys(loadSeen()).filter((k) => !map[k]);
  return [...scheduled, ...unrated];
}

export function dueCount(now: Date = new Date()): number {
  return dueKeys(now).length;
}
