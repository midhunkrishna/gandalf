import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { FilePassResult } from "./schemas.ts";
import { FILE_PASS_PROMPT_VERSION } from "./prompts.ts";

// Content-addressed cache for per-file Claude passes (issue #2).
//
// Regenerating a lesson (or re-teaching rebased commits in watch mode) re-runs
// every per-file pass even when a file's before/after content is byte-identical
// to what was already analyzed. Per-file passes scale linearly with commit size,
// so they dominate cost on large commits. Caching their validated outputs makes
// those re-runs free.
//
// Key inputs, per the issue: before blob, after blob, prompt version, model,
// schema version. Two deliberate choices:
// - Blobs are hashed from the content already in memory rather than taken from
//   `git diff --raw`: worktree diffs report an all-zeros SHA for unstaged files,
//   so git's blob ids cannot key a WORKTREE comparison.
// - The schema "version" is a hash of FilePassResult's JSON schema, so schema
//   drift invalidates mechanically — no constant to forget to bump. The prompt
//   templates are runtime-assembled functions, hence the manual constant.
//
// Deliberately NOT in the key: path, evidence, ticket intent. Evidence (hotspot
// scores, churn) shifts with every commit to the repo; keying on it would make
// the cache miss on exactly the rebase/amend cases it exists for. The teaching
// content of a file pass is a function of the file's before/after content.

/** Default size cap. The pruner evicts least-recently-used entries beyond this. */
const DEFAULT_MAX_BYTES = 500 * 1024 * 1024;

const SCHEMA_HASH = createHash("sha256")
  .update(JSON.stringify(zodToJsonSchema(FilePassResult, { $refStrategy: "none" })))
  .digest("hex");

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export interface PassKeyInput {
  beforeBlob: string | null;
  afterBlob: string | null;
  model: string;
}

/** Cache key for one per-file pass. Absent blobs (adds/removes) key distinctly from empty ones. */
export function passKey(input: PassKeyInput): string {
  const blob = (b: string | null) => (b === null ? "absent" : sha256(b));
  return sha256(
    [
      `prompt-v${FILE_PASS_PROMPT_VERSION}`,
      SCHEMA_HASH,
      input.model,
      blob(input.beforeBlob),
      blob(input.afterBlob),
    ].join("\n"),
  );
}

export interface CacheStats {
  entries: number;
  bytes: number;
}

/** Entry count + total bytes for a cache directory (doctor report). */
export async function cacheStats(dir: string): Promise<CacheStats> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return { entries: 0, bytes: 0 };
  }
  let bytes = 0;
  let count = 0;
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    try {
      bytes += (await stat(join(dir, name))).size;
      count += 1;
    } catch {
      /* raced with pruning */
    }
  }
  return { entries: count, bytes };
}

/**
 * One JSON file per entry under `dir`, named by key. Reads touch mtime so the
 * size-cap pruner evicts least-recently-USED, not least-recently-written.
 * Every method degrades to "cache miss" on I/O or parse trouble — the cache
 * must never be able to fail a generation.
 */
export class PassCache {
  constructor(
    readonly dir: string,
    private readonly maxBytes: number = DEFAULT_MAX_BYTES,
  ) {}

  private file(key: string): string {
    return join(this.dir, `${key}.json`);
  }

  async get(key: string): Promise<FilePassResult | null> {
    let raw: string;
    try {
      raw = await readFile(this.file(key), "utf8");
    } catch {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const res = FilePassResult.safeParse(parsed);
    if (!res.success) {
      // A corrupt entry would otherwise be a permanent miss occupying space.
      await unlink(this.file(key)).catch(() => {});
      return null;
    }
    const now = new Date();
    await utimes(this.file(key), now, now).catch(() => {});
    return res.data;
  }

  async put(key: string, value: FilePassResult): Promise<void> {
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(this.file(key), JSON.stringify(value), "utf8");
      await this.prune();
    } catch {
      /* never fail the generation over cache writes */
    }
  }

  /** Evict oldest-mtime entries until the directory fits the size cap. */
  private async prune(): Promise<void> {
    const names = (await readdir(this.dir)).filter((n) => n.endsWith(".json"));
    const stats = [];
    let total = 0;
    for (const name of names) {
      try {
        const s = await stat(join(this.dir, name));
        stats.push({ name, size: s.size, mtimeMs: s.mtimeMs });
        total += s.size;
      } catch {
        /* raced with another process */
      }
    }
    if (total <= this.maxBytes) return;
    stats.sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const s of stats) {
      if (total <= this.maxBytes) break;
      await unlink(join(this.dir, s.name)).catch(() => {});
      total -= s.size;
    }
  }
}
