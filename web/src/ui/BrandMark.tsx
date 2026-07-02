/**
 * The gandalf mark: a wizard's staff with a spark at its tip, drawn as two
 * slightly irregular strokes so it reads hand-made rather than icon-set.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* staff: a gentle bow with a short crook at the top */}
      <path
        d="M6 21.5 C8.6 16.4 12 11 15.2 6.6 c.5 -.7 1.4 -.9 2 -.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* spark */}
      <path
        d="M18.4 1.8 l.7 1.7 1.7 .7 -1.7 .7 -.7 1.7 -.7 -1.7 -1.7 -.7 1.7 -.7 Z"
        fill="currentColor"
      />
      {/* stray mote */}
      <circle cx="14.2" cy="3.9" r="0.8" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
