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

// Synthesis is fanned out into focused passes. Each shares the same grounding context
// (ticket intent + deterministic evidence + per-file findings) but has a narrow system
// prompt + small schema, so each `claude -p` call is faster and more reliably satisfied.
const SYNTH_INTRO =
  "You are a staff engineer synthesizing one facet of a multi-lens lesson about a code change, for a teammate learning what changed and why. Ground everything in the per-file findings + deterministic evidence + ticket intent (the WHY). Be specific, not preachy.";
const SYNTH_OUTRO = "Output must satisfy the provided JSON schema exactly.";

const SYNTH_NARRATIVE_SYSTEM = `${SYNTH_INTRO}
Produce the lesson framing:
- title: a specific, concrete headline (≤ ~12 words) naming what changed.
- hypothesis: one line stating what the change is trying to accomplish.
- summary: 2–4 sentences on the change and its purpose, foregrounding the WHY.
${SYNTH_OUTRO}`;

const SYNTH_BEHAVIORAL_SYSTEM = `${SYNTH_INTRO}
Produce the behavioral analysis:
- verdict: "behavioral" (observable behavior changed) vs "refactor-only" (behavior preserved).
- conditionalEquivalence: a one-line "Unchanged except when …" statement.
- Up to 3 Trace Cards: a concrete input, before vs after output, divergent state, a Given-When-Then caption, and safety. These are ILLUSTRATIVE — you reason from the code, you do NOT execute it (the illustrative flag is always true).
- For EACH Trace Card, also include a "prediction" that lets the reader guess before the after-output is shown: a one-line "question" stem (e.g. "What does it return now?") and up to 2 "distractors" — plausible-but-wrong alternative after-outputs a careful reviewer might guess, grounded in the code. The correct answer is the card's afterOutput (do NOT repeat it in distractors). Leave distractors empty (the reader then free-recalls) if no credible wrong answer exists; set prediction to null only for trivial cards.
- workedExample: an optional short worked example (or null).
- ripple: affected callers per changed symbol.
${SYNTH_OUTRO}`;

const SYNTH_GRAPH_SYSTEM = `${SYNTH_INTRO}
Produce a module dependency graph delta: nodes (with status) and edges (kind: imports/conforms/uses/injects, with status). rippleTargets = modules likely needing a corresponding change — informed by the change-coupling evidence (files that historically change together).
${SYNTH_OUTRO}`;

const SYNTH_DATAFLOW_SYSTEM = `${SYNTH_INTRO}
Produce the data flow: a Mermaid sequence diagram (valid Mermaid source) describing the runtime flow through the changed path; an optional Sankey (quantities of data/calls between modules) or null; and a before/after narrative.
${SYNTH_OUTRO}`;

const SYNTH_PATTERNS_SYSTEM = `${SYNTH_INTRO}
Produce patterns: design / architecture patterns (incl. MVC/MVVM/VIPER/TCA) and code smells, as a before→after delta (added/removed/present), each with quoted evidence lines + a confidence level. Include an ADR with "Considered Options" (the chosen approach + 1–2 alternatives, each pros/cons + "best when") ONLY if the change makes an architecturally significant decision; otherwise null.
${SYNTH_OUTRO}`;

const SYNTH_EXPLANATIONS_SYSTEM = `${SYNTH_INTRO}
Produce per-lens tiered explanations for each lens (behavioral / dependency / contract / dataflow), at four altitudes where altitude changes the CONTENT, not just length: eli5 = analogy + one-line user impact; junior = the trace + named concepts; senior = control/state + edge cases; architect = module ripple + contract/invariant deltas.
${SYNTH_OUTRO}`;

const SYNTH_RETRIEVAL_SYSTEM = `${SYNTH_INTRO}
Produce 3–5 retrieval-practice questions that test the DURABLE, important takeaways of this change (favor "why / when / which" reasoning over trivia or line-counting). For each: a "prompt" (the question), a concise model "answer", the "lens" it belongs to (one of: behavioral, dependency, contract, dataflow, complexity, patterns), and "evidence" lines (file + line) grounding the answer where applicable. The questions should be answerable from the lesson and worth remembering weeks later.
${SYNTH_OUTRO}`;

export interface PerFileSummary {
  path: string;
  module: string;
  tldr: FileChange["tldr"];
  contracts: FilePassResult["contracts"];
  cognitive: FilePassResult["cognitive"];
}

/** Shared grounding context reused verbatim by every synthesis pass (keeps the cacheable prefix stable). */
function synthBody(
  summaries: PerFileSummary[],
  evidenceSummary: string,
  intent: string | null,
): string {
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

  return `TICKET INTENT (the WHY — may be empty):
${intent ?? "(no matching ticket)"}

DETERMINISTIC EVIDENCE SUMMARY:
${evidenceSummary}

PER-FILE FINDINGS:
${files}`;
}

export interface SynthesisPrompts {
  narrative: Built;
  graph: Built;
  dataflow: Built;
  patterns: Built;
  behavioral: Built;
  explanations: Built;
  retrieval: Built;
}

/** Build the six focused synthesis prompts that the pipeline fans out in parallel. */
export function synthesisPrompts(
  summaries: PerFileSummary[],
  evidenceSummary: string,
  intent: string | null,
): SynthesisPrompts {
  const body = synthBody(summaries, evidenceSummary, intent);
  const mk = (system: string, ask: string): Built => ({ system, prompt: `${body}\n\n${ask}` });
  return {
    narrative: mk(SYNTH_NARRATIVE_SYSTEM, "Produce the lesson title, hypothesis, and summary now."),
    graph: mk(SYNTH_GRAPH_SYSTEM, "Produce the module dependency graph delta now."),
    dataflow: mk(SYNTH_DATAFLOW_SYSTEM, "Produce the data flow now."),
    patterns: mk(SYNTH_PATTERNS_SYSTEM, "Produce the patterns analysis now."),
    behavioral: mk(SYNTH_BEHAVIORAL_SYSTEM, "Produce the behavioral analysis now."),
    explanations: mk(SYNTH_EXPLANATIONS_SYSTEM, "Produce the per-lens tiered explanations now."),
    retrieval: mk(SYNTH_RETRIEVAL_SYSTEM, "Produce the retrieval-practice questions now."),
  };
}
