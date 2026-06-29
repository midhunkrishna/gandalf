import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useIsDark } from "@/lib/useIsDark.ts";

let counter = 0;

/** Render a Mermaid diagram; falls back to the raw source if it can't parse. */
export function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const isDark = useIsDark();

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: isDark ? "dark" : "neutral",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    });
    mermaid
      .render(`mmd-${++counter}`, code)
      .then(({ svg }) => {
        if (cancelled) return;
        if (ref.current) ref.current.innerHTML = svg;
        setError(false);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [code, isDark]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-xs text-muted-ink">
        {code}
      </pre>
    );
  }
  return <div ref={ref} className="gandalf-mermaid w-full overflow-x-auto" />;
}
