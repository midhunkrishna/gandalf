/**
 * Parse a unified diff into hunks of typed rows so the viewer can render it
 * natively (Shiki-highlighted, token-styled) instead of via diff2html.
 * Only the hunk body is modelled — file headers (`---`/`+++`, `diff --git`,
 * `index …`) are skipped.
 */
export type DiffRowKind = "context" | "add" | "del";

export interface DiffRow {
  kind: DiffRowKind;
  /** 1-based line number in the before-file (null for added rows). */
  beforeNo: number | null;
  /** 1-based line number in the after-file (null for removed rows). */
  afterNo: number | null;
  /** Line content without the leading diff marker. */
  text: string;
}

export interface DiffHunk {
  /** The raw `@@ … @@` header line. */
  header: string;
  rows: DiffRow[];
}

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseUnifiedDiff(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  if (!diff.trim()) return hunks;

  let before = 0;
  let after = 0;
  let current: DiffHunk | null = null;

  for (const ln of diff.split("\n")) {
    const m = ln.match(HUNK_RE);
    if (m) {
      before = parseInt(m[1]!, 10);
      after = parseInt(m[2]!, 10);
      current = { header: ln, rows: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (ln.startsWith("+")) {
      current.rows.push({ kind: "add", beforeNo: null, afterNo: after++, text: ln.slice(1) });
    } else if (ln.startsWith("-")) {
      current.rows.push({ kind: "del", beforeNo: before++, afterNo: null, text: ln.slice(1) });
    } else if (ln.startsWith(" ")) {
      // Empty context lines arrive space-prefixed; a bare "" is only the final split artifact.
      current.rows.push({ kind: "context", beforeNo: before++, afterNo: after++, text: ln.slice(1) });
    }
    // "\ No newline at end of file", bare "", and stray headers are ignored.
  }
  return hunks;
}

/**
 * Pair a hunk's rows into GitHub-style split rows: context on both sides,
 * removal runs aligned against the addition runs that replace them.
 */
export interface SplitRow {
  left: DiffRow | null;
  right: DiffRow | null;
}

export function pairRows(rows: DiffRow[]): SplitRow[] {
  const out: SplitRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i]!;
    if (r.kind === "context") {
      out.push({ left: r, right: r });
      i++;
      continue;
    }
    const dels: DiffRow[] = [];
    const adds: DiffRow[] = [];
    while (i < rows.length && rows[i]!.kind === "del") dels.push(rows[i++]!);
    while (i < rows.length && rows[i]!.kind === "add") adds.push(rows[i++]!);
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) out.push({ left: dels[k] ?? null, right: adds[k] ?? null });
    if (n === 0) i++; // defensive: never loop forever
  }
  return out;
}
