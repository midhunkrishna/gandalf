import { useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Moon, Sun, Brain, FileCog } from "lucide-react";
import { BrandMark } from "@/ui/BrandMark.tsx";
import type { LessonBundle, LessonMeta } from "@engine/core/schemas.ts";
import { Button } from "@/ui/button.tsx";
import { Badge } from "@/ui/badge.tsx";
import { cn } from "@/lib/cn.ts";
import { LessonView } from "@/lens/LessonView.tsx";
import { DesignPreview } from "@/DesignPreview.tsx";
import { LessonLibrary } from "@/components/LessonLibrary.tsx";
import { LessonGallery } from "@/components/LessonGallery.tsx";
import { ReviewSession } from "@/components/ReviewSession.tsx";
import { fallbackLesson, fetchLesson, fetchLessonList } from "@/lib/loadLesson.ts";
import { dueCount as countDue, registerQuestions } from "@/lib/reviewStore.ts";
import { useFileFilter } from "@/lib/fileFilter.tsx";
import { isHidden } from "@/lib/fileKind.ts";
import { useRoute, navigate, NO_DETAIL } from "@/lib/router.ts";

function darkInit(): boolean {
  try {
    const stored = localStorage.getItem("gandalf:dark");
    if (stored != null) return stored === "1";
  } catch {
    /* private mode */
  }
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function App() {
  const route = useRoute();
  const view = route.view;
  const [dark, setDark] = useState(darkInit);
  const [lesson, setLesson] = useState<LessonBundle>(fallbackLesson);
  const [library, setLibrary] = useState<LessonMeta[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dueN, setDueN] = useState(0);
  const { showAll, setShowAll } = useFileFilter();
  const hiddenCount = useMemo(() => lesson.files.filter((f) => isHidden(f.path)).length, [lesson]);

  useEffect(() => {
    fetchLessonList().then(setLibrary);
    setDueN(countDue());
  }, []);

  // The URL owns which lesson is open. Fetch on change; when the loader fell
  // back (no id yet, bad id, offline export), canonicalize the URL in place.
  useEffect(() => {
    let cancelled = false;
    fetchLesson(route.lessonId ?? undefined).then((l) => {
      if (cancelled) return;
      setLesson(l);
      if (route.view === "lesson" && l.meta.id !== route.lessonId) {
        // Fallback fired — detail params belonged to the requested lesson, drop them.
        navigate({ lessonId: l.meta.id, ...NO_DETAIL }, { replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.lessonId]);

  // Apply + persist the theme; seed the review queue with this lesson's questions.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("gandalf:dark", dark ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [dark]);

  useEffect(() => {
    registerQuestions(lesson.meta.id, lesson.retrieval?.questions.length ?? 0);
    setDueN(countDue());
  }, [lesson]);

  function closeReview() {
    setReviewOpen(false);
    setDueN(countDue());
  }

  function selectLesson(id: string) {
    navigate({ view: "lesson", lessonId: id, ...NO_DETAIL });
  }

  function toggleDark() {
    setDark((d) => !d);
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-bg px-6 py-3">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-semibold">gandalf</span>
          <Badge tone="neutral" className="ml-1 font-mono">v0.1</Badge>
        </div>
        <div className="flex items-center gap-2">
          {view === "lesson" && (
            <>
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  role="switch"
                  aria-checked={showAll}
                  aria-label={showAll ? "Hide config & generated files" : `Show ${hiddenCount} config & generated files`}
                  title={
                    showAll
                      ? "Showing config and generated files too"
                      : `${hiddenCount} config file${hiddenCount > 1 ? "s" : ""} tucked away. Click to show them`
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors duration-fast",
                    showAll
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-line text-muted-ink hover:text-ink",
                  )}
                >
                  <FileCog className="h-4 w-4" />
                  {showAll ? "All files" : `+${hiddenCount}`}
                </button>
              )}
              <button
                onClick={() => setReviewOpen(true)}
                aria-label={`Spaced review${dueN ? ` — ${dueN} due` : ""}`}
                title="Spaced review of due recall questions"
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm text-muted-ink transition-colors duration-fast hover:text-ink"
              >
                <Brain className="h-4 w-4" />
                Review
                {dueN > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[0.7rem] font-medium text-primary-ink">
                    {dueN}
                  </span>
                )}
              </button>
              <LessonLibrary
                lessons={library.length ? library : [lesson.meta]}
                currentId={lesson.meta.id}
                onSelect={selectLesson}
              />
            </>
          )}
          <div className="flex rounded-md border border-line p-0.5">
            {(["lesson", "library", "tokens"] as const).map((v) => (
              <button
                key={v}
                onClick={() =>
                  navigate(v === "lesson" ? { view: v, lessonId: lesson.meta.id } : { view: v })
                }
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
      ) : view === "library" ? (
        <LessonGallery
          lessons={library.length ? library : [lesson.meta]}
          currentId={lesson.meta.id}
          onSelect={selectLesson}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <DesignPreview />
        </div>
      )}

      {reviewOpen && (
        <ReviewSession lessons={library.length ? library : [lesson.meta]} onClose={closeReview} />
      )}
    </div>
    </MotionConfig>
  );
}
