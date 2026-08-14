import { normalizeModule, moduleKind } from "./modules.ts";
import type { LessonBundle, ModuleGraphDelta, GraphNode } from "./schemas.ts";

/**
 * Cross-section referential-integrity checks for a lesson bundle.
 *
 * The synthesis passes are independent Claude calls, so nothing structurally
 * guarantees that, e.g., a graph node's `module` matches the deterministic
 * `file.module` taxonomy the viewer joins on. These checks catch that class of
 * drift at generation time (and via `gandalf doctor` for stored lessons).
 */
export interface ValidationIssue {
  severity: "error" | "warning";
  section: string;
  message: string;
}

const MERMAID_TYPES = [
  "sequenceDiagram",
  "flowchart",
  "graph",
  "classDiagram",
  "stateDiagram",
  "erDiagram",
  "journey",
];

const stem = (p: string) => p.split("/").pop()!.replace(/\.[^.]+$/, "");

export function validateLesson(lesson: LessonBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (section: string, message: string) => issues.push({ severity: "error", section, message });
  const warn = (section: string, message: string) => issues.push({ severity: "warning", section, message });

  const files = lesson.files;
  const paths = new Set(files.map((f) => f.path));

  // ---- graph: every changed node must resolve to a file (mirrors the viewer's fallback chain) ----
  const resolves = (node: { id: string; module: string }) =>
    files.some(
      (f) =>
        f.path === node.module ||
        stem(f.path) === node.id ||
        f.path.startsWith(`${node.module}/`) ||
        f.module === node.module ||
        f.module === normalizeModule(node.module),
    );
  const nodeIds = new Set(lesson.graph.nodes.map((n) => n.id));
  for (const n of lesson.graph.nodes) {
    if (n.status !== "unchanged" && !resolves(n)) {
      err("graph", `changed node "${n.id}" (module "${n.module}") resolves to no file — its sidebar will be empty`);
    }
  }
  for (const e of lesson.graph.edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
      warn("graph", `edge ${e.from} → ${e.to} references a node that isn't in the graph`);
    }
  }
  for (const t of lesson.graph.rippleTargets) {
    const known = nodeIds.has(t) || lesson.graph.nodes.some((n) => n.module === t);
    if (!known) warn("graph", `rippleTarget "${t}" matches no node id or module`);
  }

  // ---- contracts reference real files ----
  for (const c of lesson.contracts) {
    if (!paths.has(c.file)) err("contracts", `contract ${c.symbol} references unknown file ${c.file}`);
  }

  // ---- beacons stay within the after-file ----
  for (const f of files) {
    if (!f.afterBlob) continue;
    const lineCount = f.afterBlob.split("\n").length;
    for (const b of f.beacons) {
      if (b.startLine > b.endLine) {
        warn("beacons", `${f.path}: beacon ${b.startLine}–${b.endLine} is inverted`);
      } else if (b.endLine > lineCount) {
        warn("beacons", `${f.path}: beacon ${b.startLine}–${b.endLine} runs past EOF (${lineCount} lines)`);
      }
    }
  }

  // ---- dataflow ----
  // The lite profile never runs the dataflow pass, so its typed-empty section is the
  // expected shape, not drift. Every other rule below is content-driven and stays quiet
  // on the empty patterns/retrieval/explanations a lite lesson carries.
  const lite = lesson.meta.profile === "lite";
  const mermaid = lesson.dataflow.mermaid.trim();
  if (!mermaid) {
    if (!lite) warn("dataflow", "mermaid source is empty");
  } else if (!MERMAID_TYPES.some((t) => mermaid.startsWith(t))) {
    warn("dataflow", `mermaid source starts with "${mermaid.slice(0, 32)}…" — not a known diagram type`);
  }
  if (lesson.dataflow.sankey) {
    const sankeyIds = new Set(lesson.dataflow.sankey.nodes.map((n) => n.id));
    for (const l of lesson.dataflow.sankey.links) {
      if (!sankeyIds.has(l.source) || !sankeyIds.has(l.target)) {
        err("dataflow", `sankey link ${l.source} → ${l.target} references a missing sankey node`);
      }
    }
  }

  // ---- evidence lines (patterns + retrieval) point at real files ----
  for (const p of lesson.patterns.detected) {
    for (const evl of p.evidenceLines) {
      if (!paths.has(evl.file)) warn("patterns", `finding "${p.name}" cites unknown file ${evl.file}`);
    }
  }
  for (const q of lesson.retrieval?.questions ?? []) {
    for (const evl of q.evidence) {
      if (!paths.has(evl.file)) warn("retrieval", `question "${q.prompt.slice(0, 48)}…" cites unknown file ${evl.file}`);
    }
  }

  return issues;
}

/**
 * A dangling reference is only repairable if it reads like a module id at all: one
 * identifier-ish path, no whitespace and no prose (the model's failure mode is
 * "Core/X (because …)", which must be dropped rather than turned into a node).
 */
const PLAUSIBLE_ID = /^[A-Za-z0-9_@][A-Za-z0-9_.\-/]*$/;

export interface GraphRepair {
  graph: ModuleGraphDelta;
  /** One line per repair, in application order (empty when nothing was wrong). */
  actions: string[];
}

/**
 * Last line of defence for graph referential integrity, applied before a lesson is
 * persisted (and re-usable by `gandalf doctor --fix` on stored lessons).
 *
 * The node set is derived deterministically and the graph pass's schema pins edge
 * endpoints to it, so this only sees the retry path's output and older lessons:
 * a dangling endpoint that still looks like a module becomes an `unchanged` context
 * node, anything else takes its edge with it. Ripple targets are reduced to their
 * leading token before being dropped, since the model likes to append reasoning.
 */
export function repairGraph(graph: ModuleGraphDelta): GraphRepair {
  const actions: string[] = [];
  const nodes: GraphNode[] = [...graph.nodes];
  const ids = new Set(nodes.map((n) => n.id));

  const edges = graph.edges.filter((e) => {
    const label = `${e.from} → ${e.to}`;
    const missing = [...new Set([e.from, e.to])].filter((id) => !ids.has(id));
    // Decide before creating anything, so a dropped edge never leaves an orphan node.
    if (missing.some((id) => !PLAUSIBLE_ID.test(id))) {
      actions.push(`dropped edge ${label} (endpoint is not a usable module id)`);
      return false;
    }
    for (const id of missing) {
      const module = normalizeModule(id);
      nodes.push({ id, module, status: "unchanged", kind: moduleKind(module) });
      ids.add(id);
      actions.push(`added missing node "${id}" (module "${module}", status unchanged) for edge ${label}`);
    }
    return true;
  });

  const keys = new Set(nodes.flatMap((n) => [n.id, n.module]));
  const rippleTargets: string[] = [];
  for (const t of graph.rippleTargets) {
    const head = t.split(/[\s(]/, 1)[0] ?? t;
    const match = [t, head, normalizeModule(head)].find((c) => keys.has(c));
    if (match === t) {
      rippleTargets.push(t);
    } else if (match) {
      rippleTargets.push(match);
      actions.push(`rewrote rippleTarget "${t}" to "${match}"`);
    } else {
      actions.push(`dropped rippleTarget "${t}" (matches no node id or module)`);
    }
  }

  return { graph: { nodes, edges, rippleTargets }, actions };
}

export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "✓ no integrity issues";
  return issues
    .map((i) => `${i.severity === "error" ? "✗" : "⚠"} [${i.section}] ${i.message}`)
    .join("\n");
}
