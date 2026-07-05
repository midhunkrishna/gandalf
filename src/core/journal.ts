import { mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// The watch journal: durable record of which commits have been taught, are
// pending, failed, or were skipped — lives in the lesson STORE directory
// (sibling of lessons/), never inside the analyzed repo's history. Full SHAs
// only: short-sha length varies with repo size over time and would corrupt
// frontier comparisons.

export const CommitStatus = z.enum(["pending", "in-progress", "done", "failed", "skipped"]);
export type CommitStatus = z.infer<typeof CommitStatus>;

export const SkipReason = z.enum(["merge", "empty-diff", "ignored-only"]);
export type SkipReason = z.infer<typeof SkipReason>;

export const CommitRecord = z.object({
  subject: z.string(),
  status: CommitStatus,
  reason: SkipReason.nullable().default(null),
  ticketId: z.string().nullable().default(null),
  lessonId: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
  attempts: z.number().int().nonnegative().default(0),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  // Enough to rebuild a CommitTask for --retry-failed AFTER the frontier has
  // moved past the failure (failed is terminal; the rev-list no longer
  // contains the commit).
  parent: z.string().nullable().default(null),
  parentCount: z.number().int().nonnegative().default(1),
});
export type CommitRecord = z.infer<typeof CommitRecord>;

export const JournalEvent = z.object({
  at: z.string(),
  type: z.enum(["init", "rewrite", "baseline-reset"]),
  detail: z.string(),
});
export type JournalEvent = z.infer<typeof JournalEvent>;

export const Journal = z.object({
  version: z.literal(1),
  repoRoot: z.string(),
  /** Where watching began (or was last reset). Commits before it are never touched. */
  baseline: z.string(),
  /** The first-parent frontier: everything up to and including it has a terminal status. */
  lastProcessed: z.string(),
  commits: z.record(z.string(), CommitRecord).default({}),
  events: z.array(JournalEvent).default([]),
});
export type Journal = z.infer<typeof Journal>;

const MAX_EVENTS = 100;

export function journalPath(storeDir: string): string {
  return join(storeDir, "watch-journal.json");
}

export function initJournal(repoRoot: string, baseline: string): Journal {
  return {
    version: 1,
    repoRoot,
    baseline,
    lastProcessed: baseline,
    commits: {},
    events: [{ at: new Date().toISOString(), type: "init", detail: `baseline ${baseline}` }],
  };
}

export function appendEvent(journal: Journal, type: JournalEvent["type"], detail: string): void {
  journal.events.push({ at: new Date().toISOString(), type, detail });
  if (journal.events.length > MAX_EVENTS) journal.events.splice(0, journal.events.length - MAX_EVENTS);
}

/**
 * Load the journal. A corrupt file is renamed aside (`.corrupt-<ts>`) and null
 * is returned so the caller re-inits — but the evidence is preserved and the
 * caller must warn (never silently reprocess).
 */
export async function loadJournal(
  storeDir: string,
): Promise<{ journal: Journal | null; corrupt: string | null }> {
  const path = journalPath(storeDir);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { journal: null, corrupt: null };
  }
  try {
    const journal = Journal.parse(JSON.parse(raw));
    // Crash recovery: an in-progress commit means a previous run died mid-
    // generation — demote it so planning re-queues it (attempts preserved).
    for (const rec of Object.values(journal.commits)) {
      if (rec.status === "in-progress") rec.status = "pending";
    }
    return { journal, corrupt: null };
  } catch {
    const aside = `${path}.corrupt-${Date.now()}`;
    await rename(path, aside).catch(() => {});
    return { journal: null, corrupt: aside };
  }
}

/** Atomic save: tmp + rename so a crash mid-write can't truncate the journal. */
export async function saveJournal(storeDir: string, journal: Journal): Promise<void> {
  await mkdir(storeDir, { recursive: true });
  const path = journalPath(storeDir);
  const tmp = `${path}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(journal, null, 2) + "\n", "utf8");
  await rename(tmp, path);
}

// ---------------------------------------------------------------------------
// Single-instance lock: one watcher per store. The lockfile records the
// holder's pid; a dead pid (ESRCH) makes the lock stale and reclaimable.

export function lockPath(storeDir: string): string {
  return join(storeDir, "watch.lock");
}

export interface LockResult {
  acquired: boolean;
  holderPid: number | null;
}

export function acquireLock(storeDir: string): LockResult {
  const path = lockPath(storeDir);
  const payload = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() });
  try {
    writeFileSync(path, payload, { flag: "wx" });
    return { acquired: true, holderPid: process.pid };
  } catch {
    // Lock exists — is the holder alive?
    let holderPid: number | null = null;
    try {
      holderPid = Number(JSON.parse(readFileSync(path, "utf8")).pid) || null;
    } catch {
      holderPid = null;
    }
    if (holderPid !== null) {
      try {
        process.kill(holderPid, 0); // throws ESRCH if dead
        return { acquired: false, holderPid };
      } catch {
        /* stale — fall through to reclaim */
      }
    }
    try {
      writeFileSync(path, payload); // reclaim stale/unreadable lock
      return { acquired: true, holderPid: process.pid };
    } catch {
      return { acquired: false, holderPid };
    }
  }
}

export async function releaseLock(storeDir: string): Promise<void> {
  if (!existsSync(lockPath(storeDir))) return;
  await rm(lockPath(storeDir), { force: true }).catch(() => {});
}
