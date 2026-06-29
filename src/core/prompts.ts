import type { FileChange, FilePassResult } from "./schemas.ts";

const BLOB_TRUNC = 6000;

function truncate(s: string | null, n: number): string {
  if (!s) return "(none)";
  return s.length > n ? `${s.slice(0, n)}\n… [truncated ${s.length - n} chars]` : s;
}

export interface Built {
  system: string;
  prompt: string;
}

const FILE_SYSTEM = `You are a senior engineer writing precise teaching material about ONE changed file in a code review.
Rules:
- Ground every complexity claim in the provided metrics. If metrics are absent, ESTIMATE cognitive complexity using SonarSource rules (ignore shorthand like a whole switch; +1 per break in linear flow — loops/conditionals/catch/sequences of boolean ops/recursion; +1 extra per level of nesting) and note it is an estimate.
- "beacons" are the few focal line ranges that carry the change's meaning — not every changed line. Use line numbers from the AFTER file where possible.
- For each changed declaration, emit a ContractChange. Decide safety with Design-by-Contract: weakening a precondition or strengthening a postcondition is SAFE (backward-compatible); strengthening a precondition or weakening a postcondition is BREAKING. Use "unknown" when unclear.
- tldr.before / tldr.now / tldr.behaviorChanged must be one sentence each, concrete.
Output must satisfy the provided JSON schema exactly.`;

export function filePassPrompt(file: FileChange, evidence: string): Built {
  const prompt = `FILE: ${file.path}
LANGUAGE: ${file.language}
STATUS: ${file.status}

DETERMINISTIC EVIDENCE (ground truth — do not contradict):
${evidence}

UNIFIED DIFF:
${truncate(file.unifiedDiff, 12000)}

AFTER (current) CONTENT:
${truncate(file.afterBlob, BLOB_TRUNC)}

BEFORE CONTENT:
${truncate(file.beforeBlob, BLOB_TRUNC)}

Produce the per-file teaching artifact for this single file.`;
  return { system: FILE_SYSTEM, prompt };
}

const SYNTH_SYSTEM = `You are a staff engineer synthesizing a multi-lens lesson about a code change, for a teammate learning what changed and why.
Produce, grounded in the per-file findings + deterministic evidence + ticket intent (the WHY):
- A behavioral verdict: "behavioral" (observable behavior changed) vs "refactor-only" (behavior preserved), plus a one-line conditional-equivalence statement ("Unchanged except when …").
- Up to 3 Trace Cards: a concrete input, the before vs after output, divergent state, a Given-When-Then caption, and safety. These are ILLUSTRATIVE — you reason from the code, you do NOT execute it (the illustrative flag is always true).
- A module dependency graph delta: nodes (with status) and edges (kind: imports/conforms/uses/injects, with status). rippleTargets = modules likely needing a corresponding change — informed by the change-coupling evidence (files that historically change together).
- Data flow: a Mermaid sequence diagram (valid Mermaid source) describing the runtime flow through the changed path, an optional Sankey (quantities of data/calls between modules), and a before/after narrative.
- Patterns: design patterns / architecture patterns (incl. MVC/MVVM/VIPER/TCA) and code smells, as a before→after delta (added/removed/present), each with quoted evidence lines + a confidence level. Be specific, not preachy.
- An ADR with "Considered Options" (the chosen approach + 1–2 alternatives, each pros/cons + "best when") ONLY if the change makes an architecturally significant decision; otherwise null.
- Per-lens tiered explanations (eli5 / junior / senior / architect) where altitude changes the CONTENT, not just length: eli5 = analogy + one-line user impact; junior = the trace + named concepts; senior = control/state + edge cases; architect = module ripple + contract/invariant deltas.
Output must satisfy the provided JSON schema exactly.`;

export interface PerFileSummary {
  path: string;
  module: string;
  tldr: FileChange["tldr"];
  contracts: FilePassResult["contracts"];
  cognitive: FilePassResult["cognitive"];
}

export function synthesisPrompt(
  summaries: PerFileSummary[],
  evidenceSummary: string,
  intent: string | null,
): Built {
  const files = summaries
    .map((s) => {
      const contracts = s.contracts
        .map((c) => `    ${c.changeType} ${c.kind} ${c.symbol} [${c.safety}] ${c.beforeSig ?? "∅"} → ${c.afterSig ?? "∅"}`)
        .join("\n");
      return `- ${s.path}  (module: ${s.module})
    before: ${s.tldr.before}
    now: ${s.tldr.now}
    behaviorChanged: ${s.tldr.behaviorChanged}
${contracts ? `  contracts:\n${contracts}` : "  contracts: (none)"}`;
    })
    .join("\n");

  const prompt = `TICKET INTENT (the WHY — may be empty):
${intent ?? "(no matching ticket)"}

DETERMINISTIC EVIDENCE SUMMARY:
${evidenceSummary}

PER-FILE FINDINGS:
${files}

Synthesize the cross-cutting lesson now.`;
  return { system: SYNTH_SYSTEM, prompt };
}
