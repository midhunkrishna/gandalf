import type { LessonBundle } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { TieredExplanation } from "@/components/TieredExplanation.tsx";
import { safetyTone } from "@/lib/concept.ts";

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
            <div key={i} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={safetyTone(c.safety)}>{c.safety}</Badge>
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
              {(c.preconditionDelta || c.postconditionDelta) && (
                <div className="mt-2 space-y-0.5 text-xs text-muted-ink">
                  {c.preconditionDelta && (
                    <div>
                      <span className="font-medium text-ink">precondition:</span> {c.preconditionDelta}
                    </div>
                  )}
                  {c.postconditionDelta && (
                    <div>
                      <span className="font-medium text-ink">postcondition:</span>{" "}
                      {c.postconditionDelta}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
