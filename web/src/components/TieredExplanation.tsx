import type { TieredText } from "@engine/core/schemas.ts";
import { useDepth } from "@/state/depth.tsx";

/** Renders the explanation at the currently-selected audience tier. */
export function TieredExplanation({ text, className }: { text: TieredText; className?: string }) {
  const { depth } = useDepth();
  return (
    <p className={className ?? "max-w-prose text-[0.95rem] leading-relaxed text-ink"}>
      {text[depth]}
    </p>
  );
}
