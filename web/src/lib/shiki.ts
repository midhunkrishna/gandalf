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

/** Highlight code, marking lines in `focus` and dimming the rest (focus-and-dim). */
export async function highlightFocus(
  code: string,
  language: string,
  focus: Focus | null,
  dark: boolean,
): Promise<string> {
  const hl = await highlighter();
  return hl.codeToHtml(code, {
    lang: resolveLang(hl, language),
    theme: dark ? "github-dark" : "github-light",
    transformers: [
      {
        line(node, line) {
          if (!focus) return;
          const base = node.properties.class ? `${String(node.properties.class)} ` : "";
          node.properties.class = base + (line >= focus.start && line <= focus.end ? "cl-focus" : "cl-dim");
        },
      },
    ],
  });
}
