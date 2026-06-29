import { useMemo, useRef, useState } from "react";
import { hierarchy, treemap } from "d3-hierarchy";
import type { Hotspot } from "@engine/core/schemas.ts";

interface Datum {
  path?: string;
  complexity?: number | null;
  churn?: number;
  changeCount?: number;
  score?: number;
  value?: number;
  children?: Datum[];
}

const base = (p: string) => p.split("/").pop() ?? p;

/** Hotspot treemap: area = churn, fill intensity = complexity (Tornhill-style). Hover for details. */
export function Treemap({ hotspots }: { hotspots: Hotspot[] }) {
  const width = 720;
  const height = 260;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ d: Datum; x: number; y: number } | null>(null);

  const leaves = useMemo(() => {
    const root = hierarchy<Datum>({
      children: hotspots.map((h) => ({
        path: h.path,
        complexity: h.complexity,
        churn: h.churn,
        changeCount: h.changeCount,
        score: h.score,
        value: Math.max(1, h.churn),
      })),
    }).sum((d) => d.value ?? 0);
    return treemap<Datum>().size([width, height]).paddingInner(3)(root).leaves();
  }, [hotspots]);

  const maxC = Math.max(1, ...hotspots.map((h) => h.complexity ?? 0));

  const at = (e: React.MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {leaves.map((leaf, i) => {
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          const complexity = leaf.data.complexity;
          const intensity = complexity != null ? complexity / maxC : 0.35;
          return (
            <g
              key={i}
              onMouseEnter={(e) => setHover({ d: leaf.data, ...at(e) })}
              onMouseMove={(e) => setHover((prev) => (prev ? { ...prev, ...at(e) } : { d: leaf.data, ...at(e) }))}
              className="cursor-default"
            >
              <rect
                x={leaf.x0}
                y={leaf.y0}
                width={w}
                height={h}
                rx={3}
                fill={`hsl(var(--primary) / ${0.16 + intensity * 0.55})`}
                stroke={hover?.d === leaf.data ? "hsl(var(--primary))" : "hsl(var(--bg))"}
                strokeWidth={hover?.d === leaf.data ? 1.5 : 1}
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

      {hover && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-md border border-line bg-bg px-3 py-2 text-xs shadow-md"
          style={{ left: Math.min(hover.x + 12, (wrapRef.current?.clientWidth ?? 0) - 180), top: hover.y + 12 }}
        >
          <div className="mb-1 font-mono text-[0.7rem] text-ink">{hover.d.path}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-ink">
            <span>commits</span>
            <span className="text-right text-ink">{hover.d.changeCount ?? "—"}</span>
            <span>churn (LOC)</span>
            <span className="text-right text-ink">{hover.d.churn ?? "—"}</span>
            <span>complexity</span>
            <span className="text-right text-ink">{hover.d.complexity ?? "—"}</span>
            <span>hotspot score</span>
            <span className="text-right font-medium text-primary">{hover.d.score?.toFixed(1) ?? "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
