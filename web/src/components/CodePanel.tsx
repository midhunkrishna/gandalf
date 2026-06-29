import { useMemo } from "react";
import { html as diffHtml } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import type { FileChange } from "@engine/core/schemas.ts";

/**
 * Diff view, themed to the design tokens (see `.gandalf-diff` in index.css).
 * Line-by-line by default; `split` renders GitHub-style side-by-side (before | after).
 * Both modes pin diff2html's otherwise-absolute line numbers into normal table flow
 * (see the `.gandalf-diff` overrides). Horizontally scrollable, never clipped.
 */
export function CodePanel({ file, split = false }: { file: FileChange; split?: boolean }) {
  const markup = useMemo(() => {
    if (!file.unifiedDiff.trim()) return "";
    return diffHtml(file.unifiedDiff, {
      drawFileList: false,
      outputFormat: split ? "side-by-side" : "line-by-line",
      matching: "lines",
    });
  }, [file.unifiedDiff, split]);

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
