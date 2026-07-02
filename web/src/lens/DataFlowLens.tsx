import type { LessonBundle } from "@engine/core/schemas.ts";
import { MermaidDiagram } from "@/components/MermaidDiagram.tsx";
import { Sankey } from "@/components/Sankey.tsx";
import { TieredExplanation } from "@/components/TieredExplanation.tsx";
import { SectionHeading } from "@/ui/SectionHeading.tsx";

export function DataFlowLens({ lesson }: { lesson: LessonBundle }) {
  const df = lesson.dataflow;
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-3">
        <h2 className="text-2xl">Data flow</h2>
        <TieredExplanation text={lesson.explanations.dataflow} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-removed/20 bg-removed/5 p-3">
          <div className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-removed">
            before
          </div>
          <p className="text-sm leading-relaxed text-ink">{df.narrative.before}</p>
        </div>
        <div className="rounded-md border border-added/20 bg-added/5 p-3">
          <div className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-added">
            after
          </div>
          <p className="text-sm leading-relaxed text-ink">{df.narrative.after}</p>
        </div>
      </div>

      <section className="space-y-2">
        <SectionHeading hint="who calls whom, in order">Sequence</SectionHeading>
        <div className="rounded-lg border border-line bg-surface p-4">
          <MermaidDiagram code={df.mermaid} />
        </div>
      </section>

      {df.sankey && df.sankey.links.length > 0 && (
        <section className="space-y-2">
          <SectionHeading hint="how much moves between modules">Flow volume</SectionHeading>
          <div className="rounded-lg border border-line bg-surface p-4">
            <Sankey data={df.sankey} />
          </div>
        </section>
      )}
    </div>
  );
}
