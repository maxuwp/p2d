---
name: p2d-final-review
description: Paper-to-deck Stage 5.5 — Cross-Artifact Consistency Audit. Runs after Stage 2 (humanization approved) and optionally before Stage 3 (visual). Part A (always): cross-checks canonical_facts paper_facts items against slides and notes for exact consistency (algorithm names, numbers, authors, dates), verifies every in-slide citation maps to a real paper section, confirms all references exist in the bibliography, confirms PSE coverage, confirms MCS echoed on takeaway. Part B (optional): presenter read-through simulation + audience read-through simulation. Output: final_review.md (pass/fail per check + specific slide refs). Triggers: when paper-to-deck orchestrator dispatches Stage 5.5, or when user says "run a consistency check", "audit the deck before compiling".
version: "1.3"
---

# Paper-to-Deck Stage 5.5: Final Consistency Review

This stage catches divergence and factual drift before the deck is compiled. It's the last chance to fix problems cheaply — slides and notes are still markdown, before HTML assembly. Run it by default for `conference-talk` and `grad-seminar` modes; offer it optionally for others.

## When to run

- **Default (always run):** `conference-talk`, `grad-seminar`, `self-study` (self-study
  also auto-invokes Part B — there is no live presenter to catch problems, so the
  simulation is the only rehearsal the deck gets)
- **Offer (optional):** `undergrad-intro`, `research-group-share`

If the umbrella skill is orchestrating, invoke this stage automatically for conference, grad, and self-study modes. For other modes, offer once: "Run a final consistency check before compiling? Takes 2–3 minutes. (Recommended for talks where accuracy matters most.)"

---

## Inputs

| Input | Source |
|-------|--------|
| `slides_humanized` | `<session>/slides_humanized.md` |
| `speaker_notes_humanized` | `<session>/speaker_notes_humanized.md` |
| `paper_text` | `<session>/paper_text.md` |
| `paper_analysis` | `<session>/paper_analysis.json` |
| `canonical_facts` | `manifest.canonical_facts` (mcs + pse + paper_facts) |
| `outline` | `<session>/presentation_outline.json` |

---

## Part A: Cross-Artifact Consistency Audit (always runs)

### Check 1 — paper_facts accuracy

For each item in `canonical_facts.paper_facts`:
- Find every occurrence of that fact (or a restatement of it) in `slides_humanized.md` and `speaker_notes_humanized.md`.
- Verify the key details match exactly: numbers, names, algorithm labels, dates, percentages.
- Flag any instance where the value in the slide differs from the value in `paper_text.md`.

Example: if `paper_facts` says "reduces development time to ~6 weeks" and slide 4 says "cuts time to 4-6 weeks," flag it → the paper says ~6 weeks, not 4-6 weeks.

### Check 2 — In-slide citation validity

For every `(per §N.M)` or `(per §Section Title)` reference in `slides_humanized.md`:
- Verify the referenced section exists in `paper_text.md`.
- Verify the content of that slide bullet is actually supported by that section.
- Flag: invented section reference, or slide claim not supported by the cited section.

### Check 3 — Reference list accuracy

For every item in the `---REFERENCES---` block of `slides_humanized.md`:
- Verify it appears (or a close match) in `paper_analysis.references_text`.
- Flag any reference that doesn't appear in the paper's bibliography — these are likely hallucinated.

### Check 4 — PSE coverage

Read `manifest.canonical_facts.pse`. For each PSE:
- Count how many slides in `slides_humanized.md` carry a `<!-- TRACES: pse-N ... -->` comment.
- Pass: each PSE has ≥1 slide.
- Fail: a PSE has 0 slides. Note the slide count gap.

### Check 5 — MCS echo on takeaway

Find the takeaway slide (last content slide before references, or labeled "Takeaway" / "Key Takeaway" in the title).
- Verify the MCS from `canonical_facts.mcs` is echoed — not necessarily verbatim, but the core contribution claim must be present.
- Fail if: takeaway is generic ("future work is needed"), or describes a sub-detail rather than the main contribution.

---

## Part B: Audience Simulation (opt-in — ASK first; token cost is real)

The simulation reads the full deck + notes twice (presenter pass + audience pass) — it is
the most token-expensive step in this pipeline. For non-`self-study` modes, **ask before
launching**: state the cost plainly and offer **run / skip**. For `self-study`, Part B
auto-runs because there is no live presenter to catch problems; record
`finalReview.part_b_mode: "run"` automatically. For presenter-led modes, record
`finalReview.part_b_mode: "run" | "skipped"` in the manifest; if skipped,
`final_review.md` states it prominently. Re-offer on every re-run after content edits.


### Presenter Read-Through

Walk through the deck as if presenting it cold, using `slides_humanized.md` + `speaker_notes_humanized.md`:
1. For each section, verify the section timing from the outline is plausible given the notes' word count.
2. Flag any undefined term that appears in a slide bullet but is not defined in the notes for that slide or a prior slide.
3. Flag any section where a transition bridge sentence is missing (the last note of one PSE section should bridge to the next).
4. Flag any slide whose notes say `[OPTIONAL DETAIL]` that would likely be needed for the audience to follow the argument.

### Audience Read-Through (slides only)

Walk through `slides_humanized.md` as if the audience is seeing it without speaker notes:
1. Flag any slide whose bullets make a claim with no visible evidence (no `(per §N.M)`, no chart reference, no table).
2. Flag any slide with more than 5 bullets — likely too much to read during a talk.
3. Check the takeaway slide: can the main contribution be understood from the bullets alone?

---

## Output: `final_review.md`

```markdown
# Final Review Report — <paper title>

**Reviewed:** <ISO timestamp>
**Mode:** <audience_mode>

## Part A: Consistency Audit

### Check 1 — paper_facts accuracy
- PASS: "reduces development time to ~6 weeks" — correct on slides 4 and 9
- FAIL: Slide 6 says "12-15 steps" but paper says "12 steps" (Section IV)

### Check 2 — In-slide citations
- PASS: All 8 citations verified against paper_text.md
- (or) FAIL: Slide 3 cites "§Section V" which does not exist in paper_text.md

### Check 3 — References
- PASS: All 5 references in deck bibliography found in paper's bibliography

### Check 4 — PSE Coverage
- PASS: pse-1 (3 slides), pse-2 (2 slides), pse-3 (3 slides), pse-4 (2 slides)

### Check 5 — MCS Echo
- PASS: Slide 10 (Takeaway) echoes the MCS: "four-phase, 12-step protocol, ~6 weeks"

**Part A result: PASS** (or "PASS with N warnings")

## Part B: Audience Simulation

### Presenter Read-Through
- PASS: All sections within timing budget
- WARNING: Slide 5 uses "FPGA" without prior definition in slides or notes
- WARNING: No transition bridge between PSE-2 and PSE-3 sections

### Audience Read-Through
- PASS: Takeaway slide readable standalone
- WARNING: Slide 7 has 6 bullets (exceeds 5-bullet limit)

## Action Required

| # | Severity | Location | Issue | Suggested Fix |
|---|---|---|---|---|
| 1 | ERROR | Slide 6 | Says "12-15 steps" but paper says "12 steps" | Change to "12 steps" |
| 2 | WARNING | Slide 5 | "FPGA" not defined | Define in notes for slide 3 |
| 3 | WARNING | PSE-2→PSE-3 | Missing bridge | Add transition sentence to last note of PSE-2 section |

**Recommendation:** Fix 1 error before compiling. Warnings can be addressed at HITL review.
```

Save to `<session>/final_review.md`. Update manifest: `generatedArtifacts.finalReview = { status: "complete", passed: true/false, errors: N, warnings: N }`.

---

## After generating

If errors > 0:
- Do NOT proceed to Stage 3 automatically.
- Present the errors to the presenter with suggested fixes.
- Offer: "Fix automatically (for unambiguous corrections like typos/wrong numbers)?" or "Open files for manual edit?"
- After fixes are applied, re-run Part A checks only (the quick pass). Don't re-run the full simulation.

If errors == 0 and warnings > 0:
- Present warnings but proceed to Stage 3 on presenter confirmation.

If errors == 0 and warnings == 0:
- Announce "Final review: all checks passed. Proceeding to Stage 3 (Visual Enhancement)."
- Auto-continue to `p2d-style` + `p2d-compile` without prompting.
