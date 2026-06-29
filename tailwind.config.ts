import type { Config } from "tailwindcss";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The design system is defined as CSS variables in web/src/styles/index.css
 * (warm-editorial identity, :root + .dark). Tailwind only surfaces those tokens
 * as utilities — there are no raw hex values here. Constraint + consistency.
 *
 * Content globs are absolute (relative to this config) so utilities generate
 * regardless of the cwd Vite/Tailwind is launched from.
 */
const config: Config = {
  darkMode: "class",
  content: [join(here, "web/index.html"), join(here, "web/src/**/*.{ts,tsx}")],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        ink: "hsl(var(--ink) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        "muted-ink": "hsl(var(--muted-ink) / <alpha-value>)",
        line: "hsl(var(--line) / <alpha-value>)",
        primary: "hsl(var(--primary) / <alpha-value>)",
        "primary-ink": "hsl(var(--primary-ink) / <alpha-value>)",
        sage: "hsl(var(--sage) / <alpha-value>)",
        gold: "hsl(var(--gold) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        // dual-coding concept hues (reused across gutter / graph node / legend)
        added: "hsl(var(--added) / <alpha-value>)",
        removed: "hsl(var(--removed) / <alpha-value>)",
        modified: "hsl(var(--modified) / <alpha-value>)",
        unchanged: "hsl(var(--unchanged) / <alpha-value>)",
      },
      fontFamily: {
        display: "var(--font-display)",
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        // modular scale (~1.2), paired line-heights
        xs: ["0.75rem", { lineHeight: "1.5" }],
        sm: ["0.875rem", { lineHeight: "1.55" }],
        base: ["1rem", { lineHeight: "1.6" }],
        lg: ["1.125rem", { lineHeight: "1.55" }],
        xl: ["1.35rem", { lineHeight: "1.4" }],
        "2xl": ["1.62rem", { lineHeight: "1.3" }],
        "3xl": ["1.95rem", { lineHeight: "1.2" }],
        "4xl": ["2.35rem", { lineHeight: "1.15" }],
        "5xl": ["3rem", { lineHeight: "1.1" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      maxWidth: { prose: "68ch" },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        decelerate: "cubic-bezier(0, 0, 0.2, 1)",
        accelerate: "cubic-bezier(0.4, 0, 1, 1)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "200ms",
        slow: "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
