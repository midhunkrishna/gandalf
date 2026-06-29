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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import type { ModuleGraphDelta } from "@engine/core/schemas.ts";
import { statusTone, toneColor, type ConceptTone } from "@/lib/concept.ts";
import { cn } from "@/lib/cn.ts";

const NODE_W = 184;
const NODE_H = 54;
const elk = new ELK();

interface ConceptData extends Record<string, unknown> {
  label: string;
  sublabel: string;
  tone: ConceptTone;
  rippled: boolean;
  selected: boolean;
}

function ConceptNode({ data }: NodeProps<Node<ConceptData>>) {
  const { label, sublabel, tone, rippled, selected } = data;
  return (
    <div
      className={cn(
        "flex h-[54px] w-[184px] flex-col justify-center rounded-md border bg-surface px-3 shadow-sm transition-shadow",
        selected ? "ring-2 ring-ring ring-offset-2 ring-offset-bg" : "hover:shadow-md",
        rippled && !selected && "border-dashed",
      )}
      style={{ borderColor: toneColor(tone), borderLeftWidth: 3 }}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-line" />
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: toneColor(tone) }} />
        <span className="truncate font-mono text-xs font-medium text-ink">{label}</span>
      </div>
      <span className="truncate pl-3.5 text-[0.65rem] text-muted-ink">{sublabel}</span>
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
  const [nodes, setNodes] = useState<Node<ConceptData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const ripple = useMemo(() => new Set(graph.rippleTargets), [graph.rippleTargets]);
  const nodeIds = useMemo(() => new Set(graph.nodes.map((n) => n.id)), [graph.nodes]);

  useEffect(() => {
    let cancelled = false;
    const validEdges = graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
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
        setNodes(
          graph.nodes.map((n) => ({
            id: n.id,
            type: "concept",
            position: pos.get(n.id) ?? { x: 0, y: 0 },
            data: {
              label: n.id.split("/").pop() ?? n.id,
              sublabel: n.module === n.id ? n.kind : n.module,
              tone: statusTone(n.status),
              rippled: ripple.has(n.id) || ripple.has(n.module),
              selected: false,
            },
          })),
        );
        setEdges(
          validEdges.map((e, i) => {
            const tone = statusTone(e.status);
            return {
              id: `e${i}`,
              source: e.from,
              target: e.to,
              label: e.kind,
              animated: e.status === "added",
              labelStyle: { fontSize: 10, fill: "hsl(var(--muted-ink))" },
              labelBgStyle: { fill: "hsl(var(--bg))" },
              style: {
                stroke: toneColor(tone),
                strokeWidth: e.status === "unchanged" ? 1 : 1.75,
                strokeDasharray: e.status === "removed" ? "5 4" : undefined,
                opacity: e.status === "unchanged" ? 0.5 : 1,
              },
              markerEnd: { type: MarkerType.ArrowClosed, color: toneColor(tone), width: 16, height: 16 },
            } satisfies Edge;
          }),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [graph, nodeIds, ripple]);

  const styledNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, selected: n.id === selectedId } })),
    [nodes, selectedId],
  );

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      nodesDraggable={false}
      className="bg-bg"
    >
      <Background color="hsl(var(--line))" gap={20} size={1} />
      <Controls showInteractive={false} className="!shadow-md" />
    </ReactFlow>
  );
}
