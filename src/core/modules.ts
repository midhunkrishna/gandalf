/**
 * Normalize a file path to a canonical module name.
 *
 * Two regimes are handled:
 *  - The dazzzle Swift app's §006 taxonomy (App / Features / Core engines / CoreModels /
 *    DesignSystem / Assets / Tests), repairing the synthetic ticket paths (double-"Engine",
 *    `Core/UI`, ~90 phantom `*Feature` folders) so the graph shows real modules.
 *  - A generic fallback (first 1–2 path segments) for any other repo, incl. gandalf itself.
 */
export function normalizeModule(path: string): string {
  const p = path.replace(/^\.?\//, "");
  const seg = p.split("/").filter(Boolean);
  if (seg.length === 0) return "(root)";

  const top = seg[0]!;

  // ---- Swift app taxonomy ----
  if (top === "App") return "App";
  if (top === "Assets") return "Assets";
  if (top === "Tests") return "Tests";

  if (top === "Features") {
    const f = seg[1] ?? "";
    const name = f.replace(/Feature$/i, "");
    return name ? `Features/${name}` : "Features";
  }

  if (top === "Core") {
    let sub = seg[1] ?? "";
    if (!sub) return "Core";
    if (/^UI$/i.test(sub)) return "Core/DesignSystem";
    // collapse the generator's duplicated "Engine" suffix
    sub = sub.replace(/Engine(Engine)+$/i, "Engine");
    return `Core/${sub}`;
  }

  // ---- generic fallback ----
  // src/<area>/... -> "<area>"; otherwise first two segments.
  if (top === "src" || top === "lib") {
    return seg[1] ? `${top}/${seg[1]}` : top;
  }
  return seg.length >= 2 ? `${seg[0]}/${seg[1]}` : seg[0]!;
}

const NODE_KIND_HINTS: Array<[RegExp, string]> = [
  [/^App$/, "app"],
  [/^Features\//, "feature"],
  [/Engine$/, "engine"],
  [/CoreModels$/, "model"],
  [/^Assets/, "asset"],
  [/^Tests/, "test"],
];

/** Best-effort node kind for graph styling. */
export function moduleKind(moduleName: string): string {
  for (const [re, kind] of NODE_KIND_HINTS) {
    if (re.test(moduleName)) return kind;
  }
  return "module";
}

const LANG_BY_EXT: Record<string, string> = {
  ".swift": "swift",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".html": "html",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".sh": "bash",
  ".yml": "yaml",
  ".yaml": "yaml",
};

export function languageOf(path: string): string {
  const m = path.match(/(\.[^./]+)$/);
  return (m && LANG_BY_EXT[m[1]!.toLowerCase()]) || "text";
}
