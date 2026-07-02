import { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { GitBranch, ImageDown, Loader2 } from "lucide-react";
import type { LessonBundle } from "@engine/core/schemas.ts";
import { Constellation } from "./Constellation.tsx";
import { VerdictStamp, BreakingStamp } from "./VerdictStamp.tsx";
import { shortRef } from "@/lib/refs.ts";

/**
 * One-click 1200×630 share card — the branded screenshot for posting a lesson.
 * The card mounts off-screen only while capturing, inherits the current theme
 * (CSS vars cascade from <html>), and is rasterized client-side.
 */

const Card = forwardRef<HTMLDivElement, { lesson: LessonBundle }>(function Card({ lesson }, ref) {
  const stats: Array<[number, string]> = [
    [lesson.files.length, "files changed"],
    [lesson.contracts.length, "contracts"],
    [lesson.graph.nodes.length, "modules"],
    [lesson.retrieval?.questions.length ?? 0, "recall questions"],
  ];
  return (
    <div
      ref={ref}
      className="relative flex h-[630px] w-[1200px] flex-col overflow-hidden bg-bg p-14 text-ink"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <Constellation
        graph={lesson.graph}
        className="absolute inset-x-0 -bottom-10 h-[300px] w-full"
        style={{
          // Keep the drawing clear of the stat row bottom-left.
          maskImage: "linear-gradient(to right, transparent 38%, black 66%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 38%, black 66%)",
        }}
      />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <GitBranch className="h-6 w-6 text-primary" strokeWidth={2} />
          <span className="font-display text-2xl font-semibold">gandalf</span>
        </span>
        <span className="font-mono text-sm text-muted-ink">
          {shortRef(lesson.meta.fromRef)} → {shortRef(lesson.meta.toRef)}
          {lesson.meta.ticketId ? ` · ${lesson.meta.ticketId}` : ""} · {lesson.meta.createdAt.slice(0, 10)}
        </span>
      </div>
      <h1 className="relative mt-9 max-w-[64rem] font-display text-[50px] font-semibold leading-[1.1]">
        {lesson.meta.title}
      </h1>
      <div className="relative mt-7 flex items-center gap-5">
        <VerdictStamp verdict={lesson.meta.verdict} size="lg" />
        <BreakingStamp count={lesson.meta.breakingCount} size="lg" />
      </div>
      <div className="relative mt-auto flex items-end gap-14">
        {stats.map(([n, label]) => (
          <div key={label}>
            <div className="font-display text-4xl font-semibold tabular-nums">{n}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-ink">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

export function ShareCardButton({ lesson }: { lesson: LessonBundle }) {
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) return;
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
        // Two frames: one to mount, one to lay out.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const node = cardRef.current;
        if (!node || cancelled) return;
        const png = await toPng(node, { width: 1200, height: 630, pixelRatio: 2 });
        const a = document.createElement("a");
        a.href = png;
        a.download = `${lesson.meta.id}-card.png`;
        a.click();
      } catch (err) {
        console.error("share card export failed", err);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [busy, lesson]);

  return (
    <>
      <button
        onClick={() => setBusy(true)}
        disabled={busy}
        title="Download a 1200×630 share card of this lesson"
        aria-label="Download share card"
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg/70 px-2 py-0.5 text-sm text-muted-ink backdrop-blur transition-colors duration-fast hover:border-primary/50 hover:text-ink"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />}
        Share card
      </button>
      {busy &&
        createPortal(
          <div aria-hidden="true" style={{ position: "fixed", left: "-2600px", top: 0, zIndex: -1 }}>
            <Card ref={cardRef} lesson={lesson} />
          </div>,
          document.body,
        )}
    </>
  );
}
