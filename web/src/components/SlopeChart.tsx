import { motion, useReducedMotion } from "framer-motion";
import type { FnComplexity } from "@engine/core/schemas.ts";

type Metric = "cognitive" | "cyclomatic";

const DECEL = [0, 0, 0.2, 1] as const;

/**
 * Per-function before→after dumbbell, rendered as real SVG so the connector draws on
 * (motion.line pathLength) and the "after" dot pops in as the row scrolls into view.
 * Increase in complexity = red (worse), decrease = green (better). Reduced-motion users
 * get the final, fully-drawn state with no animation.
 */
export function SlopeChart({ data, metric }: { data: FnComplexity[]; metric: Metric }) {
  const reduce = useReducedMotion();
  const rows = data
    .map((d) => ({
      symbol: d.symbol,
      before: metric === "cognitive" ? d.cognitiveBefore : d.cyclomaticBefore,
      after: metric === "cognitive" ? d.cognitiveAfter : d.cyclomaticAfter,
    }))
    .filter((r) => r.before != null || r.after != null);

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-ink">
        No {metric} numbers for this change{metric === "cyclomatic" ? " — install lizard to measure them" : ""}.
      </p>
    );
  }

  const max = Math.max(1, ...rows.flatMap((r) => [r.before ?? 0, r.after ?? 0]));
  const animate = !reduce;

  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const b = r.before ?? r.after ?? 0;
        const a = r.after ?? r.before ?? 0;
        const dir = a > b ? "removed" : a < b ? "added" : "unchanged";
        // Keep dots clear of the SVG edges so they never clip.
        const bp = 2 + (b / max) * 96;
        const ap = 2 + (a / max) * 96;
        return (
          <div key={r.symbol} className="flex items-center gap-3 text-sm">
            <div className="w-44 shrink-0 truncate font-mono text-xs text-ink" title={r.symbol}>
              {r.symbol}
            </div>
            <svg className="h-5 flex-1 overflow-visible" preserveAspectRatio="none" aria-hidden>
              <line x1="0" x2="100%" y1="50%" y2="50%" stroke="hsl(var(--line))" strokeWidth={1} />
              <motion.line
                x1={`${bp}%`}
                y1="50%"
                x2={`${ap}%`}
                y2="50%"
                stroke={`hsl(var(--${dir}))`}
                strokeWidth={2}
                initial={animate ? { pathLength: 0 } : false}
                whileInView={animate ? { pathLength: 1 } : undefined}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.6, ease: DECEL, delay: Math.min(i, 8) * 0.03 }}
              />
              {/* before — hollow */}
              <circle
                cx={`${bp}%`}
                cy="50%"
                r={5}
                fill="hsl(var(--bg))"
                stroke="hsl(var(--muted-ink))"
                strokeWidth={2}
              />
              {/* after — filled, pops in */}
              <motion.circle
                cx={`${ap}%`}
                cy="50%"
                r={5}
                fill={`hsl(var(--${dir}))`}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                initial={animate ? { scale: 0 } : false}
                whileInView={animate ? { scale: 1 } : undefined}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.3, ease: DECEL, delay: Math.min(i, 8) * 0.03 + 0.3 }}
              />
            </svg>
            <div
              className="w-14 shrink-0 text-right font-mono text-xs"
              style={{ color: dir === "unchanged" ? undefined : `hsl(var(--${dir}))` }}
            >
              {r.before ?? "—"}→{r.after ?? "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
