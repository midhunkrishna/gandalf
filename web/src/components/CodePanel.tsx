import { useEffect, useMemo, useRef, useState } from "react";
import type { FileChange } from "@engine/core/schemas.ts";
import { parseUnifiedDiff, pairRows, type DiffHunk, type DiffRow } from "@/lib/parseDiff.ts";
import { tokenizeLines, type TokenSpan } from "@/lib/shiki.ts";
import { useIsDark } from "@/lib/useIsDark.ts";
import { prefersReducedMotion } from "@/lib/reducedMotion.ts";
import { cn } from "@/lib/cn.ts";

/**
 * Native diff view: the unified diff parsed into rows and rendered with Shiki
 * syntax colours inside the token washes (`--added` / `--removed`) — the same
 * hue-per-concept used by the graph and legends. Beacon rows (the focal lines
 * that carry the change's meaning) get a primary accent bar.
 * `split` renders GitHub-style before | after.
 */

type RowTokens = TokenSpan[] | null;

interface TokenizedHunk {
  hunk: DiffHunk;
  /** Per-row themed spans, aligned by row index (null until tokenized). */
  rowTokens: RowTokens[];
}

function tokenizeHunks(hunks: DiffHunk[], language: string, dark: boolean): Promise<TokenizedHunk[]> {
  return Promise.all(
    hunks.map(async (hunk) => {
      // Tokenize each side as its own document so grammar state flows across rows.
      const beforeDoc = hunk.rows.filter((r) => r.kind !== "add").map((r) => r.text).join("\n");
      const afterDoc = hunk.rows.filter((r) => r.kind !== "del").map((r) => r.text).join("\n");
      const [before, after] = await Promise.all([
        tokenizeLines(beforeDoc, language, dark),
        tokenizeLines(afterDoc, language, dark),
      ]);
      let b = 0;
      let a = 0;
      const rowTokens = hunk.rows.map((r): RowTokens => {
        if (r.kind === "del") return before[b++] ?? null;
        if (r.kind === "add") return after[a++] ?? null;
        b++;
        return after[a++] ?? null;
      });
      return { hunk, rowTokens };
    }),
  );
}

function CodeText({ tokens, text }: { tokens: RowTokens; text: string }) {
  if (!tokens || tokens.length === 0) {
    return <>{text.length ? text : " "}</>;
  }
  return (
    <>
      {tokens.map((t, i) => (
        <span
          key={i}
          style={{
            color: t.color,
            fontStyle: t.italic ? "italic" : undefined,
            fontWeight: t.bold ? 600 : undefined,
          }}
        >
          {t.content}
        </span>
      ))}
    </>
  );
}

const rowClass = (kind: DiffRow["kind"]) => (kind === "add" ? "gd-add" : kind === "del" ? "gd-del" : undefined);

export function CodePanel({
  file,
  split = false,
  focusLine = null,
}: {
  file: FileChange;
  split?: boolean;
  /** After-file line to scroll to and flash (cross-navigation target). */
  focusLine?: number | null;
}) {
  const dark = useIsDark();
  const container = useRef<HTMLDivElement>(null);
  const hunks = useMemo(() => parseUnifiedDiff(file.unifiedDiff), [file.unifiedDiff]);
  const beaconLines = useMemo(() => {
    const s = new Set<number>();
    for (const b of file.beacons) for (let n = b.startLine; n <= b.endLine; n++) s.add(n);
    return s;
  }, [file.beacons]);

  const [tokenized, setTokenized] = useState<TokenizedHunk[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTokenized(null);
    tokenizeHunks(hunks, file.language, dark).then((t) => {
      if (!cancelled) setTokenized(t);
    });
    return () => {
      cancelled = true;
    };
  }, [hunks, file.language, dark]);

  // Scroll to + flash the focused line. Degrades to a no-op when the line has
  // no diff row (stale link after regeneration) — never a wrong target.
  useEffect(() => {
    if (focusLine == null) return;
    const raf = requestAnimationFrame(() => {
      const rows = container.current?.querySelectorAll<HTMLTableRowElement>("tr[data-after]") ?? [];
      const target = Array.from(rows).find((r) => Number(r.dataset.after) >= focusLine);
      if (!target) return;
      target.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      target.classList.add("gg-flash");
      setTimeout(() => target.classList.remove("gg-flash"), 1700);
    });
    return () => cancelAnimationFrame(raf);
  }, [focusLine, file.path, split]);

  if (hunks.length === 0) {
    return <p className="px-1 text-sm text-muted-ink">No text diff for this file.</p>;
  }

  const isBeacon = (r: DiffRow | null) => r?.afterNo != null && beaconLines.has(r.afterNo);

  return (
    <div ref={container} className="gandalf-diff overflow-x-auto rounded-md border border-line" data-diff-view={split ? "split" : "unified"}>
      <table>
        <tbody>
          {hunks.map((hunk, hi) => {
            const toks = tokenized?.[hi]?.rowTokens;
            const tokensAt = (row: DiffRow) => toks?.[hunk.rows.indexOf(row)] ?? null;
            return [
              <tr key={`h${hi}`}>
                <td className={cn("gd-hunk", hi === 0 && "gd-hunk-first")} colSpan={split ? 6 : 4}>
                  {hunk.header}
                </td>
              </tr>,
              ...(split
                ? pairRows(hunk.rows).map((pair, ri) => (
                    <tr key={`${hi}:${ri}`} data-after={pair.right?.afterNo ?? undefined}>
                      <td className={cn("gd-num", pair.left && rowClass(pair.left.kind))}>{pair.left?.beforeNo ?? ""}</td>
                      <td className={cn("gd-mark", pair.left && rowClass(pair.left.kind), !pair.left && "gd-empty")}>
                        {pair.left?.kind === "del" ? "−" : ""}
                      </td>
                      <td className={cn("gd-code", pair.left ? rowClass(pair.left.kind) : "gd-empty")}>
                        {pair.left ? <CodeText tokens={tokensAt(pair.left)} text={pair.left.text} /> : " "}
                      </td>
                      <td className={cn("gd-num gd-split-divide", pair.right && rowClass(pair.right.kind), isBeacon(pair.right) && "gd-beacon")}>
                        {pair.right?.afterNo ?? ""}
                      </td>
                      <td className={cn("gd-mark", pair.right && rowClass(pair.right.kind), !pair.right && "gd-empty")}>
                        {pair.right?.kind === "add" ? "+" : ""}
                      </td>
                      <td className={cn("gd-code", pair.right ? rowClass(pair.right.kind) : "gd-empty")}>
                        {pair.right ? <CodeText tokens={tokensAt(pair.right)} text={pair.right.text} /> : " "}
                      </td>
                    </tr>
                  ))
                : hunk.rows.map((row, ri) => (
                    <tr key={`${hi}:${ri}`} className={rowClass(row.kind)} data-after={row.afterNo ?? undefined}>
                      <td className={cn("gd-num", isBeacon(row) && "gd-beacon")}>{row.beforeNo ?? ""}</td>
                      <td className="gd-num">{row.afterNo ?? ""}</td>
                      <td className="gd-mark">{row.kind === "add" ? "+" : row.kind === "del" ? "−" : ""}</td>
                      <td className="gd-code">
                        <CodeText tokens={tokensAt(row)} text={row.text} />
                      </td>
                    </tr>
                  ))),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
