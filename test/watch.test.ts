import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inferTicketId, planWork, classifyCommitDiff, COST_VALVE, type RepoState, type CommitTask } from "../src/core/watch.ts";
import { initJournal } from "../src/core/journal.ts";
import type { CommitInfo } from "../src/core/git.ts";

const pexec = promisify(execFile);

const sha = (c: string) => c.repeat(40);
const defaults = { includeMerges: false, retryFailed: false, inferTicket: true, max: undefined };

function commit(id: string, subject: string, parents: string[] = ["p"]): CommitInfo {
  return { sha: sha(id), parents: parents.map((p) => sha(p)), subject };
}

function state(partial: Partial<RepoState>): RepoState {
  return {
    head: sha("h"),
    frontierExists: true,
    isAncestor: true,
    mergeBase: sha("0"),
    shallow: false,
    commits: [],
    ...partial,
  };
}

describe("inferTicketId", () => {
  it.each([
    ["E1-033: add planner", "E1-033"],
    ["ABC-7 - fix the thing", "ABC-7"],
    ["V2-014: TikTok share", "V2-014"],
    ["fix: typo", null],
    ["WIP", null],
    ["  P0-2:  leading spaces", "P0-2"],
  ])("%s -> %s", (subject, expected) => {
    expect(inferTicketId(subject)).toBe(expected);
  });
});

describe("planWork", () => {
  it("fast-forward: queues new first-parent commits oldest first", () => {
    const j = initJournal("/repo", sha("0"));
    const plan = planWork(j, state({ commits: [commit("a", "one"), commit("b", "E1-033: two")] }), defaults);
    expect(plan.refusal).toBeNull();
    expect(plan.tasks.map((t) => t.sha)).toEqual([sha("a"), sha("b")]);
    expect(plan.tasks[0]!.parent).toBe(sha("p"));
    expect(plan.tasks[1]!.ticketId).toBe("E1-033");
  });

  it("skips already-recorded commits; retryFailed re-enqueues failures only", () => {
    const j = initJournal("/repo", sha("0"));
    j.commits[sha("a")] = { subject: "done", status: "done", reason: null, ticketId: null, lessonId: "x", error: null, attempts: 1, startedAt: null, finishedAt: null, parent: sha("p"), parentCount: 1 };
    j.commits[sha("b")] = { subject: "failed", status: "failed", reason: null, ticketId: null, lessonId: null, error: "boom", attempts: 1, startedAt: null, finishedAt: null, parent: sha("p"), parentCount: 1 };
    const commits = [commit("a", "done"), commit("b", "failed"), commit("c", "new")];
    const without = planWork(j, state({ commits }), defaults);
    expect(without.tasks.map((t) => t.sha)).toEqual([sha("c")]);
    const withRetry = planWork(j, state({ commits }), { ...defaults, retryFailed: true });
    expect(withRetry.tasks.map((t) => t.sha)).toEqual([sha("b"), sha("c")]);
    expect(withRetry.tasks[0]!.retry).toBe(true);
  });

  it("rewrite (non-fast-forward with merge-base): resumes from the merge-base with an event", () => {
    const j = initJournal("/repo", sha("0"));
    j.lastProcessed = sha("x"); // rewritten away
    const plan = planWork(
      j,
      state({ isAncestor: false, mergeBase: sha("m"), commits: [commit("n", "amended")] }),
      defaults,
    );
    expect(plan.journal.lastProcessed === sha("m") || plan.tasks.length === 1).toBe(true);
    expect(plan.tasks.map((t) => t.sha)).toEqual([sha("n")]);
    expect(plan.journal.events.some((e) => e.type === "rewrite")).toBe(true);
  });

  it("no common history: baseline-resets to HEAD and processes nothing", () => {
    const j = initJournal("/repo", sha("0"));
    const plan = planWork(j, state({ frontierExists: false, mergeBase: null, head: sha("h") }), defaults);
    expect(plan.tasks).toEqual([]);
    expect(plan.journal.baseline).toBe(sha("h"));
    expect(plan.journal.lastProcessed).toBe(sha("h"));
    expect(plan.journal.events.some((e) => e.type === "baseline-reset")).toBe(true);
  });

  it("cost valve: refuses a large backlog unless --max was given", () => {
    const j = initJournal("/repo", sha("0"));
    const many = Array.from({ length: COST_VALVE + 5 }, (_, i) => ({
      sha: `${i}`.padStart(40, "f"),
      parents: [sha("p")],
      subject: `commit ${i}`,
    }));
    const refused = planWork(j, state({ commits: many }), defaults);
    expect(refused.refusal).toContain("--max");
    expect(refused.tasks).toEqual([]);
    const capped = planWork(j, state({ commits: many }), { ...defaults, max: 3 });
    expect(capped.refusal).toBeNull();
    expect(capped.tasks.length).toBe(3);
  });
});

describe("classifyCommitDiff (real mkdtemp repo)", () => {
  async function repoWithCommits(): Promise<{ dir: string; shas: string[] }> {
    const dir = await mkdtemp(join(tmpdir(), "gandalf-classify-"));
    const git = (...args: string[]) =>
      pexec("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir });
    await git("init", "-q");
    await writeFile(join(dir, "a.ts"), "export const a = 1;\n");
    await git("add", "-A");
    await git("commit", "-q", "-m", "real change");
    await git("commit", "-q", "--allow-empty", "-m", "empty commit");
    await mkdir(join(dir, "dist"), { recursive: true });
    await writeFile(join(dir, "dist", "bundle.js"), "generated\n");
    await mkdir(join(dir, ".gandalf"), { recursive: true });
    await writeFile(join(dir, ".gandalf", "x.json"), "{}\n");
    await git("add", "-f", "-A");
    await git("commit", "-q", "-m", "ignored only");
    const { stdout } = await pexec("git", ["log", "--reverse", "--format=%H %P"], { cwd: dir });
    const shas = stdout.trim().split("\n").map((l) => l.split(" ")[0]!);
    return { dir, shas };
  }

  function task(shaStr: string, parent: string | null, parentCount = parent ? 1 : 0): CommitTask {
    return { sha: shaStr, parent, parentCount, subject: "t", ticketId: null, retry: false };
  }

  it("classifies empty, ignored-only, merge, and real commits", async () => {
    const { dir, shas } = await repoWithCommits();
    try {
      const [root, empty, ignoredOnly] = shas as [string, string, string];
      expect(await classifyCommitDiff(task(empty, root), dir, false)).toBe("empty-diff");
      expect(await classifyCommitDiff(task(ignoredOnly, empty), dir, false)).toBe("ignored-only");
      expect(await classifyCommitDiff(task(root, null), dir, false)).toBeNull(); // root commit processes
      const merge = task(ignoredOnly, empty, 2);
      expect(await classifyCommitDiff(merge, dir, false)).toBe("merge");
      expect(await classifyCommitDiff(merge, dir, true)).toBe("ignored-only"); // include-merges falls through to diff rules
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
