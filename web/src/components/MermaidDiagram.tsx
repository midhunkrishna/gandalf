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
    const id = `mmd-${++counter}`;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: isDark ? "dark" : "neutral",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    });
    (async () => {
      try {
        // Validate first: render() injects a "Syntax error" graphic into the DOM (which then
        // orphans across tab switches) when the source is invalid. parse({suppressErrors}) just
        // returns false, so we fall back to <pre> without ever polluting the document.
        const ok = await mermaid.parse(code, { suppressErrors: true });
        if (cancelled) return;
        if (!ok) {
          setError(true);
          return;
        }
        const { svg } = await mermaid.render(id, code);
        if (cancelled) return;
        if (ref.current) ref.current.innerHTML = svg;
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      // Remove any temp/measurement element mermaid may have left behind.
      document.getElementById(id)?.remove();
      document.getElementById("d" + id)?.remove();
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
