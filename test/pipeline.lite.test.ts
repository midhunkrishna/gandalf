import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateLesson } from "../src/core/pipeline.ts";
import { validateLesson } from "../src/core/validate.ts";

/**
 * The lite path end to end, against a fake `claude` on PATH (same trick as
 * claude.test.ts): one call per analyzable file plus ONE merged synthesis call.
 * The shim logs the kind + model of every call, so the profile's model choices
 * are asserted without burning real usage.
 */

const pexec = promisify(execFile);

let repo: string;
let shimDir: string;
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

/** Fake claude: answers per pass kind (detected in the system prompt) and logs the model. */
async function writeShim(): Promise<void> {
  const shim = join(shimDir, "claude");
  await writeFile(
    shim,
    `#!/bin/bash
cat > /dev/null
model=""
prev=""
for a in "$@"; do
  if [ "$prev" = "--model" ]; then model="$a"; fi
  prev="$a"
done
if [[ " $* " == *"ONE changed file"* ]]; then
  echo "file $model" >> ${callLog}
  echo '{"type":"result","is_error":false,"structured_output":${FILE_RESULT}}'
else
  echo "synth $model" >> ${callLog}
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

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "gandalf-lite-repo-"));
  shimDir = await mkdtemp(join(tmpdir(), "gandalf-lite-shim-"));
  callLog = join(shimDir, "calls.log");
  savedPath = process.env.PATH ?? "";
  process.env.PATH = `${shimDir}:${savedPath}`;
  await writeShim();
  await git("init", "-q");
  // Churn history so the files under test are NOT top-3 hotspots (that would
  // escalate them to sonnet, which is its own case in profile.test.ts).
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
});

describe("generateLesson (lite profile)", () => {
  it("makes one call per analyzable file plus one merged synthesis call", async () => {
    const lesson = await generateLesson({ cwd: repo, fromRef: "HEAD~1", toRef: "HEAD", profile: "lite" });
    const log = await calls();
    expect(log.filter((l) => l.startsWith("file "))).toEqual(["file haiku", "file haiku"]);
    expect(log.filter((l) => l.startsWith("synth "))).toEqual(["synth sonnet"]);
    expect(lesson.files.map((f) => f.path)).toEqual(["src/core/alpha.ts", "src/core/beta.ts"]);
  }, 60_000);

  it("marks the lesson lite and writes typed empties for the skipped lenses", async () => {
    const lesson = await generateLesson({ cwd: repo, fromRef: "HEAD~1", toRef: "HEAD", profile: "lite" });

    expect(lesson.meta.profile).toBe("lite");
    expect(lesson.meta.title).toBe("Lite lesson");
    expect(lesson.meta.verdict).toBe("behavioral");

    expect(lesson.patterns).toEqual({ detected: [], adr: null });
    expect(lesson.retrieval).toEqual({ questions: [] });
    expect(lesson.dataflow.mermaid).toBe("");
    expect(lesson.dataflow.sankey).toBeNull();
    expect(lesson.dataflow.narrative.before).toContain("lite profile");
    for (const tiered of Object.values(lesson.explanations)) {
      for (const text of Object.values(tiered)) expect(text).toContain("lite profile");
    }

    // What lite keeps: per-file teaching, the deterministic graph nodes, complexity.
    expect(lesson.files.every((f) => f.tldr.now === "n")).toBe(true);
    expect(lesson.graph.nodes.map((n) => n.id)).toEqual(["src/core"]);
    expect(lesson.complexity.hotspots.length).toBeGreaterThan(0);

    expect(validateLesson(lesson)).toEqual([]);
  }, 60_000);

  it("still defaults to the full profile when no profile is given", async () => {
    // The shim only answers the merged lite contract, so the full run's narrative pass
    // fails the run, but only after fanning out its passes on the full profile's models.
    await expect(generateLesson({ cwd: repo, fromRef: "HEAD~1", toRef: "HEAD" })).rejects.toThrow();
    const log = await calls();
    expect(log.filter((l) => l.startsWith("file "))).toEqual(["file sonnet", "file sonnet"]);
    const synth = log.filter((l) => l.startsWith("synth "));
    expect(synth.every((l) => l === "synth opus")).toBe(true);
    expect(synth.length).toBeGreaterThanOrEqual(7); // seven passes, each with its retry
  }, 60_000);
});
