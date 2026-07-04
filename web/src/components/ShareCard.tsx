import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { ImageDown, Loader2 } from "lucide-react";
import { BrandMark } from "@/ui/BrandMark.tsx";
import type { LessonBundle } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { shortRef } from "@/lib/refs.ts";
import { useRoute, type Route } from "@/lib/router.ts";
import { useFileFilter } from "@/lib/fileFilter.tsx";
import { buildCardContent, clip, type CardContent } from "./share/features.ts";
import { FeatureBody } from "./share/FeatureBody.tsx";

/**
 * Tab-aware share card (1200×630): the frame (brand header, lead sentence,
 * verdict footer) is constant; the middle region features whatever the active
 * lens is about — the teaching diff, a contract's −/+ signatures, a worked
 * example, the Δ-complexity scorecard, … (see share/features.ts). Renders
 * off-screen only while capturing; inherits the current theme; rasterized
 * client-side.
 */

function Card({
  lesson,
  content,
  cardRef,
}: {
  lesson: LessonBundle;
  content: CardContent;
  cardRef: React.RefObject<HTMLDivElement>;
}) {
  const modules = new Set(lesson.files.map((f) => f.module)).size;
  return (
    <div
      ref={cardRef}
      className="flex h-[630px] w-[1200px] flex-col bg-bg p-12 text-ink"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <BrandMark className="h-6 w-6 text-primary" />
          <span className="font-display text-2xl font-semibold">gandalf</span>
        </span>
        <span className="font-mono text-sm text-muted-ink">{content.headerRight}</span>
      </div>

      <p className="mt-6 max-w-[68rem] text-[22px] font-medium leading-snug">
        {clip(content.lead, 190)}
      </p>

      <div className="mt-5">
        <FeatureBody feature={content.feature} />
      </div>

      <div className="mt-auto flex items-center gap-3 pt-5">
        <Badge
          tone={lesson.meta.verdict === "behavioral" ? "modified" : "safe"}
          className="rounded-md px-2.5 py-1 text-sm"
        >
          {lesson.meta.verdict === "behavioral" ? "behavioral change" : "refactor-only"}
        </Badge>
        {lesson.meta.breakingCount > 0 && (
          <Badge tone="breaking" className="rounded-md px-2.5 py-1 text-sm">
            {lesson.meta.breakingCount} breaking
          </Badge>
        )}
        <span className="text-sm text-muted-ink">
          {lesson.files.length} files · {modules} modules
        </span>
        <span className="ml-auto font-mono text-sm text-muted-ink">
          {shortRef(lesson.meta.fromRef)} → {shortRef(lesson.meta.toRef)}
          {lesson.meta.ticketId ? ` · ${lesson.meta.ticketId}` : ""}
        </span>
      </div>
    </div>
  );
}

export function ShareCardButton({ lesson }: { lesson: LessonBundle }) {
  const route = useRoute();
  const { visible } = useFileFilter();
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState<CardContent | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Snapshot the route at click time: a tab switch mid-capture must not
  // mismatch the card's content against its filename (or restart the effects).
  const snapRef = useRef<Route>(route);

  // Stage 1: on click, build the tab's content (tokenization is async) before mounting the card.
  useEffect(() => {
    if (!busy) return;
    let cancelled = false;
    const dark = document.documentElement.classList.contains("dark");
    buildCardContent(lesson, snapRef.current, { dark, visible }).then((c) => {
      if (cancelled) return;
      setContent(c);
    });
    return () => {
      cancelled = true;
    };
    // `visible` is deliberately omitted: the build is scoped to the click, gated by `busy`.
  }, [busy, lesson]);

  // Stage 2: card mounted with data — capture and download.
  useEffect(() => {
    if (!busy || !content) return;
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const node = cardRef.current;
        if (!node || cancelled) return;
        const png = await toPng(node, { width: 1200, height: 630, pixelRatio: 2 });
        const a = document.createElement("a");
        a.href = png;
        a.download = `${lesson.meta.id}-${snapRef.current.tab}-card.png`;
        a.click();
      } catch (err) {
        console.error("share card export failed", err);
      } finally {
        if (!cancelled) {
          setBusy(false);
          setContent(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [busy, content, lesson]);

  return (
    <>
      <button
        onClick={() => {
          snapRef.current = route;
          setBusy(true);
        }}
        disabled={busy}
        title="Download a 1200×630 share card of this tab's view"
        aria-label="Download share card"
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg/70 px-2 py-0.5 text-sm text-muted-ink backdrop-blur transition-colors duration-fast hover:border-primary/50 hover:text-ink"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />}
        Share card
      </button>
      {busy &&
        content &&
        createPortal(
          <div aria-hidden="true" style={{ position: "fixed", left: "-2600px", top: 0, zIndex: -1 }}>
            <Card lesson={lesson} content={content} cardRef={cardRef} />
          </div>,
          document.body,
        )}
    </>
  );
}
