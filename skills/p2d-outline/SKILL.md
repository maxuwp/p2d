---
name: p2d-outline
description: Paper-to-deck Stage 3 — PSE-Anchored Outline Creation. Translates an approved paper analysis + confirmed MCS/PSE canonical facts + presentation style profile into a detailed slide-by-slide outline derived ONLY from the paper's content. Uses a two-agent creator/reviewer cycle (threshold 85/100) before opening the HITL gate. Enforces PSE completeness — every Primary Structural Element must have at least one slide — and warns on short-talk budget (≤4 slides). Triggers: when the umbrella paper-to-deck skill dispatches Stage 3, or when the user says "outline the talk", "build the slide map for this paper". Output: presentation_outline.json + outline_review.json, gated by the Outline Review Gate.
version: "1.2"
---

# Paper-to-Deck Stage 3: PSE-Anchored Outline Creation

## Grounding (read first)

Outline structure follows **CLT segmenting** (one PSE per section, load distributed
across the time budget) and **Doumont's audience law** (the audience mode, not the
paper's internal ordering preferences, decides depth per section). The MCS is the talk's
ONE message (Alley's critical assertion) — every section must serve it. Master map:
`<paper-to-deck-skill-dir>/reference/grounding_frameworks.md`.

## Outline gate: prefer the items page (narrow decisions)

For the presenter gate, prefer the guided app's `items` mode over one big document gate:
write `hitl/p2d_outline_input.json` with one item per outline section (`id` = pse id;
fields: section title, purpose, slide count, minutes) and run
`posed_app.py items --name p2d_outline --session <dir>`. The presenter gets per-section
keep/revise/split/remove + comment + reorder; `approve` with any non-keep disposition or
comment = approved-with-required-revision (apply by id, re-run the outline reviewer,
re-gate). Fall back to the document gate only if items mode can't run.

You are a **master Presentation Strategist and Research Analyst** (per the n8n Outlining Agent). Your one job: produce a JSON outline derived **strictly** from the paper's content, anchored to the confirmed PSE list, tuned to the persona and constraints.

## Inputs (named exactly as in the n8n prompt)

From the manifest:

- `[Source Paper Text]` — `<session>/paper_text.md` (ground truth — must be complete)
- `[Paper Analysis]` — `<session>/paper_analysis.json` (must be `status: complete`)
- `[Canonical Facts]` — `manifest.canonical_facts` — **REQUIRED** (must be `confirmed: true`):
  - `mcs` — Main Contribution Statement (1–2 sentences; this is what the deck must communicate)
  - `pse` — ordered Primary Structural Elements (every PSE must appear in the outline)
  - `paper_facts` — verifiable claims (for downstream faithfulness checks)
- `[Persona Profile]` — `<session>/presentation_style.md` (must be `status: complete`)
- `[Presentation Constraints]` — from `initialRequest`:
  - `audienceMode` (drives slide budget + depth)
  - `eventDuration` (minutes)
  - `audienceLevel`
  - `specialGuidelines` (e.g., conference template rules)
- `previous_outline` — for revision/regeneration
- `user_action` / `refinement_feedback` — from prior HITL gate

If `canonical_facts` is missing or `confirmed: false`, stop and tell the orchestrator to re-run `p2d-ingest` with the MCS+PSE extraction.

---

## Pre-flight: Short-talk warning

Before generating the outline, compute `target_slides` (see formula below):

```
if target_slides <= 4:
    WARN: "This duration yields only N slides — that's a very short talk.
    Two options:
    A. Single-contribution focus: one PSE expands into all N slides, others mentioned briefly.
    B. Teaser mode: give 1 slide per PSE as an overview, no deep dive.
    Which mode would you like?"
    Wait for user response before proceeding.
```

---

## Slide budget formula (audience-mode-aware)

```
if audienceMode == "conference-talk":
    target_slides = floor(eventDuration / 1.5)   # ~1 slide per 1.5 min, strict
elif audienceMode == "undergrad-intro":
    target_slides = floor(eventDuration / 1.5)
elif audienceMode == "grad-seminar":
    target_slides = floor(eventDuration / 2.0)
elif audienceMode == "research-group-share":
    target_slides = floor(eventDuration / 2.5)
elif audienceMode == "self-study":
    target_slides = floor(paper_pages * 1.5)
```

---

## Creation pass (Role 1)

### Critical output rules (verbatim from n8n system message)

1. Output ONLY a single, valid JSON object.
2. Do NOT include any text, explanations, or markdown code fences before or after the JSON.
3. The JSON must strictly follow the schema below.
4. All slide titles and key points must reflect the Persona Profile style.
5. **The outline structure must be derived ONLY from the full Source Paper Text — do not invent content not present in the paper.**

Response must begin with `{` and end with `}` with nothing before or after.

### PSE anchoring (anti-divergence enforcement)

The outline's sections must map 1:1 to the PSEs from `canonical_facts.pse`:
- Each PSE becomes at minimum one section in the outline.
- A PSE may expand to multiple slides if the slide budget allows.
- The narrative arc of the outline must follow the PSE order.
- The MCS must be echoed on the Takeaway slide (last content slide).

Sections such as title slide, motivation/context, and Q&A are allowed outside the PSE mapping. The mandatory constraint is that NO PSE is left without at least one slide.

### Output schema

Write to `<session>/presentation_outline.json`:

```json
{
  "presentation_title": "string — concise, audience-appropriate (not the paper's title verbatim)",
  "presenter_name": "string",
  "audience_mode": "string",
  "target_duration_minutes": 15,
  "target_slides": 10,
  "narrative_arc": "string — 1 sentence on the story shape",
  "mcs_echo": "string — how the MCS will appear in the takeaway slide (1 sentence)",
  "pse_coverage": [
    { "pse_id": "pse-1", "label": "Phase 1: ...", "slide_indices": [3, 4] }
  ],
  "sections": [
    {
      "section_index": 1,
      "section_title": "Motivation & Problem",
      "duration_minutes": 2,
      "slide_count": 1,
      "pse_id": "pse-1 | null (for intro/outro sections)",
      "slides": [
        {
          "slide_index": 1,
          "title": "string — in persona's voice",
          "purpose": "hook | define | compare | result | takeaway | Q&A bridge",
          "key_points": ["3 bullets max, scannable"],
          "visual_idea": "string — what to show (chart-from-paper | diagram | table | text-only)",
          "source_paper_section": "string — which section of the paper this draws from",
          "speaker_notes_hint": "string — one-line hint for the drafter about what to say"
        }
      ]
    }
  ],
  "transitions": [
    { "from_section": 1, "to_section": 2, "bridge_sentence": "1 sentence the presenter can literally say" }
  ],
  "qa_prep": {
    "anticipated_questions": [
      { "question": "string", "short_answer": "string", "paper_section_to_reference": "string" }
    ],
    "out_of_scope_redirects": ["string — gracefully deflect questions outside the paper's scope"]
  },
  "potential_demo_or_artifact": "string | null"
}
```

### Construction rules

- **Total slides equals `target_slides`** — no more, no fewer.
- **Each slide draws from a specific paper section.** Fill `source_paper_section` for every slide. If you can't, the slide doesn't belong.
- **All PSEs covered.** Every `pse_id` in `canonical_facts.pse` must appear at least once in `pse_coverage[*].slide_indices`.
- **Narrative arc matches `paper_type`:**
  - Empirical → motivation → method → results → discussion → takeaway
  - Survey → motivation → taxonomy → key works → trends → open questions
  - Position → context → claim → evidence → counterargument → call to action
  - Technical/methods → problem → existing approaches → our method → eval → limitations
- **Q&A prep is mandatory** for all audience modes except `self-study`.

### Outline self-check (append before handing to reviewer)

After creating the outline, append a self-check comment block to the outline JSON file as a leading comment:

```
<!-- OUTLINE-SELF-CHECK:
  pse_coverage: [pse-1, pse-2, pse-3, pse-4]
  missing_pse: []
  slide_count_check: OK (10 slides == target 10)
  mcs_echoed_on_takeaway: YES (slide 9)
-->
```

If `missing_pse` is not empty → add slides for the missing PSEs before proceeding to the reviewer. This check MUST pass before the gate opens.

---

## Reviewer pass (Role 2 — cold, separate context)

The reviewer reads ONLY:
- `<session>/presentation_outline.json` (just saved)
- `manifest.canonical_facts.mcs` and `manifest.canonical_facts.pse`
- `initialRequest.audienceMode` and `eventDuration`

The reviewer does NOT see the creation agent's reasoning. Score on 4 dimensions (25 points each, total /100):

| Dimension | Score | Criteria |
|---|---|---|
| PSE Completeness | /25 | All PSEs covered with ≥1 slide each; PSE order respected; no PSE buried in a footnote |
| MCS Fidelity | /25 | MCS clearly echoed in takeaway slide; presentation title captures the contribution; no scope creep into tangential sub-details |
| Narrative Arc Fit | /25 | Arc matches paper type; audience-mode tuning applied (conference = tight; grad = methods-heavy; undergrad = motivation-heavy) |
| Slide Budget Balance | /25 | Sections proportional to their PSE importance; no one PSE getting <1 slide or >50% of all slides; timing is realistic |

**Threshold: 85/100.** Below threshold: Creation agent revises with reviewer feedback. Max 3 revision rounds. If still <85 after 3 rounds: escalate to user with score + top 3 issues; ask to revise manually or regenerate from scratch.

After review, save `<session>/outline_review.json`:

```json
{
  "score": 88,
  "dimensions": {
    "pse_completeness": 23,
    "mcs_fidelity": 22,
    "narrative_arc_fit": 22,
    "slide_budget_balance": 21
  },
  "passed": true,
  "revision_rounds": 1,
  "top_issues": [],
  "reviewer_notes": "string"
}
```

---

## Task-type detection

| Condition | Task |
|-----------|------|
| `previous_outline` missing | `INITIAL_CREATION` |
| `user_action == "Regenerate"` | `REGENERATION` (substantively different arc; try a different narrative if possible) |
| `user_action == "Request Revisions"` + feedback | `REVISION` (modify per feedback only) |

---

## After generating

1. Write `presentation_outline.json` with self-check comment.
2. Run reviewer pass; save `outline_review.json`.
3. If score ≥85: proceed to gate. If <85: revise + re-review (max 3 rounds). If still <85: escalate.
4. Update manifest:
   - `generatedArtifacts.detailedOutline = { status: "complete", filePath: "presentation_outline.json", version: <n>, presentationTitle, targetDuration, totalSlides, pse_coverage_passed: true/false }`
5. **Render the outline to the user** as a Markdown table-of-contents: section titles + slide titles + time per section + PSE mapping + narrative arc. Don't dump the JSON.
6. Show reviewer score: "Outline review: N/100 — approved for your review."
7. Hand back to the umbrella `paper-to-deck` orchestrator for the Outline HITL Gate.

## Override option

User can pick "Upload an override" at the gate and supply a JSON file or pasted blob conforming to the schema. Validate PSE coverage on the override — warn if any PSE is missing even on user-supplied overrides.
