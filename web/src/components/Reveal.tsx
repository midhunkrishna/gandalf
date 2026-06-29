import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Scroll-triggered reveal. Fades + lifts its content into place the first time it
 * enters the viewport (works inside inner scroll containers — IntersectionObserver
 * clips against the overflow ancestor). Animates transform/opacity only.
 *
 * Honors reduced-motion at the source: when the user prefers reduced motion we render
 * a plain element already at its final state — no transform, no fade, no observer.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  amount = 0.25,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Stagger offset in seconds. */
  delay?: number;
  /** Initial vertical offset in px. */
  y?: number;
  /** Fraction of the element that must be visible to trigger. */
  amount?: number;
  as?: "div" | "section" | "li";
}) {
  const reduce = useReducedMotion();
  const Tag = as;
  if (reduce) return <Tag className={className}>{children}</Tag>;

  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      // Material "decelerate" easing; a touch slower than UI micro-motion so it reads as narrative.
      transition={{ duration: 0.5, ease: [0, 0, 0.2, 1], delay }}
    >
      {children}
    </MotionTag>
  );
}
