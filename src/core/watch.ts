import { setTimeout as sleep } from "node:timers/promises";
import type { LessonBundle } from "./schemas.ts";
import type { Logger } from "./log.ts";
import {
  commitExists,
  firstParentLog,
  isAncestor,
  isShallow,
  listChangedFiles,
  mergeBase,
  repoOperationInProgress,
  revParse,
  type CommitInfo,
} from "./git.ts";
import { classifyPath, isPermanentIgnore } from "./noise.ts";
import {
  appendEvent,
  initJournal,
  loadJournal,
  saveJournal,
  type Journal,
  type SkipReason,
} from "./journal.ts";

// Watch mode: observe a repository's commits and teach each one — orthogonal
// to whatever produced the commits. Pure core (planWork & friends, unit-
// testable without git or claude) / imperative shell (runOnce/runDaemon with
// injected WatchDeps so tests never spawn the real pipeline).

export interface CommitTask {
  sha: string;
  /** First parent — the diff base. Null for a root commit. */
  parent: string | null;
  /** Total parent count (>1 = merge commit). */
  parentCount: number;
  subject: string;
  ticketId: string | null;
  /** Set when this is a --retry-failed re-attempt (preserves the attempt count). */
  retry: boolean;
}

export interface RepoState {
  head: string;
  frontierExists: boolean;
  isAncestor: boolean;
  mergeBase: string | null;
  shallow: boolean;
  /** First-parent commits in <effective base>..head, oldest first. */
  commits: CommitInfo[];
}

export interface PlanOptions {
  includeMerges: boolean;
  retryFailed: boolean;
  max?: number;
  inferTicket: boolean;
}

export interface Plan {
  /** The journal AFTER planning decisions (rewrite/baseline events applied). Caller persists. */
  journal: Journal;
  tasks: CommitTask[];
  /** Set when planning refused (cost valve) — nothing should run. */
  refusal: string | null;
}

/** Pending-work cost valve: above this, require an explicit --max/--from. */
export const COST_VALVE = 25;

/** `"E1-033: title"` / `"ABC-7 - fix"` → the leading ticket id, else null. */
export function inferTicketId(subject: string): string | null {
  const m = /^([A-Za-z]+\d*-\d+)\s*[:\-–]/.exec(subject.trim());
  return m ? m[1]! : null;
}

/** Gather everything planWork needs in one pass (imperative side). */
export async function gatherRepoState(cwd: string, journal: Journal): Promise<RepoState> {
  const head = (await revParse("HEAD", cwd))!;
  const frontier = journal.lastProcessed;
  const frontierExists = await commitExists(frontier, cwd);
  const ancestor = frontierExists ? await isAncestor(frontier, head, cwd) : false;
  const base = ancestor ? frontier : frontierExists ? await mergeBase(frontier, head, cwd) : null;
  const commits = base ? await firstParentLog(base, head, cwd) : [];
  return {
    head,
    frontierExists,
    isAncestor: ancestor,
    mergeBase: ancestor ? frontier : base,
    shallow: await isShallow(cwd),
    commits,
  };
}

/**
 * Decide what to do — PURE. Fast-forward processes new first-parent commits in
 * order; a rewrite (amend/rebase) resumes from the merge-base skipping already-
 * recorded shas; no common history resets the baseline to HEAD (never guess).
 */
export function planWork(journal: Journal, state: RepoState, opts: PlanOptions): Plan {
  const j: Journal = structuredClone(journal);
  const tasks: CommitTask[] = [];

  if (!state.frontierExists || state.mergeBase === null) {
    if (state.head !== j.lastProcessed) {
      const why = state.shallow
        ? `frontier ${j.lastProcessed.slice(0, 12)} unreachable (shallow repository?)`
        : `frontier ${j.lastProcessed.slice(0, 12)} shares no history with HEAD ${state.head.slice(0, 12)}`;
      appendEvent(j, "baseline-reset", `${why} — baseline reset to HEAD; nothing processed`);
      j.baseline = state.head;
      j.lastProcessed = state.head;
    }
    return { journal: j, tasks, refusal: null };
  }

  if (!state.isAncestor && state.head !== j.lastProcessed) {
    appendEvent(
      j,
      "rewrite",
      `lastProcessed ${j.lastProcessed.slice(0, 12)} not an ancestor of HEAD ${state.head.slice(0, 12)}; resuming from merge-base ${state.mergeBase.slice(0, 12)}`,
    );
    j.lastProcessed = state.mergeBase;
  }

  // Retries first: failed commits live BEHIND the frontier (failed is
  // terminal), so they aren't in state.commits — rebuild their tasks from the
  // journal record. Insertion order = original commit order.
  const inRange = new Set(state.commits.map((c) => c.sha));
  if (opts.retryFailed) {
    for (const [recSha, rec] of Object.entries(j.commits)) {
      if (rec.status !== "failed" || inRange.has(recSha)) continue;
      tasks.push({
        sha: recSha,
        parent: rec.parent,
        parentCount: rec.parentCount,
        subject: rec.subject,
        ticketId: opts.inferTicket ? (rec.ticketId ?? inferTicketId(rec.subject)) : null,
        retry: true,
      });
    }
  }

  for (const c of state.commits) {
    const known = j.commits[c.sha];
    if (known && known.status !== "pending") {
      if (known.status === "failed" && opts.retryFailed) {
        tasks.push(toTask(c, opts, true));
      }
      continue; // done/skipped/failed(no retry): already handled
    }
    tasks.push(toTask(c, opts, false));
  }

  if (tasks.length > COST_VALVE && opts.max === undefined) {
    return {
      journal: j,
      tasks: [],
      refusal:
        `${tasks.length} commits pending — each costs minutes of claude usage. ` +
        `Re-run with --max <n> to chew incrementally, or move the baseline with --from <ref>.`,
    };
  }
  if (opts.max !== undefined && tasks.length > opts.max) tasks.length = opts.max;

  return { journal: j, tasks, refusal: null };
}

function toTask(c: CommitInfo, opts: PlanOptions, retry: boolean): CommitTask {
  return {
    sha: c.sha,
    parent: c.parents[0] ?? null,
    parentCount: c.parents.length,
    subject: c.subject,
    ticketId: opts.inferTicket ? inferTicketId(c.subject) : null,
    retry,
  };
}

/** Pre-checks that spend git time, not claude usage. Null = process it. */
export async function classifyCommitDiff(
  task: CommitTask,
  cwd: string,
  includeMerges: boolean,
): Promise<SkipReason | null> {
  if (task.parentCount > 1 && !includeMerges) return "merge";
  if (!task.parent) return null; // root commit: let the pipeline diff against the empty tree
  const files = await listChangedFiles(task.parent, task.sha, cwd);
  if (files.length === 0) return "empty-diff";
  const analyzable = files.filter((f) => !isPermanentIgnore(f.path) && !classifyPath(f.path).skip);
  if (analyzable.length === 0) return "ignored-only";
  return null;
}

export interface WatchDeps {
  generate: (task: CommitTask) => Promise<LessonBundle>;
  save: (bundle: LessonBundle) => Promise<string>;
  log: Logger;
}

export interface WatchRunOptions {
  cwd: string;
  storeDir: string;
  /** Baseline ref when no journal exists yet (default: HEAD — teach future commits only). */
  from?: string;
  pollMs: number;
  debounceMs: number;
  plan: PlanOptions;
}

export interface RunSummary {
  processed: number;
  failed: number;
  skipped: number;
  refused: boolean;
}

/** Load-or-init the journal, surfacing corruption loudly. */
async function openJournal(o: WatchRunOptions, log: Logger): Promise<Journal> {
  const { journal, corrupt } = await loadJournal(o.storeDir);
  if (corrupt) log.warn(`journal was corrupt — moved aside to ${corrupt}; starting fresh`);
  if (journal) return journal;
  const baselineRef = o.from ?? "HEAD";
  const baseline = await revParse(baselineRef, o.cwd);
  if (!baseline) throw new Error(`cannot resolve baseline ref "${baselineRef}"`);
  const j = initJournal(o.cwd, baseline);
  await saveJournal(o.storeDir, j);
  log.info(`journal initialized at baseline ${baseline.slice(0, 12)} (${baselineRef})`);
  return j;
}

/** One plan→execute cycle. Mutates + persists the journal; returns counts. */
async function executeCycle(
  journal: Journal,
  o: WatchRunOptions,
  deps: WatchDeps,
  isStopping: () => boolean,
): Promise<RunSummary> {
  const state = await gatherRepoState(o.cwd, journal);
  const plan = planWork(journal, state, o.plan);
  Object.assign(journal, plan.journal);
  await saveJournal(o.storeDir, journal);

  if (plan.refusal) {
    deps.log.error(plan.refusal);
    return { processed: 0, failed: 0, skipped: 0, refused: true };
  }
  if (plan.tasks.length) deps.log.info(`${plan.tasks.length} commit(s) to teach`);

  const summary: RunSummary = { processed: 0, failed: 0, skipped: 0, refused: false };
  for (const task of plan.tasks) {
    if (isStopping()) break;
    const short = task.sha.slice(0, 12);
    const record = journal.commits[task.sha] ?? {
      subject: task.subject,
      status: "pending" as const,
      reason: null,
      ticketId: task.ticketId,
      lessonId: null,
      error: null,
      attempts: 0,
      startedAt: null,
      finishedAt: null,
      parent: task.parent,
      parentCount: task.parentCount,
    };
    journal.commits[task.sha] = record;

    const skip = await classifyCommitDiff(task, o.cwd, o.plan.includeMerges);
    if (skip) {
      record.status = "skipped";
      record.reason = skip;
      record.finishedAt = new Date().toISOString();
      if (!task.retry) journal.lastProcessed = task.sha;
      await saveJournal(o.storeDir, journal);
      summary.skipped++;
      deps.log.debug(`skip ${short} (${skip}) — ${task.subject}`);
      continue;
    }

    record.status = "in-progress";
    record.attempts += 1;
    record.startedAt = new Date().toISOString();
    await saveJournal(o.storeDir, journal);
    deps.log.info(`teaching ${short}${task.ticketId ? ` [${task.ticketId}]` : ""} — ${task.subject}`);
    const startedAt = Date.now();
    try {
      const bundle = await deps.generate(task);
      const file = await deps.save(bundle);
      record.status = "done";
      record.lessonId = bundle.meta.id;
      record.error = null;
      record.finishedAt = new Date().toISOString();
      if (!task.retry) journal.lastProcessed = task.sha;
      await saveJournal(o.storeDir, journal);
      summary.processed++;
      deps.log.info(`done ${short} → ${bundle.meta.id} (${Math.round((Date.now() - startedAt) / 1000)}s) ${file}`);
    } catch (err) {
      record.status = "failed";
      record.error = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      record.finishedAt = new Date().toISOString();
      // Failed is TERMINAL: advance the frontier so one bad commit never
      // wedges the watcher; --retry-failed re-enqueues it explicitly (and a
      // retry must never regress the frontier).
      if (!task.retry) journal.lastProcessed = task.sha;
      await saveJournal(o.storeDir, journal);
      summary.failed++;
      deps.log.error(`FAILED ${short} — ${record.error} (retry with: gandalf watch --once --retry-failed)`);
    }
  }
  return summary;
}

/** `--once`: process the backlog as of start, then exit. */
export async function runOnce(o: WatchRunOptions, deps: WatchDeps): Promise<RunSummary> {
  const journal = await openJournal(o, deps.log);
  return executeCycle(journal, o, deps, () => false);
}

/** Foreground daemon: poll HEAD, debounce, cycle. Runs until `stop` aborts. */
export async function runDaemon(o: WatchRunOptions, deps: WatchDeps, stop: AbortSignal): Promise<void> {
  const journal = await openJournal(o, deps.log);
  deps.log.info(`watching ${o.cwd} (poll ${o.pollMs}ms, debounce ${o.debounceMs}ms) — Ctrl-C to stop`);

  let lastSeenHead = "";
  let lastChangeAt = 0;

  // Initial catch-up runs immediately (commits made while the watcher was down).
  let pendingWork = true;

  while (!stop.aborted) {
    const head = await revParse("HEAD", o.cwd);
    if (head && head !== lastSeenHead) {
      if (lastSeenHead) deps.log.debug(`HEAD moved ${lastSeenHead.slice(0, 12)} → ${head.slice(0, 12)}`);
      lastSeenHead = head;
      lastChangeAt = Date.now();
      if (head !== journal.lastProcessed) pendingWork = true;
    }

    const settled = Date.now() - lastChangeAt >= o.debounceMs;
    if (pendingWork && settled && !(await repoOperationInProgress(o.cwd))) {
      pendingWork = false;
      const summary = await executeCycle(journal, o, deps, () => stop.aborted);
      if (summary.refused) return; // cost valve: surface and stop rather than loop-refusing
      // A commit may have landed mid-cycle; the next poll detects it.
    }

    try {
      await sleep(o.pollMs, undefined, { signal: stop });
    } catch {
      break; // aborted during sleep
    }
  }
  deps.log.info("watch stopped");
}
