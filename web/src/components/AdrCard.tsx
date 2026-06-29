import type { Adr } from "@engine/core/schemas.ts";

/** ADR with "Considered Options" — chosen approach + alternatives, value-neutral. */
export function AdrCard({ adr }: { adr: Adr }) {
  return (
    <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-ink">Decision</div>
        <h3 className="font-display text-lg font-semibold text-ink">{adr.title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-ink">
        <span className="font-medium text-muted-ink">Context. </span>
        {adr.context}
      </p>
      <p className="text-sm leading-relaxed text-ink">
        <span className="font-medium text-muted-ink">Decision. </span>
        {adr.decision}
      </p>
      {adr.consequences.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-ink">
            Consequences
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink">
            {adr.consequences.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {adr.options.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-ink">
            Considered options
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {adr.options.map((o, i) => (
              <div key={i} className="rounded-md border border-line bg-bg p-3">
                <div className="font-medium text-ink">{o.name}</div>
                <div className="mt-2 space-y-1 text-xs">
                  {o.pros.map((p, j) => (
                    <div key={`p${j}`} className="flex gap-1.5">
                      <span className="text-added">+</span>
                      <span className="text-ink">{p}</span>
                    </div>
                  ))}
                  {o.cons.map((p, j) => (
                    <div key={`c${j}`} className="flex gap-1.5">
                      <span className="text-removed">−</span>
                      <span className="text-ink">{p}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted-ink">
                  <span className="font-medium">Best when:</span> {o.bestWhen}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
