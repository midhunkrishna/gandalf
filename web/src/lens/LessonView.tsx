import { lazy, Suspense } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Loader2 } from "lucide-react";
import type { LessonBundle } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { cn } from "@/lib/cn.ts";
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

const triggerCls = cn(
  "border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-ink outline-none transition-colors duration-fast",
  "hover:text-ink data-[state=active]:border-primary data-[state=active]:text-ink",
);

export function LessonView({ lesson }: { lesson: LessonBundle }) {
  return (
    <DepthProvider>
      <QuizModeProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-line bg-surface/40 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl">{lesson.meta.title}</h1>
            <Badge tone={lesson.meta.verdict === "behavioral" ? "modified" : "safe"}>
              {lesson.meta.verdict === "behavioral" ? "behavioral change" : "refactor-only"}
            </Badge>
            {lesson.meta.breakingCount > 0 && (
              <Badge tone="breaking">{lesson.meta.breakingCount} breaking</Badge>
            )}
          </div>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-ink">
            {lesson.meta.hypothesis}
          </p>
        </div>

        <Tabs.Root defaultValue="dependency" className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6">
            <Tabs.List className="flex">
              {LENSES.map(([value, label]) => (
                <Tabs.Trigger key={value} value={value} className={triggerCls}>
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <div className="flex items-center gap-3">
              <QuizToggle />
              <DepthSelector />
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
          <Tabs.Content value="dataflow" className="min-h-0 flex-1 overflow-y-auto outline-none">
            <DataFlowLens lesson={lesson} />
          </Tabs.Content>
          <Tabs.Content value="complexity" className="min-h-0 flex-1 overflow-y-auto outline-none">
            <ComplexityLens lesson={lesson} />
          </Tabs.Content>
          <Tabs.Content value="patterns" className="min-h-0 flex-1 overflow-y-auto outline-none">
            <PatternsLens lesson={lesson} />
          </Tabs.Content>
          <Tabs.Content value="recall" className="min-h-0 flex-1 overflow-y-auto outline-none">
            <RecallPanel lesson={lesson} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
      </QuizModeProvider>
    </DepthProvider>
  );
}
