import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveLessonsDir, storeKey } from "../src/core/lesson.ts";
import { rootCommit } from "../src/core/git.ts";
import { GandalfConfig } from "../src/core/config.ts";

const pexec = promisify(execFile);
const git = (args: string[], cwd: string) => pexec("git", args, { cwd });

let home: string;
let repo: string;

async function makeRepo(withCommit: boolean): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "gandalf-place-"));
  await git(["init", "-q"], dir);
  if (withCommit) {
    await git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "root"], dir);
  }
  return dir;
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "gandalf-home-"));
  process.env.GANDALF_HOME_DIR = home;
});

afterEach(async () => {
  delete process.env.GANDALF_HOME_DIR;
  await rm(home, { recursive: true, force: true });
  if (repo) await rm(repo, { recursive: true, force: true });
});

const homeDirConfig = GandalfConfig.parse({ lesson_location: "home-dir" });
const projectWdConfig = GandalfConfig.parse({ lesson_location: "project-wd" });

describe("resolveLessonsDir", () => {
  it("--out-dir wins over everything", async () => {
    repo = await makeRepo(true);
    const store = await resolveLessonsDir(repo, homeDirConfig, "/tmp/custom-lessons");
    expect(store.lessonsDir).toBe("/tmp/custom-lessons");
    expect(store.storeDir).toBe("/tmp/custom-lessons");
    expect(store.source).toBe("out-dir");
  });

  it("project-wd keeps the pre-config in-repo layout", async () => {
    repo = await makeRepo(true);
    const store = await resolveLessonsDir(repo, projectWdConfig);
    expect(store.lessonsDir).toBe(join(repo, ".gandalf", "lessons"));
    expect(store.storeDir).toBe(join(repo, ".gandalf"));
    expect(store.source).toBe("project-wd");
  });

  it("home-dir composes <name>-<rootsha12> under the gandalf home", async () => {
    repo = await makeRepo(true);
    const rootSha = (await rootCommit(repo))!;
    const store = await resolveLessonsDir(repo, homeDirConfig);
    const expectedKey = `${basename(repo)}-${rootSha.slice(0, 12)}`;
    expect(store.storeDir).toBe(join(home, expectedKey));
    expect(store.lessonsDir).toBe(join(home, expectedKey, "lessons"));
    expect(store.source).toBe("home-dir");
  });

  it("falls back to project-wd for a repo with no commits", async () => {
    repo = await makeRepo(false);
    const store = await resolveLessonsDir(repo, homeDirConfig);
    expect(store.lessonsDir).toBe(join(repo, ".gandalf", "lessons"));
    expect(store.source).toBe("project-wd (empty repo fallback)");
  });
});

describe("storeKey", () => {
  it("slugs unsafe project-name characters", () => {
    expect(storeKey("/tmp/my project (v2)", "abcdef0123456789")).toBe("my_project__v2_-abcdef012345");
  });
});
