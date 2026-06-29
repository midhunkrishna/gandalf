import { useEffect, useState } from "react";
import { Moon, Sun, GitBranch } from "lucide-react";
import type { LessonBundle } from "@engine/core/schemas.ts";
import { Button } from "@/ui/button.tsx";
import { Badge } from "@/ui/badge.tsx";
import { cn } from "@/lib/cn.ts";
import { LessonView } from "@/lens/LessonView.tsx";
import { DesignPreview } from "@/DesignPreview.tsx";
import { fallbackLesson, fetchLesson } from "@/lib/loadLesson.ts";

type View = "lesson" | "tokens";

export function App() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState<View>("lesson");
  const [lesson, setLesson] = useState<LessonBundle>(fallbackLesson);

  useEffect(() => {
    fetchLesson().then(setLesson);
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-bg px-6 py-3">
        <div className="flex items-center gap-2.5">
          <GitBranch className="h-5 w-5 text-primary" strokeWidth={2} />
          <span className="font-display text-lg font-semibold">gandalf</span>
          <Badge tone="primary" className="ml-1">preview</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-line p-0.5">
            {(["lesson", "tokens"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-sm capitalize transition-colors duration-fast",
                  view === v ? "bg-surface-2 text-ink shadow-xs" : "text-muted-ink hover:text-ink",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleDark}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {view === "lesson" ? (
        <LessonView lesson={lesson} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <DesignPreview />
        </div>
      )}
    </div>
  );
}
