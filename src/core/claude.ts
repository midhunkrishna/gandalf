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
  /** Short label for logs/errors. */
  label?: string;
}

interface ResultEnvelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  total_cost_usd?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  usage?: { service_tier?: string };
}

interface SpawnOutcome {
  stdout: string;
  stderr: string;
  code: number | null;
  wallMs: number;
  /** number of claude processes in flight (incl. this one) when this call started */
  concurrentAtStart: number;
}

const DEFAULT_TOOLS = ["Read", "Grep", "Glob"];
const DEFAULT_TIMEOUT = 240_000;

/** Live count of in-flight `claude -p` processes — surfaced in logs to diagnose concurrency. */
let inFlight = 0;

function clog(line: string): void {
  process.stderr.write(`${line}\n`);
}

function spawnClaude(args: string[], stdin: string, cwd: string, timeoutMs: number): Promise<SpawnOutcome> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    inFlight += 1;
    const concurrentAtStart = inFlight;
    let settled = false;
    const release = () => {
      if (settled) return;
      settled = true;
      inFlight -= 1;
      clearTimeout(timer);
    };

    const child = spawn("claude", args, { cwd, stdio: ["pipe", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      release();
      child.kill("SIGKILL");
      reject(new Error(`claude timed out after ${timeoutMs}ms (concurrent=${concurrentAtStart})`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      release();
      reject(err);
    });
    child.on("close", (code) => {
      release();
      resolve({ stdout, stderr, code, wallMs: Date.now() - t0, concurrentAtStart });
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
    // Drop all MCP servers (we pass no --mcp-config): shrinks the cached prompt
    // prefix and skips MCP health-check startup — gandalf only needs Read/Grep/Glob.
    "--strict-mcp-config",
    "--add-dir",
    opts.cwd,
    "--allowedTools",
    ...(opts.allowedTools ?? DEFAULT_TOOLS),
  ];
  if (opts.system) args.push("--system-prompt", opts.system);
  return args;
}

function parseEnvelope(raw: string, stderr: string, label: string): ResultEnvelope {
  let env: ResultEnvelope;
  try {
    env = JSON.parse(raw) as ResultEnvelope;
  } catch {
    const tail = stderr.trim().slice(-400);
    throw new Error(
      `[${label}] claude did not return a JSON envelope.\n  stdout: ${raw.slice(0, 300)}\n  stderr: ${tail}`,
    );
  }
  if (env.is_error) {
    throw new Error(`[${label}] claude reported an error: ${env.result ?? "(no detail)"}`);
  }
  return env;
}

/** One concise timing line per call so concurrency vs. latency is visible in logs. */
function logTiming(label: string, model: string, env: ResultEnvelope, o: SpawnOutcome): void {
  const s = (ms?: number) => (ms != null ? `${(ms / 1000).toFixed(1)}s` : "?");
  const cost = env.total_cost_usd != null ? `$${env.total_cost_usd.toFixed(3)}` : "$?";
  clog(
    `  ⟐ [${label}] ${model} wall=${s(o.wallMs)} api=${s(env.duration_api_ms)} ${cost} ` +
      `turns=${env.num_turns ?? "?"} tier=${env.usage?.service_tier ?? "?"} concurrent=${o.concurrentAtStart}`,
  );
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
  const model = opts.model ?? "sonnet";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" });
  const schemaStr = JSON.stringify(jsonSchema);

  // Attempt 1 — server-side schema enforcement.
  try {
    const args = [...baseArgs(opts), "--json-schema", schemaStr];
    const out = await spawnClaude(args, opts.prompt, opts.cwd, timeoutMs);
    const env = parseEnvelope(out.stdout, out.stderr, label);
    logTiming(label, model, env, out);
    const candidate =
      env.structured_output !== undefined && env.structured_output !== null
        ? env.structured_output
        : extractJson(env.result ?? "");
    return schema.parse(candidate) as z.infer<S>;
  } catch (firstErr) {
    clog(`  ↻ [${label}] retrying without --json-schema (attempt 1 failed: ${String(firstErr).slice(0, 200)})`);
    // Attempt 2 — no --json-schema, explicit instruction + the prior error.
    const retryPrompt =
      `${opts.prompt}\n\n---\nReturn ONLY a single JSON value that conforms to this JSON Schema ` +
      `(no prose, no code fences):\n${schemaStr}\n\nThe previous attempt failed with: ${String(firstErr).slice(0, 400)}`;
    const out = await spawnClaude(baseArgs(opts), retryPrompt, opts.cwd, timeoutMs);
    const env = parseEnvelope(out.stdout, out.stderr, `${label}:retry`);
    logTiming(`${label}:retry`, model, env, out);
    const candidate = extractJson(env.result ?? "");
    return schema.parse(candidate) as z.infer<S>;
  }
}
