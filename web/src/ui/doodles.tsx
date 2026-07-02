/**
 * Small hand-drawn-feel illustrations for empty states. Loose strokes, token
 * colors only, deliberately imperfect geometry — two of these in the whole
 * app, used where an empty pane would otherwise be a wall of instructions.
 */

/** Three sketchy module boxes, one lit: "pick a module". */
export function DoodleGraph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 56" fill="none" className={className} aria-hidden="true">
      <g stroke="hsl(var(--muted-ink) / 0.55)" strokeWidth="1.4" strokeLinecap="round">
        <rect x="5" y="7" width="26" height="14" rx="3" transform="rotate(-1.5 18 14)" />
        <rect x="8" y="36" width="26" height="14" rx="3" transform="rotate(1 21 43)" />
        <path d="M32 15 C44 17 50 22 60 26" />
        <path d="M35 42 C46 40 52 34 60 30" />
      </g>
      <rect
        x="62"
        y="21"
        width="28"
        height="15"
        rx="3"
        transform="rotate(-1 76 28)"
        stroke="hsl(var(--primary))"
        strokeWidth="1.6"
        fill="hsl(var(--primary) / 0.07)"
      />
      <path
        d="M84 15.5 l.5 1.3 1.3 .5 -1.3 .5 -.5 1.3 -.5 -1.3 -1.3 -.5 1.3 -.5 Z"
        fill="hsl(var(--primary))"
      />
    </svg>
  );
}

/** A closed notebook with a ribbon: "nothing due, the reading is done". */
export function DoodleAllClear({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 56" fill="none" className={className} aria-hidden="true">
      <g stroke="hsl(var(--muted-ink) / 0.55)" strokeWidth="1.4" strokeLinecap="round">
        <rect x="14" y="9" width="42" height="40" rx="4" transform="rotate(-1.5 35 29)" />
        <path d="M21 10 C20.4 23 20.4 36 21 48" />
        <path d="M30 20 h17 M30 27 h13" strokeOpacity="0.6" />
      </g>
      <path
        d="M44 8 v14 l4 -3.6 4 3.4 V8"
        stroke="hsl(var(--primary))"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="hsl(var(--primary) / 0.08)"
        transform="rotate(-1.5 48 15)"
      />
    </svg>
  );
}
