import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { claudeStructured } from "../src/core/claude.ts";

/**
 * Exercise the structured-output path against a fake `claude` binary on PATH:
 * the shim's behaviour switches on whether --json-schema was passed, so both
 * the happy path and the no-schema retry fallback are covered without burning
 * real Claude usage.
 */

const Schema = z.object({ x: z.number() });

let dir: string;
let savedPath: string;

async function writeShim(script: string): Promise<void> {
  const shim = join(dir, "claude");
  await writeFile(shim, `#!/bin/bash\ncat > /dev/null\n${script}\n`, "utf8");
  await chmod(shim, 0o755);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gandalf-shim-"));
  savedPath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${savedPath}`;
});

afterEach(async () => {
  process.env.PATH = savedPath;
  await rm(dir, { recursive: true, force: true });
});

describe("claudeStructured (fake claude shim)", () => {
  it("returns structured_output from the --json-schema attempt", async () => {
    await writeShim(`echo '{"type":"result","is_error":false,"result":"ok","structured_output":{"x":1}}'`);
    const out = await claudeStructured(Schema, { prompt: "p", cwd: dir, label: "test" });
    expect(out).toEqual({ x: 1 });
  });

  it("falls back to extracting JSON from result text", async () => {
    await writeShim(`echo '{"type":"result","is_error":false,"result":"here: {\\"x\\": 2} done"}'`);
    const out = await claudeStructured(Schema, { prompt: "p", cwd: dir, label: "test" });
    expect(out).toEqual({ x: 2 });
  });

  it("retries without --json-schema when the first attempt fails validation", async () => {
    await writeShim(
      `if [[ " $* " == *" --json-schema "* ]]; then
  echo '{"type":"result","is_error":false,"result":"no json here"}'
else
  echo '{"type":"result","is_error":false,"result":"{\\"x\\": 3}"}'
fi`,
    );
    const out = await claudeStructured(Schema, { prompt: "p", cwd: dir, label: "test" });
    expect(out).toEqual({ x: 3 });
  });

  it("throws when both attempts fail", async () => {
    await writeShim(`echo '{"type":"result","is_error":true,"result":"boom"}'`);
    await expect(claudeStructured(Schema, { prompt: "p", cwd: dir, label: "test" })).rejects.toThrow(/boom/);
  });
});
