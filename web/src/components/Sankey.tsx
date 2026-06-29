import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { DataFlow } from "@engine/core/schemas.ts";

type SankeyData = NonNullable<DataFlow["sankey"]>;

/** Quantitative flow between modules/functions (d3-sankey, themed). */
export function Sankey({ data }: { data: SankeyData }) {
  const reduce = useReducedMotion();
  const animate = !reduce;
  const width = 720;
  const height = Math.max(160, data.nodes.length * 48);

  const graph = useMemo(() => {
    try {
      const layout = sankey<{ id: string; label?: string }, object>()
        .nodeId((d) => d.id)
        .nodeWidth(13)
        .nodePadding(18)
        .extent([
          [4, 6],
          [width - 4, height - 6],
        ]);
      return layout({
        nodes: data.nodes.map((n) => ({ ...n })),
        links: data.links.map((l) => ({ ...l })),
      });
    } catch {
      return null;
    }
  }, [data, height]);

  if (!graph) return null;
  const linkPath = sankeyLinkHorizontal<{ id: string; label?: string }, object>();

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {graph.links.map((l, i) => (
        <motion.path
          key={i}
          d={linkPath(l) ?? undefined}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeOpacity={0.22}
          strokeWidth={Math.max(1, l.width ?? 1)}
          initial={animate ? { pathLength: 0 } : false}
          whileInView={animate ? { pathLength: 1 } : undefined}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: [0, 0, 0.2, 1], delay: Math.min(i, 12) * 0.03 }}
        />
      ))}
      {graph.nodes.map((n, i) => {
        const x0 = n.x0 ?? 0;
        const x1 = n.x1 ?? 0;
        const y0 = n.y0 ?? 0;
        const y1 = n.y1 ?? 0;
        const left = x0 < width / 2;
        return (
          <g key={i}>
            <rect x={x0} y={y0} width={x1 - x0} height={Math.max(2, y1 - y0)} rx={2} fill="hsl(var(--sage))" />
            <text
              x={left ? x1 + 6 : x0 - 6}
              y={(y0 + y1) / 2}
              dy="0.32em"
              textAnchor={left ? "start" : "end"}
              style={{ fontSize: 10 }}
              className="fill-ink"
            >
              {n.label ?? n.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
