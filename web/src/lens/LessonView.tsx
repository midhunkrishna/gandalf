import { lazy, Suspense, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Loader2, ChevronUp, ChevronDown, GitCommitHorizontal, MoveRight } from "lucide-react";
import type { LessonBundle } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { cn } from "@/lib/cn.ts";
import { Constellation } from "@/components/Constellation.tsx";
import { shortRef } from "@/lib/refs.ts";
import { CountUp } from "@/components/CountUp.tsx";
import { ShareCardButton } from "@/components/ShareCard.tsx";
import { DepthProvider } from "@/state/depth.tsx";
import { QuizModeProvider } from "@/lib/quizMode.tsx";
import { DepthSelector } from "@/components/DepthSelector.tsx";
import { QuizToggle } from "@/components/QuizToggle.tsx";
import { OverviewLens } from "@/lens/OverviewLens.tsx";
import { DependencyLens } from "@/lens/DependencyLens.tsx";
import { BehavioralLens } from "@/lens/BehavioralLens.tsx";
import { ContractLens } from "@/lens/ContractLens.tsx";
import { DataFlowLens } from "@/lens/DataFlowLens.tsx";
import { ComplexityLens } from "@/lens/ComplexityLens.tsx";
import { PatternsLens } from "@/lens/PatternsLens.tsx";
import { RecallPanel } from "@/components/RecallPanel.tsx";
import { useRoute, navigate, NO_DETAIL, type Tab } from "@/lib/router.ts";

// Lazy-loaded: pulls in Shiki + Lenis only when the walkthrough is opened.
const WalkthroughLens = lazy(() =>
  import("@/lens/WalkthroughLens.tsx").then((m) => ({ default: m.WalkthroughLens })),
);

const LENSES: Array<[string, string]> = [
  ["overview", "Overview"],
  ["dependency", "Dependencies"],
  ["walkthrough", "Walkthrough"],
  ["behavioral", "Behavioral"],
  ["contract", "Contracts"],
  ["dataflow", "Data flow"],
  ["complexity", "Complexity"],
  ["patterns", "Patterns"],
  ["recall", "Recall"],
];

// Lenses the lite profile never generates: hidden entirely rather than shown empty.
const LITE_HIDDEN = new Set(["dataflow", "patterns", "recall"]);

// Lenses that render TieredExplanation → only these show the depth selector.
const DEPTH_TABS = new Set(["behavioral", "contract", "dataflow", "dependency"]);
// A lite lesson has no tiered explanations, so no lens gets a depth selector.
const NO_DEPTH_TABS = new Set<string>();
// Lenses with predict-then-reveal gating → only these show the quiz toggle.
const QUIZ_TABS = new Set(["behavioral", "contract"]);

const triggerCls = cn(
  "border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-ink outline-none transition-colors duration-fast",
  "hover:text-ink data-[state=active]:border-primary data-[state=active]:text-ink",
);

const iconBtn =
  "rounded-md p-1 text-muted-ink transition-colors duration-fast hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md border border-line bg-bg/70 px-2 py-0.5 backdrop-blur">
      <span className="text-sm font-semibold tabular-nums text-ink">
        <CountUp value={value} />
      </span>
      <span className="text-[0.7rem] text-muted-ink">{label}</span>
    </span>
  );
}

function heroInit(): boolean {
  try {
    return localStorage.getItem("gandalf:hero-collapsed") === "1";
  } catch {
    return false;
  }
}

export function LessonView({ lesson }: { lesson: LessonBundle }) {
  const lite = lesson.meta.profile === "lite";
  const lenses = lite ? LENSES.filter(([value]) => !LITE_HIDDEN.has(value)) : LENSES;
  const depthTabs = lite ? NO_DEPTH_TABS : DEPTH_TABS;
  // The URL owns the active tab (default overview — Shneiderman's mantra). A deep link
  // into a lens this lesson doesn't have falls back to overview instead of an empty tab.
  const routedTab = useRoute().tab;
  const tab = lenses.some(([value]) => value === routedTab) ? routedTab : "overview";
  const setTab = (t: string) => navigate({ tab: t as Tab, ...NO_DETAIL });
  const [heroCollapsed, setHeroCollapsed] = useState<boolean>(heroInit);
  const setHero = (v: boolean) => {
    setHeroCollapsed(v);
    try {
      localStorage.setItem("gandalf:hero-collapsed", v ? "1" : "0");
    } catch {
      /* private mode */
    }
  };

  return (
    <DepthProvider>
      <QuizModeProvider>
        <div className="flex min-h-0 flex-1 flex-col">
          {!heroCollapsed && (
            <div className="relative overflow-hidden border-b border-line bg-surface/40">
              <Constellation
                graph={lesson.graph}
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{
                  // Keep the drawing right-of-center so it never fights the title/prose.
                  maskImage: "linear-gradient(to right, transparent 30%, black 62%)",
                  WebkitMaskImage: "linear-gradient(to right, transparent 30%, black 62%)",
                }}
              />
              <div className="relative px-6 py-5">
                <button
                  onClick={() => setHero(true)}
                  aria-label="Collapse header"
                  title="Tuck the header away"
                  className={cn(iconBtn, "absolute right-4 top-0")}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 pr-8">
                  <h1 className="max-w-3xl font-display text-2xl leading-snug md:text-3xl">
                    {lesson.meta.title}
                  </h1>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={lesson.meta.verdict === "behavioral" ? "modified" : "safe"}>
                      {lesson.meta.verdict === "behavioral" ? "behavioral change" : "refactor-only"}
                    </Badge>
                    {lesson.meta.breakingCount > 0 && (
                      <Badge tone="breaking">{lesson.meta.breakingCount} breaking</Badge>
                    )}
                    {lite && (
                      <Badge tone="neutral" title="Lite profile: Data flow, Patterns, Recall and the tiered explanations were not generated">
                        lite
                      </Badge>
                    )}
                  </span>
                </div>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-ink">
                  {lesson.meta.hypothesis}
                </p>
                <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5 font-mono text-xs text-muted-ink">
                    <GitCommitHorizontal className="h-3.5 w-3.5" />
                    {shortRef(lesson.meta.fromRef)}
                    <MoveRight className="h-3 w-3" />
                    {shortRef(lesson.meta.toRef)}
                  </span>
                  {lesson.meta.ticketId && (
                    <span className="font-mono text-xs text-muted-ink">{lesson.meta.ticketId}</span>
                  )}
                  <span className="font-mono text-xs text-muted-ink">
                    {lesson.meta.createdAt.slice(0, 10)}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatChip value={lesson.files.length} label="files" />
                    <StatChip value={lesson.contracts.length} label="contracts" />
                    {!lite && <StatChip value={lesson.retrieval?.questions.length ?? 0} label="recall" />}
                  </span>
                  <ShareCardButton lesson={lesson} />
                </div>
              </div>
            </div>
          )}

          <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6">
              <div className="flex items-center gap-1.5">
                {heroCollapsed && (
                  <button
                    onClick={() => setHero(false)}
                    aria-label="Expand header"
                    title="Bring the header back"
                    className={iconBtn}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                )}
                <Tabs.List className="flex">
                  {lenses.map(([value, label]) => (
                    <Tabs.Trigger key={value} value={value} className={triggerCls}>
                      {label}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
              </div>
              <div className="flex items-center gap-3">
                {QUIZ_TABS.has(tab) && <QuizToggle />}
                {depthTabs.has(tab) && <DepthSelector />}
              </div>
            </div>

            <Tabs.Content value="overview" className="min-h-0 flex-1 overflow-y-auto outline-none">
              <OverviewLens lesson={lesson} />
            </Tabs.Content>
            <Tabs.Content value="dependency" className="min-h-0 flex-1 outline-none">
              <DependencyLens lesson={lesson} />
            </Tabs.Content>
            <Tabs.Content value="walkthrough" className="min-h-0 flex-1 outline-none">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-muted-ink">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                }
              >
                <WalkthroughLens lesson={lesson} />
              </Suspense>
            </Tabs.Content>
            <Tabs.Content value="behavioral" className="min-h-0 flex-1 overflow-y-auto outline-none">
              <BehavioralLens lesson={lesson} />
            </Tabs.Content>
            <Tabs.Content value="contract" className="min-h-0 flex-1 overflow-y-auto outline-none">
              <ContractLens lesson={lesson} />
            </Tabs.Content>
            {!lite && (
              <Tabs.Content value="dataflow" className="min-h-0 flex-1 overflow-y-auto outline-none">
                <DataFlowLens lesson={lesson} />
              </Tabs.Content>
            )}
            <Tabs.Content value="complexity" className="min-h-0 flex-1 overflow-y-auto outline-none">
              <ComplexityLens lesson={lesson} />
            </Tabs.Content>
            {!lite && (
              <>
                <Tabs.Content value="patterns" className="min-h-0 flex-1 overflow-y-auto outline-none">
                  <PatternsLens lesson={lesson} />
                </Tabs.Content>
                <Tabs.Content value="recall" className="min-h-0 flex-1 overflow-y-auto outline-none">
                  <RecallPanel lesson={lesson} />
                </Tabs.Content>
              </>
            )}
          </Tabs.Root>
        </div>
      </QuizModeProvider>
    </DepthProvider>
  );
}
