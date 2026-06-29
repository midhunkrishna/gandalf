import type { LessonBundle } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { Reveal } from "@/components/Reveal.tsx";
import { statusTone } from "@/lib/concept.ts";
import { useFileFilter } from "@/lib/fileFilter.tsx";

const H3 = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink";

export function OverviewLens({ lesson }: { lesson: LessonBundle }) {
  const m = lesson.meta;
  const { visible } = useFileFilter();
  const changed = lesson.files.filter((f) => f.status !== "unchanged" && visible(f.path));
  const hotspots = lesson.complexity.hotspots.filter((h) => visible(h.path)).slice(0, 6);
  const maxScore = hotspots[0]?.score ?? 1;

  const stats: Array<[string, string]> = [
    ["Verdict", m.verdict === "behavioral" ? "Behavioral" : "Refactor"],
    ["Files", String(lesson.files.length)],
    ["Contracts", String(lesson.contracts.length)],
    ["Breaking", String(m.breakingCount)],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-3">
        <h2 className="text-2xl">Overview</h2>
        <p className="max-w-prose text-[0.95rem] leading-relaxed text-ink">{m.summary}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([k, v], i) => (
          <Reveal key={k} delay={i * 0.05} className="rounded-lg border border-line bg-surface p-3">
            <div className="text-xs text-muted-ink">{k}</div>
            <div className="font-display text-lg font-semibold text-ink">{v}</div>
          </Reveal>
        ))}
      </div>

      <Reveal as="section" className="space-y-2">
        <h3 className={H3}>Changed files</h3>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {changed.map((f, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: `hsl(var(--${statusTone(f.status)}))` }}
              />
              <span className="truncate font-mono text-xs text-ink">{f.path}</span>
              <Badge tone={statusTone(f.status)} className="ml-auto shrink-0">
                {f.status}
              </Badge>
            </li>
          ))}
        </ul>
      </Reveal>

      {hotspots.length > 0 && (
        <Reveal as="section" className="space-y-2">
          <h3 className={H3}>
            Hotspots{" "}
            <span className="font-normal normal-case tracking-normal text-muted-ink">
              — change-frequency × complexity
            </span>
          </h3>
          <ul className="space-y-1.5">
            {hotspots.map((h, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="truncate font-mono text-xs text-ink">{h.path}</span>
                <span className="shrink-0 text-xs text-muted-ink">{h.changeCount} commits</span>
                <div className="ml-auto h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (h.score / maxScore) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}
