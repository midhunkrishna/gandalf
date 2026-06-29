import { z } from "zod";

/**
 * The gandalf lesson data model.
 *
 * Design rules (from the plan):
 *  - One focused schema per artifact so each `claude -p` pass has a small, satisfiable contract.
 *  - Deterministic numbers (cyclomatic, churn, hotspots) come from Plane-1 tools, NOT from Claude.
 *  - Every Claude judgment carries quoted-line evidence + a confidence level.
 *  - Behavioral trace cards are illustrative (gandalf cannot execute the target code).
 */

// ---------- shared enums ----------
export const ChangeStatus = z.enum([
  "added",
  "removed",
  "modified",
  "unchanged",
  "renamed",
]);
export type ChangeStatus = z.infer<typeof ChangeStatus>;

export const Verdict = z.enum(["behavioral", "refactor-only"]);
export type Verdict = z.infer<typeof Verdict>;

export const Safety = z.enum(["safe", "breaking", "unknown"]);
export type Safety = z.infer<typeof Safety>;

export const Confidence = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof Confidence>;

export const DepthTier = z.enum(["eli5", "junior", "senior", "architect"]);
export type DepthTier = z.infer<typeof DepthTier>;

/** Audience-tiered prose: generated once, switched client-side. */
export const TieredText = z.object({
  eli5: z.string(),
  junior: z.string(),
  senior: z.string(),
  architect: z.string(),
});
export type TieredText = z.infer<typeof TieredText>;

/** A "beacon" is a focal line range that carries the change's meaning. */
export const Beacon = z.object({
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  note: z.string(),
});
export type Beacon = z.infer<typeof Beacon>;

export const EvidenceLine = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
});

// ---------- file-level ----------
export const Tldr = z.object({
  before: z.string(),
  now: z.string(),
  behaviorChanged: z.string(),
});
export type Tldr = z.infer<typeof Tldr>;

export const FileChange = z.object({
  path: z.string(),
  /** Normalized to the canonical module taxonomy (App / Features / Core engines / ...). */
  module: z.string(),
  language: z.string(),
  status: ChangeStatus,
  unifiedDiff: z.string(),
  beforeBlob: z.string().nullable().default(null),
  afterBlob: z.string().nullable().default(null),
  tldr: Tldr,
  beacons: z.array(Beacon).default([]),
});
export type FileChange = z.infer<typeof FileChange>;

// ---------- contract lens ----------
export const SymbolKind = z.enum([
  "func",
  "method",
  "protocol",
  "struct",
  "class",
  "enum",
  "property",
  "type",
  "other",
]);

export const ContractChange = z.object({
  file: z.string(),
  symbol: z.string(),
  kind: SymbolKind,
  beforeSig: z.string().nullable(),
  afterSig: z.string().nullable(),
  changeType: z.enum(["added", "removed", "modified"]),
  /** Design-by-Contract rule: weaken pre / strengthen post = safe; strengthen pre / weaken post = breaking. */
  safety: Safety,
  preconditionDelta: z.string().nullable().default(null),
  postconditionDelta: z.string().nullable().default(null),
  beaconLines: z.array(z.number().int().nonnegative()).default([]),
});
export type ContractChange = z.infer<typeof ContractChange>;

// ---------- module dependency lens ----------
export const NodeKind = z.enum([
  "app",
  "feature",
  "engine",
  "model",
  "asset",
  "test",
  "module",
]);

export const GraphNode = z.object({
  id: z.string(),
  module: z.string(),
  status: ChangeStatus,
  kind: NodeKind.default("module"),
});

export const EdgeKind = z.enum(["imports", "conforms", "uses", "injects"]);

export const GraphEdge = z.object({
  from: z.string(),
  to: z.string(),
  kind: EdgeKind,
  status: ChangeStatus,
});

export const ModuleGraphDelta = z.object({
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  /** Modules likely needing a corresponding change (downstream of the diff). */
  rippleTargets: z.array(z.string()).default([]),
});
export type ModuleGraphDelta = z.infer<typeof ModuleGraphDelta>;

// ---------- data flow lens ----------
export const SankeyNode = z.object({ id: z.string(), label: z.string().optional() });
export const SankeyLink = z.object({
  source: z.string(),
  target: z.string(),
  value: z.number().positive(),
  label: z.string().optional(),
});
export const DataFlow = z.object({
  /** Mermaid sequence-diagram source. */
  mermaid: z.string(),
  sankey: z
    .object({ nodes: z.array(SankeyNode), links: z.array(SankeyLink) })
    .nullable()
    .default(null),
  narrative: z.object({ before: z.string(), after: z.string() }),
});
export type DataFlow = z.infer<typeof DataFlow>;

// ---------- complexity ----------
export const FnComplexity = z.object({
  file: z.string(),
  symbol: z.string(),
  cyclomaticBefore: z.number().nullable(),
  cyclomaticAfter: z.number().nullable(),
  cognitiveBefore: z.number().nullable(),
  cognitiveAfter: z.number().nullable(),
  nestingBefore: z.number().nullable(),
  nestingAfter: z.number().nullable(),
  locBefore: z.number().nullable(),
  locAfter: z.number().nullable(),
});
export type FnComplexity = z.infer<typeof FnComplexity>;

export const Hotspot = z.object({
  path: z.string(),
  churn: z.number(),
  changeCount: z.number().int(),
  complexity: z.number().nullable(),
  score: z.number(),
});
export type Hotspot = z.infer<typeof Hotspot>;

export const Coupling = z.object({
  a: z.string(),
  b: z.string(),
  pct: z.number(),
  together: z.number().int(),
});
export type Coupling = z.infer<typeof Coupling>;

export const Complexity = z.object({
  perFunction: z.array(FnComplexity).default([]),
  scorecard: z.object({
    deltaCyclomatic: z.number(),
    deltaCognitive: z.number(),
    deltaNesting: z.number(),
    deltaLoc: z.number(),
  }),
  hotspots: z.array(Hotspot).default([]),
  coupling: z.array(Coupling).default([]),
});
export type Complexity = z.infer<typeof Complexity>;

// ---------- patterns / alternatives ----------
export const PatternFinding = z.object({
  name: z.string(),
  kind: z.enum(["pattern", "smell", "architecture"]),
  status: z.enum(["added", "removed", "present"]),
  evidenceLines: z.array(EvidenceLine).default([]),
  confidence: Confidence,
  note: z.string(),
});
export type PatternFinding = z.infer<typeof PatternFinding>;

export const AdrOption = z.object({
  name: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  bestWhen: z.string(),
});
export const Adr = z.object({
  title: z.string(),
  context: z.string(),
  decision: z.string(),
  consequences: z.array(z.string()),
  options: z.array(AdrOption).default([]),
});
export type Adr = z.infer<typeof Adr>;

export const Patterns = z.object({
  detected: z.array(PatternFinding).default([]),
  adr: Adr.nullable().default(null),
});
export type Patterns = z.infer<typeof Patterns>;

// ---------- behavioral lens ----------
export const TraceCard = z.object({
  input: z.string(),
  beforeOutput: z.string(),
  afterOutput: z.string(),
  divergentState: z
    .array(z.object({ name: z.string(), before: z.string(), after: z.string() }))
    .default([]),
  /** Given-When-Then caption. */
  gwt: z.string(),
  safety: Safety,
  /**
   * Predict-then-reveal prompt: the reader guesses before `afterOutput` is shown.
   * `distractors` = up to 2 plausible-but-wrong after-outputs → multiple choice;
   * empty → free-text "think, then reveal". The correct answer is always `afterOutput`.
   */
  prediction: z
    .object({ question: z.string(), distractors: z.array(z.string()).default([]) })
    .nullable()
    .default(null),
  /** Honesty flag: traces are reasoned from code, not executed. */
  illustrative: z.literal(true).default(true),
});
export type TraceCard = z.infer<typeof TraceCard>;

export const Behavioral = z.object({
  verdict: Verdict,
  conditionalEquivalence: z.string(),
  traceCards: z.array(TraceCard).default([]),
  workedExample: z.string().nullable().default(null),
  ripple: z
    .array(z.object({ symbol: z.string(), callers: z.array(z.string()) }))
    .default([]),
});
export type Behavioral = z.infer<typeof Behavioral>;

// ---------- explanations (per-lens, tiered) ----------
export const Explanations = z.object({
  behavioral: TieredText,
  dependency: TieredText,
  contract: TieredText,
  dataflow: TieredText,
});
export type Explanations = z.infer<typeof Explanations>;

// ---------- retrieval practice (active recall) ----------
/** A free-recall/cued question testing a durable takeaway, with a model answer + grounding. */
export const RetrievalQuestion = z.object({
  prompt: z.string(),
  answer: z.string(),
  /** Lens this question belongs to (behavioral / dependency / contract / dataflow / complexity / patterns). */
  lens: z.string(),
  evidence: z.array(EvidenceLine).default([]),
});
export type RetrievalQuestion = z.infer<typeof RetrievalQuestion>;

export const Retrieval = z.object({
  questions: z.array(RetrievalQuestion).default([]),
});
export type Retrieval = z.infer<typeof Retrieval>;

// ---------- lesson meta + bundle ----------
export const LessonMeta = z.object({
  id: z.string(),
  title: z.string(),
  fromRef: z.string(),
  toRef: z.string(),
  ticketId: z.string().nullable().default(null),
  createdAt: z.string(),
  hypothesis: z.string(),
  summary: z.string(),
  verdict: Verdict,
  breakingCount: z.number().int().nonnegative(),
});
export type LessonMeta = z.infer<typeof LessonMeta>;

export const LessonBundle = z.object({
  meta: LessonMeta,
  files: z.array(FileChange),
  contracts: z.array(ContractChange).default([]),
  graph: ModuleGraphDelta,
  dataflow: DataFlow,
  complexity: Complexity,
  patterns: Patterns,
  behavioral: Behavioral,
  explanations: Explanations,
  // Optional so lessons generated before Phase 5 still parse.
  retrieval: Retrieval.default({ questions: [] }),
});
export type LessonBundle = z.infer<typeof LessonBundle>;

// ========================================================================
// Claude-pass output schemas (each `claude -p` call validates against one).
// Kept small/focused so the model reliably satisfies them.
// ========================================================================

/** Per-file pass: Claude reads one changed file + its diff and the evidence row. */
export const FilePassResult = z.object({
  tldr: Tldr,
  beacons: z.array(Beacon).default([]),
  contracts: z.array(ContractChange).default([]),
  /** Cognitive-complexity estimate per changed function (anchored by lizard's cyclomatic). */
  cognitive: z
    .array(
      z.object({
        symbol: z.string(),
        cognitiveBefore: z.number().nullable(),
        cognitiveAfter: z.number().nullable(),
      }),
    )
    .default([]),
});
export type FilePassResult = z.infer<typeof FilePassResult>;

/**
 * Synthesis is split into focused parallel passes (lower latency + smaller, more
 * reliably-satisfiable contracts per call). Each pass validates against one schema:
 *  - SynthNarrative  → title/hypothesis/summary
 *  - ModuleGraphDelta → graph
 *  - DataFlow        → dataflow
 *  - Patterns        → patterns
 *  - Behavioral      → behavioral (its `verdict` is the lesson-level verdict)
 *  - Explanations    → per-lens tiered prose
 */
export const SynthNarrative = z.object({
  title: z.string(),
  hypothesis: z.string(),
  summary: z.string(),
});
export type SynthNarrative = z.infer<typeof SynthNarrative>;

/** Legacy monolithic synthesis shape — retained for reference; pipeline now fans out the passes above. */
export const SynthesisResult = z.object({
  title: z.string(),
  hypothesis: z.string(),
  summary: z.string(),
  verdict: Verdict,
  graph: ModuleGraphDelta,
  dataflow: DataFlow,
  patterns: Patterns,
  behavioral: Behavioral,
  explanations: Explanations,
});
export type SynthesisResult = z.infer<typeof SynthesisResult>;
