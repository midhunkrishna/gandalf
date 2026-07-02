import type { Tldr as TldrT } from "@engine/core/schemas.ts";

const ROWS: Array<[string, keyof TldrT, string]> = [
  ["Before", "before", "removed"],
  ["Now", "now", "added"],
  ["Behavior changed", "behaviorChanged", "modified"],
];

export function Tldr({ tldr }: { tldr: TldrT }) {
  return (
    <div className="space-y-2.5">
      {ROWS.map(([label, key, tone]) => (
        <div key={key} className="rounded-md border border-line bg-surface p-3">
          <div
            className="mb-1 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em]"
            style={{ color: `hsl(var(--${tone}))` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(var(--${tone}))` }} />
            {label}
          </div>
          <p className="text-sm leading-relaxed text-ink">{tldr[key]}</p>
        </div>
      ))}
    </div>
  );
}
