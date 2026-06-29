import type { LessonBundle, PatternFinding } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { AdrCard } from "@/components/AdrCard.tsx";

const H3 = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink";
const base = (p: string) => p.split("/").pop() ?? p;

function statusTone(s: PatternFinding["status"]): "added" | "removed" | "neutral" {
  return s === "added" ? "added" : s === "removed" ? "removed" : "neutral";
}

export function PatternsLens({ lesson }: { lesson: LessonBundle }) {
  const p = lesson.patterns;
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-2">
        <h2 className="text-2xl">Patterns &amp; smells</h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-ink">
          Design/architecture patterns and code smells this change introduces or removes — each with
          quoted evidence and a confidence level. Identified by Claude, grounded in the diff.
        </p>
      </header>

      {p.detected.length > 0 && (
        <section className="space-y-3">
          {p.detected.map((f, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(f.status)}>{f.status}</Badge>
                <span className="font-medium text-ink">{f.name}</span>
                <span className="text-xs text-muted-ink">{f.kind}</span>
                <span className="ml-auto text-xs text-muted-ink">confidence: {f.confidence}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink">{f.note}</p>
              {f.evidenceLines.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {f.evidenceLines.map((e, j) => (
                    <span
                      key={j}
                      className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-ink"
                    >
                      {base(e.file)}:{e.line}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {p.adr && (
        <section className="space-y-3">
          <h3 className={H3}>Architecture decision</h3>
          <AdrCard adr={p.adr} />
        </section>
      )}
    </div>
  );
}
