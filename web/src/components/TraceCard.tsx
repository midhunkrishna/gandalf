import { ArrowRight } from "lucide-react";
import type { TraceCard as TraceCardT } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { safetyTone } from "@/lib/concept.ts";

/** Worked-example card: one input → before vs after output, divergent state, GWT, safety. */
export function TraceCard({ card }: { card: TraceCardT }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
          input
        </span>
        <Badge tone={safetyTone(card.safety)}>{card.safety}</Badge>
      </div>
      <div className="mb-3 rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-ink">
        {card.input}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-removed">before</div>
          <div className="rounded-md border border-removed/20 bg-removed/5 p-2.5 text-sm leading-relaxed text-ink">
            {card.beforeOutput}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-added">after</div>
          <div className="rounded-md border border-added/20 bg-added/5 p-2.5 text-sm leading-relaxed text-ink">
            {card.afterOutput}
          </div>
        </div>
      </div>
      {card.divergentState.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
            divergent state
          </div>
          {card.divergentState.map((d, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="font-mono font-medium text-ink">{d.name}</span>
              <span className="text-removed">{d.before}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-ink" />
              <span className="text-added">{d.after}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 border-t border-line pt-2.5 text-xs italic leading-relaxed text-muted-ink">
        {card.gwt}
      </p>
    </div>
  );
}
