import { useEffect, useRef, useState } from "react";
import { Library, Check } from "lucide-react";
import type { LessonMeta } from "@engine/core/schemas.ts";
import { Button } from "@/ui/button.tsx";
import { Badge } from "@/ui/badge.tsx";
import { cn } from "@/lib/cn.ts";

/** Timeline dropdown of persisted lessons (newest first). */
export function LessonLibrary({
  lessons,
  currentId,
  onSelect,
}: {
  lessons: LessonMeta[];
  currentId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} aria-label="Lesson library">
        <Library className="h-4 w-4" />
        Lessons{lessons.length > 1 ? ` (${lessons.length})` : ""}
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 max-h-[70vh] w-80 overflow-y-auto rounded-lg border border-line bg-bg p-1.5 shadow-lg">
          {lessons.length === 0 ? (
            <div className="p-3 text-sm text-muted-ink">
              No persisted lessons yet. Run <code className="font-mono text-xs">gandalf generate</code>.
            </div>
          ) : (
            <ol className="space-y-0.5 pl-3">
              {lessons.map((m) => (
                <li key={m.id} className="relative">
                  <span className="absolute -left-3 top-3.5 h-1.5 w-1.5 rounded-full bg-line" />
                  <button
                    onClick={() => {
                      onSelect(m.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-md p-2.5 text-left transition-colors duration-fast hover:bg-surface-2",
                      m.id === currentId && "bg-surface-2",
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="line-clamp-2 text-sm font-medium text-ink">{m.title}</span>
                      {m.id === currentId && <Check className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={m.verdict === "behavioral" ? "modified" : "safe"}>
                        {m.verdict === "behavioral" ? "behavioral" : "refactor"}
                      </Badge>
                      {m.breakingCount > 0 && <Badge tone="breaking">{m.breakingCount} breaking</Badge>}
                      {m.ticketId && <span className="text-[0.7rem] text-muted-ink">{m.ticketId}</span>}
                      <span className="ml-auto text-[0.7rem] text-muted-ink">{m.createdAt.slice(0, 10)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
