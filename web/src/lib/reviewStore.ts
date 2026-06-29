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

/** Keys whose next review is due now (or that have never been reviewed but are passed in via `candidates`). */
export function dueKeys(now: Date = new Date()): string[] {
  const map = load();
  const t = now.getTime();
  return Object.keys(map).filter((k) => new Date(map[k]!.dueAt).getTime() <= t);
}

export function dueCount(now: Date = new Date()): number {
  return dueKeys(now).length;
}
