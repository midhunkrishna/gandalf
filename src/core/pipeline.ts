import {
  WORKTREE,
  resolveRef,
  listChangedFiles,
  unifiedDiff,
  blobAt,
} from "./git.ts";
import { buildEvidence, deriveGraphNodes, evidenceForFile, type EvidenceBundle } from "./evidence.ts";
import { normalizeModule, languageOf } from "./modules.ts";
import { classifyPath, isFormattingOnly, isPermanentIgnore } from "./noise.ts";
import { loadTickets, matchTicket, ticketIntent } from "./tickets.ts";
import { claudeStructured, type ClaudeOptions, type ModelAlias } from "./claude.ts";
import {
  filePassPrompt,
  liteSynthesisPrompt,
  synthesisPrompts,
  type Built,
  type PerFileSummary,
} from "./prompts.ts";
import { validateLesson, formatIssues, repairGraph } from "./validate.ts";
import {
  FilePassResult,
  SynthNarrative,
  graphPassSchema,
  synthLiteSchema,
  DataFlow,
  Patterns,
  Behavioral,
  Explanations,
  Retrieval,
  LessonBundle,
  type FileChange,
  type Complexity,
  type FnComplexity,
  type ContractChange,
  type GenerationProfile,
  type GraphNode,
  type GraphPassResult,
  type Hotspot,
} from "./schemas.ts";

export interface GenerateOptions {
  cwd: string;
  fromRef?: string;
  toRef?: string;
  ticketId?: string;
  modelFile?: ModelAlias;
  modelSynth?: ModelAlias;
  concurrency?: number;
  /** Generation profile; defaults to "full" (the behavior that predates profiles). */
  profile?: GenerationProfile;
  onProgress?: (msg: string) => void;
}

/** Run async `fn` over `items` with a concurrency cap, preserving order. */
async function mapLimit<A, B>(items: A[], limit: number, fn: (a: A, i: number) => Promise<B>): Promise<B[]> {
  const out = new Array<B>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

function evidenceSummary(ev: EvidenceBundle): string {
  const lines: string[] = [];
  lines.push(`tools: scc=${ev.tools.scc} lizard=${ev.tools.lizard} swiftlint=${ev.tools.swiftlint}`);
  if (ev.hotspots.length) {
    lines.push("topHotspots (changeCount × complexity):");
    for (const h of ev.hotspots.slice(0, 8)) {
      lines.push(`  ${h.path} — score=${h.score.toFixed(1)} commits=${h.changeCount} churn=${h.churn} ccn=${h.complexity ?? "?"}`);
    }
  }
  if (ev.coupling.length) {
    lines.push("topChangeCoupling:");
    for (const c of ev.coupling.slice(0, 8)) {
      lines.push(`  ${c.a} ↔ ${c.b} — ${c.pct}% (${c.together}x)`);
    }
  }
  return lines.join("\n");
}

function assembleComplexity(
  files: FileChange[],
  cognitiveByFile: Map<string, FilePassResult["cognitive"]>,
  ev: EvidenceBundle,
): Complexity {
  const perFunction: FnComplexity[] = [];
  for (const f of files) {
    const cog = cognitiveByFile.get(f.path) ?? [];
    const fm = ev.fileMetrics[f.path];
    const fmBefore = ev.fileMetricsBefore[f.path];
    for (const c of cog) {
      const match = (x: { symbol: string }) => x.symbol === c.symbol || x.symbol.endsWith(c.symbol);
      const afterFn = fm?.functions.find(match);
      const beforeFn = fmBefore?.functions.find(match);
      perFunction.push({
        file: f.path,
        symbol: c.symbol,
        cyclomaticBefore: beforeFn ? beforeFn.cyclomatic : null,
        cyclomaticAfter: afterFn ? afterFn.cyclomatic : null,
        cognitiveBefore: c.cognitiveBefore,
        cognitiveAfter: c.cognitiveAfter,
        // lizard doesn't measure nesting depth — left null rather than faked.
        nestingBefore: null,
        nestingAfter: null,
        locBefore: beforeFn ? beforeFn.nloc : null,
        locAfter: afterFn ? afterFn.nloc : null,
      });
    }
  }
  const sum = (sel: (p: FnComplexity) => number | null) =>
    perFunction.reduce((acc, p) => acc + (sel(p) ?? 0), 0);
  return {
    perFunction,
    scorecard: {
      deltaCyclomatic: sum((p) => p.cyclomaticAfter) - sum((p) => p.cyclomaticBefore),
      deltaCognitive: sum((p) => p.cognitiveAfter) - sum((p) => p.cognitiveBefore),
      deltaNesting: sum((p) => p.nestingAfter) - sum((p) => p.nestingBefore),
      deltaLoc: sum((p) => p.locAfter) - sum((p) => p.locBefore),
    },
    hotspots: ev.hotspots,
    coupling: ev.coupling,
  };
}

const COLLAPSED_TLDR = {
  before: "Collapsed: generated/lockfile/binary or formatting-only change.",
  now: "No semantic change to teach.",
  behaviorChanged: "None.",
} as const;

// ---------- lite profile ----------
// Lite trades depth for volume: haiku file passes (escalating on heavy files) and ONE
// merged sonnet synthesis pass instead of seven opus passes. Everything deterministic
// (contracts, beacons, TLDRs, complexity, the graph's node set) is unaffected.

/** A file above this many changed diff lines earns a sonnet pass in lite. */
const LITE_HEAVY_DIFF_LINES = 150;
/** …so does a file among the evidence bundle's top hotspots. */
const LITE_HOTSPOT_TOP_N = 3;

const LITE_SKIPPED = "Not generated in the lite profile. Re-run with --full for this lens.";

/** Lines a unified diff adds or removes, ignoring its ---/+++ headers. */
function changedLineCount(diff: string): number {
  let n = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+") || line.startsWith("-")) n += 1;
  }
  return n;
}

/**
 * Per-file model for the lite profile: haiku, escalating to sonnet where the file is
 * heavy enough to be worth it. Both signals are already computed, so the decision is
 * deterministic and costs no extra Claude call.
 */
export function liteFileModel(
  file: { path: string; unifiedDiff: string },
  hotspots: Hotspot[],
): ModelAlias {
  if (changedLineCount(file.unifiedDiff) > LITE_HEAVY_DIFF_LINES) return "sonnet";
  const top = hotspots.slice(0, LITE_HOTSPOT_TOP_N);
  return top.some((h) => h.path === file.path) ? "sonnet" : "haiku";
}

/** Everything a lesson needs out of synthesis, whichever profile produced it. */
interface SynthSections {
  narrative: SynthNarrative;
  behavioral: Behavioral;
  /** Edges + ripple targets only; the nodes are deterministic (deriveGraphNodes). */
  graphPass: GraphPassResult;
  dataflow: DataFlow;
  patterns: Patterns;
  explanations: Explanations;
  retrieval: Retrieval;
}

interface SynthContext {
  summaries: PerFileSummary[];
  evidenceSummary: string;
  intent: string | null;
  graphNodes: GraphNode[];
  model: ModelAlias;
  cwd: string;
  log: (msg: string) => void;
}

/** Full profile: seven focused passes, fanned out in parallel. */
async function fullSynthesis(ctx: SynthContext): Promise<SynthSections> {
  const prompts = synthesisPrompts(ctx.summaries, ctx.evidenceSummary, ctx.intent, ctx.graphNodes);
  const synthOpts = (built: Built, label: string): ClaudeOptions => ({
    system: built.system,
    prompt: built.prompt,
    model: ctx.model,
    cwd: ctx.cwd,
    label,
    timeoutMs: 360_000,
  });
  // The per-file passes above already warmed the shared prompt-prefix cache, so the
  // synthesis passes fan out concurrently as cache-reads. Each is small + focused, so
  // wall-clock ≈ the slowest single pass instead of one ~5-min monolith.
  //
  // Failure policy: narrative + behavioral are load-bearing (title, verdict) and still
  // fail the run; every other pass degrades to a placeholder section with a warning so
  // one flaky call can't sink the lesson.
  const settled = await Promise.allSettled([
    claudeStructured(SynthNarrative, synthOpts(prompts.narrative, "synth:narrative")),
    claudeStructured(graphPassSchema(ctx.graphNodes.map((n) => n.id)), synthOpts(prompts.graph, "synth:graph")),
    claudeStructured(DataFlow, synthOpts(prompts.dataflow, "synth:dataflow")),
    claudeStructured(Patterns, synthOpts(prompts.patterns, "synth:patterns")),
    claudeStructured(Behavioral, synthOpts(prompts.behavioral, "synth:behavioral")),
    claudeStructured(Explanations, synthOpts(prompts.explanations, "synth:explanations")),
    claudeStructured(Retrieval, synthOpts(prompts.retrieval, "synth:retrieval")),
  ]);
  const required = <T,>(r: PromiseSettledResult<T>, label: string): T => {
    if (r.status === "rejected") throw new Error(`${label} synthesis failed: ${r.reason}`);
    return r.value;
  };
  const optional = <T,>(r: PromiseSettledResult<T>, label: string, fallback: T): T => {
    if (r.status === "rejected") {
      ctx.log(`  ⚠ ${label} synthesis failed — writing a placeholder section (${r.reason})`);
      return fallback;
    }
    return r.value;
  };
  const unavailable = "(explanation unavailable — this synthesis pass failed; regenerate the lesson)";
  return {
    narrative: required(settled[0], "narrative"),
    behavioral: required(settled[4], "behavioral"),
    // Graph fallback: the deterministic nodes still stand on their own (no edges beats no lens).
    graphPass: optional(settled[1], "graph", { edges: [], rippleTargets: [] }),
    dataflow: optional(settled[2], "dataflow", {
      mermaid: "",
      sankey: null,
      narrative: { before: "(dataflow synthesis failed — regenerate)", after: "" },
    }),
    patterns: optional(settled[3], "patterns", { detected: [], adr: null }),
    explanations: optional(settled[5], "explanations", {
      behavioral: { eli5: unavailable, junior: unavailable, senior: unavailable, architect: unavailable },
      dependency: { eli5: unavailable, junior: unavailable, senior: unavailable, architect: unavailable },
      contract: { eli5: unavailable, junior: unavailable, senior: unavailable, architect: unavailable },
      dataflow: { eli5: unavailable, junior: unavailable, senior: unavailable, architect: unavailable },
    }),
    retrieval: optional(settled[6], "retrieval", { questions: [] }),
  };
}

/**
 * Lite profile: one merged pass on the cheaper model. It carries narrative + behavioral,
 * both load-bearing (title, verdict), so it fails the run on error exactly as their
 * focused passes do in the full profile. Its graph portion still goes through repairGraph.
 */
async function liteSynthesis(ctx: SynthContext): Promise<SynthSections> {
  const built = liteSynthesisPrompt(ctx.summaries, ctx.evidenceSummary, ctx.intent, ctx.graphNodes);
  const merged = await claudeStructured(synthLiteSchema(ctx.graphNodes.map((n) => n.id)), {
    system: built.system,
    prompt: built.prompt,
    model: ctx.model,
    cwd: ctx.cwd,
    label: "synth:lite",
    timeoutMs: 360_000,
  });
  const skipped = { eli5: LITE_SKIPPED, junior: LITE_SKIPPED, senior: LITE_SKIPPED, architect: LITE_SKIPPED };
  return {
    narrative: merged.narrative,
    behavioral: merged.behavioral,
    graphPass: merged.graph,
    // Skipped lenses get typed empties, never nulls: the bundle parses, validation stays
    // quiet (it knows the profile), and the viewer hides these tabs on a lite lesson.
    dataflow: { mermaid: "", sankey: null, narrative: { before: LITE_SKIPPED, after: "" } },
    patterns: { detected: [], adr: null },
    explanations: { behavioral: skipped, dependency: skipped, contract: skipped, dataflow: skipped },
    retrieval: { questions: [] },
  };
}

export async function generateLesson(opts: GenerateOptions): Promise<LessonBundle> {
  const cwd = opts.cwd;
  const log = opts.onProgress ?? (() => {});
  const fromRef = opts.fromRef ?? "HEAD";
  const toRef = opts.toRef ?? WORKTREE;
  const concurrency = opts.concurrency ?? 4;
  const profile = opts.profile ?? "full";

  const fromShort = await resolveRef(fromRef, cwd);
  const toShort = await resolveRef(toRef, cwd);

  log(`Diffing ${fromShort} → ${toShort === WORKTREE ? "working tree" : toShort}…`);
  // Permanent ignores (.gandalf artifacts) never enter the lesson at all.
  const changed = (await listChangedFiles(fromRef, toRef, cwd)).filter((c) => !isPermanentIgnore(c.path));
  if (changed.length === 0) throw new Error("No changes between the given refs.");

  // Build FileChange skeletons with blobs + noise classification.
  const files: FileChange[] = [];
  for (const c of changed) {
    const diff = await unifiedDiff(fromRef, toRef, c.path, c.oldPath, cwd);
    const beforeBlob = c.status === "added" ? null : await blobAt(fromRef, c.oldPath ?? c.path, cwd);
    const afterBlob = c.status === "removed" ? null : await blobAt(toRef, c.path, cwd);
    const noise = classifyPath(c.path);
    const formatting = !noise.skip && diff ? isFormattingOnly(diff) : false;
    files.push({
      path: c.path,
      module: normalizeModule(c.path),
      language: languageOf(c.path),
      status: c.status,
      unifiedDiff: diff,
      beforeBlob,
      afterBlob,
      tldr: noise.skip || formatting ? { ...COLLAPSED_TLDR } : { before: "", now: "", behaviorChanged: "" },
      beacons: [],
    });
  }

  log("Computing deterministic evidence bundle…");
  const ev = await buildEvidence({
    cwd,
    changed: files.map((f) => ({ path: f.path, afterBlob: f.afterBlob, beforeBlob: f.beforeBlob })),
  });

  // Per-file Claude passes (skip collapsed files).
  const analyzable = files.filter(
    (f) => !classifyPath(f.path).skip && !(f.unifiedDiff && isFormattingOnly(f.unifiedDiff)),
  );
  log(`Analyzing ${analyzable.length} file(s) with claude -p…`);
  const contracts: ContractChange[] = [];
  const cognitiveByFile = new Map<string, FilePassResult["cognitive"]>();
  const analyzeOne = async (f: FileChange) => {
    const built = filePassPrompt(f, evidenceForFile(ev, f.path));
    const res = await claudeStructured(FilePassResult, {
      system: built.system,
      prompt: built.prompt,
      // An explicit --model-file wins; otherwise the profile picks (lite escalates per file).
      model: opts.modelFile ?? (profile === "lite" ? liteFileModel(f, ev.hotspots) : "sonnet"),
      cwd,
      label: `file:${f.path}`,
    });
    f.tldr = res.tldr;
    f.beacons = res.beacons;
    cognitiveByFile.set(f.path, res.cognitive);
    // collect contracts onto the lesson later via closure
    contracts.push(...res.contracts);
    log(`  ✓ ${f.path}`);
  };
  // A failed per-file pass must not sink the whole (multi-minute, usage-burning)
  // run: degrade that file to a collapsed TLDR and keep going.
  const analyzeSafe = async (f: FileChange) => {
    try {
      await analyzeOne(f);
    } catch (e) {
      f.tldr = {
        before: "Per-file analysis failed — diff shown without teaching annotations.",
        now: "Re-run `gandalf generate` to retry this file.",
        behaviorChanged: "Unknown.",
      };
      log(`  ✗ ${f.path} — ${e instanceof Error ? e.message : e}`);
    }
  };
  // Warm-start fan-out: every `claude -p` shares one large cacheable prompt prefix
  // (the Claude Code preamble + tool schemas). Run the FIRST file alone so that
  // prefix is written to the cache once, then fan out the rest as cache-reads —
  // avoids N concurrent calls all paying the cache-creation penalty.
  if (analyzable.length > 0) {
    await analyzeSafe(analyzable[0]!);
    await mapLimit(analyzable.slice(1), concurrency, (f) => analyzeSafe(f));
  }

  // ticket overlay
  const tickets = await loadTickets(cwd);
  const ticket = matchTicket(files.map((f) => f.path), tickets, opts.ticketId);
  const intent = ticket ? ticketIntent(ticket) : null;
  if (ticket) log(`Matched ticket ${ticket.id}`);

  const summaries: PerFileSummary[] = analyzable.map((f) => ({
    path: f.path,
    module: f.module,
    tldr: f.tldr,
    contracts: contracts.filter((c) => c.file === f.path),
    cognitive: cognitiveByFile.get(f.path) ?? [],
  }));

  // The graph's node set is deterministic (one node per changed module + its in-repo
  // import neighbours), so the graph pass only chooses edges between these ids.
  const graphNodes = deriveGraphNodes(
    analyzable.map((f) => ({
      path: f.path,
      status: f.status,
      afterBlob: f.afterBlob,
      beforeBlob: f.beforeBlob,
    })),
  );

  log(
    profile === "lite"
      ? "Synthesizing cross-cutting lesson with claude -p (1 merged lite pass)…"
      : "Synthesizing cross-cutting lesson with claude -p (7 focused passes)…",
  );
  const synthCtx: SynthContext = {
    summaries,
    evidenceSummary: evidenceSummary(ev),
    intent,
    graphNodes,
    // An explicit --model-synth wins; otherwise the profile picks.
    model: opts.modelSynth ?? (profile === "lite" ? "sonnet" : "opus"),
    cwd,
    log,
  };
  const sections = profile === "lite" ? await liteSynthesis(synthCtx) : await fullSynthesis(synthCtx);
  const { narrative, behavioral, dataflow, patterns, explanations, retrieval } = sections;
  // Repair covers the retry path, where the schema's node enum is no longer enforced.
  const repaired = repairGraph({ nodes: graphNodes, ...sections.graphPass });
  for (const action of repaired.actions) log(`  ⚠ graph repair: ${action}`);
  const graph = repaired.graph;

  const complexity = assembleComplexity(analyzable, cognitiveByFile, ev);
  const breakingCount = contracts.filter((c) => c.safety === "breaking").length;
  const id = makeId(opts.ticketId ?? ticket?.id ?? null, fromShort, toShort);

  const bundle = {
    meta: {
      id,
      title: narrative.title,
      fromRef: fromShort,
      toRef: toShort,
      ticketId: ticket?.id ?? opts.ticketId ?? null,
      createdAt: new Date().toISOString(),
      hypothesis: narrative.hypothesis,
      summary: narrative.summary,
      // The behavioral pass owns the lesson-level verdict (single source of truth).
      verdict: behavioral.verdict,
      breakingCount,
      profile,
    },
    files,
    contracts,
    graph,
    dataflow,
    complexity,
    patterns,
    behavioral,
    explanations,
    retrieval,
  };

  const lesson = LessonBundle.parse(bundle);

  // Cross-section integrity report (non-fatal): catches graph↔files drift & friends.
  const issues = validateLesson(lesson);
  if (issues.length) {
    log(`Integrity check: ${issues.length} issue(s)`);
    log(formatIssues(issues).split("\n").map((l) => `  ${l}`).join("\n"));
  } else {
    log("Integrity check: ✓ no issues");
  }

  return lesson;
}

function makeId(ticketId: string | null, from: string, to: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, "_");
  const base = ticketId ? safe(ticketId) : "diff";
  return `${base}-${safe(from)}-${safe(to)}`;
}
