import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassCache, cacheStats, passKey } from "../src/core/passCache.ts";
import type { FilePassResult } from "../src/core/schemas.ts";

const RESULT: FilePassResult = {
  tldr: { before: "b", now: "n", behaviorChanged: "c" },
  beacons: [],
  contracts: [],
  cognitive: [],
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gandalf-passcache-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("passKey", () => {
  const base = { beforeBlob: "old", afterBlob: "new", model: "sonnet" };

  it("is deterministic for identical inputs", () => {
    expect(passKey(base)).toBe(passKey({ ...base }));
  });

  it("changes when any blob or the model changes", () => {
    const k = passKey(base);
    expect(passKey({ ...base, beforeBlob: "other" })).not.toBe(k);
    expect(passKey({ ...base, afterBlob: "other" })).not.toBe(k);
    expect(passKey({ ...base, model: "haiku" })).not.toBe(k);
  });

  it("changes when the prompt version is bumped", async () => {
    vi.resetModules();
    vi.doMock("../src/core/prompts.ts", async (orig) => ({
      ...(await orig<typeof import("../src/core/prompts.ts")>()),
      FILE_PASS_PROMPT_VERSION: 999_999,
    }));
    const bumped = await import("../src/core/passCache.ts");
    expect(bumped.passKey(base)).not.toBe(passKey(base));
    vi.doUnmock("../src/core/prompts.ts");
    vi.resetModules();
  });

  it("keys an absent blob distinctly from an empty one", () => {
    expect(passKey({ ...base, beforeBlob: null })).not.toBe(passKey({ ...base, beforeBlob: "" }));
    expect(passKey({ ...base, afterBlob: null })).not.toBe(passKey({ ...base, afterBlob: "" }));
  });
});

describe("PassCache", () => {
  it("round-trips a validated result", async () => {
    const cache = new PassCache(dir);
    const key = passKey({ beforeBlob: "a", afterBlob: "b", model: "sonnet" });
    expect(await cache.get(key)).toBeNull();
    await cache.put(key, RESULT);
    expect(await cache.get(key)).toEqual(RESULT);
  });

  it("treats a corrupt entry as a miss and removes it", async () => {
    const cache = new PassCache(dir);
    const key = passKey({ beforeBlob: "a", afterBlob: "b", model: "sonnet" });
    await cache.put(key, RESULT);
    await writeFile(join(dir, `${key}.json`), "{not json", "utf8");
    expect(await cache.get(key)).toBeNull();
    expect(await readdir(dir)).toEqual([]);
  });

  it("treats a schema-invalid entry as a miss and removes it", async () => {
    const cache = new PassCache(dir);
    const key = passKey({ beforeBlob: "a", afterBlob: "b", model: "sonnet" });
    await writeFile(join(dir, `${key}.json`), JSON.stringify({ tldr: { before: "b" } }), "utf8");
    expect(await cache.get(key)).toBeNull();
    expect(await readdir(dir)).toEqual([]);
  });

  it("evicts least-recently-used entries beyond the size cap", async () => {
    const one = JSON.stringify(RESULT).length;
    const cache = new PassCache(dir, one * 2); // room for two entries
    const keys = ["1", "2", "3"].map((n) => passKey({ beforeBlob: n, afterBlob: n, model: "sonnet" }));
    await cache.put(keys[0]!, RESULT);
    await cache.put(keys[1]!, RESULT);
    // Age the first entry's mtime so the LRU order is unambiguous, then overflow.
    const old = new Date(Date.now() - 60_000);
    await utimes(join(dir, `${keys[0]}.json`), old, old);
    await cache.put(keys[2]!, RESULT);
    expect(await cache.get(keys[0]!)).toBeNull();
    expect(await cache.get(keys[1]!)).toEqual(RESULT);
    expect(await cache.get(keys[2]!)).toEqual(RESULT);
  });

  it("reports entry count and bytes, and zero for an absent directory", async () => {
    expect(await cacheStats(join(dir, "nope"))).toEqual({ entries: 0, bytes: 0 });
    const cache = new PassCache(dir);
    const key = passKey({ beforeBlob: "a", afterBlob: "b", model: "sonnet" });
    await cache.put(key, RESULT);
    const stats = await cacheStats(dir);
    expect(stats.entries).toBe(1);
    const written = await readFile(join(dir, `${key}.json`), "utf8");
    expect(stats.bytes).toBe(Buffer.byteLength(written));
  });
});
