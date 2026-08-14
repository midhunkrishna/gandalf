import type { LessonBundle, TieredText } from "@engine/core/schemas.ts";
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

/**
 * One lens's tiered explanation, dropped entirely on a lite lesson: that profile never
 * runs the explanations pass, so its section holds a placeholder, not prose.
 */
export function LessonExplanation({
  lesson,
  lens,
  className,
}: {
  lesson: LessonBundle;
  lens: keyof LessonBundle["explanations"];
  className?: string;
}) {
  if (lesson.meta.profile === "lite") return null;
  return <TieredExplanation text={lesson.explanations[lens]} className={className} />;
}
