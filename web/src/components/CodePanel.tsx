import { useMemo } from "react";
import { html as diffHtml } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import type { FileChange } from "@engine/core/schemas.ts";

/**
 * Diff view, themed to the design tokens (see `.gandalf-diff` in index.css).
 * Always line-by-line: its line numbers live in normal table cells so they scroll with
 * the code. (diff2html's side-by-side uses position:absolute line numbers that detach
 * from the code on all-added/all-removed files.) Horizontally scrollable, never clipped.
 */
export function CodePanel({ file }: { file: FileChange; wide?: boolean }) {
  const markup = useMemo(() => {
    if (!file.unifiedDiff.trim()) return "";
    return diffHtml(file.unifiedDiff, {
      drawFileList: false,
      outputFormat: "line-by-line",
      matching: "lines",
    });
  }, [file.unifiedDiff]);

  if (!markup) {
    return <p className="px-1 text-sm text-muted-ink">No textual diff for this file.</p>;
  }
  return (
    <div
      className="gandalf-diff overflow-x-auto rounded-md border border-line"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
