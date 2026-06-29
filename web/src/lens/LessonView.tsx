import { useMemo, useState } from "react";
import { MousePointerClick } from "lucide-react";
import type { LessonBundle, FileChange } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { DependencyGraph } from "@/components/DependencyGraph.tsx";
import { Tldr } from "@/components/Tldr.tsx";
import { CodePanel } from "@/components/CodePanel.tsx";
import { safetyTone } from "@/lib/concept.ts";

function fileForNode(lesson: LessonBundle, nodeId: string | null): FileChange | null {
  if (!nodeId) return null;
  const direct = lesson.files.find((f) => f.path === nodeId);
  if (direct) return direct;
  const node = lesson.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return lesson.files.find((f) => f.path === node.module || f.module === node.module) ?? null;
}

const LEGEND: Array<[string, string]> = [
  ["added", "added"],
  ["removed", "removed"],
  ["modified", "modified"],
  ["unchanged", "unchanged"],
];

export function LessonView({ lesson }: { lesson: LessonBundle }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const file = useMemo(() => fileForNode(lesson, selectedId), [lesson, selectedId]);
  const contracts = useMemo(
    () => (file ? lesson.contracts.filter((c) => c.file === file.path) : []),
    [lesson, file],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line bg-surface/40 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl">{lesson.meta.title}</h1>
          <Badge tone={lesson.meta.verdict === "behavioral" ? "modified" : "safe"}>
            {lesson.meta.verdict === "behavioral" ? "behavioral change" : "refactor-only"}
          </Badge>
          {lesson.meta.breakingCount > 0 && (
            <Badge tone="breaking">{lesson.meta.breakingCount} breaking</Badge>
          )}
        </div>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-ink">
          {lesson.meta.hypothesis}
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <DependencyGraph graph={lesson.graph} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-md border border-line bg-bg/85 px-3 py-1.5 text-[0.7rem] shadow-sm backdrop-blur">
            {LEGEND.map(([name, tone]) => (
              <span key={name} className="flex items-center gap-1 text-muted-ink">
                <span className="h-2 w-2 rounded-full" style={{ background: `hsl(var(--${tone}))` }} />
                {name}
              </span>
            ))}
          </div>
        </div>

        <aside className="w-[460px] shrink-0 overflow-y-auto border-l border-line bg-bg p-5">
          {!file ? (
            <div className="space-y-5">
              <div className="rounded-md border border-dashed border-line bg-surface/50 p-4 text-sm text-muted-ink">
                <MousePointerClick className="mb-2 h-5 w-5 text-primary" />
                Click a module in the graph to see what changed — before / after, the contract
                deltas, and a split-screen diff.
              </div>
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink">
                  Summary
                </h2>
                <p className="text-sm leading-relaxed text-ink">{lesson.meta.summary}</p>
              </section>
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink">
                  Conditional equivalence
                </h2>
                <p className="text-sm leading-relaxed text-ink">
                  {lesson.behavioral.conditionalEquivalence}
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="font-mono text-xs text-muted-ink">{file.module}</div>
                <div className="font-mono text-sm font-medium text-ink">{file.path}</div>
              </div>
              <Tldr tldr={file.tldr} />
              {contracts.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink">
                    Contract changes
                  </h2>
                  <ul className="space-y-1.5">
                    {contracts.map((c) => (
                      <li key={c.symbol} className="flex items-center gap-2 text-sm">
                        <Badge tone={safetyTone(c.safety)}>{c.safety}</Badge>
                        <span className="font-mono text-xs text-ink">{c.symbol}</span>
                        <span className="text-xs text-muted-ink">({c.changeType})</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink">
                  Diff
                </h2>
                <CodePanel file={file} />
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
