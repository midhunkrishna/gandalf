import type { FnComplexity } from "@engine/core/schemas.ts";

type Metric = "cognitive" | "cyclomatic";

/** Per-function before→after dumbbell. Increase = red (worse), decrease = green (better). */
export function SlopeChart({ data, metric }: { data: FnComplexity[]; metric: Metric }) {
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
        No {metric} data{metric === "cyclomatic" ? " (install `lizard` for measured cyclomatic complexity)" : ""}.
      </p>
    );
  }

  const max = Math.max(1, ...rows.flatMap((r) => [r.before ?? 0, r.after ?? 0]));

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const b = r.before ?? r.after ?? 0;
        const a = r.after ?? r.before ?? 0;
        const dir = a > b ? "removed" : a < b ? "added" : "unchanged";
        const bp = (b / max) * 100;
        const ap = (a / max) * 100;
        return (
          <div key={r.symbol} className="flex items-center gap-3 text-sm">
            <div className="w-44 shrink-0 truncate font-mono text-xs text-ink">{r.symbol}</div>
            <div className="relative h-5 flex-1">
              <div className="absolute top-1/2 h-px bg-line" style={{ left: 0, right: 0 }} />
              <div
                className="absolute top-1/2 h-[2px]"
                style={{
                  left: `${Math.min(bp, ap)}%`,
                  width: `${Math.abs(ap - bp)}%`,
                  background: `hsl(var(--${dir}))`,
                }}
              />
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted-ink bg-bg"
                style={{ left: `${bp}%` }}
                title={`before ${r.before ?? "—"}`}
              />
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${ap}%`, background: `hsl(var(--${dir}))` }}
                title={`after ${r.after ?? "—"}`}
              />
            </div>
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
