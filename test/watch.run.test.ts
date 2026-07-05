import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runOnce, type CommitTask, type WatchRunOptions } from "../src/core/watch.ts";
import { loadJournal } from "../src/core/journal.ts";
import { silentLogger } from "../src/core/log.ts";
import type { LessonBundle } from "../src/core/schemas.ts";

const pexec = promisify(execFile);

// runOnce only touches bundle.meta.id — a stub is sufficient with injected save.
function stubBundle(id: string): LessonBundle {
  return { meta: { id } } as unknown as LessonBundle;
}

let repo: string;
let store: string;
const git = (...args: string[]) =>
  pexec("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: repo });

async function commitFile(name: string, subject: string): Promise<string> {
  await writeFile(join(repo, name), `${name} @ ${subject}\n`);
  await git("add", "-A");
  await git("commit", "-q", "-m", subject);
  const { stdout } = await pexec("git", ["rev-parse", "HEAD"], { cwd: repo });
  return stdout.trim();
}

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "gandalf-run-"));
  store = await mkdtemp(join(tmpdir(), "gandalf-run-store-"));
  await git("init", "-q");
  await commitFile("base.ts", "baseline commit");
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
  await rm(store, { recursive: true, force: true });
});

function options(overrides: Partial<WatchRunOptions["plan"]> = {}, from?: string): WatchRunOptions {
  return {
    cwd: repo,
    storeDir: store,
    from,
    pollMs: 10,
    debounceMs: 0,
    plan: { includeMerges: false, retryFailed: false, inferTicket: true, max: undefined, ...overrides },
  };
}

describe("runOnce", () => {
  it("teaches 3 commits in commit order and records them done", async () => {
    const baseline = (await pexec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim();
    const c1 = await commitFile("one.ts", "E1-101: first");
    const c2 = await commitFile("two.ts", "second");
    const c3 = await commitFile("three.ts", "E1-103: third");

    const calls: CommitTask[] = [];
    const summary = await runOnce(options({}, baseline), {
      generate: async (t) => {
        calls.push(t);
        return stubBundle(`lesson-${t.sha.slice(0, 7)}`);
      },
      save: async (b) => `/lessons/${b.meta.id}`,
      log: silentLogger,
    });

    expect(summary).toEqual({ processed: 3, failed: 0, skipped: 0, refused: false });
    expect(calls.map((t) => t.sha)).toEqual([c1, c2, c3]);
    expect(calls[0]!.ticketId).toBe("E1-101");
    expect(calls[1]!.ticketId).toBeNull();

    const { journal } = await loadJournal(store);
    expect(journal!.lastProcessed).toBe(c3);
    expect(journal!.commits[c1]!.status).toBe("done");
    expect(journal!.commits[c1]!.lessonId).toBe(`lesson-${c1.slice(0, 7)}`);
    expect(journal!.commits[c3]!.status).toBe("done");
  });

  it("a failure is terminal: later commits still process; retry-failed re-attempts", async () => {
    const baseline = (await pexec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim();
    await commitFile("one.ts", "first");
    const c2 = await commitFile("two.ts", "second (will fail)");
    const c3 = await commitFile("three.ts", "third");

    const failOn = new Set([c2]);
    const deps = {
      generate: async (t: CommitTask) => {
        if (failOn.has(t.sha)) throw new Error("synthesis exploded");
        return stubBundle(`lesson-${t.sha.slice(0, 7)}`);
      },
      save: async (b: LessonBundle) => `/lessons/${b.meta.id}`,
      log: silentLogger,
    };

    const first = await runOnce(options({}, baseline), deps);
    expect(first).toEqual({ processed: 2, failed: 1, skipped: 0, refused: false });
    let { journal } = await loadJournal(store);
    expect(journal!.commits[c2]!.status).toBe("failed");
    expect(journal!.commits[c2]!.error).toContain("synthesis exploded");
    expect(journal!.commits[c2]!.attempts).toBe(1);
    expect(journal!.commits[c3]!.status).toBe("done"); // frontier advanced past the failure
    expect(journal!.lastProcessed).toBe(c3);

    // Second pass without retry: nothing to do.
    const idle = await runOnce(options({}, baseline), deps);
    expect(idle).toEqual({ processed: 0, failed: 0, skipped: 0, refused: false });

    // Retry pass: the failed commit is re-attempted (and succeeds this time).
    failOn.clear();
    const retried = await runOnce(options({ retryFailed: true }, baseline), deps);
    expect(retried.processed).toBe(1);
    ({ journal } = await loadJournal(store));
    expect(journal!.commits[c2]!.status).toBe("done");
    expect(journal!.commits[c2]!.attempts).toBe(2);
  });

  it("without --from, a fresh journal teaches only future commits", async () => {
    await commitFile("pre.ts", "existed before watch started");
    const summary = await runOnce(options(), {
      generate: async () => stubBundle("never"),
      save: async () => "never",
      log: silentLogger,
    });
    expect(summary.processed).toBe(0); // baseline = HEAD at init

    const cNew = await commitFile("new.ts", "landed after watch init");
    const second = await runOnce(options(), {
      generate: async (t) => stubBundle(`lesson-${t.sha.slice(0, 7)}`),
      save: async () => "saved",
      log: silentLogger,
    });
    expect(second.processed).toBe(1);
    const { journal } = await loadJournal(store);
    expect(journal!.commits[cNew]!.status).toBe("done");
  });

  it("skips empty-diff commits without invoking generate", async () => {
    const baseline = (await pexec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim();
    await git("commit", "-q", "--allow-empty", "-m", "empty");
    let generateCalls = 0;
    const summary = await runOnce(options({}, baseline), {
      generate: async () => {
        generateCalls++;
        return stubBundle("x");
      },
      save: async () => "x",
      log: silentLogger,
    });
    expect(summary.skipped).toBe(1);
    expect(generateCalls).toBe(0);
  });
});
