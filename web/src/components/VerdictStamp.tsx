import { cn } from "@/lib/cn.ts";

/**
 * Letterpress-style verdict stamp for the lesson "cover" surfaces (hero,
 * gallery cards, share card). Slightly rotated, double-ruled, token-hued.
 */
const SIZE = {
  sm: "px-1.5 py-0.5 text-[0.6rem] tracking-[0.12em]",
  md: "px-2.5 py-1 text-xs tracking-[0.16em]",
  lg: "px-4 py-1.5 text-lg tracking-[0.18em]",
} as const;

function Stamp({ label, tone, size, className }: { label: string; tone: string; size: keyof typeof SIZE; className?: string }) {
  return (
    <span
      className={cn("inline-block -rotate-2 select-none rounded-sm border-2 font-mono font-semibold uppercase", SIZE[size], className)}
      style={{
        color: `hsl(var(${tone}))`,
        borderColor: `hsl(var(${tone}) / 0.65)`,
        boxShadow: `inset 0 0 0 1px hsl(var(${tone}) / 0.25)`,
        background: `hsl(var(${tone}) / 0.06)`,
      }}
    >
      {label}
    </span>
  );
}

export function VerdictStamp({ verdict, size = "md", className }: { verdict: string; size?: keyof typeof SIZE; className?: string }) {
  const behavioral = verdict === "behavioral";
  return (
    <Stamp
      label={behavioral ? "behavioral change" : "refactor-only"}
      tone={behavioral ? "--modified" : "--sage"}
      size={size}
      className={className}
    />
  );
}

export function BreakingStamp({ count, size = "md", className }: { count: number; size?: keyof typeof SIZE; className?: string }) {
  if (count <= 0) return null;
  return <Stamp label={`${count} breaking`} tone="--danger" size={size} className={cn("rotate-1", className)} />;
}
