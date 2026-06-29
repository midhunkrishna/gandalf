import { useMemo } from "react";
import { hierarchy, treemap } from "d3-hierarchy";
import type { Hotspot } from "@engine/core/schemas.ts";

interface Datum {
  path?: string;
  complexity?: number | null;
  value?: number;
  children?: Datum[];
}

const base = (p: string) => p.split("/").pop() ?? p;

/** Hotspot treemap: area = churn, fill intensity = complexity (Tornhill-style). */
export function Treemap({ hotspots }: { hotspots: Hotspot[] }) {
  const width = 720;
  const height = 260;

  const leaves = useMemo(() => {
    const root = hierarchy<Datum>({
      children: hotspots.map((h) => ({
        path: h.path,
        complexity: h.complexity,
        value: Math.max(1, h.churn),
      })),
    }).sum((d) => d.value ?? 0);
    return treemap<Datum>().size([width, height]).paddingInner(3)(root).leaves();
  }, [hotspots]);

  const maxC = Math.max(1, ...hotspots.map((h) => h.complexity ?? 0));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {leaves.map((leaf, i) => {
        const w = leaf.x1 - leaf.x0;
        const h = leaf.y1 - leaf.y0;
        const complexity = leaf.data.complexity;
        const intensity = complexity != null ? complexity / maxC : 0.35;
        return (
          <g key={i}>
            <rect
              x={leaf.x0}
              y={leaf.y0}
              width={w}
              height={h}
              rx={3}
              fill={`hsl(var(--primary) / ${0.16 + intensity * 0.55})`}
              stroke="hsl(var(--bg))"
              strokeWidth={1}
            />
            {w > 46 && h > 18 && leaf.data.path && (
              <text x={leaf.x0 + 6} y={leaf.y0 + 15} className="fill-ink" style={{ fontSize: 10 }}>
                {base(leaf.data.path)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
