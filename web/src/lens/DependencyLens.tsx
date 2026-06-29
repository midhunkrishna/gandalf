import { useMemo, useState } from "react";
import { MousePointerClick } from "lucide-react";
import type { LessonBundle, FileChange } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { DependencyGraph } from "@/components/DependencyGraph.tsx";
import { Tldr } from "@/components/Tldr.tsx";
import { CodePanel } from "@/components/CodePanel.tsx";
import { TieredExplanation } from "@/components/TieredExplanation.tsx";
import { safetyTone } from "@/lib/concept.ts";

function fileForNode(lesson: LessonBundle, nodeId: string | null): FileChange | null {
  if (!nodeId) return null;
  const direct = lesson.files.find((f) => f.path === nodeId);
  if (direct) return direct;
  const node = lesson.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return lesson.files.find((f) => f.path === node.module || f.module === node.module) ?? null;
}

const LEGEND = ["added", "removed", "modified", "unchanged"] as const;

export function DependencyLens({ lesson }: { lesson: LessonBundle }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(460);
  const file = useMemo(() => fileForNode(lesson, selectedId), [lesson, selectedId]);
  const contracts = useMemo(
    () => (file ? lesson.contracts.filter((c) => c.file === file.path) : []),
    [lesson, file],
  );

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(Math.max(startW + (startX - ev.clientX), 360), window.innerWidth - 360);
      setSidebarWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="relative min-w-0 flex-1">
        <DependencyGraph graph={lesson.graph} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-md border border-line bg-bg/85 px-3 py-1.5 text-[0.7rem] shadow-sm backdrop-blur">
          {LEGEND.map((tone) => (
            <span key={tone} className="flex items-center gap-1 text-muted-ink">
              <span className="h-2 w-2 rounded-full" style={{ background: `hsl(var(--${tone}))` }} />
              {tone}
            </span>
          ))}
        </div>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        onMouseDown={startDrag}
        className="w-1.5 shrink-0 cursor-col-resize bg-line/50 transition-colors duration-fast hover:bg-primary/50"
      />

      <aside
        style={{ width: sidebarWidth }}
        className="shrink-0 overflow-y-auto border-l border-line bg-bg p-5"
      >
        {!file ? (
          <div className="space-y-5">
            <div className="rounded-md border border-dashed border-line bg-surface/50 p-4 text-sm text-muted-ink">
              <MousePointerClick className="mb-2 h-5 w-5 text-primary" />
              Click a module in the graph to see what changed — before / after, the contract deltas,
              and a split-screen diff. Drag the divider to widen this panel.
            </div>
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink">
                How the modules relate
              </h2>
              <TieredExplanation text={lesson.explanations.dependency} className="text-sm leading-relaxed text-ink" />
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
              <CodePanel file={file} wide={sidebarWidth >= 720} />
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
