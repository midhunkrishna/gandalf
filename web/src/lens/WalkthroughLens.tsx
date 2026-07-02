import { useEffect, useMemo, useRef, useState } from "react";
import Lenis from "lenis";
import Snap from "lenis/snap";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { LessonBundle, FileChange } from "@engine/core/schemas.ts";
import { CodeStage } from "@/components/CodeStage.tsx";
import { Reveal } from "@/components/Reveal.tsx";
import type { Focus } from "@/lib/shiki.ts";
import { prefersReducedMotion } from "@/lib/reducedMotion.ts";
import { cn } from "@/lib/cn.ts";

interface Scene {
  id: string;
  file: FileChange;
  focus: Focus | null;
  prose: string;
}

function buildScenes(lesson: LessonBundle): Scene[] {
  const scenes: Scene[] = [];
  for (const f of lesson.files) {
    if (!f.afterBlob || f.status === "removed") continue;
    if (f.beacons.length) {
      for (const b of f.beacons) {
        scenes.push({ id: `${f.path}:${b.startLine}`, file: f, focus: { start: b.startLine, end: b.endLine }, prose: b.note });
      }
    } else if (f.tldr.behaviorChanged && f.tldr.behaviorChanged !== "None.") {
      scenes.push({ id: f.path, file: f, focus: null, prose: f.tldr.behaviorChanged });
    }
  }
  return scenes;
}

export function WalkthroughLens({ lesson }: { lesson: LessonBundle }) {
  const scenes = useMemo(() => buildScenes(lesson), [lesson]);
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Parallax: the intro hero drifts up and fades as you scroll into the steps.
  const reduce = useReducedMotion();
  const { scrollY } = useScroll({ container: scrollRef });
  const heroY = useTransform(scrollY, [0, 500], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 360], [1, 0.25]);

  // Lenis smooth scroll + gentle proximity snap on this lens's scroll container
  // (both skipped under reduced-motion). Proximity snap settles on the nearest scene
  // boundary only once the user stops near it — it never seizes the scrollbar.
  useEffect(() => {
    if (prefersReducedMotion() || !scrollRef.current || !contentRef.current) return;
    const lenis = new Lenis({
      wrapper: scrollRef.current,
      content: contentRef.current,
      duration: 1.1,
      smoothWheel: true,
    });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const snap = new Snap(lenis, {
      type: "proximity",
      lerp: 0.1,
      duration: 0.8,
      distanceThreshold: "18%",
    });
    const removers = stepRefs.current
      .filter((el): el is HTMLDivElement => Boolean(el))
      .map((el) => snap.addElement(el, { align: "center" }));

    return () => {
      cancelAnimationFrame(raf);
      removers.forEach((remove) => remove());
      snap.destroy();
      lenis.destroy();
    };
  }, [scenes.length]);

  // One step controller: the centered prose step is the active scene.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || scenes.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.idx));
        }
      },
      { root, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [scenes.length]);

  const activeScene = scenes[active];

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div ref={contentRef}>
        <motion.section
          className="mx-auto max-w-3xl px-8 pb-20 pt-16 text-center"
          style={reduce ? undefined : { y: heroY, opacity: heroOpacity }}
        >
          <h2 className="font-display text-3xl leading-tight">{lesson.meta.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-ink">
            {lesson.meta.hypothesis}
          </p>
          {scenes.length > 0 && (
            <div className="mt-10 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-muted-ink">
              Scroll to walk through the change <ChevronDown className="h-4 w-4 animate-bounce" />
            </div>
          )}
        </motion.section>

        {scenes.length === 0 ? (
          <p className="mx-auto max-w-3xl px-8 pb-24 text-center text-sm text-muted-ink">
            This change has no focal lines to walk through.
          </p>
        ) : (
          <div className="relative mx-auto flex max-w-6xl gap-10 px-8">
            <div className="w-[44%] shrink-0">
              {scenes.map((s, i) => (
                <div
                  key={s.id}
                  data-idx={i}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className="flex min-h-[74vh] flex-col justify-center"
                >
                  <div
                    className={cn(
                      "rounded-lg border bg-surface p-5 transition-all duration-300 ease-standard",
                      i === active
                        ? "border-primary/40 opacity-100 shadow-md"
                        : "border-line opacity-50",
                    )}
                  >
                    <div className="mb-2 font-mono text-xs text-muted-ink">
                      {s.file.path}
                      {s.focus ? `:${s.focus.start}` : ""}
                    </div>
                    <p className="text-[0.95rem] leading-relaxed text-ink">{s.prose}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky top-6 h-[calc(100vh-12rem)] flex-1 self-start py-2">
              {activeScene && (
                <CodeStage
                  code={activeScene.file.afterBlob ?? ""}
                  language={activeScene.file.language}
                  focus={activeScene.focus}
                  diff={activeScene.file.unifiedDiff}
                />
              )}
            </div>
          </div>
        )}

        <Reveal as="section" className="mx-auto max-w-3xl px-8 py-24" y={24}>
          <div className="rounded-lg border border-line bg-surface p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink">
              In summary
            </div>
            <p className="mx-auto mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink">
              {lesson.behavioral.conditionalEquivalence}
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
