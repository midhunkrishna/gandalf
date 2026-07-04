import type { FnComplexity } from "@engine/core/schemas.ts";

/** Summed before→after deltas across a set of functions (nulls count as 0). */
export function deltaScorecard(rows: FnComplexity[]) {
  const sum = (sel: (p: FnComplexity) => number | null) => rows.reduce((a, p) => a + (sel(p) ?? 0), 0);
  return {
    deltaCyclomatic: sum((p) => p.cyclomaticAfter) - sum((p) => p.cyclomaticBefore),
    deltaCognitive: sum((p) => p.cognitiveAfter) - sum((p) => p.cognitiveBefore),
    deltaNesting: sum((p) => p.nestingAfter) - sum((p) => p.nestingBefore),
    deltaLoc: sum((p) => p.locAfter) - sum((p) => p.locBefore),
  };
}
