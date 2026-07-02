import { useEffect, useRef } from "react";
import { FileDiff } from "lucide-react";
import type { ContractChange, LessonBundle } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { TieredExplanation } from "@/components/TieredExplanation.tsx";
import { PredictReveal } from "@/components/PredictReveal.tsx";
import { Reveal } from "@/components/Reveal.tsx";
import { safetyTone } from "@/lib/concept.ts";
import { parseUnifiedDiff } from "@/lib/parseDiff.ts";
import { prefersReducedMotion } from "@/lib/reducedMotion.ts";
import { useRoute, navigate, contractAnchor, NO_DETAIL } from "@/lib/router.ts";

const SAFETIES = ["safe", "breaking", "unknown"] as const;
const base = (p: string) => p.split("/").pop() ?? p;

/** Best after-line for a contract: its beacon, else the first diff row naming the symbol. */
function contractLine(lesson: LessonBundle, c: ContractChange): number | null {
  if (c.beaconLines.length) return c.beaconLines[0]!;
  const file = lesson.files.find((f) => f.path === c.file);
  if (!file) return null;
  const stem = c.symbol.split(".").pop()!.split("(")[0]!;
  if (!stem) return null;
  for (const h of parseUnifiedDiff(file.unifiedDiff)) {
    for (const r of h.rows) {
      if (r.kind !== "del" && r.afterNo != null && r.text.includes(stem)) return r.afterNo;
    }
  }
  return null;
}

export function ContractLens({ lesson }: { lesson: LessonBundle }) {
  const route = useRoute();
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // A contract anchor in the URL (arriving back from the diff, or a pasted
  // link) scrolls to and flashes its row; a stale anchor is a clean no-op.
  useEffect(() => {
    if (!route.contract) return;
    const el = rowRefs.current.get(route.contract);
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      el.classList.add("gg-flash");
      setTimeout(() => el.classList.remove("gg-flash"), 1700);
    }, 60);
    return () => clearTimeout(t);
  }, [route.contract, lesson]);

  function jumpToDiff(c: ContractChange) {
    navigate({
      tab: "dependency",
      ...NO_DETAIL,
      node: c.file,
      line: contractLine(lesson, c),
      from: contractAnchor(c),
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-3">
        <h2 className="text-2xl">Contracts</h2>
        <TieredExplanation text={lesson.explanations.contract} />
        <p className="text-xs text-muted-ink">
          Design-by-Contract in one rule: a change that asks less of callers or promises
          them more is safe. Asking more or promising less breaks them.
        </p>
      </header>

      {lesson.contracts.length === 0 ? (
        <p className="text-sm text-muted-ink">No contract changes detected.</p>
      ) : (
        <div className="space-y-3">
          {lesson.contracts.map((c, i) => (
            <Reveal key={i} delay={Math.min(i, 6) * 0.05}>
            <div
              ref={(el) => {
                if (el) rowRefs.current.set(contractAnchor(c), el);
                else rowRefs.current.delete(contractAnchor(c));
              }}
              className="rounded-lg border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => jumpToDiff(c)}
                  title="Open this change in the diff"
                  className="group flex min-w-0 items-center gap-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="truncate font-mono text-sm font-medium text-ink transition-colors duration-fast group-hover:text-primary">
                    {c.symbol}
                  </span>
                  <FileDiff className="h-3.5 w-3.5 shrink-0 text-muted-ink opacity-0 transition-opacity duration-fast group-hover:opacity-100" />
                </button>
                <span className="text-xs text-muted-ink">
                  {c.kind} · {c.changeType}
                </span>
                <span className="ml-auto font-mono text-[0.7rem] text-muted-ink">
                  {base(c.file)}
                  {c.beaconLines.length ? `:${c.beaconLines[0]}` : ""}
                </span>
              </div>
              {(c.beforeSig || c.afterSig) && (
                <div className="mt-3 space-y-1 font-mono text-xs">
                  {c.beforeSig && (
                    <div className="rounded bg-removed/5 px-2 py-1 text-ink">
                      <span className="text-removed">− </span>
                      {c.beforeSig}
                    </div>
                  )}
                  {c.afterSig && (
                    <div className="rounded bg-added/5 px-2 py-1 text-ink">
                      <span className="text-added">+ </span>
                      {c.afterSig}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3">
                <PredictReveal
                  answer={c.safety}
                  distractors={SAFETIES.filter((s) => s !== c.safety)}
                  question="Given these signature changes, is this Safe or Breaking (Design-by-Contract)?"
                  selfExplain={
                    c.preconditionDelta || c.postconditionDelta
                      ? {
                          prompt: `Explain in your own words why this is ${c.safety} under Design-by-Contract.`,
                          rationale: (
                            <div className="space-y-0.5 text-xs text-muted-ink">
                              {c.preconditionDelta && (
                                <div>
                                  <span className="font-medium text-ink">precondition:</span>{" "}
                                  {c.preconditionDelta}
                                </div>
                              )}
                              {c.postconditionDelta && (
                                <div>
                                  <span className="font-medium text-ink">postcondition:</span>{" "}
                                  {c.postconditionDelta}
                                </div>
                              )}
                            </div>
                          ),
                        }
                      : undefined
                  }
                >
                  <Badge tone={safetyTone(c.safety)}>{c.safety}</Badge>
                </PredictReveal>
              </div>
            </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
