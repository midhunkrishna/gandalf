import {
  WORKTREE,
  resolveRef,
  listChangedFiles,
  unifiedDiff,
  blobAt,
} from "./git.ts";
import { buildEvidence, evidenceForFile, type EvidenceBundle } from "./evidence.ts";
import { normalizeModule, languageOf } from "./modules.ts";
import { classifyPath, isFormattingOnly } from "./noise.ts";
import { loadTickets, matchTicket, ticketIntent } from "./tickets.ts";
import { claudeStructured, type ModelAlias } from "./claude.ts";
import { filePassPrompt, synthesisPrompt, type PerFileSummary } from "./prompts.ts";
import {
  FilePassResult,
  SynthesisResult,
  LessonBundle,
  type FileChange,
  type Complexity,
  type FnComplexity,
  type ContractChange,
} from "./schemas.ts";

export interface GenerateOptions {
  cwd: string;
  fromRef?: string;
  toRef?: string;
  ticketId?: string;
  modelFile?: ModelAlias;
  modelSynth?: ModelAlias;
  concurrency?: number;
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
    for (const c of cog) {
      const afterFn = fm?.functions.find((x) => x.symbol === c.symbol || x.symbol.endsWith(c.symbol));
      perFunction.push({
        file: f.path,
        symbol: c.symbol,
        cyclomaticBefore: null,
        cyclomaticAfter: afterFn ? afterFn.cyclomatic : null,
        cognitiveBefore: c.cognitiveBefore,
        cognitiveAfter: c.cognitiveAfter,
        nestingBefore: null,
        nestingAfter: null,
        locBefore: null,
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

export async function generateLesson(opts: GenerateOptions): Promise<LessonBundle> {
  const cwd = opts.cwd;
  const log = opts.onProgress ?? (() => {});
  const fromRef = opts.fromRef ?? "HEAD";
  const toRef = opts.toRef ?? WORKTREE;
  const concurrency = opts.concurrency ?? 4;

  const fromShort = await resolveRef(fromRef, cwd);
  const toShort = await resolveRef(toRef, cwd);

  log(`Diffing ${fromShort} → ${toShort === WORKTREE ? "working tree" : toShort}…`);
  const changed = await listChangedFiles(fromRef, toRef, cwd);
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
    changed: files.map((f) => ({ path: f.path, afterBlob: f.afterBlob })),
  });

  // Per-file Claude passes (skip collapsed files).
  const analyzable = files.filter(
    (f) => !classifyPath(f.path).skip && !(f.unifiedDiff && isFormattingOnly(f.unifiedDiff)),
  );
  log(`Analyzing ${analyzable.length} file(s) with claude -p…`);
  const contracts: ContractChange[] = [];
  const cognitiveByFile = new Map<string, FilePassResult["cognitive"]>();
  await mapLimit(analyzable, concurrency, async (f) => {
    const built = filePassPrompt(f, evidenceForFile(ev, f.path));
    const res = await claudeStructured(FilePassResult, {
      system: built.system,
      prompt: built.prompt,
      model: opts.modelFile ?? "sonnet",
      cwd,
      label: `file:${f.path}`,
    });
    f.tldr = res.tldr;
    f.beacons = res.beacons;
    cognitiveByFile.set(f.path, res.cognitive);
    // collect contracts onto the lesson later via closure
    contracts.push(...res.contracts);
    log(`  ✓ ${f.path}`);
  });

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

  log("Synthesizing cross-cutting lesson with claude -p…");
  const synth = await claudeStructured(SynthesisResult, {
    ...synthesisPrompt(summaries, evidenceSummary(ev), intent),
    model: opts.modelSynth ?? "opus",
    cwd,
    label: "synthesis",
    timeoutMs: 360_000,
  });

  const complexity = assembleComplexity(analyzable, cognitiveByFile, ev);
  const breakingCount = contracts.filter((c) => c.safety === "breaking").length;
  const id = makeId(opts.ticketId ?? ticket?.id ?? null, fromShort, toShort);

  const bundle = {
    meta: {
      id,
      title: synth.title,
      fromRef: fromShort,
      toRef: toShort,
      ticketId: ticket?.id ?? opts.ticketId ?? null,
      createdAt: new Date().toISOString(),
      hypothesis: synth.hypothesis,
      summary: synth.summary,
      verdict: synth.verdict,
      breakingCount,
    },
    files,
    contracts,
    graph: synth.graph,
    dataflow: synth.dataflow,
    complexity,
    patterns: synth.patterns,
    behavioral: synth.behavioral,
    explanations: synth.explanations,
  };

  return LessonBundle.parse(bundle);
}

function makeId(ticketId: string | null, from: string, to: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, "_");
  const base = ticketId ? safe(ticketId) : "diff";
  return `${base}-${safe(from)}-${safe(to)}`;
}
