import { useEffect, useRef, useState } from "react";
import { highlightFocus, type Focus } from "@/lib/shiki.ts";
import { prefersReducedMotion } from "@/lib/reducedMotion.ts";

/** The pinned code panel of the walkthrough: Shiki highlight + focus-and-dim + auto-scroll to focus. */
export function CodeStage({
  code,
  language,
  focus,
}: {
  code: string;
  language: string;
  focus: Focus | null;
}) {
  const [html, setHtml] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const dark = document.documentElement.classList.contains("dark");
    highlightFocus(code, language, focus, dark).then((h) => !cancelled && setHtml(h));
    return () => {
      cancelled = true;
    };
  }, [code, language, focus]);

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
      className="gandalf-code h-full overflow-auto rounded-lg border border-line bg-surface text-xs shadow-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
