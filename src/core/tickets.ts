import { readFile } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { existsSync } from "node:fs";

/** A parsed ticket from tickets.md (the "intent" overlay for a diff). */
export interface Ticket {
  id: string;
  title: string;
  phase: string | null;
  area: string | null;
  purpose: string | null;
  implementation: string[];
  files: string[];
  acceptance: string[];
  doNot: string | null;
  doneMeans: string | null;
}

function collect(block: string, field: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`^- ${field}:\\s*(.*)$`, "gm");
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push((m[1] ?? "").trim());
  return out;
}

function first(values: string[]): string | null {
  return values.length ? values[0]! : null;
}

export function parseTickets(markdown: string): Ticket[] {
  const tickets: Ticket[] = [];
  // Split on each "### Ticket <ID>: <title>" header, keeping the header.
  const parts = markdown.split(/^### Ticket /m).slice(1);
  for (const part of parts) {
    const headerEnd = part.indexOf("\n");
    const header = (headerEnd === -1 ? part : part.slice(0, headerEnd)).trim();
    const body = headerEnd === -1 ? "" : part.slice(headerEnd + 1);
    const colon = header.indexOf(":");
    const id = (colon === -1 ? header : header.slice(0, colon)).trim();
    const title = (colon === -1 ? "" : header.slice(colon + 1)).trim();
    if (!id) continue;
    tickets.push({
      id,
      title,
      phase: first(collect(body, "Phase")),
      area: first(collect(body, "Area")),
      purpose: first(collect(body, "Purpose")),
      implementation: collect(body, "Implementation"),
      files: collect(body, "Files"),
      acceptance: collect(body, "Acceptance"),
      doNot: first(collect(body, "Do not")),
      doneMeans: first(collect(body, "Done means")),
    });
  }
  return tickets;
}

/** Walk up from cwd looking for tickets.md. */
export function findTicketsFile(cwd: string): string | null {
  let dir = cwd;
  for (let i = 0; i < 4; i++) {
    const candidate = join(dir, "tickets.md");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export async function loadTickets(cwd: string): Promise<Ticket[]> {
  const file = findTicketsFile(cwd);
  if (!file) return [];
  try {
    return parseTickets(await readFile(file, "utf8"));
  } catch {
    return [];
  }
}

/** Pick the ticket whose Files best overlap the changed paths (by basename + suffix). */
export function matchTicket(
  changedPaths: string[],
  tickets: Ticket[],
  explicitId?: string,
): Ticket | null {
  if (explicitId) {
    return tickets.find((t) => t.id.toLowerCase() === explicitId.toLowerCase()) ?? null;
  }
  if (!tickets.length || !changedPaths.length) return null;
  const changedBases = new Set(changedPaths.map((p) => basename(p)));
  let best: Ticket | null = null;
  let bestScore = 0;
  for (const t of tickets) {
    let score = 0;
    for (const f of t.files) {
      const fb = basename(f);
      if (changedBases.has(fb)) score += 2;
      else if (changedPaths.some((p) => p.endsWith(f) || f.endsWith(p))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 2 ? best : null;
}

/** Compact intent string for the synthesis prompt. */
export function ticketIntent(t: Ticket): string {
  const lines = [`Ticket ${t.id}: ${t.title}`];
  if (t.phase) lines.push(`Phase: ${t.phase}`);
  if (t.area) lines.push(`Area: ${t.area}`);
  if (t.purpose) lines.push(`Purpose: ${t.purpose}`);
  if (t.acceptance.length) {
    lines.push("Acceptance:");
    for (const a of t.acceptance.slice(0, 8)) lines.push(`  - ${a}`);
  }
  if (t.doNot) lines.push(`Do not: ${t.doNot}`);
  return lines.join("\n");
}
