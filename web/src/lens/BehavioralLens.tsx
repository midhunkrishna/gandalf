import type { LessonBundle } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { TraceCard } from "@/components/TraceCard.tsx";
import { TieredExplanation } from "@/components/TieredExplanation.tsx";
import { Reveal } from "@/components/Reveal.tsx";

const H3 = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink";

export function BehavioralLens({ lesson }: { lesson: LessonBundle }) {
  const b = lesson.behavioral;
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-2xl">Behavioral change</h2>
          <Badge tone={b.verdict === "behavioral" ? "modified" : "safe"}>
            {b.verdict === "behavioral" ? "behavior changed" : "refactor-only"}
          </Badge>
        </div>
        <div className="rounded-md border-l-2 border-modified bg-surface px-4 py-3 text-[0.95rem] leading-relaxed text-ink">
          {b.conditionalEquivalence}
        </div>
        <TieredExplanation text={lesson.explanations.behavioral} />
      </header>

      {b.traceCards.length > 0 && (
        <section className="space-y-3">
          <h3 className={H3}>
            Worked examples{" "}
            <span className="font-normal normal-case tracking-normal text-muted-ink">
              — illustrative, reasoned from code (not executed)
            </span>
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {b.traceCards.map((c, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <TraceCard card={c} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {b.workedExample && (
        <section className="space-y-2">
          <h3 className={H3}>Walkthrough</h3>
          <p className="max-w-prose text-sm leading-relaxed text-ink">{b.workedExample}</p>
        </section>
      )}

      {b.ripple.length > 0 && (
        <Reveal as="section" className="space-y-2">
          <h3 className={H3}>What could break (ripple)</h3>
          <ul className="space-y-2">
            {b.ripple.map((r, i) => (
              <li key={i} className="rounded-md border border-line bg-surface p-3 text-sm">
                <span className="font-mono font-medium text-ink">{r.symbol}</span>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-ink">
                  {r.callers.map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}
