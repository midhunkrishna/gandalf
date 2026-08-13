# Research behind gandalf

gandalf's job is to make a code change *understood*, not just *displayed*. A raw `git diff` shows the what and how at the line level but loses the behavioral "what" and the "why": the two things program-comprehension, code-review, and documentation research all identify as the decisive missing ingredients. gandalf's design is grounded in three bodies of research:

1. **Program comprehension & software visualization**: how developers actually build mental models of code and change.
2. **Cognitive science of multimedia learning**: how to present information so it's understood with minimal extraneous load.
3. **The learning science of retention**: how to make an explanation *stick*, not just land.

This document lists, per topic, **(1)** the technique gandalf uses to capture/convey a change, **(2)** the research that backs it, and **(3)** how gandalf applies it. A consolidated reference list is at the end. (Effect sizes quoted from meta-analyses are evidence-strength signals, not a single commensurable scale.)

> **Credibility first.** Every quantitative claim gandalf shows is computed deterministically in Node (`src/core/evidence.ts`) and fed to Claude as ground truth; Claude *interprets*, it never invents metrics, and every judgment is anchored to quoted lines with a confidence level. Trace Cards are reasoned from code, **not executed**, and are labelled "illustrative." This two-plane separation is the backbone that makes the rest trustworthy.

---

## 1. Why a diff isn't enough: program comprehension

**Technique.** Summarize the change *as a unit* (a before/now/behavior-changed TL;DR, a behavioral verdict, and a one-line *conditional-equivalence* statement, "unchanged except when …") and point the reader at the few **focal lines** that carry the meaning rather than every touched line.

**Research.** Developers comprehend code by building mental models and matching **beacons**, recognizable meaning-bearing fragments, rather than reading linearly (Brooks 1983; Letovsky 1986; von Mayrhauser & Vans 1995). Studies of developers' real information needs find that the hardest questions are about *rationale, behavior, and impact* ("why was it done this way?", "what happens if I change this?"), not syntax (LaToza & Myers 2010; Ko et al. 2007). Code review research similarly finds that understanding *intent* is reviewers' chief bottleneck (Bacchelli & Bird 2013).

**In gandalf.** Each file carries a `tldr` triad (`before` / `now` / `behaviorChanged`) and **beacons** (focal line ranges) instead of a wall of diff. The Behavioral lens leads with a verdict (*behavioral change* vs *refactor-only*) and a conditional-equivalence one-liner. The ticket overlay injects the change's *intent* (`Purpose` / `Acceptance` / `Do not`) as the "why."

---

## 2. Structuring the explanation: altitude, navigation, and load

**Technique.** Present the change **top-down, one zoom level at a time**, across four lenses, with an audience-selectable depth and an overview-first navigation spine.

**Research.**
- **C4 model** (Brown): describe software at four zoom levels (Context → Container → Component → Code); start at the altitude the reader needs.
- **Diátaxis** (Procida): distinct documentation modes (tutorial / how-to / reference / explanation) serve distinct needs; don't mix them.
- **Visual information-seeking mantra** (Shneiderman 1996): *overview first, zoom and filter, then details on demand.*
- **Cognitive Load Theory** (Sweller 1988; Sweller, van Merriënboer & Paas 2019): working memory is limited, so **segment** material and disclose progressively to keep load on schema-building, not on wayfinding. The **expertise-reversal effect** (Kalyuga et al. 2003) shows the *right* level of detail depends on the audience, so depth must be adjustable.

**In gandalf.** The four lenses map onto C4 + Diátaxis (Behavioral≈Context/Explanation, Dependency≈Container-Component/Reference, Contract≈Code/Reference, Data-flow≈cross-cutting/Explanation). The **depth selector** (ELI5 / Junior / Senior / Architect) re-renders a lens's prose at the chosen altitude (*content* changes, not just length), a direct answer to expertise reversal. Navigation follows Shneiderman: Overview → lens tabs → click-to-details. Noise (lockfiles/configs) is collapsed by default to protect attention.

---

## 3. Dual-coding & multimedia learning

**Technique.** Pair prose with a diagram in every lens; reuse **one stable hue per concept** across the code gutter, graph node, and legend; place the code beside the prose that explains it; and **signal** the focal lines (focus-and-dim).

**Research.**
- **Dual-coding theory** (Paivio 1986): information encoded in *both* verbal and visual channels lays two independent retrieval routes (the picture-superiority effect).
- **Cognitive Theory of Multimedia Learning** (Mayer 2009/2021): a set of replicated design principles: *multimedia* (words + graphics beat words alone, median *d*≈1.4), *spatial/temporal contiguity* (put related words and visuals together, *d*≈0.85/1.3), *signaling* (cue the essential, *d*≈0.4), *segmenting* (learner-paced chunks, *d*≈0.7+), *coherence*, *redundancy*, and *pre-training*.

**In gandalf.** The design system assigns one semantic hue per concept (`--added`/`--removed`/`--modified`/`--unchanged`) reused across the diff gutter, graph nodes, slope charts, and legends, which is textbook dual coding. Every lens pairs narrative with a custom visual (graph, Mermaid, Sankey, treemap, slope/dumbbell). The Walkthrough places a sticky code panel **beside** the stepping prose (spatial contiguity) and uses **focus-and-dim** beacons (signaling), one idea per scene (segmenting). Noise collapsing and the per-lens focus enact the coherence principle.

---

## 4. The behavioral lens: worked examples, traces, and prediction

**Technique.** Show concrete, illustrative **Trace Cards** (an input, the before vs after output, divergent state, and a **Given-When-Then** caption) and, in quiz mode, make the reader **predict** the after-output before revealing it.

**Research.**
- **Worked-example effect** (Sweller & Cooper 1985): for novices, studying worked solutions beats unguided problem-solving (it reverses for experts: Kalyuga's expertise reversal again, hence the depth tiers).
- **Behaviour-Driven Development / Given-When-Then** (North 2006): a shared, example-shaped vocabulary for specifying behavior.
- **Prediction / pretesting** and the **generation effect**: see §8; predicting an answer before it's shown sharpens encoding even when the guess is wrong.

**In gandalf.** The `Behavioral` schema's Trace Cards are exactly worked examples with GWT captions, explicitly labelled illustrative (gandalf can't execute the target code, so it never claims to). `PredictReveal` turns each card into a pretest: the after-output, divergent state, and safety verdict are gated behind a free-text or multiple-choice guess.

---

## 5. The contract lens: Design by Contract

**Technique.** For each changed signature, classify the change **Safe** or **Breaking** using pre/postcondition reasoning, and surface the pre/postcondition delta.

**Research.**
- **Design by Contract** (Meyer 1992; Eiffel): a routine is a contract of preconditions and postconditions. The compatibility rule: **weakening a precondition or strengthening a postcondition is safe**; the reverse is breaking.
- **Behavioural subtyping / the Liskov Substitution Principle** (Liskov & Wing 1994) formalizes when a change preserves substitutability.
- **Semantic Versioning** (semver.org) operationalizes "breaking" for everyday API evolution.

**In gandalf.** The `ContractChange` schema records `beforeSig`/`afterSig`, a `preconditionDelta`/`postconditionDelta`, and a `safety` verdict computed by the DbC rule above. In quiz mode the Contracts lens asks the reader to judge Safe/Breaking *before* revealing the verdict and its rationale.

---

## 6. The module-dependency lens: impact analysis

**Technique.** A merged, color-coded module graph of the change, plus a **ripple list** of modules likely needing a corresponding change, informed by historical **change coupling**.

**Research.**
- **Software change-impact analysis** (Bohner & Arnold 1996): estimate the set of artifacts affected by a change (the "ripple effect").
- **Change coupling / logical coupling** (Gall et al. 1998; Fowler's *Shotgun Surgery* smell): files that historically change together are coupled even without a static dependency, a strong predictor of co-change.
- Architecture visualization at the component level (C4, §2).

**In gandalf.** The `ModuleGraphDelta` (nodes/edges with status + `rippleTargets`) is rendered with React Flow + elkjs, color-coded by change status. `evidence.ts` computes change-coupling from `git log` co-change frequency, which feeds both the ripple list and the hotspot score (§7).

---

## 7. Analytical depth: complexity, hotspots, patterns, decisions

**Technique.** Contrast **cyclomatic** vs **cognitive** complexity, rank **hotspots** by churn × complexity, show a before→after **pattern/smell** delta, and capture significant decisions as an **ADR with considered options**.

**Research.**
- **Cyclomatic complexity** (McCabe 1976): counts independent paths; a classic but readability-blind metric.
- **Cognitive Complexity** (Campbell / SonarSource 2018): penalizes what makes code *hard to read* (nesting, broken linear flow) rather than mere branching; surfaces the contrast where a wide `switch` is high-cyclomatic but low-cognitive, and deep nesting the reverse.
- **Hotspots** (Tornhill, *Your Code as a Crime Scene* 2015 / *Software Design X-Rays* 2018): prioritize code that is **both** complex **and** frequently changed.
- **Code smells & refactoring** (Fowler 1999); **design patterns** (Gamma et al. 1994) for the pattern vocabulary.
- **Architecture Decision Records** (Nygard 2011) and the **MADR** "Considered Options" template: record the chosen option *and the alternatives*, with consequences.

**In gandalf.** `lizard` supplies measured cyclomatic complexity (and Claude estimates SonarSource-style cognitive complexity, anchored to it). The Complexity lens shows the Δ-scorecard, per-function slope/dumbbell charts, and the cognitive-vs-cyclomatic callout. The **hotspot treemap** sizes by churn and shades by complexity (Tornhill), with per-tile scores on hover. The Patterns lens emits a before→after smell/pattern delta with quoted evidence + confidence, and an ADR with **Considered Options** (chosen + 1–2 alternatives, each with pros/cons and "best when").

---

## 8. Making it stick: active recall & retention

This is gandalf's most evidence-driven layer. A multimedia explanation that's only *read* is passive; the largest, most-replicated gains in retention come from **active generation**: retrieving, predicting, and spacing.

**Technique.** **Predict-then-reveal** within a lesson; **retrieval-practice** questions at the end; and **spaced resurfacing** of those questions across the lesson library.

**Research.**
- **Retrieval practice / the testing effect**: recalling beats re-reading and *modifies* memory (Roediger & Karpicke 2006: 61% vs 40% at one week; meta-analysis Adesope, Trevisan & Sundararajan 2017, *g*≈0.61; Karpicke & Blunt 2011 found retrieval beats elaborate concept-mapping, which is relevant because gandalf's lenses *are* concept maps). Dunlosky et al. (2013) rate practice testing and distributed practice the **only two "high-utility"** techniques of ten reviewed.
- **Prediction / pretesting**: guessing before the answer is shown, even wrongly, primes encoding and triggers a curiosity/surprise signal (Kornell, Hays & Bjork 2009; Brod 2021; meta-analysis St. Hilaire, Carpenter et al. 2023, *g*≈0.54 on pretested items). Feedback is mandatory, and gandalf's reveal provides it.
- **Generation effect** (Slamecka & Graf 1978; meta-analysis Bertsch et al. 2007, *d*≈0.40, rising at delay).
- **Spaced / distributed practice** (Cepeda, Pashler et al. 2006) with expanding intervals (Leitner).
- **Self-explanation** (Chi et al. 1989; meta-analysis Bisra et al. 2018, *g*≈0.55), **contrasting cases** (Gentner et al. 2003; Schwartz & Bransford 1998), **concreteness fading** (Goldstone & Son 2005; Fyfe et al. 2014), and **advance organizers** (Ausubel 1960) round out the design.

**In gandalf.** `PredictReveal` (Trace Cards + contract verdicts) delivers pretesting + the generation effect, with the existing reveal as mandatory feedback. The **Recall** tab generates 3–5 evidence-grounded retrieval questions per lesson (answer-from-memory → reveal → self-rate). Ratings seed a localStorage **Leitner schedule** (`reviewStore.ts`), and the header **Review** queue resurfaces *due* questions across the whole persisted lesson library, delivering both of Dunlosky's high-utility techniques. The TL;DR/Overview act as **advance organizers**; the ADR "Considered Options" and before↔after panels are **contrasting cases**; the ELI5→Architect ladder is a guided **concreteness fade**.

---

## 9. Scroll-driven narrative (scrollytelling)

**Technique.** A Walkthrough that is **scroll-linked, never scroll-jacking**: a sticky code graphic with stepping prose, one idea per scene, gentle parallax and draw-on, proximity snap, all of it degrading to a static document when motion is reduced.

**Research.**
- **Scrollytelling** as a form (Seyser & Zeiller 2018; the NYT *Snow Fall*, The Pudding, and Bostock's "How to Scroll" as canonical practice): the **sticky-graphic + stepping-text** pattern, with the explicit rule that scroll position drives the story but never *seizes* the scrollbar.
- It is the interactive embodiment of Mayer's **segmenting** (one idea per scene) and **signaling** (focus-and-dim) principles (§3).
- **Accessibility**: WCAG 2.3.3 *Animation from Interactions* and the `prefers-reduced-motion` media query require a reduced-motion path.

**In gandalf.** The Walkthrough lens (`WalkthroughLens.tsx`) uses Lenis smooth scroll + Framer Motion mechanics + an IntersectionObserver step controller (single source of truth for the active scene), with parallax, `pathLength` SVG draw-on, and `lenis/snap` *proximity* snapping. A top-level `MotionConfig reducedMotion` + the `prefers-reduced-motion` guard snap everything to its final state for reduced-motion users, and the static export degrades to a linear, readable document.

---

## 10. Professional visual-design craft

**Technique.** A real, token-based design system applied consistently: one type scale, an 8-point spacing rhythm, a restrained semantic palette, AA contrast in both themes, and a single motion vocabulary.

**Research / practice.** The "studio vs stitched-libraries" difference is **constraint + consistency** (Wathan & Schoger, *Refactoring UI*; Google **Material Design**; the WCAG 2.x contrast and reduced-motion success criteria). Consistent tokens reduce extraneous cognitive load (CLT, §2) and let the *content* carry the signal.

**In gandalf.** Warm-editorial CSS-variable tokens (`:root` + `.dark`) drive type/spacing/color/elevation/motion; everything stays on-scale; contrast targets AA in both themes; motion uses a small set of Material easings and animates only `transform`/`opacity`. The anti-"AI-slop" checklist (no Inter-on-everything, no purple-gradient-on-white, real hierarchy, no emoji-as-icons) is an explicit, testable requirement.

---

## References

*Program comprehension & software engineering*
- Brooks, R. (1983). *Towards a theory of the comprehension of computer programs.* Int. J. Man-Machine Studies.
- Letovsky, S. (1986). *Cognitive processes in program comprehension.*
- von Mayrhauser, A. & Vans, A.M. (1995). *Program comprehension during software maintenance and evolution.* IEEE Computer.
- LaToza, T. & Myers, B. (2010). *Hard-to-answer questions about code.* PLATEAU.
- Ko, A.J., DeLine, R. & Venolia, G. (2007). *Information needs in collocated software development teams.* ICSE.
- Bacchelli, A. & Bird, C. (2013). *Expectations, outcomes, and challenges of modern code review.* ICSE.
- Bohner, S. & Arnold, R. (1996). *Software Change Impact Analysis.* IEEE CS Press.
- Gall, H., Hajek, K. & Jazayeri, M. (1998). *Detection of logical coupling based on product release history.* ICSM.
- McCabe, T. (1976). *A Complexity Measure.* IEEE TSE.
- Campbell, G.A. / SonarSource (2018). *Cognitive Complexity: a new way of measuring understandability.*
- Tornhill, A. (2015). *Your Code as a Crime Scene*; (2018) *Software Design X-Rays.* Pragmatic Bookshelf.
- Fowler, M. (1999). *Refactoring* (code smells; Shotgun Surgery).
- Gamma, Helm, Johnson & Vlissides (1994). *Design Patterns.*
- Meyer, B. (1992). *Applying Design by Contract.* IEEE Computer.
- Liskov, B. & Wing, J. (1994). *A Behavioral Notion of Subtyping.* ACM TOPLAS.
- North, D. (2006). *Introducing BDD* (Given-When-Then).
- Nygard, M. (2011). *Documenting Architecture Decisions* (ADR); **MADR** template (adr.github.io).
- Preston-Werner, T. *Semantic Versioning 2.0.0* (semver.org).

*Information design & visualization*
- Shneiderman, B. (1996). *The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations.*
- Brown, S. *The C4 model for visualising software architecture* (c4model.com).
- Procida, D. *Diátaxis* documentation framework (diataxis.fr).
- Seyser, D. & Zeiller, M. (2018). *Scrollytelling: An Analysis of Visual Storytelling in Online Journalism.* IV.
- Bostock, M. *How to Scroll*; NYT, *Snow Fall* (2012); The Pudding (canonical scrollytelling practice).
- W3C. *WCAG 2.1/2.2*: SC 1.4.3 Contrast, SC 2.3.3 Animation from Interactions; `prefers-reduced-motion`.
- Wathan, A. & Schoger, S. *Refactoring UI*; Google *Material Design*.

*Cognitive science of multimedia learning*
- Paivio, A. (1986). *Mental Representations: A Dual Coding Approach.*
- Mayer, R. (2009/2021). *Multimedia Learning* (Cognitive Theory of Multimedia Learning).
- Sweller, J. (1988); Sweller, van Merriënboer & Paas (1998/2019). *Cognitive Load Theory.*
- Kalyuga, S. et al. (2003). *The Expertise Reversal Effect.*
- Sweller, J. & Cooper, G. (1985). *The worked-example effect.*
- van Merriënboer, J. (1990). *Completion problems / 4C-ID.*

*Learning science of retention*
- Roediger, H. & Karpicke, J. (2006). *Test-enhanced learning.* Psychological Science.
- Karpicke, J. & Blunt, J. (2011). *Retrieval practice produces more learning than elaborative studying.* Science.
- Adesope, O., Trevisan, D. & Sundararajan, N. (2017). *Rethinking the use of tests: a meta-analysis of practice testing.* Review of Educational Research (*g*≈0.61).
- Dunlosky, J., Rawson, K., Marsh, E., Nathan, M. & Willingham, D. (2013). *Improving students' learning with effective techniques.* Psychological Science in the Public Interest.
- Cepeda, N., Pashler, H. et al. (2006). *Distributed practice in verbal recall tasks: a review and quantitative synthesis.* Psychological Bulletin.
- Kornell, N., Hays, M. & Bjork, R. (2009). *Unsuccessful retrieval attempts enhance subsequent learning.*
- Brod, G. (2021). *Predicting as a learning strategy.* Psychonomic Bulletin & Review.
- St. Hilaire, K., Carpenter, S. et al. (2023). *Pretesting effects: a meta-analysis* (*g*≈0.54).
- Slamecka, N. & Graf, P. (1978); Bertsch, S. et al. (2007). *The generation effect* (meta-analysis, *d*≈0.40).
- Chi, M. et al. (1989); Bisra, K. et al. (2018). *Self-explanation* (meta-analysis, *g*≈0.55).
- Gentner, D., Loewenstein, J. & Thompson, L. (2003); Schwartz, D. & Bransford, J. (1998). *Contrasting cases / analogical encoding.*
- Goldstone, R. & Son, J. (2005); Fyfe, E. et al. (2014). *Concreteness fading.*
- Ausubel, D. (1960). *Advance organizers.*
- Bjork, R. (1994). *Desirable difficulties.*

---

## Appendix: learning-science coverage at a glance

Where each evidence-based mechanism stands in gandalf today, and what's still a candidate addition.

| Mechanism | Status | Where in gandalf |
|---|---|---|
| Dual coding / multimedia | ✅ used | concept hues + prose-with-diagram in every lens (§3) |
| Cognitive-load design (segmenting · signaling · split-attention) | ✅ used | one-idea scenes, focus-and-dim beacons, sticky code beside prose (§3, §9) |
| Worked examples | ✅ used | Trace Cards with GWT captions (§4) |
| Advance organizers | ✅ used | TL;DR triad + Overview lens precede the detail (§1, §2) |
| Retrieval practice (testing effect) | ✅ used | Recall tab: answer-from-memory → reveal (§8) |
| Prediction / pretesting | ✅ used | predict-then-reveal on Trace Cards + contract verdicts (§4, §8) |
| Generation effect | ✅ used | free-text "think, then reveal" path (§8) |
| Spaced / distributed practice | ✅ used | Leitner schedule + header **Review** queue across the library (§8) |
| Contrasting cases | ◐ partial | ADR "Considered Options" + before↔after panels are *shown* (not yet an invent-first task) |
| Concreteness fading | ◐ partial | ELI5→Architect depth ladder (user-selected, not a guided fade) |
| Elaborative interrogation | ◐ partial | the "why" is foregrounded but *supplied*, not *elicited* |
| Self-explanation | ○ candidate | e.g. prompt "explain in your own words why this is Safe/Breaking" |
| Interleaving · worked→completion fading | ○ candidate | mix problem types / fade scaffolding across a session |

*Legend:* ✅ used · ◐ partially used · ○ evidenced candidate for a future iteration.

When gandalf was still fully passive, the two highest-impact additions were **predict-then-reveal** and **retrieval + spacing**; both have since shipped (the ✅ rows above). The remaining ◐/○ rows mark where the next evidence-backed gains lie, and self-explanation prompts rank highest among them (Bisra et al. 2018, *g*≈0.55).
