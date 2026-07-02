import type { LessonMeta } from "@engine/core/schemas.ts";
import { VerdictStamp, BreakingStamp } from "./VerdictStamp.tsx";
import { cn } from "@/lib/cn.ts";

/**
 * Gallery landing page: the lesson library as a shelf of covers — verdict-
 * colored spines, newest first. Clicking a cover opens the lesson.
 */
export function LessonGallery({
  lessons,
  currentId,
  onSelect,
}: {
  lessons: LessonMeta[];
  currentId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl">Lessons</h1>
        <p className="mt-1.5 text-sm text-muted-ink">
          Every change, narrated — newest first.
        </p>
        {lessons.length === 0 ? (
          <p className="mt-10 text-sm text-muted-ink">
            No persisted lessons yet. Run <code className="font-mono text-xs">gandalf generate</code>.
          </p>
        ) : (
          <ol className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((m, i) => {
              const spine = m.verdict === "behavioral" ? "--modified" : "--sage";
              return (
                <li
                  key={m.id}
                  style={{ animation: `gg-node-in 420ms cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i * 50, 500)}ms backwards` }}
                >
                  <button
                    onClick={() => onSelect(m.id)}
                    className={cn(
                      "flex h-full w-full flex-col rounded-lg border border-line bg-surface p-4 pl-5 text-left shadow-sm transition-all duration-fast",
                      "hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                      m.id === currentId && "ring-2 ring-ring ring-offset-2 ring-offset-bg",
                    )}
                    style={{ borderLeftWidth: 4, borderLeftColor: `hsl(var(${spine}) / 0.8)` }}
                  >
                    <div className="flex items-center gap-2 font-mono text-[0.7rem] text-muted-ink">
                      <span>{m.createdAt.slice(0, 10)}</span>
                      {m.ticketId && <span>· {m.ticketId}</span>}
                    </div>
                    <h2 className="mt-2 line-clamp-3 font-display text-lg leading-snug text-ink">
                      {m.title}
                    </h2>
                    <div className="mt-auto flex items-center gap-2 pt-4">
                      <VerdictStamp verdict={m.verdict} size="sm" />
                      <BreakingStamp count={m.breakingCount} size="sm" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
