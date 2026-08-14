import type {
  Adr,
  ContractChange,
  FileChange,
  FnComplexity,
  LessonBundle,
  PatternFinding,
  RetrievalQuestion,
  TraceCard,
} from "@engine/core/schemas.ts";
import { parseUnifiedDiff, type DiffRow } from "@/lib/parseDiff.ts";
import { tokenizeLines, type TokenSpan } from "@/lib/shiki.ts";
import { deltaScorecard } from "@/lib/complexity.ts";
import { resolveContractAnchor, type Route } from "@/lib/router.ts";

/**
 * Per-tab share-card content: what the middle "feature" region of the card
 * shows, chosen from the active lens (and its in-tab selection). Pure logic —
 * no React — so the pickers are unit-testable from the root vitest suite.
 */

const MAX_ROWS = 13;
const MAX_MOVERS = 4;

/** Word-boundary truncation — CSS line-clamp is unreliable inside html-to-image's foreignObject. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
}

const base = (p: string) => p.split("/").pop() ?? p;

// ---------- teaching-diff excerpt (the classic card) ----------

export interface ExcerptRow extends DiffRow {
  tokens: TokenSpan[];
}

export interface Excerpt {
  file: FileChange;
  note: string | null;
  rows: ExcerptRow[];
}

export const isTestPath = (p: string) =>
  /(^|\/)tests?\//i.test(p) || /(\.test\.|_test\.|Tests\.\w+$)/i.test(p);

/**
 * The most teachable excerpt: prefer product code over tests, then the
 * contract-richest beacon. `preferPath` (a file path or module name — the
 * dependency lens's selected node) restricts the candidate pool when it
 * matches anything; an empty restriction falls back to the full pool.
 */
export async function buildExcerpt(
  lesson: LessonBundle,
  dark: boolean,
  preferPath?: string,
): Promise<Excerpt | null> {
  const contractCount = (f: FileChange) => lesson.contracts.filter((c) => c.file === f.path).length;
  const pool = lesson.files.filter((f) => f.beacons.length > 0 && f.unifiedDiff.trim());
  const preferred = preferPath
    ? pool.filter((f) => f.path === preferPath).length
      ? pool.filter((f) => f.path === preferPath)
      : pool.filter((f) => f.module === preferPath)
    : [];
  const candidates = (preferred.length ? preferred : pool).sort(
    (a, b) =>
      Number(isTestPath(a.path)) - Number(isTestPath(b.path)) ||
      contractCount(b) - contractCount(a) ||
      (b.beacons[0]!.endLine - b.beacons[0]!.startLine) - (a.beacons[0]!.endLine - a.beacons[0]!.startLine),
  );
  const file = candidates[0] ?? lesson.files.find((f) => f.unifiedDiff.trim());
  if (!file) return null;

  const beacon = file.beacons[0] ?? null;
  const hunks = parseUnifiedDiff(file.unifiedDiff);
  if (hunks.length === 0) return null;

  // The hunk containing the beacon start (fallback: the first hunk).
  const hunk =
    (beacon && hunks.find((h) => h.rows.some((r) => r.afterNo != null && r.afterNo >= beacon.startLine && r.afterNo <= beacon.endLine))) ||
    hunks[0]!;
  let rows = hunk.rows;
  if (beacon) {
    const idx = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.afterNo != null && r.afterNo >= beacon.startLine && r.afterNo <= beacon.endLine)
      .map(({ i }) => i);
    if (idx.length) rows = rows.slice(idx[0]!, idx[idx.length - 1]! + 1);
  }
  rows = rows.slice(0, MAX_ROWS);
  if (rows.length === 0) return null;

  // Dedent the window's common indent — excerpts often start deep inside a scope.
  const indents = rows.filter((r) => r.text.trim()).map((r) => r.text.match(/^\s*/)![0].length);
  const dedent = indents.length ? Math.min(...indents) : 0;
  const texts = rows.map((r) => r.text.slice(dedent));

  const tokens = await tokenizeLines(texts.join("\n"), file.language, dark);
  return {
    file,
    note: beacon?.note ?? null,
    rows: rows.map((r, i) => ({ ...r, text: texts[i]!, tokens: tokens[i] ?? [] })),
  };
}

// ---------- feature union ----------

export type Scorecard = ReturnType<typeof deltaScorecard>;

export type CardFeature =
  | { kind: "excerpt"; excerpt: Excerpt }
  | { kind: "trace"; trace: TraceCard }
  | { kind: "contract"; contract: ContractChange }
  | { kind: "dataflow"; before: string; after: string }
  | { kind: "complexity"; scorecard: Scorecard; movers: FnComplexity[] }
  | { kind: "pattern"; finding: PatternFinding }
  | { kind: "adr"; adr: Adr }
  | { kind: "recall"; question: RetrievalQuestion; index: number; total: number }
  | { kind: "summary" };

export interface CardContent {
  feature: CardFeature;
  /** Pre-clipped lead sentence for the constant slot under the brand header. */
  lead: string;
  /** Right side of the brand header (file path, symbol location, …). */
  headerRight: string;
}

// ---------- per-tab pickers (pure; null = nothing worth featuring) ----------

/** Best worked example: breaking beats safe, divergent state and a real output change add interest. */
export function pickTrace(traces: TraceCard[]): TraceCard | null {
  if (traces.length === 0) return null;
  const score = (t: TraceCard) =>
    (t.safety === "breaking" ? 2 : 0) +
    (t.divergentState.length > 0 ? 1 : 0) +
    (t.beforeOutput !== t.afterOutput ? 1 : 0);
  return traces.reduce((best, t) => (score(t) > score(best) ? t : best), traces[0]!);
}

const SAFETY_RANK = { breaking: 2, unknown: 1, safe: 0 } as const;

/** The anchored contract when the URL names one; otherwise the highest-stakes change. */
export function pickContract(contracts: ContractChange[], anchor: string | null): ContractChange | null {
  if (contracts.length === 0) return null;
  if (anchor) {
    const hit = resolveContractAnchor(contracts, anchor);
    if (hit) return hit;
  }
  const score = (c: ContractChange) =>
    SAFETY_RANK[c.safety] * 100 +
    (c.changeType === "removed" ? 20 : c.changeType === "modified" ? 10 : 0) +
    (c.preconditionDelta || c.postconditionDelta ? 2 : 0) +
    (c.beforeSig && c.afterSig ? 1 : 0);
  return contracts.reduce((best, c) => (score(c) > score(best) ? c : best), contracts[0]!);
}

/** Strongest finding: introduced/removed beats pre-existing, then confidence, then evidence. */
export function pickPattern(findings: PatternFinding[]): PatternFinding | null {
  if (findings.length === 0) return null;
  const CONF = { high: 2, medium: 1, low: 0 } as const;
  const score = (f: PatternFinding) =>
    (f.status !== "present" ? 100 : 0) + CONF[f.confidence] * 10 + Math.min(f.evidenceLines.length, 9);
  return findings.reduce((best, f) => (score(f) > score(best) ? f : best), findings[0]!);
}

/** Δ scorecard over the files the user can see, plus the biggest per-function movers. */
export function buildComplexityFeature(
  lesson: LessonBundle,
  visible: (path: string) => boolean,
): Extract<CardFeature, { kind: "complexity" }> | null {
  const perFunction = lesson.complexity.perFunction.filter((f) => visible(f.file));
  const cognitiveDelta = (f: FnComplexity) =>
    f.cognitiveAfter != null || f.cognitiveBefore != null
      ? (f.cognitiveAfter ?? 0) - (f.cognitiveBefore ?? 0)
      : null;
  const cyclomaticDelta = (f: FnComplexity) =>
    f.cyclomaticAfter != null || f.cyclomaticBefore != null
      ? (f.cyclomaticAfter ?? 0) - (f.cyclomaticBefore ?? 0)
      : null;
  const hasCognitive = perFunction.some((f) => cognitiveDelta(f) != null);
  const delta = hasCognitive ? cognitiveDelta : cyclomaticDelta;
  const movers = perFunction
    .filter((f) => (delta(f) ?? 0) !== 0)
    .sort((a, b) => Math.abs(delta(b) ?? 0) - Math.abs(delta(a) ?? 0))
    .slice(0, MAX_MOVERS);

  if (perFunction.length > 0) {
    const scorecard = deltaScorecard(perFunction);
    const allZero = Object.values(scorecard).every((v) => v === 0);
    if (allZero && movers.length === 0) return null;
    return { kind: "complexity", scorecard, movers };
  }
  // Filter left nothing measurable — fall back to the precomputed bundle scorecard.
  const pre = lesson.complexity.scorecard;
  if (Object.values(pre).every((v) => v === 0)) return null;
  return { kind: "complexity", scorecard: pre, movers: [] };
}

// ---------- content assembly ----------

function summaryContent(lesson: LessonBundle): CardContent {
  return {
    feature: { kind: "summary" },
    lead: clip(lesson.meta.summary, 190),
    headerRight: clip(lesson.meta.title, 90),
  };
}

async function excerptContent(
  lesson: LessonBundle,
  dark: boolean,
  preferPath?: string,
): Promise<CardContent | null> {
  const excerpt = await buildExcerpt(lesson, dark, preferPath);
  if (!excerpt) return null;
  return {
    feature: { kind: "excerpt", excerpt },
    lead: clip(excerpt.file.tldr.now || lesson.meta.summary, 190),
    headerRight: clip(excerpt.file.path, 90),
  };
}

/** Tiered prose for a card's lead, empty on a lite lesson (which never generated it). */
function explanationLead(lesson: LessonBundle, lens: keyof LessonBundle["explanations"]): string {
  return lesson.meta.profile === "lite" ? "" : lesson.explanations[lens].junior;
}

function tabContent(
  lesson: LessonBundle,
  route: Pick<Route, "tab" | "node" | "contract">,
  visible: (path: string) => boolean,
): CardContent | null {
  switch (route.tab) {
    case "behavioral": {
      const trace = pickTrace(lesson.behavioral.traceCards);
      if (!trace) return null;
      return {
        feature: { kind: "trace", trace },
        lead: clip(lesson.behavioral.conditionalEquivalence || lesson.meta.summary, 190),
        headerRight: clip(lesson.meta.title, 90),
      };
    }
    case "contract": {
      const contract = pickContract(lesson.contracts, route.contract);
      if (!contract) return null;
      return {
        feature: { kind: "contract", contract },
        lead: clip(explanationLead(lesson, "contract") || lesson.meta.summary, 190),
        headerRight: clip(
          `${base(contract.file)}${contract.beaconLines.length ? `:${contract.beaconLines[0]}` : ""}`,
          90,
        ),
      };
    }
    case "dataflow": {
      const { before, after } = lesson.dataflow.narrative;
      if (!before.trim() && !after.trim()) return null;
      return {
        feature: { kind: "dataflow", before, after },
        lead: clip(explanationLead(lesson, "dataflow") || lesson.meta.summary, 190),
        headerRight: clip(lesson.meta.title, 90),
      };
    }
    case "complexity": {
      const feature = buildComplexityFeature(lesson, visible);
      if (!feature) return null;
      return {
        feature,
        lead: clip(lesson.meta.summary, 190),
        headerRight: "complexity delta",
      };
    }
    case "patterns": {
      const finding = pickPattern(lesson.patterns.detected);
      if (finding) {
        return {
          feature: { kind: "pattern", finding },
          lead: clip(lesson.meta.summary, 190),
          headerRight: clip(finding.name, 90),
        };
      }
      if (lesson.patterns.adr) {
        return {
          feature: { kind: "adr", adr: lesson.patterns.adr },
          lead: clip(lesson.patterns.adr.title, 190),
          headerRight: "architecture decision",
        };
      }
      return null;
    }
    case "recall": {
      const questions = lesson.retrieval?.questions ?? [];
      const question = questions[0];
      if (!question) return null;
      return {
        feature: { kind: "recall", question, index: 0, total: questions.length },
        lead: clip(`Could you answer this from memory? From “${lesson.meta.title}”.`, 190),
        headerRight: clip(`question 1/${questions.length} · ${question.lens}`, 90),
      };
    }
    default:
      // overview / walkthrough / dependency feature the diff excerpt (built async by the caller).
      return null;
  }
}

/**
 * Compose the card for the active tab. Never rejects and never returns
 * nothing: tab feature → teaching-diff excerpt → summary-only frame.
 */
export async function buildCardContent(
  lesson: LessonBundle,
  route: Pick<Route, "tab" | "node" | "contract">,
  ctx: { dark: boolean; visible: (path: string) => boolean },
): Promise<CardContent> {
  try {
    const fromTab = tabContent(lesson, route, ctx.visible);
    if (fromTab) return fromTab;
    const preferPath = route.tab === "dependency" && route.node ? route.node : undefined;
    const fromExcerpt = await excerptContent(lesson, ctx.dark, preferPath);
    if (fromExcerpt) return fromExcerpt;
  } catch {
    // Tokenizer or parser failure — fall through to the summary frame.
  }
  return summaryContent(lesson);
}
