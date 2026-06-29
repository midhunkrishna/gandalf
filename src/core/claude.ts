import { spawn } from "node:child_process";
import { z, type ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Headless Claude Code driver.
 *
 * HARD CONSTRAINT: gandalf must reuse the user's existing Claude Code login.
 * Do NOT use the Agent SDK or the raw Messages API (both need ANTHROPIC_API_KEY),
 * and do NOT pass `--bare` (it disables OAuth and forces an API key).
 */

export type ModelAlias = "haiku" | "sonnet" | "opus" | "fable" | (string & {});

export interface ClaudeOptions {
  /** Large user content (diff, blobs, prior results) — sent via stdin. */
  prompt: string;
  /** System prompt (role + output contract). */
  system?: string;
  model?: ModelAlias;
  /** Working directory the CLI runs in (and is allowed to read). */
  cwd: string;
  /** Read-only tools to allow. Default: Read/Grep/Glob. */
  allowedTools?: string[];
  /** Per-call timeout (ms). */
  timeoutMs?: number;
  /** Short label for error messages. */
  label?: string;
}

interface ResultEnvelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  total_cost_usd?: number;
}

interface SpawnOutcome {
  stdout: string;
  stderr: string;
  code: number | null;
}

const DEFAULT_TOOLS = ["Read", "Grep", "Glob"];
const DEFAULT_TIMEOUT = 240_000;

function spawnClaude(args: string[], stdin: string, cwd: string, timeoutMs: number): Promise<SpawnOutcome> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`claude timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    child.stdin.write(stdin);
    child.stdin.end();
  });
}

/** Best-effort extraction of a JSON object/array from free-form model text. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in result");
  // Walk to the matching close from the last bracket of the same type.
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  if (end <= start) throw new Error("no JSON terminator in result");
  return JSON.parse(candidate.slice(start, end + 1));
}

function baseArgs(opts: ClaudeOptions): string[] {
  const args = [
    "-p",
    "--output-format",
    "json",
    "--model",
    opts.model ?? "sonnet",
    "--permission-mode",
    "default",
    "--add-dir",
    opts.cwd,
    "--allowedTools",
    ...(opts.allowedTools ?? DEFAULT_TOOLS),
  ];
  if (opts.system) args.push("--system-prompt", opts.system);
  return args;
}

function parseEnvelope(raw: string, label: string): ResultEnvelope {
  let env: ResultEnvelope;
  try {
    env = JSON.parse(raw) as ResultEnvelope;
  } catch {
    throw new Error(`[${label}] claude did not return a JSON envelope:\n${raw.slice(0, 500)}`);
  }
  if (env.is_error) {
    throw new Error(`[${label}] claude reported an error: ${env.result ?? "(no detail)"}`);
  }
  return env;
}

/**
 * Run one structured generation. Uses the CLI's native `--json-schema` enforcement
 * and reads `structured_output`; falls back to prompting-for-JSON + Zod on miss.
 */
export async function claudeStructured<S extends ZodTypeAny>(
  schema: S,
  opts: ClaudeOptions,
): Promise<z.infer<S>> {
  const label = opts.label ?? "claude";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" });
  const schemaStr = JSON.stringify(jsonSchema);

  // Attempt 1 — server-side schema enforcement.
  try {
    const args = [...baseArgs(opts), "--json-schema", schemaStr];
    const { stdout } = await spawnClaude(args, opts.prompt, opts.cwd, timeoutMs);
    const env = parseEnvelope(stdout, label);
    const candidate =
      env.structured_output !== undefined && env.structured_output !== null
        ? env.structured_output
        : extractJson(env.result ?? "");
    return schema.parse(candidate) as z.infer<S>;
  } catch (firstErr) {
    // Attempt 2 — no --json-schema, explicit instruction + the prior error.
    const retryPrompt =
      `${opts.prompt}\n\n---\nReturn ONLY a single JSON value that conforms to this JSON Schema ` +
      `(no prose, no code fences):\n${schemaStr}\n\nThe previous attempt failed with: ${String(firstErr).slice(0, 400)}`;
    const { stdout } = await spawnClaude(baseArgs(opts), retryPrompt, opts.cwd, timeoutMs);
    const env = parseEnvelope(stdout, `${label}:retry`);
    const candidate = extractJson(env.result ?? "");
    return schema.parse(candidate) as z.infer<S>;
  }
}

/** Plain free-text generation (no schema) — used for quick prose helpers. */
export async function claudeText(opts: ClaudeOptions): Promise<string> {
  const { stdout } = await spawnClaude(
    baseArgs(opts),
    opts.prompt,
    opts.cwd,
    opts.timeoutMs ?? DEFAULT_TIMEOUT,
  );
  return parseEnvelope(stdout, opts.label ?? "claude").result ?? "";
}
