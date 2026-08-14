import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * `gandalf doctor` end-to-end against a fixture lesson store: no claude, no generation.
 * The default run must stay non-destructive (report the repair, touch nothing); --fix
 * rewrites the stored bundle so a re-run is clean.
 */

const pexec = promisify(execFile);
const CLI = resolve(import.meta.dirname, "../bin/gandalf.ts");
const TSX = resolve(import.meta.dirname, "../node_modules/.bin/tsx");

const LESSON_ID = "diff-aaaaaaa-bbbbbbb";
const tier = { eli5: "a", junior: "b", senior: "c", architect: "d" };

let repo: string;
let home: string;
let lessonsDir: string;
let lessonFile: string;

/** A lesson whose only defect is an edge pointing at a node that isn't in the graph. */
function fixtureLesson(): unknown {
  return {
    meta: {
      id: LESSON_ID,
      title: "facets learn about utils",
      fromRef: "aaaaaaa",
      toRef: "bbbbbbb",
      ticketId: null,
      createdAt: new Date().toISOString(),
      hypothesis: "h",
      summary: "s",
      verdict: "behavioral",
      breakingCount: 0,
    },
    files: [
      {
        path: "datasette/facets.py",
        module: "datasette/facets.py",
        language: "python",
        status: "modified",
        unifiedDiff: "",
        beforeBlob: null,
        afterBlob: "line1\nline2",
        tldr: { before: "x", now: "y", behaviorChanged: "z" },
        beacons: [],
      },
    ],
    contracts: [],
    graph: {
      nodes: [
        { id: "datasette/facets.py", module: "datasette/facets.py", status: "modified", kind: "module" },
      ],
      edges: [{ from: "datasette/facets.py", to: "datasette/utils", kind: "imports", status: "added" }],
      rippleTargets: [],
    },
    dataflow: { mermaid: "sequenceDiagram\nA->>B: hi", sankey: null, narrative: { before: "b", after: "a" } },
    complexity: {
      perFunction: [],
      scorecard: { deltaCyclomatic: 0, deltaCognitive: 0, deltaNesting: 0, deltaLoc: 0 },
      hotspots: [],
      coupling: [],
    },
    patterns: { detected: [], adr: null },
    behavioral: { verdict: "behavioral", conditionalEquivalence: "c", traceCards: [], workedExample: null, ripple: [] },
    explanations: { behavioral: tier, dependency: tier, contract: tier, dataflow: tier },
    retrieval: { questions: [] },
  };
}

async function doctor(...args: string[]): Promise<string> {
  const { stdout } = await pexec(TSX, [CLI, "doctor", "--cwd", repo, "--out-dir", lessonsDir, ...args], {
    env: { ...process.env, GANDALF_HOME_DIR: home },
  });
  return stdout;
}

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "gandalf-doctor-repo-"));
  home = await mkdtemp(join(tmpdir(), "gandalf-doctor-home-"));
  lessonsDir = await mkdtemp(join(tmpdir(), "gandalf-doctor-lessons-"));
  await pexec("git", ["init", "-q"], { cwd: repo });
  await mkdir(join(lessonsDir, LESSON_ID), { recursive: true });
  lessonFile = join(lessonsDir, LESSON_ID, "lesson.json");
  await writeFile(lessonFile, JSON.stringify(fixtureLesson(), null, 2), "utf8");
});

afterEach(async () => {
  for (const dir of [repo, home, lessonsDir]) await rm(dir, { recursive: true, force: true });
});

describe("gandalf doctor --fix", () => {
  it("reports the repair without touching the file, then applies it", async () => {
    const before = await readFile(lessonFile, "utf8");

    const dry = await doctor();
    expect(dry).toContain("would fix");
    expect(dry).toContain(`added missing node "datasette/utils"`);
    expect(dry).toContain("re-run with --fix");
    expect(dry).toContain("[graph] edge datasette/facets.py → datasette/utils");
    expect(await readFile(lessonFile, "utf8")).toBe(before);

    const fixed = await doctor("--fix");
    expect(fixed).toContain("fixed");
    expect(await readFile(lessonFile, "utf8")).not.toBe(before);

    const rerun = await doctor();
    expect(rerun).toContain("✓ no integrity issues");
    expect(rerun).not.toContain("[graph]");
    expect(rerun).not.toContain("would fix");
  }, 60_000);
});
