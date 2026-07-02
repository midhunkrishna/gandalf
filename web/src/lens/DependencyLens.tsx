import { useEffect, useMemo, useState } from "react";
import { MousePointerClick, Maximize2, Minimize2, Columns2, Rows2 } from "lucide-react";
import type { LessonBundle, FileChange, ModuleGraphDelta } from "@engine/core/schemas.ts";
import { normalizeModule } from "@engine/core/modules.ts";
import { Badge } from "@/ui/badge.tsx";
import { DependencyGraph } from "@/components/DependencyGraph.tsx";
import { Tldr } from "@/components/Tldr.tsx";
import { CodePanel } from "@/components/CodePanel.tsx";
import { TieredExplanation } from "@/components/TieredExplanation.tsx";
import { safetyTone } from "@/lib/concept.ts";
import { useFileFilter } from "@/lib/fileFilter.tsx";
import { cn } from "@/lib/cn.ts";

function fileForNode(lesson: LessonBundle, nodeId: string | null): FileChange | null {
  if (!nodeId) return null;
  const direct = lesson.files.find((f) => f.path === nodeId);
  if (direct) return direct;
  const node = lesson.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  // node.module comes from LLM synthesis and doesn't always match the
  // deterministic file.module taxonomy — fall back from exact equality to
  // basename / path-prefix / normalized-module matches, most specific first.
  const stem = (p: string) => p.split("/").pop()!.replace(/\.[^.]+$/, "");
  return (
    lesson.files.find((f) => f.path === node.module) ??
    lesson.files.find((f) => stem(f.path) === node.id) ??
    lesson.files.find((f) => f.path.startsWith(`${node.module}/`)) ??
    lesson.files.find((f) => f.module === node.module) ??
    lesson.files.find((f) => f.module === normalizeModule(node.module)) ??
    null
  );
}

const LEGEND = ["added", "removed", "modified", "unchanged"] as const;
const toolBtn =
  "rounded-md border border-line p-1 text-muted-ink transition-colors duration-fast hover:border-primary/50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

export function DependencyLens({ lesson }: { lesson: LessonBundle }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(460);
  const [maximized, setMaximized] = useState(false);
  const [split, setSplit] = useState(false);
  const { visible, showAll } = useFileFilter();

  // Hide config/generated modules from the graph when the filter is on.
  const graph = useMemo<ModuleGraphDelta>(() => {
    const nodes = lesson.graph.nodes.filter((n) => visible(n.id) && visible(n.module));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = lesson.graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    return { ...lesson.graph, nodes, edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.graph, showAll]);

  const file = useMemo(() => fileForNode(lesson, selectedId), [lesson, selectedId]);
  const contracts = useMemo(
    () => (file ? lesson.contracts.filter((c) => c.file === file.path) : []),
    [lesson, file],
  );

  // Esc resets non-default view state (un-maximize).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMaximized(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
      {!maximized && (
        <>
          <div className="relative min-w-0 flex-1">
            <DependencyGraph graph={graph} selectedId={selectedId} onSelect={setSelectedId} />
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
        </>
      )}

      <aside
        style={maximized ? undefined : { width: sidebarWidth }}
        className={cn("overflow-y-auto bg-bg", maximized ? "flex-1" : "shrink-0 border-l border-line")}
      >
        {!file ? (
          <div className="space-y-5 p-5">
            <div className="rounded-md border border-dashed border-line bg-surface/50 p-4 text-sm text-muted-ink">
              <MousePointerClick className="mb-2 h-5 w-5 text-primary" />
              Click a module in the graph to see what changed — before / after, the contract deltas,
              and the diff. Drag the divider to widen this panel, or maximize it to hide the graph.
            </div>
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink">
                How the modules relate
              </h2>
              <TieredExplanation text={lesson.explanations.dependency} className="text-sm leading-relaxed text-ink" />
            </section>
          </div>
        ) : (
          <div>
            <div className="space-y-5 p-5 pb-4">
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
            </div>

            {/* Diff toolbar: pinned to the top of the scrolling panel, floats over the diff on scroll. */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-y border-line bg-bg/95 px-5 py-2 backdrop-blur">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink">Diff</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSplit((s) => !s)}
                  className={cn(toolBtn, split && "border-primary/50 text-primary")}
                  aria-pressed={split}
                  aria-label={split ? "Unified diff" : "Split (before / after) diff"}
                  title={split ? "Unified view" : "Split view (before | after)"}
                >
                  {split ? <Rows2 className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setMaximized((m) => !m)}
                  className={cn(toolBtn, maximized && "border-primary/50 text-primary")}
                  aria-pressed={maximized}
                  aria-label={maximized ? "Restore graph (Esc)" : "Maximize diff (hide graph)"}
                  title={maximized ? "Restore graph — Esc" : "Maximize diff"}
                >
                  {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="p-5 pt-3">
              <CodePanel file={file} split={split} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
