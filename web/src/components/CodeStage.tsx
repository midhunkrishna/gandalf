import { useEffect, useMemo, useRef, useState } from "react";
import { highlightFocus, type Focus } from "@/lib/shiki.ts";
import { diffLineMarks } from "@/lib/diffLines.ts";
import { prefersReducedMotion } from "@/lib/reducedMotion.ts";
import { useIsDark } from "@/lib/useIsDark.ts";

/** The pinned code panel of the walkthrough: Shiki highlight + focus-and-dim + diff colours + auto-scroll. */
export function CodeStage({
  code,
  language,
  focus,
  diff,
}: {
  code: string;
  language: string;
  focus: Focus | null;
  /** Unified diff for this file — drives GitHub-style add/modify/remove colouring. */
  diff?: string;
}) {
  const [html, setHtml] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const dark = useIsDark();
  const marks = useMemo(() => (diff ? diffLineMarks(diff) : undefined), [diff]);

  useEffect(() => {
    let cancelled = false;
    highlightFocus(code, language, focus, dark, marks).then((h) => !cancelled && setHtml(h));
    return () => {
      cancelled = true;
    };
  }, [code, language, focus, dark, marks]);

  useEffect(() => {
    const container = ref.current;
    if (!container || !focus) return;
    const el = container.querySelector<HTMLElement>(".cl-focus");
    if (!el) return;
    // Scroll ONLY the code container (not ancestors) to center the focused lines.
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const delta = eRect.top - cRect.top - container.clientHeight / 2 + eRect.height / 2;
    container.scrollBy({ top: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [html, focus]);

  return (
    <div
      ref={ref}
      // data-lenis-prevent: wheeling over the code scrolls the code natively (Lenis ignores it),
      // while wheeling over the prose steps still drives the page scroll.
      data-lenis-prevent
      className="gandalf-code h-full overflow-auto rounded-lg border border-line bg-surface text-xs shadow-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
