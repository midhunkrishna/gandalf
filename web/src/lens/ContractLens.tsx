import type { LessonBundle } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { TieredExplanation } from "@/components/TieredExplanation.tsx";
import { PredictReveal } from "@/components/PredictReveal.tsx";
import { Reveal } from "@/components/Reveal.tsx";
import { safetyTone } from "@/lib/concept.ts";

const SAFETIES = ["safe", "breaking", "unknown"] as const;

export function ContractLens({ lesson }: { lesson: LessonBundle }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-3">
        <h2 className="text-2xl">Contracts</h2>
        <TieredExplanation text={lesson.explanations.contract} />
        <p className="text-xs text-muted-ink">
          Safety follows Design-by-Contract: weakening a precondition or strengthening a
          postcondition is safe; the reverse is breaking.
        </p>
      </header>

      {lesson.contracts.length === 0 ? (
        <p className="text-sm text-muted-ink">No contract changes detected.</p>
      ) : (
        <div className="space-y-3">
          {lesson.contracts.map((c, i) => (
            <Reveal key={i} delay={Math.min(i, 6) * 0.05} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-medium text-ink">{c.symbol}</span>
                <span className="text-xs text-muted-ink">
                  {c.kind} · {c.changeType}
                </span>
                <span className="ml-auto font-mono text-[0.7rem] text-muted-ink">{c.file}</span>
              </div>
              {(c.beforeSig || c.afterSig) && (
                <div className="mt-3 space-y-1 font-mono text-xs">
                  {c.beforeSig && (
                    <div className="rounded bg-removed/5 px-2 py-1 text-ink">
                      <span className="text-removed">− </span>
                      {c.beforeSig}
                    </div>
                  )}
                  {c.afterSig && (
                    <div className="rounded bg-added/5 px-2 py-1 text-ink">
                      <span className="text-added">+ </span>
                      {c.afterSig}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3">
                <PredictReveal
                  answer={c.safety}
                  distractors={SAFETIES.filter((s) => s !== c.safety)}
                  question="Given these signature changes, is this Safe or Breaking (Design-by-Contract)?"
                  selfExplain={
                    c.preconditionDelta || c.postconditionDelta
                      ? {
                          prompt: `Explain in your own words why this is ${c.safety} under Design-by-Contract.`,
                          rationale: (
                            <div className="space-y-0.5 text-xs text-muted-ink">
                              {c.preconditionDelta && (
                                <div>
                                  <span className="font-medium text-ink">precondition:</span>{" "}
                                  {c.preconditionDelta}
                                </div>
                              )}
                              {c.postconditionDelta && (
                                <div>
                                  <span className="font-medium text-ink">postcondition:</span>{" "}
                                  {c.postconditionDelta}
                                </div>
                              )}
                            </div>
                          ),
                        }
                      : undefined
                  }
                >
                  <Badge tone={safetyTone(c.safety)}>{c.safety}</Badge>
                </PredictReveal>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
