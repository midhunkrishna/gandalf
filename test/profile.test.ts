import { describe, expect, it } from "vitest";
import { resolveProfile } from "../src/core/config.ts";
import { liteFileModel } from "../src/core/pipeline.ts";
import { synthLiteSchema } from "../src/core/schemas.ts";
import type { Hotspot } from "../src/core/schemas.ts";

/**
 * The lite profile's three deterministic decisions: which profile a command runs,
 * which model each file pass gets, and what the merged pass is allowed to return.
 * All pure, with no claude calls.
 */

describe("resolveProfile", () => {
  it("prefers the flag over config and the command default", () => {
    expect(resolveProfile({ lite: true }, "full", "full")).toBe("lite");
    expect(resolveProfile({ full: true }, "lite", "lite")).toBe("full");
  });

  it("falls back to config when no flag is given", () => {
    expect(resolveProfile({}, "lite", "full")).toBe("lite");
    expect(resolveProfile({}, "full", "lite")).toBe("full");
  });

  it("falls back to the command default when config is unset", () => {
    expect(resolveProfile({}, undefined, "full")).toBe("full"); // generate
    expect(resolveProfile({}, undefined, "lite")).toBe("lite"); // watch
  });

  it("rejects --lite and --full together", () => {
    expect(() => resolveProfile({ lite: true, full: true }, undefined, "full")).toThrow(/cannot be combined/);
  });
});

describe("liteFileModel", () => {
  const hotspot = (path: string, score: number): Hotspot => ({
    path,
    churn: 100,
    changeCount: 10,
    complexity: null,
    score,
  });
  // Ranked as the evidence bundle ranks them: highest score first.
  const hotspots = [
    hotspot("src/core/hot1.ts", 90),
    hotspot("src/core/hot2.ts", 80),
    hotspot("src/core/hot3.ts", 70),
    hotspot("src/core/warm.ts", 60),
  ];
  const diff = (changed: number) =>
    ["--- a/f.ts", "+++ b/f.ts", "@@ -1 +1 @@", ...Array.from({ length: changed }, (_, i) => `+line ${i}`)].join("\n");

  it("uses haiku for a small diff outside the top hotspots", () => {
    expect(liteFileModel({ path: "src/core/cold.ts", unifiedDiff: diff(20) }, hotspots)).toBe("haiku");
  });

  it("escalates to sonnet past 150 changed lines", () => {
    expect(liteFileModel({ path: "src/core/cold.ts", unifiedDiff: diff(150) }, hotspots)).toBe("haiku");
    expect(liteFileModel({ path: "src/core/cold.ts", unifiedDiff: diff(151) }, hotspots)).toBe("sonnet");
  });

  it("escalates to sonnet for a top-3 hotspot, but not the fourth", () => {
    expect(liteFileModel({ path: "src/core/hot3.ts", unifiedDiff: diff(3) }, hotspots)).toBe("sonnet");
    expect(liteFileModel({ path: "src/core/warm.ts", unifiedDiff: diff(3) }, hotspots)).toBe("haiku");
  });

  it("ignores the diff's ---/+++ headers when counting changed lines", () => {
    // 151 body lines would escalate; 149 plus the two headers must not.
    expect(liteFileModel({ path: "src/core/cold.ts", unifiedDiff: diff(149) }, hotspots)).toBe("haiku");
  });
});

describe("synthLiteSchema", () => {
  const schema = synthLiteSchema(["src/core", "src/server"]);
  const merged = {
    narrative: { title: "T", hypothesis: "H", summary: "S" },
    behavioral: { verdict: "behavioral", conditionalEquivalence: "unchanged except when x" },
    graph: {
      edges: [{ from: "src/core", to: "src/server", kind: "imports", status: "added" }],
      rippleTargets: ["src/server"],
    },
  };

  it("round-trips the three merged sections, defaulting the optional fields", () => {
    const parsed = schema.parse(merged);
    expect(parsed.narrative.title).toBe("T");
    expect(parsed.behavioral.traceCards).toEqual([]);
    expect(parsed.behavioral.workedExample).toBeNull();
    expect(parsed.graph.edges).toHaveLength(1);
  });

  it("keeps the graph's per-run node enum", () => {
    const bad = schema.safeParse({
      ...merged,
      graph: { edges: [{ from: "src/core", to: "Nowhere", kind: "imports", status: "added" }], rippleTargets: [] },
    });
    expect(bad.success).toBe(false);
  });

  it("rejects a missing load-bearing section", () => {
    const { behavioral: _dropped, ...withoutBehavioral } = merged;
    expect(schema.safeParse(withoutBehavioral).success).toBe(false);
  });
});
