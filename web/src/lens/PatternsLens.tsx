import type { LessonBundle, PatternFinding } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { AdrCard } from "@/components/AdrCard.tsx";
import { Reveal } from "@/components/Reveal.tsx";

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
          The patterns and smells this change introduces or removes. Every claim quotes its
          evidence and carries a confidence level.
        </p>
      </header>

      {p.detected.length > 0 && (
        <section className="space-y-3">
          {p.detected.map((f, i) => (
            <Reveal key={i} delay={Math.min(i, 5) * 0.05} className="rounded-lg border border-line bg-surface p-4">
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
            </Reveal>
          ))}
        </section>
      )}

      {p.adr && (
        <Reveal as="section">
          <AdrCard adr={p.adr} />
        </Reveal>
      )}
    </div>
  );
}
