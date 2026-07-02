import { useEffect, useState } from "react";
import { X, Eye, Check } from "lucide-react";
import type { LessonMeta, RetrievalQuestion } from "@engine/core/schemas.ts";
import { fetchLesson } from "@/lib/loadLesson.ts";
import { dueKeys, parseKey, recordReview, type Rating } from "@/lib/reviewStore.ts";
import { Reveal } from "@/components/Reveal.tsx";
import { cn } from "@/lib/cn.ts";
import { DoodleAllClear } from "@/ui/doodles.tsx";

interface DueQ {
  lessonId: string;
  lessonTitle: string;
  index: number;
  q: RetrievalQuestion;
}

const base = (p: string) => p.split("/").pop() ?? p;
const RATINGS: Array<[Rating, string]> = [
  ["again", "Again"],
  ["good", "Good"],
  ["easy", "Easy"],
];

/**
 * Spaced-review overlay: gathers retrieval questions that are due across the persisted library
 * (localStorage schedule), fetching each due lesson lazily, and runs a one-at-a-time recall session.
 */
export function ReviewSession({ lessons, onClose }: { lessons: LessonMeta[]; onClose: () => void }) {
  const [items, setItems] = useState<DueQ[] | null>(null);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const byLesson = new Map<string, number[]>();
      for (const k of dueKeys()) {
        const p = parseKey(k);
        if (!p) continue;
        const list = byLesson.get(p.lessonId) ?? [];
        list.push(p.index);
        byLesson.set(p.lessonId, list);
      }
      const titles = new Map(lessons.map((m) => [m.id, m.title]));
      const out: DueQ[] = [];
      for (const [lessonId, idxs] of byLesson) {
        try {
          const bundle = await fetchLesson(lessonId);
          if (bundle.meta.id !== lessonId) continue; // fetch fell back to another lesson — skip
          const qs = bundle.retrieval?.questions ?? [];
          for (const i of idxs) {
            if (qs[i]) out.push({ lessonId, lessonTitle: titles.get(lessonId) ?? bundle.meta.title, index: i, q: qs[i]! });
          }
        } catch {
          /* lesson unreachable (e.g. offline export) — skip its due items */
        }
      }
      if (!cancelled) setItems(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [lessons]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cur = items?.[pos];

  function rate(r: Rating) {
    if (!cur) return;
    recordReview(cur.lessonId, cur.index, r);
    setRevealed(false);
    setPos((p) => p + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-line bg-bg p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Spaced review"
      >
        <header className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-ink">
              Spaced review
            </div>
            <h2 className="text-lg">Due questions</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close review"
            className="rounded-md p-1 text-muted-ink transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {items === null ? (
          <p className="py-8 text-center text-sm text-muted-ink">Gathering due questions…</p>
        ) : items.length === 0 ? (
          <div className="space-y-3 py-8 text-center text-sm text-muted-ink">
            <DoodleAllClear className="mx-auto h-14 w-[72px]" />
            <p>All caught up. Questions come due here as lessons age.</p>
          </div>
        ) : !cur ? (
          <div className="space-y-4 py-6 text-center">
            <Check className="mx-auto h-8 w-8 text-added" />
            <p className="text-sm text-ink">That's the queue. {items.length} question{items.length > 1 ? "s" : ""} reviewed.</p>
            <button
              onClick={onClose}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-ink hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[0.7rem] text-muted-ink">
              <span>
                {pos + 1} / {items.length}
              </span>
              <span className="line-clamp-1 max-w-[60%] font-mono">{cur.lessonTitle}</span>
            </div>
            <p className="text-base font-medium leading-relaxed text-ink">{cur.q.prompt}</p>

            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted-ink transition-colors duration-fast hover:border-primary/50 hover:text-ink"
              >
                <Eye className="h-3.5 w-3.5" />
                Answer from memory, then reveal
              </button>
            ) : (
              <Reveal y={8} className="space-y-3">
                <div className="rounded-md border border-line bg-surface-2 p-3 text-sm leading-relaxed text-ink">
                  {cur.q.answer}
                </div>
                {cur.q.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cur.q.evidence.map((e, j) => (
                      <span key={j} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-ink">
                        {base(e.file)}:{e.line}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 border-t border-line pt-3">
                  <span className="text-[0.7rem] uppercase tracking-[0.12em] text-muted-ink">Schedule next:</span>
                  {RATINGS.map(([r, label]) => (
                    <button
                      key={r}
                      onClick={() => rate(r)}
                      className={cn(
                        "rounded-md border border-line px-3 py-1 text-xs font-medium text-muted-ink",
                        "transition-colors duration-fast hover:border-primary/50 hover:text-ink",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Reveal>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
