import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  ensureConfig,
  configPath,
  gandalfHome,
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_YAML,
} from "../src/core/config.ts";

let home: string;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "gandalf-config-"));
  process.env.GANDALF_HOME_DIR = home;
});

afterEach(async () => {
  delete process.env.GANDALF_HOME_DIR;
  await rm(home, { recursive: true, force: true });
});

describe("gandalfHome / configPath", () => {
  it("respects GANDALF_HOME_DIR", () => {
    expect(gandalfHome()).toBe(home);
    expect(configPath()).toBe(join(home, "config.yaml"));
  });
});

describe("loadConfig", () => {
  it("returns documented defaults when the file is absent", async () => {
    const { config, warnings } = await loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(config.lesson_location).toBe("home-dir");
    expect(warnings).toEqual([]);
  });

  it("parses a valid YAML config", async () => {
    await mkdir(home, { recursive: true });
    await writeFile(configPath(), 'lesson_location: "project-wd"\n');
    const { config, warnings } = await loadConfig();
    expect(config.lesson_location).toBe("project-wd");
    expect(warnings).toEqual([]);
  });

  it("leaves generation_profile unset unless the file sets it", async () => {
    const absent = await loadConfig();
    expect(absent.config.generation_profile).toBeUndefined();
    await mkdir(home, { recursive: true });
    await writeFile(configPath(), 'generation_profile: "lite"\n');
    const { config, warnings } = await loadConfig();
    expect(config.generation_profile).toBe("lite");
    expect(warnings).toEqual([]);
  });

  it("warns on unknown keys without failing", async () => {
    await mkdir(home, { recursive: true });
    await writeFile(configPath(), 'lesson_location: "project-wd"\nfuture_key: 42\n');
    const { config, warnings } = await loadConfig();
    expect(config.lesson_location).toBe("project-wd");
    expect(warnings.some((w) => w.includes('unknown key "future_key"'))).toBe(true);
  });

  it("salvages the rest of the file when one key has a bad value", async () => {
    await mkdir(home, { recursive: true });
    await writeFile(configPath(), 'lesson_location: "attic"\n');
    const { config, warnings } = await loadConfig();
    expect(config.lesson_location).toBe("home-dir"); // bad value -> that key's default
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("degrades to defaults on unparseable YAML, with a warning", async () => {
    await mkdir(home, { recursive: true });
    await writeFile(configPath(), "lesson_location: [unclosed\n  - :::");
    const { config, warnings } = await loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnings.some((w) => w.includes("not valid YAML"))).toBe(true);
  });
});

describe("ensureConfig", () => {
  it("creates ~/.gandalf and writes the self-documenting template", async () => {
    const first = await ensureConfig();
    expect(first.created).toBe(true);
    const written = await readFile(first.path, "utf8");
    expect(written).toBe(DEFAULT_CONFIG_YAML);
    expect(written).toContain("lesson_location");
    expect(written.split("\n").some((l) => l.trimStart().startsWith("#"))).toBe(true);
  });

  it("never overwrites an existing config", async () => {
    await mkdir(home, { recursive: true });
    await writeFile(configPath(), "# my customized config\nlesson_location: \"project-wd\"\n");
    const result = await ensureConfig();
    expect(result.created).toBe(false);
    expect(await readFile(configPath(), "utf8")).toContain("my customized config");
  });
});
