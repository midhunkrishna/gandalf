import type { ChangeStatus, Safety } from "@engine/core/schemas.ts";

/** Dual-coding: one stable token per concept, reused across gutter, node, and legend. */
export type ConceptTone = "added" | "removed" | "modified" | "unchanged";

export function statusTone(s: ChangeStatus): ConceptTone {
  switch (s) {
    case "added":
      return "added";
    case "removed":
      return "removed";
    case "modified":
    case "renamed":
      return "modified";
    default:
      return "unchanged";
  }
}

/** Solid CSS color for a concept tone (for inline styles, e.g. graph strokes). */
export function toneColor(tone: ConceptTone): string {
  return `hsl(var(--${tone}))`;
}

export function safetyTone(s: Safety): "safe" | "breaking" | "neutral" {
  return s === "safe" ? "safe" : s === "breaking" ? "breaking" : "neutral";
}
