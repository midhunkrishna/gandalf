import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateLesson } from "../src/core/pipeline.ts";
import { PassCache } from "../src/core/passCache.ts";

/**
 * The pass cache end to end, against a fake `claude` on PATH (same trick as
 * pipeline.lite.test.ts). Issue #2's acceptance criteria: a regeneration makes
 * zero per-file calls and reports the hits; a one-file amend re-runs exactly
 * the amended file.
 */

const pexec = promisify(execFile);

let repo: string;
let shimDir: string;
let cacheDir: string;
let callLog: string;
let savedPath: string;

const git = (...args: string[]) =>
  pexec("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: repo });

const FILE_RESULT =
  '{"tldr":{"before":"b","now":"n","behaviorChanged":"c"},"beacons":[],"contracts":[],"cognitive":[]}';
const LITE_RESULT =
  '{"narrative":{"title":"Lite lesson","hypothesis":"H","summary":"S"},' +
  '"behavioral":{"verdict":"behavioral","conditionalEquivalence":"Unchanged except when the flag is set"},' +
  '"graph":{"edges":[],"rippleTargets":[]}}';

/** Fake claude: answers per pass kind (detected in the system prompt) and logs the pass. */
async function writeShim(): Promise<void> {
  const shim = join(shimDir, "claude");
  await writeFile(
    shim,
    `#!/bin/bash
cat > /dev/null
if [[ " $* " == *"ONE changed file"* ]]; then
  echo "file" >> ${callLog}
  echo '{"type":"result","is_error":false,"structured_output":${FILE_RESULT}}'
else
  echo "synth" >> ${callLog}
  echo '{"type":"result","is_error":false,"structured_output":${LITE_RESULT}}'
fi
`,
    "utf8",
  );
  await chmod(shim, 0o755);
}

async function commit(files: Record<string, string>, subject: string): Promise<void> {
  for (const [name, body] of Object.entries(files)) {
    await mkdir(join(repo, name, ".."), { recursive: true });
    await writeFile(join(repo, name), body, "utf8");
  }
  await git("add", "-A");
  await git("commit", "-q", "-m", subject);
}

async function calls(): Promise<string[]> {
  const raw = await readFile(callLog, "utf8").catch(() => "");
  return raw.split("\n").filter(Boolean);
}

async function clearCalls(): Promise<void> {
  await rm(callLog, { force: true });
}

function generate(progress?: string[]) {
  return generateLesson({
    cwd: repo,
    fromRef: "HEAD~1",
    toRef: "HEAD",
    profile: "lite",
    passCache: new PassCache(cacheDir),
    onProgress: (m) => progress?.push(m),
  });
}

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "gandalf-cache-repo-"));
  shimDir = await mkdtemp(join(tmpdir(), "gandalf-cache-shim-"));
  cacheDir = await mkdtemp(join(tmpdir(), "gandalf-cache-store-"));
  callLog = join(shimDir, "calls.log");
  savedPath = process.env.PATH ?? "";
  process.env.PATH = `${shimDir}:${savedPath}`;
  await writeShim();
  await git("init", "-q");
  // Churn history so the files under test stay off the top-3 hotspot list and
  // keep the same (haiku) model across runs — the model is part of the cache key.
  for (let i = 0; i < 5; i++) {
    const body = Array.from({ length: (i + 1) * 8 }, (_, n) => `export const v${n} = ${i};`).join("\n");
    await commit({ "src/hot/one.ts": body, "src/hot/two.ts": body, "src/hot/three.ts": body }, `churn ${i}`);
  }
  await commit(
    { "src/core/alpha.ts": "export const a = 1;\n", "src/core/beta.ts": "export const b = 1;\n" },
    "baseline",
  );
  await commit(
    { "src/core/alpha.ts": "export const a = 2;\n", "src/core/beta.ts": "export const b = 2;\n" },
    "the change under test",
  );
});

afterEach(async () => {
  process.env.PATH = savedPath;
  await rm(repo, { recursive: true, force: true });
  await rm(shimDir, { recursive: true, force: true });
  await rm(cacheDir, { recursive: true, force: true });
});

describe("generateLesson with a pass cache", () => {
  it("regenerating the same diff runs zero per-file calls and reports the hits", async () => {
    await generate();
    expect((await calls()).filter((l) => l === "file")).toHaveLength(2);

    await clearCalls();
    const progress: string[] = [];
    const lesson = await generate(progress);
    const log = await calls();
    expect(log.filter((l) => l === "file")).toHaveLength(0);
    expect(log.filter((l) => l === "synth")).toHaveLength(1); // synthesis stays uncached
    expect(progress).toContain("cache: 2/2 file passes reused");
    expect(lesson.files.every((f) => f.tldr.now === "n")).toBe(true);
  }, 60_000);

  it("a one-file amend re-runs exactly the amended file", async () => {
    await generate();

    await clearCalls();
    // Amend alpha only: beta's before/after blobs are identical to the first run.
    await writeFile(join(repo, "src/core/alpha.ts"), "export const a = 3;\n", "utf8");
    await git("add", "-A");
    await git("commit", "-q", "--amend", "--no-edit");
    const progress: string[] = [];
    await generate(progress);
    expect((await calls()).filter((l) => l === "file")).toHaveLength(1);
    expect(progress).toContain("cache: 1/2 file passes reused");
  }, 60_000);

  it("runs every pass live when no cache is given", async () => {
    await generate();
    await clearCalls();
    const progress: string[] = [];
    await generateLesson({
      cwd: repo,
      fromRef: "HEAD~1",
      toRef: "HEAD",
      profile: "lite",
      onProgress: (m) => progress.push(m),
    });
    expect((await calls()).filter((l) => l === "file")).toHaveLength(2);
    expect(progress.some((m) => m.startsWith("cache:"))).toBe(false);
  }, 60_000);
});
