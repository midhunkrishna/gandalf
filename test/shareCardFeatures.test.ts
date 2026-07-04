import { describe, expect, it } from "vitest";
import type { ContractChange, LessonBundle, PatternFinding, TraceCard } from "../src/core/schemas.ts";
import {
  buildCardContent,
  buildComplexityFeature,
  buildExcerpt,
  clip,
  pickContract,
  pickPattern,
  pickTrace,
} from "../web/src/components/share/features.ts";
import { contractAnchor } from "../web/src/lib/router.ts";

const TIERED = { eli5: "", junior: "", senior: "", architect: "" };

const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
 const c = 4;
`;

function file(path: string, module: string, withBeacon = true): LessonBundle["files"][number] {
  return {
    path,
    module,
    language: "typescript",
    status: "modified",
    unifiedDiff: DIFF,
    beforeBlob: null,
    afterBlob: null,
    tldr: { before: "was", now: `now ${path}`, behaviorChanged: "no" },
    beacons: withBeacon ? [{ startLine: 1, endLine: 3, note: "the beacon" }] : [],
  };
}

function lesson(overrides: Partial<LessonBundle> = {}): LessonBundle {
  return {
    meta: {
      id: "l1",
      title: "A lesson",
      fromRef: "aaaa",
      toRef: "bbbb",
      ticketId: null,
      createdAt: "2026-07-02T00:00:00Z",
      hypothesis: "hyp",
      summary: "the summary",
      verdict: "refactor-only",
      breakingCount: 0,
    },
    files: [],
    contracts: [],
    graph: { nodes: [], edges: [], rippleTargets: [] },
    dataflow: { mermaid: "", sankey: null, narrative: { before: "", after: "" } },
    complexity: {
      perFunction: [],
      scorecard: { deltaCyclomatic: 0, deltaCognitive: 0, deltaNesting: 0, deltaLoc: 0 },
      hotspots: [],
      coupling: [],
    },
    patterns: { detected: [], adr: null },
    behavioral: { verdict: "refactor-only", conditionalEquivalence: "", traceCards: [], workedExample: null, ripple: [] },
    explanations: { behavioral: TIERED, dependency: TIERED, contract: TIERED, dataflow: TIERED },
    retrieval: { questions: [] },
    ...overrides,
  };
}

function trace(overrides: Partial<TraceCard> = {}): TraceCard {
  return {
    input: "x = 1",
    beforeOutput: "1",
    afterOutput: "1",
    divergentState: [],
    gwt: "given when then",
    safety: "safe",
    prediction: null,
    illustrative: true,
    ...overrides,
  };
}

function contract(overrides: Partial<ContractChange> = {}): ContractChange {
  return {
    file: "src/a.ts",
    symbol: "f",
    kind: "func",
    beforeSig: "f(a)",
    afterSig: "f(a, b)",
    changeType: "modified",
    safety: "safe",
    preconditionDelta: null,
    postconditionDelta: null,
    beaconLines: [],
    ...overrides,
  };
}

function finding(overrides: Partial<PatternFinding> = {}): PatternFinding {
  return {
    name: "Strategy",
    kind: "pattern",
    status: "present",
    evidenceLines: [],
    confidence: "low",
    note: "a note",
    ...overrides,
  };
}

const ALL_VISIBLE = () => true;

describe("clip", () => {
  it("returns short strings untouched", () => {
    expect(clip("hello", 10)).toBe("hello");
  });
  it("truncates on a word boundary with an ellipsis", () => {
    const out = clip("one two three four five", 12);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(13);
    expect(out).toBe("one two…");
  });
});

describe("pickTrace", () => {
  it("returns null on empty", () => {
    expect(pickTrace([])).toBeNull();
  });
  it("prefers a breaking trace over a safe one", () => {
    const breaking = trace({ safety: "breaking", input: "winner" });
    expect(pickTrace([trace(), breaking])).toBe(breaking);
  });
  it("prefers divergent state and changed output among same-safety traces", () => {
    const rich = trace({
      divergentState: [{ name: "s", before: "0", after: "1" }],
      afterOutput: "2",
    });
    expect(pickTrace([trace(), rich])).toBe(rich);
  });
});

describe("pickContract", () => {
  it("returns null on empty", () => {
    expect(pickContract([], null)).toBeNull();
  });
  it("ranks breaking above unknown above safe", () => {
    const safe = contract();
    const unknown = contract({ symbol: "g", safety: "unknown" });
    const breaking = contract({ symbol: "h", safety: "breaking" });
    expect(pickContract([safe, unknown, breaking], null)).toBe(breaking);
    expect(pickContract([safe, unknown], null)).toBe(unknown);
  });
  it("honors a matching anchor over ranking", () => {
    const safe = contract({ symbol: "anchored" });
    const breaking = contract({ symbol: "h", safety: "breaking" });
    expect(pickContract([safe, breaking], contractAnchor(safe))).toBe(safe);
  });
  it("falls through to ranking on a stale anchor", () => {
    const breaking = contract({ symbol: "h", safety: "breaking" });
    expect(pickContract([contract(), breaking], "src/gone.ts::vanished")).toBe(breaking);
  });
});

describe("pickPattern", () => {
  it("prefers introduced/removed findings over pre-existing ones", () => {
    const present = finding({ confidence: "high" });
    const added = finding({ name: "Observer", status: "added" });
    expect(pickPattern([present, added])).toBe(added);
  });
  it("breaks ties by confidence", () => {
    const low = finding({ status: "added" });
    const high = finding({ name: "Observer", status: "added", confidence: "high" });
    expect(pickPattern([low, high])).toBe(high);
  });
  it("returns null on empty", () => {
    expect(pickPattern([])).toBeNull();
  });
});

describe("buildComplexityFeature", () => {
  const fn = (file: string, cogBefore: number | null, cogAfter: number | null) => ({
    file,
    symbol: `f@${file}`,
    cyclomaticBefore: null,
    cyclomaticAfter: null,
    cognitiveBefore: cogBefore,
    cognitiveAfter: cogAfter,
    nestingBefore: null,
    nestingAfter: null,
    locBefore: null,
    locAfter: null,
  });

  it("computes the scorecard from visible files only", () => {
    const l = lesson({
      complexity: {
        perFunction: [fn("src/a.ts", 10, 4), fn("package-lock.json", 100, 0)],
        scorecard: { deltaCyclomatic: 0, deltaCognitive: 0, deltaNesting: 0, deltaLoc: 0 },
        hotspots: [],
        coupling: [],
      },
    });
    const f = buildComplexityFeature(l, (p) => p === "src/a.ts");
    expect(f).not.toBeNull();
    expect(f!.scorecard.deltaCognitive).toBe(-6);
    expect(f!.movers.map((m) => m.file)).toEqual(["src/a.ts"]);
  });

  it("returns null when everything is zero", () => {
    const l = lesson({
      complexity: {
        perFunction: [fn("src/a.ts", 5, 5)],
        scorecard: { deltaCyclomatic: 0, deltaCognitive: 0, deltaNesting: 0, deltaLoc: 0 },
        hotspots: [],
        coupling: [],
      },
    });
    expect(buildComplexityFeature(l, ALL_VISIBLE)).toBeNull();
  });

  it("falls back to the precomputed scorecard when the filter empties perFunction", () => {
    const l = lesson({
      complexity: {
        perFunction: [fn("package-lock.json", 3, 9)],
        scorecard: { deltaCyclomatic: 2, deltaCognitive: 0, deltaNesting: 0, deltaLoc: 0 },
        hotspots: [],
        coupling: [],
      },
    });
    const f = buildComplexityFeature(l, () => false);
    expect(f).not.toBeNull();
    expect(f!.scorecard.deltaCyclomatic).toBe(2);
    expect(f!.movers).toEqual([]);
  });
});

describe("buildExcerpt preferPath", () => {
  it("biases to an exact file path", async () => {
    const l = lesson({ files: [file("src/a.ts", "Core"), file("src/b.ts", "App")] });
    const e = await buildExcerpt(l, false, "src/b.ts");
    expect(e?.file.path).toBe("src/b.ts");
  });
  it("biases to a module name", async () => {
    const l = lesson({ files: [file("src/a.ts", "Core"), file("src/b.ts", "App")] });
    const e = await buildExcerpt(l, false, "App");
    expect(e?.file.path).toBe("src/b.ts");
  });
  it("falls back to the full pool when nothing matches", async () => {
    const l = lesson({ files: [file("src/a.ts", "Core")] });
    const e = await buildExcerpt(l, false, "no/such/file.ts");
    expect(e?.file.path).toBe("src/a.ts");
  });
});

describe("buildCardContent", () => {
  const ctx = { dark: false, visible: ALL_VISIBLE };

  it("features the tab's content when it has data", async () => {
    const l = lesson({
      behavioral: {
        verdict: "behavioral",
        conditionalEquivalence: "equivalent unless x < 0",
        traceCards: [trace()],
        workedExample: null,
        ripple: [],
      },
    });
    const c = await buildCardContent(l, { tab: "behavioral", node: null, contract: null }, ctx);
    expect(c.feature.kind).toBe("trace");
    expect(c.lead).toBe("equivalent unless x < 0");
  });

  it("teases the first recall question, answer hidden", async () => {
    const l = lesson({
      retrieval: {
        questions: [
          { prompt: "Why?", answer: "Because.", lens: "contract", evidence: [] },
          { prompt: "How?", answer: "So.", lens: "dataflow", evidence: [] },
        ],
      },
    });
    const c = await buildCardContent(l, { tab: "recall", node: null, contract: null }, ctx);
    expect(c.feature.kind).toBe("recall");
    if (c.feature.kind === "recall") {
      expect(c.feature.question.prompt).toBe("Why?");
      expect(c.feature.total).toBe(2);
    }
    expect(c.headerRight).toContain("question 1/2");
  });

  it("falls back to the diff excerpt when the tab has no data", async () => {
    const l = lesson({ files: [file("src/a.ts", "Core")] });
    const c = await buildCardContent(l, { tab: "contract", node: null, contract: null }, ctx);
    expect(c.feature.kind).toBe("excerpt");
  });

  it("falls back to the summary frame on an empty bundle", async () => {
    const c = await buildCardContent(lesson(), { tab: "patterns", node: null, contract: null }, ctx);
    expect(c.feature.kind).toBe("summary");
    expect(c.lead).toBe("the summary");
  });

  it("biases the dependency tab's excerpt to the selected node", async () => {
    const l = lesson({ files: [file("src/a.ts", "Core"), file("src/b.ts", "App")] });
    const c = await buildCardContent(l, { tab: "dependency", node: "src/b.ts", contract: null }, ctx);
    expect(c.feature.kind).toBe("excerpt");
    if (c.feature.kind === "excerpt") expect(c.feature.excerpt.file.path).toBe("src/b.ts");
    expect(c.headerRight).toBe("src/b.ts");
  });
});
