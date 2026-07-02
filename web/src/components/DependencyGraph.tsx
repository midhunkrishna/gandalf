import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import {
  AppWindow,
  Cog,
  Database,
  FlaskConical,
  Image as ImageIcon,
  LayoutTemplate,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { ModuleGraphDelta } from "@engine/core/schemas.ts";
import { statusTone, toneColor, type ConceptTone } from "@/lib/concept.ts";
import { prefersReducedMotion } from "@/lib/reducedMotion.ts";
import { cn } from "@/lib/cn.ts";

const NODE_W = 184;
const NODE_H = 54;
const elk = new ELK();

const KIND_ICON: Record<string, LucideIcon> = {
  app: AppWindow,
  feature: LayoutTemplate,
  engine: Cog,
  model: Database,
  test: FlaskConical,
  asset: ImageIcon,
};

interface ConceptData extends Record<string, unknown> {
  label: string;
  sublabel: string;
  kind: string;
  tone: ConceptTone;
  rippled: boolean;
  selected: boolean;
  dimmed: boolean;
  enterDelay: number;
}

function ConceptNode({ data }: NodeProps<Node<ConceptData>>) {
  const { label, sublabel, kind, tone, rippled, selected, dimmed, enterDelay } = data;
  const Icon = KIND_ICON[kind] ?? Package;
  const changed = tone !== "unchanged";
  return (
    <div
      className={cn(
        "gg-node flex h-[54px] w-[184px] flex-col justify-center rounded-md border px-3 transition-opacity duration-150",
        selected ? "ring-2 ring-ring ring-offset-2 ring-offset-bg" : "shadow-sm",
        rippled && !selected && "border-dashed",
        dimmed && "opacity-25",
      )}
      data-glow={changed && !selected}
      style={
        {
          "--tone": `var(--${tone})`,
          borderColor: changed ? `hsl(var(--tone) / 0.55)` : "hsl(var(--line))",
          borderLeftWidth: 3,
          borderLeftColor: toneColor(tone),
          background: changed
            ? `linear-gradient(hsl(var(--tone) / 0.07), hsl(var(--tone) / 0.07)), hsl(var(--surface))`
            : "hsl(var(--surface))",
          animation:
            `gg-node-in 420ms cubic-bezier(0.16, 1, 0.3, 1) ${enterDelay}ms backwards` +
            (rippled && !selected ? ", gg-ripple 2.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite" : ""),
        } as React.CSSProperties
      }
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-line" />
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: toneColor(tone) }} strokeWidth={2.25} />
        <span className="truncate font-mono text-xs font-medium text-ink">{label}</span>
      </div>
      <span className="truncate pl-5 text-[0.65rem] text-muted-ink">{sublabel}</span>
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-line" />
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

export function DependencyGraph({
  graph,
  selectedId,
  onSelect,
}: {
  graph: ModuleGraphDelta;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [positioned, setPositioned] = useState<Node<ConceptData>[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<Node<ConceptData>, Edge> | null>(null);
  const ripple = useMemo(() => new Set(graph.rippleTargets), [graph.rippleTargets]);
  const nodeIds = useMemo(() => new Set(graph.nodes.map((n) => n.id)), [graph.nodes]);
  const validEdges = useMemo(
    () => graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)),
    [graph.edges, nodeIds],
  );

  // The hovered (or, failing that, selected) node defines the focused neighborhood;
  // everything outside it dims so impact propagation reads at a glance.
  const focusId = hoverId ?? selectedId;
  const neighborhood = useMemo(() => {
    if (!focusId) return null;
    const set = new Set([focusId]);
    for (const e of validEdges) {
      if (e.from === focusId) set.add(e.to);
      if (e.to === focusId) set.add(e.from);
    }
    return set;
  }, [focusId, validEdges]);

  useEffect(() => {
    let cancelled = false;
    elk
      .layout({
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "RIGHT",
          "elk.layered.spacing.nodeNodeBetweenLayers": "90",
          "elk.spacing.nodeNode": "36",
        },
        children: graph.nodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
        edges: validEdges.map((e, i) => ({ id: `e${i}`, sources: [e.from], targets: [e.to] })),
      })
      .then((laid) => {
        if (cancelled) return;
        const pos = new Map(laid.children?.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
        setPositioned(
          graph.nodes.map((n, i) => ({
            id: n.id,
            type: "concept",
            position: pos.get(n.id) ?? { x: 0, y: 0 },
            data: {
              label: n.id.split("/").pop() ?? n.id,
              sublabel: n.module === n.id ? n.kind : n.module,
              kind: n.kind,
              tone: statusTone(n.status),
              rippled: ripple.has(n.id) || ripple.has(n.module),
              selected: false,
              dimmed: false,
              enterDelay: Math.min(i * 45, 600),
            },
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [graph.nodes, validEdges, ripple]);

  // Cinematic entrance: ease the viewport to fit once the layout lands.
  useEffect(() => {
    if (!flow || positioned.length === 0) return;
    flow.fitView({ padding: 0.2, duration: prefersReducedMotion() ? 0 : 550 });
  }, [flow, positioned]);

  const nodes = useMemo(
    () =>
      positioned.map((n) => ({
        ...n,
        data: {
          ...n.data,
          selected: n.id === selectedId,
          dimmed: neighborhood ? !neighborhood.has(n.id) : false,
        },
      })),
    [positioned, selectedId, neighborhood],
  );

  const edges = useMemo(
    () =>
      validEdges.map((e, i) => {
        const tone = statusTone(e.status);
        const inFocus = focusId !== null && (e.from === focusId || e.to === focusId);
        const outOfFocus = focusId !== null && !inFocus;
        const baseOpacity = e.status === "unchanged" ? 0.5 : 1;
        return {
          id: `e${i}`,
          source: e.from,
          target: e.to,
          // Labels appear only on the focused neighborhood — the resting canvas stays clean.
          label: inFocus ? e.kind : undefined,
          labelStyle: { fontSize: 10, fill: "hsl(var(--muted-ink))", fontFamily: "var(--font-mono)" },
          labelBgStyle: { fill: "hsl(var(--bg))", opacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          style: {
            stroke: toneColor(tone),
            strokeWidth: (e.status === "unchanged" ? 1 : 1.75) + (inFocus ? 0.75 : 0),
            strokeDasharray: e.status === "removed" ? "5 4" : undefined,
            opacity: outOfFocus ? 0.12 : inFocus ? 1 : baseOpacity,
            // Removed edges fade in (a draw-on would flash solid→dashed at the end).
            animation:
              e.status === "removed"
                ? `gg-fade-in 500ms ease-out ${100 + i * 40}ms backwards`
                : `gg-edge-draw 650ms ease-out ${100 + Math.min(i * 40, 500)}ms backwards`,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: toneColor(tone), width: 16, height: 16 },
        } satisfies Edge;
      }),
    [validEdges, focusId],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      onInit={setFlow}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      onNodeMouseEnter={(_, node) => setHoverId(node.id)}
      onNodeMouseLeave={() => setHoverId(null)}
      nodesDraggable={false}
      className="bg-bg"
    >
      <Background color="hsl(var(--line))" gap={20} size={1} />
      <Controls showInteractive={false} className="!shadow-md" />
    </ReactFlow>
  );
}
