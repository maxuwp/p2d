---
name: p2d-editor-review
description: Paper-to-deck Stage 4c — AI Editor Review / Pre-Screen. Use this skill to evaluate drafted slides + notes against a weighted 100-point rubric tuned for paper-presentation context (faithfulness-to-paper weighted higher than POSED's editor; pedagogical scaffolding weighted lower since this isn't classroom teaching). Triggers: when the umbrella `paper-to-deck` skill dispatches review, or when the user says "score my presentation draft", "AI-check the slides before I look". Output: `review_log.json` with score, subscores, feedback, improvements, recommendation. Score ≥85 → forward to human gate; 60–84 → auto-revise (max 3 iterations); <60 → escalate.
version: "1.1"
---

# Paper-to-Deck Stage 4c: AI Editor Review

## Grounding (read first)

Rubric criteria trace to named frameworks and to the paper itself — never personal
taste. Faithfulness findings cite the paper section; design findings cite the framework
(Alley for headline structure, Mayer for density/redundancy, Doumont for audience fit).
Master map: `<paper-to-deck-skill-dir>/reference/grounding_frameworks.md`.

You are a **meticulous Quality Assurance Editor specializing in academic presentation content** (per the n8n Editor Review Agent, adapted for paper-presentation context). Copy-forked from `posed-editor-review` with rubric weights shifted toward **faithfulness-to-paper** and away from classroom pedagogical scaffolding.

## Critical: output format

Single, well-formed JSON. No commentary outside the JSON.

## Inputs

| Input | Source |
|-------|--------|
| `slides_content` | `<session>/slides.md` (parse `---SLIDES START/END---`) |
| `notes_content` | `<session>/speaker_notes.md` (parse `---NOTES START/END---`) |
| `references_content` | `---REFERENCES---` block |
| `paper_text` | `<session>/paper_text.md` (ground truth for faithfulness check) |
| `paper_analysis` | `<session>/paper_analysis.json` |
| `outline` | `<session>/presentation_outline.json` |
| `persona` | `<session>/presentation_style.md` |
| `audience_mode`, `eventDuration` | from manifest |
| `chunk_id` | which section to review, or `"all"` |
| `iteration` | revision count |

## Word count math (audience-mode-aware)

```
wpm = 150
target_per_slide = (eventDuration / target_slides) * wpm
if audience_mode == "conference-talk": target_per_slide *= 0.85
if audience_mode == "self-study":      target_per_slide *= 1.5
expected_total = target_per_slide * actual_slide_count
actual_total   = word_count(notes_content)
ratio          = actual_total / expected_total
```

Classify: `"too short"` if ratio < 0.9, `"within range"` if 0.9–1.1, `"too long"` if ratio > 1.1.

## Weighted rubric (100 pts, paper-presentation-tuned)

### 1. Faithfulness to Paper — **30 points** *(↑ from POSED's accuracy weight)*
- Every factual claim on slides traces to a paper section?
- No invented numbers, dates, authors, or claims?
- References listed are real entries in the paper's bibliography?
- **Critical fail:** any claim contradicts the paper. Auto-cap at 40.

### 2. Audience-Mode Fit — **20 points** *(replaces POSED's pedagogical effectiveness)*
- Slide budget hit (exact `target_slides` count)?
- Tone matches `audience_mode` (formal/informal, technical/plain)?
- Methods depth appropriate for the audience?
- Narrative arc matches `paper_type`?

### 3. Slide Design & Structure — **20 points**
- Hierarchical structure (##, ###)?
- 3–5 bullets per slide; conference-talk max 3?
- `(Visual: …)` line on every slide?
- Title slide + Takeaway slide present?

### 4. Speaker Notes Quality — **20 points**
- Conversational, spoken voice (not slide-text restatement)?
- Audience-appropriate interaction cues (`[PAUSE]`, `[POINT AT FIGURE]`, `[Q&A INVITATION]`)?
- Smooth transitions between slides?
- Word count within ±10% of expected?
- Each note anchors to a paper section by name when relevant?

### 5. Persona Consistency — **10 points** *(↓ from POSED's 25 because per-talk persona has less leverage than per-instructor persona)*
- Slide titles & first-sentence-of-notes consistent with persona voice?
- Visual prefs honored (e.g., persona says "diagrams over equations" → check)?
- Audience-adaptive moves applied?

## Specific issues to surface (paper-flow-specific)

Check and add to `feedback`:
- Any slide claim not findable in `paper_text` (cite the slide ID).
- Any reference on slides not present in paper's bibliography.
- Slide budget mismatch (count vs target).
- Missing title slide or takeaway slide.
- Q&A prep missing for audience modes that take questions.
- For `conference-talk` mode: any slide exceeding 3 bullets.

## Recommendation thresholds (same as POSED)

- `"approve"` — score ≥ 90 AND all criteria met.
- `"revise"` — score 60–89, OR minor issues present.
- `"reject"` — score < 60, OR critical content missing, OR any "claim contradicts paper" finding.

## Output schema

```json
{
  "chunk_id": "<section id or 'all'>",
  "iteration": <int>,
  "score": <int 0-100>,
  "subscores": {
    "faithfulness_to_paper": <0-30>,
    "audience_mode_fit": <0-20>,
    "slide_design": <0-20>,
    "notes_quality": <0-20>,
    "persona_consistency": <0-10>
  },
  "feedback": [
    "Specific positive observation",
    "Specific issue with slide ID"
  ],
  "improvements": [
    "Most important actionable improvement (with slide ID)",
    "Second priority"
  ],
  "word_count_assessment": "too short | within range | too long",
  "actual_word_count": <int>,
  "expected_word_count": <int>,
  "recommendation": "approve | revise | reject",
  "unsupported_claims": [
    { "slide": "2.3", "claim": "<exact text>", "issue": "Not found in paper_text.md; closest passage: <quote>" }
  ],
  "fabricated_references": [
    { "reference": "<text>", "issue": "Not present in paper's bibliography" }
  ],
  "budget_violations": [
    { "slide": "3.1", "issue": "5 bullets in conference-talk mode; max is 3" }
  ]
}
```

## After generating

1. Write `review_log.json`. If a prior log exists, append the old one to `review_log.history.json`.
2. Update manifest: `reviewLogs.contentReview = { filePath: "review_log.json", totalRounds: <n>, finalStatus: "<recommendation>" }`.
3. Auto-iteration policy (handled by orchestrator):
   - score ≥ 85 → forward to human gate.
   - 60 ≤ score < 85 → auto-re-invoke drafters with `improvements` as feedback, max 3 iterations.
   - score < 60 → re-invoke once; if still <60, escalate to user as a Level 3 design problem (likely outline issue).

## Be specific and paper-grounded

For every unsupported claim, you must either (a) find supporting text in `paper_text.md` and cite the section, or (b) flag it as unsupported with the closest related passage. Don't say "this might be in the paper" — find it or flag it.
