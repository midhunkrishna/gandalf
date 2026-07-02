import { useMemo } from "react";
import type { ModuleGraphDelta } from "@engine/core/schemas.ts";
import { statusTone, toneColor } from "@/lib/concept.ts";

/**
 * Decorative "constellation" of the lesson's actual module graph — a faint
 * line drawing used behind the hero and on the share card. Deterministic
 * (hash-jittered arc), purely presentational.
 */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

const W = 800;
const H = 220;

export function Constellation({
  graph,
  className,
  style,
}: {
  graph: ModuleGraphDelta;
  className?: string;
  style?: React.CSSProperties;
}) {
  const layout = useMemo(() => {
    const n = graph.nodes.length;
    const pos = new Map<string, { x: number; y: number }>();
    graph.nodes.forEach((node, i) => {
      const t = n > 1 ? i / (n - 1) : 0.5;
      const jx = (hash01(node.id) - 0.5) * (W / Math.max(n, 4));
      const jy = hash01(node.id + "y") - 0.5;
      pos.set(node.id, {
        x: 40 + t * (W - 80) + jx,
        // gentle wave, jitter-spread
        y: H / 2 + Math.sin(t * Math.PI * 1.6 + hash01(node.id) * 2) * 46 + jy * 78,
      });
    });
    return pos;
  }, [graph.nodes]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {graph.edges.map((e, i) => {
        const a = layout.get(e.from);
        const b = layout.get(e.to);
        if (!a || !b) return null;
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="hsl(var(--ink))"
            strokeOpacity={0.1}
            strokeWidth={0.75}
          />
        );
      })}
      {graph.nodes.map((n) => {
        const p = layout.get(n.id)!;
        const tone = statusTone(n.status);
        const changed = tone !== "unchanged";
        return (
          <circle
            key={n.id}
            cx={p.x}
            cy={p.y}
            r={changed ? 3.2 : 2.2}
            fill={toneColor(tone)}
            fillOpacity={changed ? 0.75 : 0.4}
          />
        );
      })}
    </svg>
  );
}
