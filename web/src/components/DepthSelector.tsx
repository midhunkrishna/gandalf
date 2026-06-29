import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { DepthTier } from "@engine/core/schemas.ts";
import { useDepth } from "@/state/depth.tsx";
import { cn } from "@/lib/cn.ts";

const TIERS: Array<[DepthTier, string]> = [
  ["eli5", "ELI5"],
  ["junior", "Junior"],
  ["senior", "Senior"],
  ["architect", "Architect"],
];

export function DepthSelector() {
  const { depth, setDepth } = useDepth();
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-ink">Explain for</span>
      <ToggleGroup.Root
        type="single"
        value={depth}
        onValueChange={(v) => v && setDepth(v as DepthTier)}
        className="flex rounded-md border border-line p-0.5"
      >
        {TIERS.map(([v, label]) => (
          <ToggleGroup.Item
            key={v}
            value={v}
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors duration-fast",
              "data-[state=on]:bg-surface-2 data-[state=on]:text-ink data-[state=on]:shadow-xs",
              "text-muted-ink hover:text-ink",
            )}
          >
            {label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
