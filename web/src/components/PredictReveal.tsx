import { useMemo, useState, type ReactNode } from "react";
import { Check, X, Eye, MessageSquareQuote } from "lucide-react";
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

/** Optional post-reveal self-explanation stage: elicit "why" before showing the lesson's reasoning. */
export interface SelfExplain {
  prompt?: string;
  rationale: ReactNode;
}

/**
 * Predict-then-reveal: the reader commits a guess before `children` (the answer) is shown.
 * - distractors present → multiple choice over [answer, ...distractors] (pretesting + feedback).
 * - no distractors → free-text "think, then reveal" (generation effect); the typed guess is
 *   shown back beside the answer so the reader can compare (not discarded).
 * - selfExplain → after the reveal, the reader is prompted to explain WHY in their own words
 *   before the lesson's reasoning is shown (self-explanation effect, Bisra et al. 2018).
 * Quiz mode off → renders the answer (and reasoning) immediately.
 */
export function PredictReveal({
  answer,
  distractors = [],
  question = "Predict the result, then reveal.",
  selfExplain,
  children,
}: {
  answer: string;
  distractors?: string[];
  question?: string;
  selfExplain?: SelfExplain;
  children: ReactNode;
}) {
  const { quiz } = useQuizMode();
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [explanation, setExplanation] = useState("");
  const [explained, setExplained] = useState(false);
  // Shuffle once per mount so option order is stable across re-renders.
  const options = useMemo(
    () => (distractors.length ? shuffle([answer, ...distractors]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!quiz) {
    return (
      <div className="space-y-3">
        {children}
        {selfExplain?.rationale}
      </div>
    );
  }

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
            {picked === answer ? "You predicted correctly." : "Not quite. Here's what actually happens."}
          </div>
        )}
        {guess.trim() && (
          <div className="rounded-md border border-line bg-surface px-3 py-2">
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-ink">
              Your prediction
            </div>
            <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-ink">{guess}</p>
          </div>
        )}
        <Reveal y={8}>{children}</Reveal>
        {selfExplain &&
          (explained ? (
            <Reveal y={8} className="space-y-2">
              {explanation.trim() && (
                <div className="rounded-md border border-line bg-surface px-3 py-2">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-ink">
                    Your reasoning
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink">{explanation}</p>
                </div>
              )}
              {selfExplain.rationale}
            </Reveal>
          ) : (
            <div className="space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/[0.04] p-3">
              <div className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-primary">
                <MessageSquareQuote className="h-3.5 w-3.5" />
                Explain why
              </div>
              <p className="text-sm leading-relaxed text-ink">
                {selfExplain.prompt ?? "Explain in your own words why this is the result."}
              </p>
              <textarea
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Because… (optional)"
                className="w-full resize-none rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              />
              <button
                onClick={() => setExplained(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-ink transition-colors duration-fast hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Eye className="h-3.5 w-3.5" />
                Compare with the lesson's reasoning
              </button>
            </div>
          ))}
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
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
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
