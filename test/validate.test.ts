import { describe, expect, it } from "vitest";
import { validateLesson } from "../src/core/validate.ts";
import { LessonBundle } from "../src/core/schemas.ts";

const tier = { eli5: "a", junior: "b", senior: "c", architect: "d" };

function mkLesson(overrides: Record<string, unknown> = {}): LessonBundle {
  return LessonBundle.parse({
    meta: {
      id: "t-1",
      title: "t",
      fromRef: "a",
      toRef: "b",
      ticketId: null,
      createdAt: new Date().toISOString(),
      hypothesis: "h",
      summary: "s",
      verdict: "behavioral",
      breakingCount: 0,
    },
    files: [
      {
        path: "Features/ExportFeature/ExportView.swift",
        module: "Features/Export",
        language: "swift",
        status: "added",
        unifiedDiff: "",
        beforeBlob: null,
        afterBlob: "line1\nline2\nline3",
        tldr: { before: "x", now: "y", behaviorChanged: "z" },
        beacons: [],
      },
    ],
    contracts: [],
    graph: { nodes: [], edges: [], rippleTargets: [] },
    dataflow: { mermaid: "sequenceDiagram\nA->>B: hi", sankey: null, narrative: { before: "b", after: "a" } },
    complexity: {
      perFunction: [],
      scorecard: { deltaCyclomatic: 0, deltaCognitive: 0, deltaNesting: 0, deltaLoc: 0 },
      hotspots: [],
      coupling: [],
    },
    patterns: { detected: [], adr: null },
    behavioral: { verdict: "behavioral", conditionalEquivalence: "c", traceCards: [], workedExample: null, ripple: [] },
    explanations: { behavioral: tier, dependency: tier, contract: tier, dataflow: tier },
    retrieval: { questions: [] },
    ...overrides,
  });
}

const errorsOf = (issues: ReturnType<typeof validateLesson>) => issues.filter((i) => i.severity === "error");

describe("validateLesson", () => {
  it("passes a consistent lesson", () => {
    const lesson = mkLesson({
      graph: {
        nodes: [{ id: "ExportFeature", module: "Features/ExportFeature", status: "added", kind: "feature" }],
        edges: [],
        rippleTargets: [],
      },
    });
    // resolves via path prefix / normalized module despite taxonomy drift
    expect(errorsOf(validateLesson(lesson))).toEqual([]);
  });

  it("errors when a changed node resolves to no file", () => {
    const lesson = mkLesson({
      graph: {
        nodes: [{ id: "Ghost", module: "Nowhere/Ghost", status: "added", kind: "module" }],
        edges: [],
        rippleTargets: [],
      },
    });
    const errors = errorsOf(validateLesson(lesson));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.section).toBe("graph");
  });

  it("does not flag unchanged context nodes", () => {
    const lesson = mkLesson({
      graph: {
        nodes: [{ id: "CoreModels", module: "CoreModels", status: "unchanged", kind: "model" }],
        edges: [],
        rippleTargets: [],
      },
    });
    expect(validateLesson(lesson).filter((i) => i.section === "graph")).toEqual([]);
  });

  it("warns on edges and rippleTargets that reference missing nodes", () => {
    const lesson = mkLesson({
      graph: {
        nodes: [{ id: "A", module: "Features/ExportFeature", status: "added", kind: "module" }],
        edges: [{ from: "A", to: "Missing", kind: "imports", status: "added" }],
        rippleTargets: ["Core/RenderEngine (because reasons)"],
      },
    });
    const graphWarnings = validateLesson(lesson).filter((i) => i.section === "graph" && i.severity === "warning");
    expect(graphWarnings).toHaveLength(2);
  });

  it("errors on contracts referencing unknown files", () => {
    const lesson = mkLesson({
      contracts: [
        {
          file: "Not/A/File.swift",
          symbol: "f()",
          kind: "func",
          changeType: "added",
          safety: "safe",
          beforeSig: null,
          afterSig: "func f()",
          preconditionDelta: null,
          postconditionDelta: null,
          beaconLines: [],
        },
      ],
    });
    expect(errorsOf(validateLesson(lesson)).map((i) => i.section)).toContain("contracts");
  });

  it("warns on beacons running past EOF", () => {
    const lesson = mkLesson();
    lesson.files[0]!.beacons = [{ startLine: 2, endLine: 99, note: "n" }];
    const warnings = validateLesson(lesson).filter((i) => i.section === "beacons");
    expect(warnings).toHaveLength(1);
  });

  it("errors on sankey links referencing missing nodes", () => {
    const lesson = mkLesson({
      dataflow: {
        mermaid: "sequenceDiagram",
        sankey: { nodes: [{ id: "a" }], links: [{ source: "a", target: "ghost", value: 1 }] },
        narrative: { before: "b", after: "a" },
      },
    });
    expect(errorsOf(validateLesson(lesson)).map((i) => i.section)).toContain("dataflow");
  });
});
