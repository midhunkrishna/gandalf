import { useState } from "react";
import { Eye } from "lucide-react";
import type { LessonBundle, RetrievalQuestion } from "@engine/core/schemas.ts";
import { Reveal } from "@/components/Reveal.tsx";
import { recordReview, type Rating } from "@/lib/reviewStore.ts";
import { cn } from "@/lib/cn.ts";

const base = (p: string) => p.split("/").pop() ?? p;
const RATINGS: Array<[Rating, string]> = [
  ["again", "Again"],
  ["good", "Good"],
  ["easy", "Easy"],
];

function QuestionCard({ q, lessonId, index }: { q: RetrievalQuestion; lessonId: string; index: number }) {
  const [revealed, setRevealed] = useState(false);
  const [rated, setRated] = useState<Rating | null>(null);

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-ink">
          {q.lens}
        </span>
        <span className="text-[0.7rem] text-muted-ink">question {index + 1}</span>
      </div>
      <p className="text-[0.95rem] font-medium leading-relaxed text-ink">{q.prompt}</p>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted-ink transition-colors duration-fast hover:border-primary/50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Eye className="h-3.5 w-3.5" />
          Answer from memory, then reveal
        </button>
      ) : (
        <Reveal y={8} className="mt-3 space-y-3">
          <div className="rounded-md border border-line bg-surface-2 p-3 text-sm leading-relaxed text-ink">
            {q.answer}
          </div>
          {q.evidence.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {q.evidence.map((e, j) => (
                <span
                  key={j}
                  className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-ink"
                >
                  {base(e.file)}:{e.line}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 border-t border-line pt-2.5">
            <span className="text-[0.7rem] uppercase tracking-[0.1em] text-muted-ink">How did you do?</span>
            <div className="flex gap-1.5">
              {RATINGS.map(([r, label]) => (
                <button
                  key={r}
                  onClick={() => {
                    recordReview(lessonId, index, r);
                    setRated(r);
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-fast",
                    rated === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-line text-muted-ink hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {rated && <span className="ml-auto text-[0.7rem] text-muted-ink">scheduled ✓</span>}
          </div>
        </Reveal>
      )}
    </div>
  );
}

/** End-of-lesson retrieval practice: answer from memory, reveal, self-rate (seeds spaced review). */
export function RecallPanel({ lesson }: { lesson: LessonBundle }) {
  const qs = lesson.retrieval?.questions ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-2">
        <h2 className="text-2xl">Recall</h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-ink">
          Retrieving from memory beats re-reading — it's the single best-evidenced way to make this
          change stick. Answer each from memory first, then reveal and rate yourself; ratings seed the
          spaced <span className="font-medium text-ink">Review</span> queue.
        </p>
      </header>

      {qs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted-ink">
          This lesson has no recall questions yet. Regenerate it (<code className="font-mono text-xs">gandalf generate</code>)
          to produce them.
        </p>
      ) : (
        <div className="space-y-3">
          {qs.map((q, i) => (
            <QuestionCard key={i} q={q} lessonId={lesson.meta.id} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
