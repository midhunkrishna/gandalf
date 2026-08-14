import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Maximize2, Minimize2, Columns2, Rows2 } from "lucide-react";
import type { LessonBundle, FileChange, ModuleGraphDelta } from "@engine/core/schemas.ts";
import { normalizeModule } from "@engine/core/modules.ts";
import { Badge } from "@/ui/badge.tsx";
import { DependencyGraph } from "@/components/DependencyGraph.tsx";
import { Tldr } from "@/components/Tldr.tsx";
import { CodePanel } from "@/components/CodePanel.tsx";
import { LessonExplanation } from "@/components/TieredExplanation.tsx";
import { safetyTone } from "@/lib/concept.ts";
import { useFileFilter } from "@/lib/fileFilter.tsx";
import { SectionHeading } from "@/ui/SectionHeading.tsx";
import { DoodleGraph } from "@/ui/doodles.tsx";
import { useRoute, navigate, contractAnchor, resolveContractAnchor, NO_DETAIL } from "@/lib/router.ts";
import { cn } from "@/lib/cn.ts";

/**
 * All files a graph node maps to, best match first. node.module comes from LLM
 * synthesis and doesn't always match the deterministic file.module taxonomy —
 * fall back from exact equality to basename / path-prefix / normalized-module
 * matches. Basename matches prefer the node's own module, so a same-named file
 * in an unrelated module can't hijack the click. The full in-module list lets
 * the sidebar offer sibling files instead of hiding them.
 */
function filesForNode(lesson: LessonBundle, nodeId: string | null): FileChange[] {
  if (!nodeId) return [];
  const direct = lesson.files.find((f) => f.path === nodeId);
  if (direct) return [direct];
  const node = lesson.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const stem = (p: string) => p.split("/").pop()!.replace(/\.[^.]+$/, "");
  const inModule = (f: FileChange) =>
    f.path.startsWith(`${node.module}/`) ||
    f.module === node.module ||
    f.module === normalizeModule(node.module);
  const byStem = lesson.files.filter((f) => stem(f.path) === node.id);
  const primary = lesson.files.find((f) => f.path === node.module) ?? byStem.find(inModule) ?? byStem[0] ?? null;
  const siblings = lesson.files.filter((f) => f !== primary && inModule(f));
  return primary ? [primary, ...siblings] : siblings;
}

const LEGEND = ["added", "removed", "modified", "unchanged"] as const;
const toolBtn =
  "rounded-md border border-line p-1 text-muted-ink transition-colors duration-fast hover:border-primary/50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

export function DependencyLens({ lesson }: { lesson: LessonBundle }) {
  // The URL owns the selected node (deep-linkable); replace-mode keeps
  // graph-clicking from flooding the history. Manual selection drops any
  // contract-jump focus/back state — it belongs to the jump, not the node.
  const route = useRoute();
  const selectedId = route.node;
  const setSelectedId = (id: string | null) =>
    navigate({ ...NO_DETAIL, node: id }, { replace: true });
  // The contract we arrived from (back chip); a stale anchor renders nothing.
  const fromContract = useMemo(
    () => (route.from ? resolveContractAnchor(lesson.contracts, route.from) : null),
    [route.from, lesson.contracts],
  );
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

  const nodeFiles = useMemo(() => filesForNode(lesson, selectedId), [lesson, selectedId]);
  const [fileIdx, setFileIdx] = useState(0);
  useEffect(() => setFileIdx(0), [selectedId]);
  const file = nodeFiles[Math.min(fileIdx, nodeFiles.length - 1)] ?? null;

  // When the selection is a file path (a contract jump), highlight the graph
  // node that owns that file — the sidebar stays exact, the graph shows home.
  const graphSelectedId = useMemo(() => {
    if (!selectedId) return null;
    if (lesson.graph.nodes.some((n) => n.id === selectedId)) return selectedId;
    const owner = lesson.graph.nodes.find((n) =>
      filesForNode(lesson, n.id).some((f) => f.path === selectedId),
    );
    return owner?.id ?? null;
  }, [lesson, selectedId]);
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
            <DependencyGraph graph={graph} selectedId={graphSelectedId} onSelect={setSelectedId} />
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
        {fromContract && (
          // Sticky: the diff auto-scrolls to the focused line, and the way back
          // must stay one visible click away.
          <div className="sticky top-0 z-20 flex h-[42px] items-center border-b border-line bg-bg/95 px-5 backdrop-blur">
            <button
              onClick={() => navigate({ tab: "contract", ...NO_DETAIL, contract: contractAnchor(fromContract) })}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted-ink transition-colors duration-fast hover:border-primary/50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              title="Return to this contract in the Contracts lens"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                Back to <span className="font-mono text-ink">{fromContract.symbol}</span>
              </span>
            </button>
          </div>
        )}
        {!file ? (
          <div className="space-y-5 p-5">
            <div className="rounded-md border border-dashed border-line bg-surface/50 p-4 text-sm text-muted-ink">
              <DoodleGraph className="mb-3 h-14 w-24" />
              Pick a module in the graph. This panel fills with its story: what it did before, what
              it does now, which contracts moved, and the diff itself.
            </div>
            {lesson.meta.profile !== "lite" && (
              <section className="space-y-2">
                <SectionHeading>How the modules relate</SectionHeading>
                <LessonExplanation lesson={lesson} lens="dependency" className="text-sm leading-relaxed text-ink" />
              </section>
            )}
          </div>
        ) : (
          <div>
            <div className="space-y-5 p-5 pb-4">
              <div className="space-y-2">
                {nodeFiles.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {nodeFiles.map((f, i) => (
                      <button
                        key={f.path}
                        onClick={() => setFileIdx(i)}
                        className={cn(
                          "rounded-md border px-2 py-0.5 font-mono text-[0.7rem] transition-colors duration-fast",
                          f === file
                            ? "border-primary/60 bg-primary/10 text-ink"
                            : "border-line text-muted-ink hover:border-primary/40 hover:text-ink",
                        )}
                      >
                        {f.path.split("/").pop()}
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <div className="font-mono text-xs text-muted-ink">{file.module}</div>
                  <div className="font-mono text-sm font-medium text-ink">{file.path}</div>
                </div>
              </div>
              <Tldr tldr={file.tldr} />
              {contracts.length > 0 && (
                <section className="space-y-2">
                  <SectionHeading>Contract changes</SectionHeading>
                  <ul className="space-y-1.5">
                    {contracts.map((c) => (
                      <li key={c.symbol}>
                        <button
                          onClick={() =>
                            c.beaconLines.length &&
                            navigate({ line: c.beaconLines[0] }, { replace: true })
                          }
                          title={c.beaconLines.length ? `Show in the diff (line ${c.beaconLines[0]})` : undefined}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm text-left text-sm",
                            c.beaconLines.length &&
                              "transition-colors duration-fast hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                          )}
                        >
                          <Badge tone={safetyTone(c.safety)}>{c.safety}</Badge>
                          <span className="truncate font-mono text-xs text-ink">{c.symbol}</span>
                          <span className="shrink-0 text-xs text-muted-ink">({c.changeType})</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Diff toolbar: pinned to the top of the scrolling panel, floats over the diff on scroll
                (below the back chip when one is present). */}
            <div
              className={cn(
                "sticky z-10 flex items-center justify-between gap-2 border-y border-line bg-bg/95 px-5 py-2 backdrop-blur",
                fromContract ? "top-[42px]" : "top-0",
              )}
            >
              <SectionHeading>Diff</SectionHeading>
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
              <CodePanel file={file} split={split} focusLine={route.line} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
