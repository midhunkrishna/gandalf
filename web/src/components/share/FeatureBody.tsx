import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { Adr, ContractChange, FnComplexity, PatternFinding, RetrievalQuestion, TraceCard } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { cn } from "@/lib/cn.ts";
import { safetyTone } from "@/lib/concept.ts";
import { clip, type CardFeature, type Excerpt, type Scorecard } from "./features.ts";

/**
 * The swappable middle region of the 1200×630 share card, one view per
 * CardFeature kind. Static render only: no Reveal/CountUp animations, no
 * backdrop-blur, all truncation via clip() — html-to-image's foreignObject
 * can't be trusted with CSS line-clamp.
 */

const base = (p: string) => p.split("/").pop() ?? p;

const label = "text-[0.7rem] font-semibold uppercase tracking-[0.12em]";

export function ExcerptCode({ excerpt }: { excerpt: Excerpt }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface font-mono text-[15px] leading-[1.65]">
      {excerpt.rows.map((row, i) => (
        <div
          key={i}
          className={cn("flex", row.kind === "add" && "bg-added/[0.12]", row.kind === "del" && "bg-removed/[0.12]")}
        >
          <span className="w-12 shrink-0 select-none pr-3 pt-px text-right text-[12px] leading-[1.85] text-muted-ink/80">
            {row.afterNo ?? row.beforeNo ?? ""}
          </span>
          <span
            className={cn(
              "w-5 shrink-0 text-center font-semibold",
              row.kind === "add" && "text-added",
              row.kind === "del" && "text-removed",
            )}
          >
            {row.kind === "add" ? "+" : row.kind === "del" ? "−" : ""}
          </span>
          <span className="whitespace-pre pr-4 text-ink">
            {row.tokens.length
              ? row.tokens.map((t, j) => (
                  <span key={j} style={{ color: t.color, fontStyle: t.italic ? "italic" : undefined }}>
                    {t.content}
                  </span>
                ))
              : row.text || " "}
          </span>
        </div>
      ))}
    </div>
  );
}

function ExcerptFeature({ excerpt }: { excerpt: Excerpt }) {
  return (
    <div>
      <ExcerptCode excerpt={excerpt} />
      {excerpt.note && (
        <p className="mt-2.5 max-w-[68rem] text-sm italic leading-snug text-muted-ink">
          {clip(excerpt.note, 240)}
        </p>
      )}
    </div>
  );
}

function TraceFeature({ trace }: { trace: TraceCard }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className={cn(label, "text-muted-ink")}>input</div>
        <Badge tone={safetyTone(trace.safety)} className="rounded-md px-2.5 py-1 text-sm">
          {trace.safety}
        </Badge>
      </div>
      <div className="mt-1.5 overflow-hidden whitespace-pre rounded-md bg-surface-2 px-3 py-2 font-mono text-sm text-ink">
        {clip(trace.input, 120)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-removed/20 bg-removed/5 p-3">
          <div className={cn(label, "mb-1 text-removed")}>before</div>
          <p className="text-[15px] leading-relaxed text-ink">{clip(trace.beforeOutput, 180)}</p>
        </div>
        <div className="rounded-md border border-added/20 bg-added/5 p-3">
          <div className={cn(label, "mb-1 text-added")}>after</div>
          <p className="text-[15px] leading-relaxed text-ink">{clip(trace.afterOutput, 180)}</p>
        </div>
      </div>
      {trace.divergentState.length > 0 && (
        <div className="mt-3 space-y-1">
          {trace.divergentState.slice(0, 3).map((d, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-mono font-medium text-ink">{clip(d.name, 40)}</span>
              <span className="text-removed">{clip(d.before, 60)}</span>
              <ArrowRight className="h-3 w-3 shrink-0 self-center text-muted-ink" />
              <span className="text-added">{clip(d.after, 60)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 border-t border-line pt-2.5 text-sm italic leading-snug text-muted-ink">
        {clip(trace.gwt, 200)}
      </p>
    </div>
  );
}

function ContractFeature({ contract }: { contract: ContractChange }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="overflow-hidden whitespace-pre font-mono text-lg font-medium text-ink">
          {clip(contract.symbol, 70)}
        </span>
        <span className="text-sm text-muted-ink">
          {contract.kind} · {contract.changeType}
        </span>
        <Badge tone={safetyTone(contract.safety)} className="ml-auto rounded-md px-2.5 py-1 text-sm">
          {contract.safety}
        </Badge>
      </div>
      {(contract.beforeSig || contract.afterSig) && (
        <div className="mt-4 space-y-1.5 font-mono text-sm">
          {contract.beforeSig && (
            <div className="overflow-hidden whitespace-pre rounded bg-removed/5 px-3 py-2 text-ink">
              <span className="text-removed">− </span>
              {clip(contract.beforeSig, 110)}
            </div>
          )}
          {contract.afterSig && (
            <div className="overflow-hidden whitespace-pre rounded bg-added/5 px-3 py-2 text-ink">
              <span className="text-added">+ </span>
              {clip(contract.afterSig, 110)}
            </div>
          )}
        </div>
      )}
      {(contract.preconditionDelta || contract.postconditionDelta) && (
        <div className="mt-4 space-y-1 text-sm leading-snug text-muted-ink">
          {contract.preconditionDelta && (
            <div>
              <span className="font-medium text-ink">precondition:</span>{" "}
              {clip(contract.preconditionDelta, 160)}
            </div>
          )}
          {contract.postconditionDelta && (
            <div>
              <span className="font-medium text-ink">postcondition:</span>{" "}
              {clip(contract.postconditionDelta, 160)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DataflowFeature({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-removed/20 bg-removed/5 p-5">
        <div className={cn(label, "mb-2 text-removed")}>before</div>
        <p className="text-[16px] leading-relaxed text-ink">{clip(before, 320)}</p>
      </div>
      <div className="rounded-lg border border-added/20 bg-added/5 p-5">
        <div className={cn(label, "mb-2 text-added")}>after</div>
        <p className="text-[16px] leading-relaxed text-ink">{clip(after, 320)}</p>
      </div>
    </div>
  );
}

/** Which metric a mover row shows: cognitive when measured, else cyclomatic. */
function moverMetric(f: FnComplexity): { name: string; before: number; after: number } {
  if (f.cognitiveAfter != null || f.cognitiveBefore != null) {
    return { name: "cognitive", before: f.cognitiveBefore ?? 0, after: f.cognitiveAfter ?? 0 };
  }
  return { name: "cyclomatic", before: f.cyclomaticBefore ?? 0, after: f.cyclomaticAfter ?? 0 };
}

function ComplexityFeature({ scorecard, movers }: { scorecard: Scorecard; movers: FnComplexity[] }) {
  const tiles = [
    ["Cyclomatic", scorecard.deltaCyclomatic],
    ["Cognitive", scorecard.deltaCognitive],
    ["Nesting", scorecard.deltaNesting],
    ["LOC", scorecard.deltaLoc],
  ] as const;
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        {tiles.map(([name, value]) => {
          // Increase in complexity is worse (red); decrease is better (green).
          const dir = value > 0 ? "removed" : value < 0 ? "added" : "unchanged";
          const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
          return (
            <div key={name} className="rounded-lg border border-line bg-surface p-4">
              <div className="text-sm text-muted-ink">Δ {name}</div>
              <div
                className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold"
                style={{ color: value === 0 ? undefined : `hsl(var(--${dir}))` }}
              >
                <Icon className="h-5 w-5" />
                {value > 0 ? "+" : ""}
                {value}
              </div>
            </div>
          );
        })}
      </div>
      {movers.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {movers.map((f, i) => {
            const m = moverMetric(f);
            return (
              <div key={i} className="flex items-baseline gap-2 text-sm">
                <span className="overflow-hidden whitespace-pre font-mono text-ink">
                  {clip(f.symbol, 48)}
                </span>
                <span className="text-xs text-muted-ink">{base(f.file)}</span>
                <span className="ml-auto shrink-0 text-muted-ink">
                  {m.name} {m.before} → {m.after}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EvidenceChips({ evidence }: { evidence: Array<{ file: string; line: number }> }) {
  if (evidence.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {evidence.slice(0, 6).map((e, i) => (
        <span key={i} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted-ink">
          {base(e.file)}:{e.line}
        </span>
      ))}
    </div>
  );
}

function PatternFeature({ finding }: { finding: PatternFinding }) {
  const tone = finding.status === "added" ? "added" : finding.status === "removed" ? "removed" : "neutral";
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={tone} className="rounded-md px-2.5 py-1 text-sm">
          {finding.status}
        </Badge>
        <span className="text-lg font-medium text-ink">{clip(finding.name, 60)}</span>
        <span className="text-sm text-muted-ink">{finding.kind}</span>
        <span className="ml-auto text-sm text-muted-ink">confidence: {finding.confidence}</span>
      </div>
      <p className="mt-3 text-[17px] leading-relaxed text-ink">{clip(finding.note, 300)}</p>
      <EvidenceChips evidence={finding.evidenceLines} />
    </div>
  );
}

function AdrFeature({ adr }: { adr: Adr }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className={cn(label, "text-muted-ink")}>architecture decision</div>
      <div className="mt-1.5 text-lg font-medium text-ink">{clip(adr.title, 90)}</div>
      <p className="mt-3 text-[17px] leading-relaxed text-ink">{clip(adr.decision, 320)}</p>
    </div>
  );
}

function RecallFeature({ question, index, total }: { question: RetrievalQuestion; index: number; total: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className={cn(label, "rounded bg-surface-2 px-1.5 py-0.5 text-muted-ink")}>
          {question.lens}
        </span>
        <span className="text-sm text-muted-ink">
          question {index + 1} of {total}
        </span>
      </div>
      <p className="mt-3 text-[22px] font-medium leading-snug text-ink">{clip(question.prompt, 220)}</p>
      <div className="mt-4 rounded-md border border-dashed border-line px-4 py-3 text-sm italic text-muted-ink">
        Answer from memory — the reveal lives in the lesson.
      </div>
      <EvidenceChips evidence={question.evidence} />
    </div>
  );
}

export function FeatureBody({ feature }: { feature: CardFeature }) {
  switch (feature.kind) {
    case "excerpt":
      return <ExcerptFeature excerpt={feature.excerpt} />;
    case "trace":
      return <TraceFeature trace={feature.trace} />;
    case "contract":
      return <ContractFeature contract={feature.contract} />;
    case "dataflow":
      return <DataflowFeature before={feature.before} after={feature.after} />;
    case "complexity":
      return <ComplexityFeature scorecard={feature.scorecard} movers={feature.movers} />;
    case "pattern":
      return <PatternFeature finding={feature.finding} />;
    case "adr":
      return <AdrFeature adr={feature.adr} />;
    case "recall":
      return <RecallFeature question={feature.question} index={feature.index} total={feature.total} />;
    case "summary":
      return null;
    default: {
      const exhaustive: never = feature;
      return exhaustive;
    }
  }
}
