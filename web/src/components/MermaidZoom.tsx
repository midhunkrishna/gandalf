import { useEffect, useRef, useState } from "react";
import { X, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

const ctlBtn =
  "rounded-md border border-line bg-bg/90 p-1.5 text-muted-ink transition-colors duration-fast hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

/** Full-screen pan/zoom overlay for a rendered Mermaid SVG. Esc closes and resets. */
export function MermaidZoom({ svg, onClose }: { svg: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };
  const zoomBy = (f: number) => setScale((s) => Math.min(6, Math.max(0.4, s * f)));
  const onWheel = (e: React.WheelEvent) => zoomBy(e.deltaY < 0 ? 1.1 : 0.9);
  const onDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMove = (e: React.MouseEvent) => {
    if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const onUp = () => (drag.current = null);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-end gap-1.5 p-3" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => zoomBy(1.25)} className={ctlBtn} aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={() => zoomBy(0.8)} className={ctlBtn} aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
        <button onClick={reset} className={ctlBtn} aria-label="Reset zoom" title="Reset (Esc)">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button onClick={onClose} className={ctlBtn} aria-label="Close (Esc)">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className="relative flex flex-1 cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        <div
          className="gandalf-mermaid select-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "center" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <div className="pointer-events-none pb-3 text-center text-xs text-white/70">
        scroll to zoom · drag to pan · Esc to close
      </div>
    </div>
  );
}
