import { useMemo, useState, type ReactNode } from "react";
import { Check, X, Eye } from "lucide-react";
import { Reveal } from "@/components/Reveal.tsx";
import { useQuizMode } from "@/lib/quizMode.tsx";
import { cn } from "@/lib/cn.ts";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Predict-then-reveal: the reader commits a guess before `children` (the answer) is shown.
 * - distractors present → multiple choice over [answer, ...distractors] (pretesting + feedback).
 * - no distractors → free-text "think, then reveal" (generation effect).
 * Quiz mode off → renders the answer immediately. Feedback (the reveal) is always available.
 */
export function PredictReveal({
  answer,
  distractors = [],
  question = "Predict the result, then reveal.",
  children,
}: {
  answer: string;
  distractors?: string[];
  question?: string;
  children: ReactNode;
}) {
  const { quiz } = useQuizMode();
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  // Shuffle once per mount so option order is stable across re-renders.
  const options = useMemo(
    () => (distractors.length ? shuffle([answer, ...distractors]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!quiz) return <>{children}</>;

  if (revealed) {
    return (
      <div className="space-y-3">
        {options.length > 0 && picked != null && (
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              picked === answer ? "text-added" : "text-removed",
            )}
          >
            {picked === answer ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {picked === answer ? "You predicted correctly." : "Not quite — here's the actual result."}
          </div>
        )}
        <Reveal y={8}>{children}</Reveal>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-md border border-dashed border-primary/40 bg-primary/[0.04] p-3">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-primary">Predict</div>
      <p className="text-sm leading-relaxed text-ink">{question}</p>
      {options.length > 0 ? (
        <div className="space-y-1.5">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => {
                setPicked(opt);
                setRevealed(true);
              }}
              className="block w-full whitespace-pre-wrap rounded-md border border-line bg-surface px-3 py-2 text-left font-mono text-xs text-ink transition-colors duration-fast hover:border-primary/50 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <>
          <textarea
            rows={2}
            placeholder="Jot your prediction (optional)…"
            className="w-full resize-none rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          />
          <button
            onClick={() => setRevealed(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-ink transition-colors duration-fast hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Eye className="h-3.5 w-3.5" />
            Reveal answer
          </button>
        </>
      )}
    </div>
  );
}
