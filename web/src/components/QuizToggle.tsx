import { Lightbulb } from "lucide-react";
import { useQuizMode } from "@/lib/quizMode.tsx";
import { cn } from "@/lib/cn.ts";

/** Toggle predict-then-reveal gating (Trace Cards, contract verdicts). */
export function QuizToggle() {
  const { quiz, setQuiz } = useQuizMode();
  return (
    <button
      onClick={() => setQuiz(!quiz)}
      role="switch"
      aria-checked={quiz}
      aria-label="Predict-then-reveal quiz mode"
      title={
        quiz
          ? "Quiz on: predict first, then the answer shows"
          : "Quiz off: answers show right away"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-fast",
        quiz
          ? "border-primary/40 bg-primary/5 text-primary"
          : "border-line text-muted-ink hover:text-ink",
      )}
    >
      <Lightbulb className="h-3.5 w-3.5" />
      Quiz
    </button>
  );
}
