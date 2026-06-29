/**
 * Classify a changed file so the viewer can hide non-code noise (configs/lockfiles/dotfiles)
 * by default. Mirrors the generated-file patterns in src/core/noise.ts and adds a "config"
 * category. Source code AND docs (.md, LICENSE) stay "code" (always visible).
 */
export type FileKind = "code" | "config" | "generated";

const GENERATED: RegExp[] = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)Podfile\.lock$/,
  /(^|\/)Package\.resolved$/,
  /\.min\.(js|css)$/,
  /(^|\/)(dist|build|out|node_modules|Pods)\//,
  /\.(snap|map)$/,
  /\.(png|jpe?g|gif|webp|pdf|ico|woff2?|ttf|otf|mp4|mov)$/i,
  /\.xcodeproj\//,
  /\.xcassets\//,
];

const CONFIG: RegExp[] = [
  /(^|\/)package\.json$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /\.config\.[cm]?[jt]s$/, // vite.config.ts, tailwind.config.ts, postcss.config.js
  /(^|\/)[^/]*\.config\.(json|ya?ml)$/,
  /(^|\/)\.[^/]+rc(\.[a-z]+)?$/, // .prettierrc, .eslintrc.json, .babelrc
  /(^|\/)\.(gitignore|gitattributes|editorconfig|npmrc|nvmrc|dockerignore|env)(\..+)?$/,
  /\.lock$/,
  /(^|\/)(Gemfile|Podfile|Brewfile|Makefile)$/,
];

export function fileKind(path: string): FileKind {
  for (const re of GENERATED) if (re.test(path)) return "generated";
  for (const re of CONFIG) if (re.test(path)) return "config";
  return "code";
}

/** Non-code (config or generated) files are hidden by default. */
export const isHidden = (path: string): boolean => fileKind(path) !== "code";
