import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { FnComplexity, LessonBundle } from "@engine/core/schemas.ts";
import { SlopeChart } from "@/components/SlopeChart.tsx";
import { Treemap } from "@/components/Treemap.tsx";
import { Reveal } from "@/components/Reveal.tsx";
import { useFileFilter } from "@/lib/fileFilter.tsx";

const H3 = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink";
const base = (p: string) => p.split("/").pop() ?? p;

function DeltaCard({ label, value }: { label: string; value: number }) {
  // Increase in complexity is worse (red); decrease is better (green).
  const dir = value > 0 ? "removed" : value < 0 ? "added" : "unchanged";
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="text-xs text-muted-ink">Δ {label}</div>
      <div
        className="flex items-center gap-1.5 font-display text-lg font-semibold"
        style={{ color: value === 0 ? undefined : `hsl(var(--${dir}))` }}
      >
        <Icon className="h-4 w-4" />
        {value > 0 ? "+" : ""}
        {value}
      </div>
    </div>
  );
}

function deltaScorecard(rows: FnComplexity[]) {
  const sum = (sel: (p: FnComplexity) => number | null) => rows.reduce((a, p) => a + (sel(p) ?? 0), 0);
  return {
    deltaCyclomatic: sum((p) => p.cyclomaticAfter) - sum((p) => p.cyclomaticBefore),
    deltaCognitive: sum((p) => p.cognitiveAfter) - sum((p) => p.cognitiveBefore),
    deltaNesting: sum((p) => p.nestingAfter) - sum((p) => p.nestingBefore),
    deltaLoc: sum((p) => p.locAfter) - sum((p) => p.locBefore),
  };
}

export function ComplexityLens({ lesson }: { lesson: LessonBundle }) {
  const c = lesson.complexity;
  const { visible } = useFileFilter();
  // Hide config/generated files (and recompute the scorecard from what's left) so the metrics
  // reflect the code under review, not lockfile/manifest churn.
  const perFunction = useMemo(() => c.perFunction.filter((f) => visible(f.file)), [c.perFunction, visible]);
  const hotspots = useMemo(() => c.hotspots.filter((h) => visible(h.path)), [c.hotspots, visible]);
  const coupling = useMemo(
    () => c.coupling.filter((cp) => visible(cp.a) && visible(cp.b)),
    [c.coupling, visible],
  );
  const scorecard = useMemo(() => deltaScorecard(perFunction), [perFunction]);
  const hasCyclomatic = perFunction.some((f) => f.cyclomaticAfter != null || f.cyclomaticBefore != null);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-2">
        <h2 className="text-2xl">Complexity</h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-ink">
          Cognitive complexity (SonarSource) tracks how hard code is to <em>read</em>; cyclomatic
          counts independent paths. A wide <code className="font-mono">switch</code> can be
          high-cyclomatic but low-cognitive; deep nesting is the reverse.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ["Cyclomatic", scorecard.deltaCyclomatic],
          ["Cognitive", scorecard.deltaCognitive],
          ["Nesting", scorecard.deltaNesting],
          ["LOC", scorecard.deltaLoc],
        ] as const).map(([label, value], i) => (
          <Reveal key={label} delay={i * 0.05}>
            <DeltaCard label={label} value={value} />
          </Reveal>
        ))}
      </div>

      <Reveal as="section" className="space-y-3">
        <h3 className={H3}>Per-function — cognitive (before → after)</h3>
        <SlopeChart data={perFunction} metric="cognitive" />
      </Reveal>

      {hasCyclomatic && (
        <Reveal as="section" className="space-y-3">
          <h3 className={H3}>Per-function — cyclomatic (before → after)</h3>
          <SlopeChart data={perFunction} metric="cyclomatic" />
        </Reveal>
      )}

      {hotspots.length > 0 && (
        <Reveal as="section" className="space-y-2">
          <h3 className={H3}>
            Hotspot map{" "}
            <span className="font-normal normal-case tracking-normal text-muted-ink">
              — area = churn, intensity = complexity
            </span>
          </h3>
          <div className="rounded-lg border border-line bg-surface p-3">
            <Treemap hotspots={hotspots} />
          </div>
        </Reveal>
      )}

      {coupling.length > 0 && (
        <Reveal as="section" className="space-y-2">
          <h3 className={H3}>
            Change coupling{" "}
            <span className="font-normal normal-case tracking-normal text-muted-ink">
              — files that historically change together
            </span>
          </h3>
          <ul className="space-y-1.5">
            {coupling.map((cp, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-ink">{base(cp.a)}</span>
                <span className="text-muted-ink">↔</span>
                <span className="font-mono text-xs text-ink">{base(cp.b)}</span>
                <span className="ml-auto text-xs text-muted-ink">
                  {cp.pct}% ({cp.together}×)
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}
