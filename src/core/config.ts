import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

// User-level configuration: ~/.gandalf/config.yaml.
//
// Design rules (see README "Configuration"):
// - The file is OPTIONAL. Missing / unreadable / empty -> documented defaults.
// - The shipped template is self-documenting: every key appears with an inline
//   comment; behavior-changing extras ship commented-out.
// - Unknown keys warn (never fail) so an old gandalf reads a newer config.
// - `--out-dir` on any command always overrides the configured placement.

/** Where gandalf keeps user-level state (config + home-dir lesson stores). */
export function gandalfHome(): string {
  // GANDALF_HOME_DIR lets tests (and unusual setups) redirect ~/.gandalf.
  return process.env.GANDALF_HOME_DIR || join(homedir(), ".gandalf");
}

export function configPath(): string {
  return join(gandalfHome(), "config.yaml");
}

export const GandalfConfig = z.object({
  /** Where lesson libraries live. See resolveLessonsDir in lesson.ts. */
  lesson_location: z.enum(["home-dir", "project-wd"]).default("home-dir"),
});
export type GandalfConfig = z.infer<typeof GandalfConfig>;

export const DEFAULT_CONFIG: GandalfConfig = GandalfConfig.parse({});

/**
 * The self-documenting template written by the installer (and ensureConfig).
 * Keep this the single source of truth for the file's contents — install.sh
 * calls ensureConfig() rather than embedding its own copy.
 */
export const DEFAULT_CONFIG_YAML = `# gandalf configuration
# ---------------------
# This file is optional: delete any key (or the whole file) and gandalf falls
# back to the documented default. Command-line flags always win over this file
# (e.g. \`--out-dir\` overrides lesson_location for a single invocation).

# Where lesson libraries are stored.
#   "home-dir"    (default) ~/.gandalf/<project-name>-<root-commit-sha12>/lessons
#                 Lessons never touch the analyzed repository: no lesson
#                 commits in your history, no interaction with your working
#                 tree. The store key uses the repo's root (first) commit, so
#                 it survives moving or renaming the project directory.
#   "project-wd"  <repo>/.gandalf/lessons — the pre-config behavior; lessons
#                 live inside the analyzed repository's working directory.
lesson_location: "home-dir"

# Future keys ship here commented-out (disabled) with their documentation.
`;

export interface LoadedConfig {
  config: GandalfConfig;
  /** Human-readable notes (unknown keys, parse problems) for the caller to log. */
  warnings: string[];
  /** The path consulted, for doctor/debug output. */
  path: string;
}

/** Load ~/.gandalf/config.yaml; never throws — degrades to defaults with warnings. */
export async function loadConfig(): Promise<LoadedConfig> {
  const path = configPath();
  const warnings: string[] = [];
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { config: DEFAULT_CONFIG, warnings, path }; // absent file = defaults
  }
  let data: unknown;
  try {
    data = parseYaml(raw) ?? {};
  } catch (err) {
    warnings.push(`config ${path} is not valid YAML (${err instanceof Error ? err.message : String(err)}) — using defaults`);
    return { config: DEFAULT_CONFIG, warnings, path };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    warnings.push(`config ${path} must be a YAML mapping — using defaults`);
    return { config: DEFAULT_CONFIG, warnings, path };
  }
  const known = new Set(Object.keys(GandalfConfig.shape));
  for (const key of Object.keys(data)) {
    if (!known.has(key)) warnings.push(`config ${path}: unknown key "${key}" (ignored)`);
  }
  const parsed = GandalfConfig.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      warnings.push(`config ${path}: ${issue.path.join(".")} ${issue.message} — using default for that key`);
    }
    // Salvage per-key: strip the failing keys and re-parse so one bad value
    // doesn't discard the rest of the file.
    const salvaged: Record<string, unknown> = { ...(data as Record<string, unknown>) };
    for (const issue of parsed.error.issues) {
      if (issue.path.length) delete salvaged[String(issue.path[0])];
    }
    const retry = GandalfConfig.safeParse(salvaged);
    return { config: retry.success ? retry.data : DEFAULT_CONFIG, warnings, path };
  }
  return { config: parsed.data, warnings, path };
}

/** Create ~/.gandalf and write the documented template — only when absent. */
export async function ensureConfig(): Promise<{ path: string; created: boolean }> {
  const path = configPath();
  await mkdir(gandalfHome(), { recursive: true });
  if (existsSync(path)) return { path, created: false };
  await writeFile(path, DEFAULT_CONFIG_YAML, "utf8");
  return { path, created: true };
}
