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

/** Resolve a symbolic ref to a short SHA for stable lesson IDs (WORKTREE passes through). */
export async function resolveRef(ref: string, cwd: string): Promise<string> {
  if (ref === WORKTREE) return WORKTREE;
  const { stdout, ok } = await runGit(["rev-parse", "--short", ref], cwd);
  return ok ? stdout.trim() : ref;
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
