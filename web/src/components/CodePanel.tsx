import { useMemo } from "react";
import { html as diffHtml } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import type { FileChange } from "@engine/core/schemas.ts";

/** Split-screen before/after diff. (Phase 4 swaps in a token-themed Shiki/Monaco renderer.) */
export function CodePanel({ file }: { file: FileChange }) {
  const markup = useMemo(() => {
    if (!file.unifiedDiff.trim()) return "";
    return diffHtml(file.unifiedDiff, {
      drawFileList: false,
      outputFormat: "side-by-side",
      matching: "lines",
    });
  }, [file.unifiedDiff]);

  if (!markup) {
    return <p className="px-1 text-sm text-muted-ink">No textual diff for this file.</p>;
  }
  return (
    <div
      className="gandalf-diff overflow-hidden rounded-md border border-line text-[0.8rem]"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
