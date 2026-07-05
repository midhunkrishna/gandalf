import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChangeStatus } from "./schemas.ts";

const pexec = promisify(execFile);

/** Sentinel meaning "the uncommitted working tree" rather than a committed ref. */
export const WORKTREE = "WORKTREE" as const;

export interface ChangedFile {
  path: string;
  oldPath: string | null;
  status: ChangeStatus;
}

export interface GitResult {
  stdout: string;
  ok: boolean;
}

/** Run git, returning stdout. `ok` is false (not throwing) on non-zero exit. */
export async function runGit(args: string[], cwd: string): Promise<GitResult> {
  try {
    const { stdout } = await pexec("git", args, {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { stdout, ok: true };
  } catch (err: unknown) {
    const stdout =
      typeof err === "object" && err && "stdout" in err
        ? String((err as { stdout?: unknown }).stdout ?? "")
        : "";
    return { stdout, ok: false };
  }
}

export async function repoRoot(cwd: string): Promise<string> {
  const { stdout, ok } = await runGit(["rev-parse", "--show-toplevel"], cwd);
  if (!ok) throw new Error(`Not a git repository: ${cwd}`);
  return stdout.trim();
}

/**
 * The repository's root (first) commit — an identity that survives moving or
 * renaming the project directory, used to key home-dir lesson stores.
 * Returns null for a repo with no commits yet. If orphan-branch merges give
 * the repo several roots, the lexicographically first is used so the key
 * never flips between invocations.
 */
export async function rootCommit(cwd: string): Promise<string | null> {
  const { stdout, ok } = await runGit(["rev-list", "--max-parents=0", "HEAD"], cwd);
  if (!ok) return null;
  const roots = stdout.trim().split("\n").filter(Boolean).sort();
  return roots[0] ?? null;
}

/** Resolve a symbolic ref to a short SHA for stable lesson IDs (WORKTREE passes through). */
export async function resolveRef(ref: string, cwd: string): Promise<string> {
  if (ref === WORKTREE) return WORKTREE;
  const { stdout, ok } = await runGit(["rev-parse", "--short", ref], cwd);
  return ok ? stdout.trim() : ref;
}

// --- watch-mode helpers (full SHAs everywhere: short-sha length can change
// --- as the repo grows and would corrupt journal frontier comparisons) -----

/** Full SHA for a ref, or null when it doesn't resolve. */
export async function revParse(ref: string, cwd: string): Promise<string | null> {
  const { stdout, ok } = await runGit(["rev-parse", "--verify", `${ref}^{commit}`], cwd);
  return ok ? stdout.trim() : null;
}

export async function commitExists(sha: string, cwd: string): Promise<boolean> {
  const { ok } = await runGit(["cat-file", "-e", `${sha}^{commit}`], cwd);
  return ok;
}

export async function isAncestor(ancestor: string, descendant: string, cwd: string): Promise<boolean> {
  const { ok } = await runGit(["merge-base", "--is-ancestor", ancestor, descendant], cwd);
  return ok;
}

export async function mergeBase(a: string, b: string, cwd: string): Promise<string | null> {
  const { stdout, ok } = await runGit(["merge-base", a, b], cwd);
  return ok ? stdout.trim() : null;
}

export async function isShallow(cwd: string): Promise<boolean> {
  const { stdout, ok } = await runGit(["rev-parse", "--is-shallow-repository"], cwd);
  return ok && stdout.trim() === "true";
}

export interface CommitInfo {
  sha: string;
  parents: string[];
  subject: string;
}

/**
 * First-parent commits in `base..head`, oldest first, with parents + subject.
 * Uses NUL-separated `git log` fields so subjects with any punctuation parse.
 */
export async function firstParentLog(base: string, head: string, cwd: string): Promise<CommitInfo[]> {
  const FIELD = "\u0000";
  const RECORD = "\u0001";
  const { stdout, ok } = await runGit(
    ["log", "--first-parent", "--reverse", `--format=%H%x00%P%x00%s%x01`, `${base}..${head}`],
    cwd,
  );
  if (!ok) return [];
  const out: CommitInfo[] = [];
  for (const chunk of stdout.split(RECORD)) {
    const line = chunk.replace(/^\s+/, "");
    if (!line.trim()) continue;
    const [sha, parents, subject] = line.split(FIELD);
    if (!sha) continue;
    out.push({
      sha: sha.trim(),
      parents: (parents ?? "").trim().split(/\s+/).filter(Boolean),
      subject: (subject ?? "").trim(),
    });
  }
  return out;
}

/** True while a rebase/merge is in flight — watch holds off until HEAD settles. */
export async function repoOperationInProgress(cwd: string): Promise<boolean> {
  const { stdout, ok } = await runGit(
    ["rev-parse", "--git-path", "rebase-merge", "--git-path", "rebase-apply", "--git-path", "MERGE_HEAD"],
    cwd,
  );
  if (!ok) return false;
  const { existsSync } = await import("node:fs");
  const { isAbsolute, join: pjoin } = await import("node:path");
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .some((p) => existsSync(isAbsolute(p) ? p : pjoin(cwd, p)));
}

function statusLetterToChange(letter: string): ChangeStatus {
  switch (letter[0]) {
    case "A":
      return "added";
    case "D":
      return "removed";
    case "R":
      return "renamed";
    case "M":
    case "C":
    case "T":
      return "modified";
    default:
      return "modified";
  }
}

/** Build the git diff range. WORKTREE on the `to` side means "compare against the working tree". */
function diffRange(fromRef: string, toRef: string): string[] {
  if (toRef === WORKTREE) return [fromRef];
  return [fromRef, toRef];
}

/** `git diff --name-status` between fromRef and toRef (or working tree). */
export async function listChangedFiles(
  fromRef: string,
  toRef: string,
  cwd: string,
): Promise<ChangedFile[]> {
  const { stdout } = await runGit(
    ["diff", "--name-status", "-M", ...diffRange(fromRef, toRef)],
    cwd,
  );
  const files: ChangedFile[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const letter = parts[0] ?? "M";
    if (letter.startsWith("R") && parts.length >= 3) {
      files.push({
        status: "renamed",
        oldPath: parts[1] ?? null,
        path: parts[2] ?? "",
      });
    } else {
      files.push({
        status: statusLetterToChange(letter),
        oldPath: null,
        path: parts[1] ?? "",
      });
    }
  }
  return files.filter((f) => f.path);
}

/** Unified diff for a single path. */
export async function unifiedDiff(
  fromRef: string,
  toRef: string,
  path: string,
  oldPath: string | null,
  cwd: string,
): Promise<string> {
  const args = ["diff", "-M", ...diffRange(fromRef, toRef), "--"];
  if (oldPath) args.push(oldPath);
  args.push(path);
  const { stdout } = await runGit(args, cwd);
  return stdout;
}

/** Contents of `path` at a ref. For WORKTREE, read from disk. Returns null if absent. */
export async function blobAt(
  ref: string,
  path: string,
  cwd: string,
): Promise<string | null> {
  if (ref === WORKTREE) {
    try {
      return await readFile(join(cwd, path), "utf8");
    } catch {
      return null;
    }
  }
  const { stdout, ok } = await runGit(["show", `${ref}:${path}`], cwd);
  return ok ? stdout : null;
}
