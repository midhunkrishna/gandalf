import { createHighlighter, type Highlighter } from "shiki";

export interface Focus {
  start: number;
  end: number;
}

const LANGS = ["typescript", "tsx", "javascript", "swift", "json"];

let hp: Promise<Highlighter> | null = null;
function highlighter(): Promise<Highlighter> {
  if (!hp) hp = createHighlighter({ themes: ["github-light", "github-dark"], langs: LANGS });
  return hp;
}

function resolveLang(hl: Highlighter, language: string): string {
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
