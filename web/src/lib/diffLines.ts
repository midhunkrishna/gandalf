/**
 * Classify each AFTER-file line from a unified diff so the walkthrough code panel can
 * colour changes like a GitHub diff: added → green, modified → yellow, and a red marker
 * where lines were removed (removed lines don't exist in the after-only view).
 *
 * A change block (a run of `-`/`+` lines) with both deletions and additions → its `+`
 * lines are "modified"; a block with only `+` → "added"; a block with only `-` → a
 * removal marker placed above the next after-line.
 */
export interface LineMarks {
  added: Set<number>;
  modified: Set<number>;
  removedBefore: Set<number>;
}

export function diffLineMarks(unifiedDiff: string): LineMarks {
  const added = new Set<number>();
  const modified = new Set<number>();
  const removedBefore = new Set<number>();
  if (!unifiedDiff) return { added, modified, removedBefore };

  const lines = unifiedDiff.split("\n");
  let after = 0;
  let inHunk = false;
  let j = 0;

  while (j < lines.length) {
    const ln = lines[j]!;
    const hunk = ln.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      after = parseInt(hunk[1]!, 10);
      inHunk = true;
      j++;
      continue;
    }
    if (!inHunk) {
      j++;
      continue;
    }
    if (ln.startsWith(" ")) {
      after++;
      j++;
      continue;
    }
    if (ln.startsWith("-") || ln.startsWith("+")) {
      let dels = 0;
      const addLines: number[] = [];
      while (j < lines.length) {
        const c = lines[j]!;
        if (c.startsWith("-")) dels++;
        else if (c.startsWith("+")) {
          addLines.push(after);
          after++;
        } else if (c.startsWith("\\")) {
          /* "\ No newline at end of file" — ignore */
        } else break;
        j++;
      }
      if (addLines.length > 0) {
        const target = dels > 0 ? modified : added;
        for (const n of addLines) target.add(n);
      } else if (dels > 0) {
        removedBefore.add(after); // a removal sits just above this after-line
      }
      continue;
    }
    j++;
  }
  return { added, modified, removedBefore };
}
