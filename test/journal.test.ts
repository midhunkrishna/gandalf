import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initJournal,
  loadJournal,
  saveJournal,
  journalPath,
  acquireLock,
  releaseLock,
  appendEvent,
} from "../src/core/journal.ts";

let store: string;

beforeEach(async () => {
  store = await mkdtemp(join(tmpdir(), "gandalf-journal-"));
});

afterEach(async () => {
  await rm(store, { recursive: true, force: true });
});

describe("journal persistence", () => {
  it("round-trips save/load", async () => {
    const j = initJournal("/repo", "a".repeat(40));
    j.commits["b".repeat(40)] = {
      subject: "E1-033: filter tray",
      status: "done",
      reason: null,
      ticketId: "E1-033",
      lessonId: "E1-033-abc-def",
      error: null,
      attempts: 1,
      startedAt: "2026-07-04T00:00:00Z",
      finishedAt: "2026-07-04T00:04:00Z",
      parent: "c".repeat(40),
      parentCount: 1,
    };
    await saveJournal(store, j);
    const { journal, corrupt } = await loadJournal(store);
    expect(corrupt).toBeNull();
    expect(journal).toEqual(j);
  });

  it("atomic save leaves no tmp files behind", async () => {
    await saveJournal(store, initJournal("/repo", "a".repeat(40)));
    const entries = await readdir(store);
    expect(entries).toEqual(["watch-journal.json"]);
  });

  it("moves a corrupt journal aside and reports it", async () => {
    await writeFile(journalPath(store), "{ not json !!!");
    const { journal, corrupt } = await loadJournal(store);
    expect(journal).toBeNull();
    expect(corrupt).toMatch(/watch-journal\.json\.corrupt-\d+$/);
    const entries = await readdir(store);
    expect(entries.some((e) => e.startsWith("watch-journal.json.corrupt-"))).toBe(true);
    expect(entries.includes("watch-journal.json")).toBe(false);
  });

  it("demotes in-progress commits to pending on load (crash recovery)", async () => {
    const j = initJournal("/repo", "a".repeat(40));
    j.commits["b".repeat(40)] = {
      subject: "crashed mid-generation",
      status: "in-progress",
      reason: null,
      ticketId: null,
      lessonId: null,
      error: null,
      attempts: 1,
      startedAt: "2026-07-04T00:00:00Z",
      finishedAt: null,
      parent: null,
      parentCount: 1,
    };
    await saveJournal(store, j);
    const { journal } = await loadJournal(store);
    expect(journal!.commits["b".repeat(40)]!.status).toBe("pending");
    expect(journal!.commits["b".repeat(40)]!.attempts).toBe(1); // preserved
  });

  it("caps events at 100", () => {
    const j = initJournal("/repo", "a".repeat(40));
    for (let i = 0; i < 150; i++) appendEvent(j, "rewrite", `event ${i}`);
    expect(j.events.length).toBe(100);
    expect(j.events.at(-1)!.detail).toBe("event 149");
  });
});

describe("watch lock", () => {
  it("grants, blocks a second holder, and releases", async () => {
    const first = acquireLock(store);
    expect(first.acquired).toBe(true);
    // Same pid is alive, so a "second daemon" (same process here) is refused.
    const second = acquireLock(store);
    expect(second.acquired).toBe(false);
    expect(second.holderPid).toBe(process.pid);
    await releaseLock(store);
    expect(acquireLock(store).acquired).toBe(true);
    await releaseLock(store);
  });

  it("reclaims a stale lock held by a dead pid", async () => {
    await writeFile(join(store, "watch.lock"), JSON.stringify({ pid: 999999999, startedAt: "x" }));
    const result = acquireLock(store);
    expect(result.acquired).toBe(true);
    await releaseLock(store);
  });
});
