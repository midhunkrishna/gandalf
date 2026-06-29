/**
 * Classify diff "noise" so a lesson spends the reader's attention on the semantic delta.
 * (Cognitive-load research: collapse formatting-only, generated, and pure-rename churn.)
 */

const GENERATED_PATTERNS: RegExp[] = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)Podfile\.lock$/,
  /(^|\/)Package\.resolved$/,
  /\.min\.(js|css)$/,
  /(^|\/)(dist|build|out|node_modules|Pods)\//,
  /\.(snap|map)$/,
  /\.(png|jpg|jpeg|gif|webp|pdf|ico|woff2?|ttf|otf|mp4|mov)$/i,
  /\.xcodeproj\//,
  /\.xcassets\//,
];

export interface NoiseVerdict {
  /** Exclude from per-file analysis entirely (still listed, collapsed). */
  skip: boolean;
  reason: string | null;
}

export function classifyPath(path: string): NoiseVerdict {
  for (const re of GENERATED_PATTERNS) {
    if (re.test(path)) return { skip: true, reason: "generated/binary/lockfile" };
  }
  return { skip: false, reason: null };
}

/** True if a unified diff's +/- lines differ only by whitespace (formatting-only). */
export function isFormattingOnly(unifiedDiff: string): boolean {
  const added: string[] = [];
  const removed: string[] = [];
  for (const line of unifiedDiff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) continue;
    if (line.startsWith("+")) added.push(line.slice(1).replace(/\s+/g, ""));
    else if (line.startsWith("-")) removed.push(line.slice(1).replace(/\s+/g, ""));
  }
  if (added.length === 0 && removed.length === 0) return false;
  const a = [...added].sort().join("\n");
  const r = [...removed].sort().join("\n");
  return a === r;
}
