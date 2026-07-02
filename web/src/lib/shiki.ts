import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubLight from "shiki/themes/github-light.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import ts from "shiki/langs/typescript.mjs";
import tsx from "shiki/langs/tsx.mjs";
import javascript from "shiki/langs/javascript.mjs";
import jsx from "shiki/langs/jsx.mjs";
import json from "shiki/langs/json.mjs";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import markdown from "shiki/langs/markdown.mjs";
import bash from "shiki/langs/bash.mjs";
import swift from "shiki/langs/swift.mjs";

export interface Focus {
  start: number;
  end: number;
}

/** Per-after-line diff status (added/modified/removal-marker) for GitHub-style colouring. */
export interface LineMarks {
  added: Set<number>;
  modified: Set<number>;
  removedBefore: Set<number>;
}

// Fine-grained core build: only these grammars + the wasm-free JS regex engine are
// bundled. Importing the full `shiki` bundle instead pulls every language (and a 600KB
// oniguruma wasm) into the single-file export — keep this list to what we actually render.
const LANGS = [ts, tsx, javascript, jsx, json, css, html, markdown, bash, swift];

let hp: Promise<HighlighterCore> | null = null;
function highlighter(): Promise<HighlighterCore> {
  if (!hp) {
    hp = createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: LANGS,
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
  }
  return hp;
}

function resolveLang(hl: HighlighterCore, language: string): string {
  const lang = language === "tsx" ? "tsx" : language;
  return hl.getLoadedLanguages().includes(lang) ? lang : "text";
}

/** A minimal themed token for custom renderers (the native diff view). */
export interface TokenSpan {
  content: string;
  color?: string;
  italic?: boolean;
  bold?: boolean;
}

/** Tokenize code into per-line themed spans (for renderers that own their own DOM). */
export async function tokenizeLines(code: string, language: string, dark: boolean): Promise<TokenSpan[][]> {
  const hl = await highlighter();
  const { tokens } = hl.codeToTokens(code, {
    lang: resolveLang(hl, language),
    theme: dark ? "github-dark" : "github-light",
  });
  return tokens.map((line) =>
    line.map((t) => ({
      content: t.content,
      color: t.color,
      italic: ((t.fontStyle ?? 0) & 1) !== 0,
      bold: ((t.fontStyle ?? 0) & 2) !== 0,
    })),
  );
}

/**
 * Highlight code with focus-and-dim (the active beacon stays lit, the rest dims) plus
 * GitHub-style diff colouring of changed lines (added=green, modified=yellow, red removal
 * marker) when `marks` is provided.
 */
export async function highlightFocus(
  code: string,
  language: string,
  focus: Focus | null,
  dark: boolean,
  marks?: LineMarks,
): Promise<string> {
  const hl = await highlighter();
  return hl.codeToHtml(code, {
    lang: resolveLang(hl, language),
    theme: dark ? "github-dark" : "github-light",
    transformers: [
      {
        line(node, line) {
          const cls: string[] = [];
          if (focus) {
            // The focal range is the scroll anchor (.cl-focus); everything else dims.
            if (line >= focus.start && line <= focus.end) cls.push("cl-focus");
            else cls.push("cl-dim");
          }
          if (marks) {
            if (marks.added.has(line)) cls.push("cl-add");
            else if (marks.modified.has(line)) cls.push("cl-mod");
            if (marks.removedBefore.has(line)) cls.push("cl-removed-before");
          }
          if (cls.length) {
            const base = node.properties.class ? `${String(node.properties.class)} ` : "";
            node.properties.class = base + cls.join(" ");
          }
        },
      },
    ],
  });
}
