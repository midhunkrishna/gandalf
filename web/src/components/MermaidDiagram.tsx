import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import mermaid from "mermaid";
import { useIsDark } from "@/lib/useIsDark.ts";
import { MermaidZoom } from "@/components/MermaidZoom.tsx";

let counter = 0;

/** Render a Mermaid diagram; falls back to the raw source if it can't parse. Maximize → pan/zoom. */
export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(false);
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
        // orphans across tab switches) when the source is invalid. parse({suppressErrors})
        // returns false instead, so we fall back to <pre> without polluting the document.
        const ok = await mermaid.parse(code, { suppressErrors: true });
        if (cancelled) return;
        if (!ok) {
          setError(true);
          setSvg("");
          return;
        }
        const rendered = await mermaid.render(id, code);
        if (cancelled) return;
        setSvg(rendered.svg);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
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

  return (
    <div className="relative gandalf-mermaid w-full overflow-x-auto">
      {svg && (
        <button
          onClick={() => setZoom(true)}
          aria-label="Maximize diagram"
          title="Maximize (zoom / pan)"
          className="absolute right-1 top-1 z-10 rounded-md border border-line bg-bg/90 p-1 text-muted-ink transition-colors duration-fast hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      {zoom && svg && <MermaidZoom svg={svg} onClose={() => setZoom(false)} />}
    </div>
  );
}
