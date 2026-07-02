import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { GitBranch, ImageDown, Loader2 } from "lucide-react";
import type { FileChange, LessonBundle } from "@engine/core/schemas.ts";
import { Badge } from "@/ui/badge.tsx";
import { parseUnifiedDiff, type DiffRow } from "@/lib/parseDiff.ts";
import { tokenizeLines, type TokenSpan } from "@/lib/shiki.ts";
import { shortRef } from "@/lib/refs.ts";
import { cn } from "@/lib/cn.ts";

/**
 * Teaching-diff share card (1200×630): the lesson's focal beacon lines as a
 * real syntax-highlighted diff excerpt, led by the file's plain-English "now"
 * sentence — a code screenshot that explains itself (the carbon/ray.so habit,
 * upgraded). Renders off-screen only while capturing; inherits the current
 * theme; rasterized client-side.
 */

const MAX_ROWS = 13;

/** Word-boundary truncation — CSS line-clamp is unreliable inside html-to-image's foreignObject. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
}

interface ExcerptRow extends DiffRow {
  tokens: TokenSpan[];
}

interface Excerpt {
  file: FileChange;
  note: string | null;
  rows: ExcerptRow[];
}

const isTestPath = (p: string) => /(^|\/)tests?\//i.test(p) || /(\.test\.|_test\.|Tests\.\w+$)/i.test(p);

/** The most teachable excerpt: prefer product code over tests, then contract-richest beacon. */
async function buildExcerpt(lesson: LessonBundle, dark: boolean): Promise<Excerpt | null> {
  const contractCount = (f: FileChange) => lesson.contracts.filter((c) => c.file === f.path).length;
  const candidates = lesson.files
    .filter((f) => f.beacons.length > 0 && f.unifiedDiff.trim())
    .sort(
      (a, b) =>
        Number(isTestPath(a.path)) - Number(isTestPath(b.path)) ||
        contractCount(b) - contractCount(a) ||
        (b.beacons[0]!.endLine - b.beacons[0]!.startLine) - (a.beacons[0]!.endLine - a.beacons[0]!.startLine),
    );
  const file = candidates[0] ?? lesson.files.find((f) => f.unifiedDiff.trim());
  if (!file) return null;

  const beacon = file.beacons[0] ?? null;
  const hunks = parseUnifiedDiff(file.unifiedDiff);
  if (hunks.length === 0) return null;

  // The hunk containing the beacon start (fallback: the first hunk).
  const hunk =
    (beacon && hunks.find((h) => h.rows.some((r) => r.afterNo != null && r.afterNo >= beacon.startLine && r.afterNo <= beacon.endLine))) ||
    hunks[0]!;
  let rows = hunk.rows;
  if (beacon) {
    const idx = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.afterNo != null && r.afterNo >= beacon.startLine && r.afterNo <= beacon.endLine)
      .map(({ i }) => i);
    if (idx.length) rows = rows.slice(idx[0]!, idx[idx.length - 1]! + 1);
  }
  rows = rows.slice(0, MAX_ROWS);
  if (rows.length === 0) return null;

  // Dedent the window's common indent — excerpts often start deep inside a scope.
  const indents = rows.filter((r) => r.text.trim()).map((r) => r.text.match(/^\s*/)![0].length);
  const dedent = indents.length ? Math.min(...indents) : 0;
  const texts = rows.map((r) => r.text.slice(dedent));

  const tokens = await tokenizeLines(texts.join("\n"), file.language, dark);
  return {
    file,
    note: beacon?.note ?? null,
    rows: rows.map((r, i) => ({ ...r, text: texts[i]!, tokens: tokens[i] ?? [] })),
  };
}

function ExcerptCode({ excerpt }: { excerpt: Excerpt }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface font-mono text-[15px] leading-[1.65]">
      {excerpt.rows.map((row, i) => (
        <div
          key={i}
          className={cn("flex", row.kind === "add" && "bg-added/[0.12]", row.kind === "del" && "bg-removed/[0.12]")}
        >
          <span className="w-12 shrink-0 select-none pr-3 pt-px text-right text-[12px] leading-[1.85] text-muted-ink/80">
            {row.afterNo ?? row.beforeNo ?? ""}
          </span>
          <span
            className={cn(
              "w-5 shrink-0 text-center font-semibold",
              row.kind === "add" && "text-added",
              row.kind === "del" && "text-removed",
            )}
          >
            {row.kind === "add" ? "+" : row.kind === "del" ? "−" : ""}
          </span>
          <span className="whitespace-pre pr-4 text-ink">
            {row.tokens.length
              ? row.tokens.map((t, j) => (
                  <span key={j} style={{ color: t.color, fontStyle: t.italic ? "italic" : undefined }}>
                    {t.content}
                  </span>
                ))
              : row.text || " "}
          </span>
        </div>
      ))}
    </div>
  );
}

function Card({
  lesson,
  excerpt,
  cardRef,
}: {
  lesson: LessonBundle;
  excerpt: Excerpt | null;
  cardRef: React.RefObject<HTMLDivElement>;
}) {
  const modules = new Set(lesson.files.map((f) => f.module)).size;
  const lead = excerpt ? excerpt.file.tldr.now : lesson.meta.summary;
  return (
    <div
      ref={cardRef}
      className="flex h-[630px] w-[1200px] flex-col bg-bg p-12 text-ink"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <GitBranch className="h-6 w-6 text-primary" strokeWidth={2} />
          <span className="font-display text-2xl font-semibold">gandalf</span>
        </span>
        <span className="font-mono text-sm text-muted-ink">{excerpt?.file.path ?? lesson.meta.title}</span>
      </div>

      <p className="mt-6 max-w-[68rem] text-[22px] font-medium leading-snug">{clip(lead, 190)}</p>

      {excerpt && (
        <div className="mt-5">
          <ExcerptCode excerpt={excerpt} />
          {excerpt.note && (
            <p className="mt-2.5 max-w-[68rem] text-sm italic leading-snug text-muted-ink">
              {clip(excerpt.note, 240)}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 pt-5">
        <Badge
          tone={lesson.meta.verdict === "behavioral" ? "modified" : "safe"}
          className="rounded-md px-2.5 py-1 text-sm"
        >
          {lesson.meta.verdict === "behavioral" ? "behavioral change" : "refactor-only"}
        </Badge>
        {lesson.meta.breakingCount > 0 && (
          <Badge tone="breaking" className="rounded-md px-2.5 py-1 text-sm">
            {lesson.meta.breakingCount} breaking
          </Badge>
        )}
        <span className="text-sm text-muted-ink">
          {lesson.files.length} files · {modules} modules
        </span>
        <span className="ml-auto font-mono text-sm text-muted-ink">
          {shortRef(lesson.meta.fromRef)} → {shortRef(lesson.meta.toRef)}
          {lesson.meta.ticketId ? ` · ${lesson.meta.ticketId}` : ""}
        </span>
      </div>
    </div>
  );
}

export function ShareCardButton({ lesson }: { lesson: LessonBundle }) {
  const [busy, setBusy] = useState(false);
  const [excerpt, setExcerpt] = useState<Excerpt | null>(null);
  const [ready, setReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Stage 1: on click, build the excerpt (tokenization is async) before mounting the card.
  useEffect(() => {
    if (!busy) return;
    let cancelled = false;
    const dark = document.documentElement.classList.contains("dark");
    buildExcerpt(lesson, dark)
      .then((e) => {
        if (cancelled) return;
        setExcerpt(e);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setExcerpt(null);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [busy, lesson]);

  // Stage 2: card mounted with data — capture and download.
  useEffect(() => {
    if (!busy || !ready) return;
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const node = cardRef.current;
        if (!node || cancelled) return;
        const png = await toPng(node, { width: 1200, height: 630, pixelRatio: 2 });
        const a = document.createElement("a");
        a.href = png;
        a.download = `${lesson.meta.id}-card.png`;
        a.click();
      } catch (err) {
        console.error("share card export failed", err);
      } finally {
        if (!cancelled) {
          setBusy(false);
          setReady(false);
          setExcerpt(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [busy, ready, lesson]);

  return (
    <>
      <button
        onClick={() => setBusy(true)}
        disabled={busy}
        title="Download a 1200×630 share card of this lesson"
        aria-label="Download share card"
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg/70 px-2 py-0.5 text-sm text-muted-ink backdrop-blur transition-colors duration-fast hover:border-primary/50 hover:text-ink"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />}
        Share card
      </button>
      {busy &&
        ready &&
        createPortal(
          <div aria-hidden="true" style={{ position: "fixed", left: "-2600px", top: 0, zIndex: -1 }}>
            <Card lesson={lesson} excerpt={excerpt} cardRef={cardRef} />
          </div>,
          document.body,
        )}
    </>
  );
}
