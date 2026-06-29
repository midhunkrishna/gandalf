import { useState } from "react";
import { Moon, Sun, GitBranch } from "lucide-react";
import { Button } from "@/ui/button.tsx";
import { Badge } from "@/ui/badge.tsx";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-ink">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="space-y-1.5">
      <div
        className="h-14 rounded-md border border-line/60 shadow-xs"
        style={{ backgroundColor: `hsl(var(${varName}))` }}
      />
      <div className="text-xs font-medium text-ink">{name}</div>
      <div className="font-mono text-[0.7rem] text-muted-ink">{varName}</div>
    </div>
  );
}

// Full literal class names so Tailwind's scanner generates them.
const TYPE = [
  ["text-5xl", "font-display", "Pick your photos."],
  ["text-4xl", "font-display", "Turn them into something worth posting."],
  ["text-3xl", "font-display", "Module dependency, behavioral, contract, data-flow."],
  ["text-2xl", "font-display", "What changed, and — more importantly — why."],
  ["text-xl", "font-display", "A lesson, not a wall of red and green."],
  ["text-base", "", "Body copy sits at a comfortable measure of about 68 characters for sustained reading."],
  ["text-sm", "", "Secondary and metadata text steps down in size and contrast."],
] as const;

const COLORS = [
  ["Background", "--bg"],
  ["Surface", "--surface"],
  ["Surface 2", "--surface-2"],
  ["Ink", "--ink"],
  ["Muted ink", "--muted-ink"],
  ["Line", "--line"],
  ["Primary (terracotta)", "--primary"],
  ["Sage", "--sage"],
  ["Gold", "--gold"],
  ["Danger", "--danger"],
] as const;

const CONCEPT = [
  ["Added", "--added"],
  ["Removed", "--removed"],
  ["Modified", "--modified"],
  ["Unchanged", "--unchanged"],
] as const;

const SPACING = [1, 2, 3, 4, 6, 8, 12, 16, 24] as const;
const SHADOWS = ["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl"] as const;
const RADII = ["rounded-sm", "rounded-md", "rounded-lg"] as const;

export function App() {
  const [dark, setDark] = useState(false);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <GitBranch className="h-5 w-5 text-primary" strokeWidth={2} />
            <span className="font-display text-xl font-semibold">gandalf</span>
            <Badge tone="primary" className="ml-1">design system</Badge>
          </div>
          <Button variant="secondary" size="sm" onClick={toggle}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {dark ? "Light" : "Dark"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-6 py-12">
        <div className="max-w-prose space-y-3">
          <h1 className="text-4xl">Design foundation</h1>
          <p className="text-base text-muted-ink">
            Warm-editorial tokens — one type scale, an 8-point spacing rhythm, a restrained palette
            with semantic and dual-coding hues, two-layer elevation, and a single motion vocabulary.
            Every surface in gandalf is built from these.
          </p>
        </div>

        <Section title="Type scale">
          <div className="space-y-2.5">
            {TYPE.map(([cls, face, sample]) => (
              <div key={cls} className="flex items-baseline gap-4">
                <span className="w-12 shrink-0 font-mono text-xs text-muted-ink">{cls.slice(5)}</span>
                <span className={`${cls} ${face}`}>{sample}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Color — semantic">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {COLORS.map(([name, v]) => (
              <Swatch key={v} name={name} varName={v} />
            ))}
          </div>
        </Section>

        <Section title="Color — dual-coding concepts (gutter · node · legend)">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {CONCEPT.map(([name, v]) => (
              <Swatch key={v} name={name} varName={v} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge tone="added">added</Badge>
            <Badge tone="removed">removed</Badge>
            <Badge tone="modified">modified</Badge>
            <Badge tone="safe">safe</Badge>
            <Badge tone="breaking">breaking</Badge>
          </div>
        </Section>

        <Section title="Spacing — 4 / 8 scale">
          <div className="flex flex-wrap items-end gap-3">
            {SPACING.map((s) => (
              <div key={s} className="space-y-1.5 text-center">
                <div className="bg-primary/80" style={{ width: s * 4, height: s * 4 }} />
                <div className="font-mono text-[0.7rem] text-muted-ink">{s * 4}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Elevation">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
            {SHADOWS.map((s) => (
              <div key={s} className="space-y-2">
                <div className={`h-16 rounded-md bg-surface ${s}`} />
                <div className="font-mono text-[0.7rem] text-muted-ink">{s}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Radius">
          <div className="flex gap-5">
            {RADII.map((r) => (
              <div key={r} className="space-y-2">
                <div className={`h-16 w-16 border border-line bg-surface-2 ${r}`} />
                <div className="font-mono text-[0.7rem] text-muted-ink">{r}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buttons — variants & states">
          <div className="space-y-4">
            {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-3">
                <span className="w-20 font-mono text-xs text-muted-ink">{variant}</span>
                <Button variant={variant}>Default</Button>
                <Button variant={variant} className="ring-2 ring-ring ring-offset-2 ring-offset-bg">
                  Focused
                </Button>
                <Button variant={variant} disabled>
                  Disabled
                </Button>
              </div>
            ))}
            <p className="text-sm text-muted-ink">
              Hover and active states are live — interact above. Focus rings use the standard{" "}
              <code className="rounded-sm bg-surface-2 px-1 font-mono text-xs">--ring</code> token.
            </p>
          </div>
        </Section>
      </main>
    </div>
  );
}
