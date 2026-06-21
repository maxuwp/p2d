---
name: p2d-draft-notes
description: Paper-to-deck Stage 4b — Speaker Notes Drafter with Word-Count Self-Check. Writes conversational presenter notes paired slide-by-slide with slides.md. Audience-mode-aware (conference-talk gets terse scripted cues; undergrad-intro gets full explanations + analogies). Runs a word-count self-check (target 80–140% of budget; auto-expands or trims before gate) and an anti-AI vocabulary scan before handing off. Notes close each PSE section with a bridge sentence referencing the PSE. Triggers: when the umbrella paper-to-deck skill dispatches Stage 4b. Output: speaker_notes.md with word-count self-check comment.
version: "1.1"
---

# Paper-to-Deck Stage 4b: Speaker Notes Drafter

Copy-forked from `posed-draft-notes` with paper-specific tweaks: notes anchor to paper sections (so the presenter can answer questions by pointing at the source), each PSE section closes with a bridge sentence, and pacing is **audience-mode-aware**.

## Inputs

From the manifest:

| Input | Source |
|-------|--------|
| `slides` | `<session>/slides.md` (just drafted or approved) |
| `outline` | `<session>/presentation_outline.json` |
| `canonical_facts` | `manifest.canonical_facts` (mcs + pse) |
| `paper_text` | `<session>/paper_text.md` |
| `paper_analysis` | `<session>/paper_analysis.json` |
| `persona` | `<session>/presentation_style.md` |
| `audience_mode`, `eventDuration` | from manifest |
| `revision_feedback` | optional |

---

## Per-slide word-count target (audience-mode-aware)

```
words_per_minute_speaking = 150   # presentations are faster than lectures
slide_minutes = outline.target_duration_minutes / outline.target_slides
target_words_per_slide = floor(slide_minutes * words_per_minute_speaking)

# Audience mode adjustments
if audience_mode == "conference-talk":
    target_words_per_slide = floor(target_words_per_slide * 0.85)   # tighter
elif audience_mode == "self-study":
    target_words_per_slide = floor(target_words_per_slide * 1.5)    # fuller
```

Target range: 80–140% of `target_words_per_slide` per slide. Outside this range → auto-adjust (see Word-Count Self-Check below).

---

## Pre-draft: Anti-AI vocabulary scan

Same scan as `p2d-draft-slides` — before writing notes, check for and remove:

```
delve, leverage, groundbreaking, revolutionary, meticulous, multifaceted,
furthermore, tapestry, underscore, showcase, endeavor, it is worth noting,
in conclusion (except on the last slide), paradigm (as filler),
cutting-edge (unless a direct quote), transformative (unless quantified)
```

Also remove these **speaker note openers** (AI-sounding script starters):
- "Let's talk about..." → just say the thing
- "Now I'd like to..." → just say the thing
- "Moving on to..." → content transition instead
- "In this slide, we can see..." → describe what it means, not what it shows

Log auto-replacements in the self-check comment.

---

## Per-slide note draft logic

For each slide in `slides.md`:

1. **Match the PSE.** Read the `<!-- TRACES: pse-N -->` comment from the slide. This tells you what structural role the slide plays in the PSE coverage.
2. **Write the spoken words.** In the presenter's voice (from `presentation_style.md`). Draft what they will say out loud — not a summary of the bullet points, but what those bullets help them say.
3. **Anchor to the paper.** When appropriate, explicitly mention what the paper's section says: "Section 3.2 shows that..." or "The paper's Phase 2 describes..." — this lets the presenter answer audience questions with "it's in Section N."
4. **Include interaction cues** in brackets:
   - `[PAUSE]` — after a hard or surprising point
   - `[POINT AT FIGURE]` — slide has a visual to track
   - `[LOOK AT AUDIENCE]` — punchline moments
   - `[Q&A INVITATION]` — last slide of a section in `research-group-share` or `grad-seminar`
   - `[CHECK TIME]` — pre-planned checkpoints in `conference-talk`
   - `[OPTIONAL DETAIL]` — digression to include only if time allows (paired with a short fallback)
   - `[ANTICIPATE Q]` — note a likely audience question; address it preemptively
5. **PSE section closing bridge.** The LAST note block in each PSE section must close with a 1-sentence bridge that explicitly names the PSE and transitions to the next one. Example: *"That covers Phase 1 — the preparation groundwork. Phase 2 is where the design validation work begins, and that's what makes this protocol different."*

---

## Audience-mode tone (verbatim guidance)

- `undergrad-intro`: explain like teaching; use analogies; define jargon inline.
- `grad-seminar`: peer-level discourse; methods detail; less hand-holding.
- `conference-talk`: scripted-feeling first sentence per slide; rehearsal-ready; time-aware; clean transitions.
- `research-group-share`: informal; open questions at the end of sections; "what would you do here?" prompts.
- `self-study`: full prose; no interaction cues (no audience to address).

---

## Output format (strict)

Write to `<session>/speaker_notes.md`. Start with the self-check comment block:

```markdown
<!-- NOTES-SELF-CHECK:
  total_words: X
  target_words: Y
  ratio: 0.95
  ai_terms_replaced: ["furthermore→also", "leverage→use", ...]
  slides_under_budget: []
  slides_over_budget: []
  pse_bridges_present: [pse-1, pse-2, pse-3, pse-4]
-->
---NOTES START---
## Slide <section_index>.<slide_index> — <Slide Title>
<!-- PSE: pse-N -->

[~target_words of conversational delivery]
[Anchor to paper section: explicitly mention what §<N> says when relevant]
[Include interaction cues in brackets]
[End each PSE section's last block with a 1-sentence PSE bridge]

## Slide <section_index>.<slide_index+1> — <Next Slide Title>
<!-- PSE: pse-N -->

[...]
---NOTES END---
```

---

## Word-Count Self-Check (mandatory, runs before gate)

After drafting all notes:

```python
# Pseudocode for the self-check logic
total_words = count_words(speaker_notes_md)
target_words = target_words_per_slide * slide_count
ratio = total_words / target_words

slides_under_budget = []  # slides where word count < 0.80 * target
slides_over_budget = []   # slides where word count > 1.40 * target

for slide in slides:
    slide_words = count_words(slide_note_block)
    if slide_words < 0.80 * target_words_per_slide:
        slides_under_budget.append(slide.id)
    elif slide_words > 1.40 * target_words_per_slide:
        slides_over_budget.append(slide.id)
```

**Auto-correction before gate:**
- If `ratio < 0.80`: auto-expand the shortest slides with more paper-grounded detail. Do NOT invent content — expand from `paper_text.md` sections already cited.
- If `ratio > 1.40`: auto-trim the longest slides — cut filler, shorten analogies, move `[OPTIONAL DETAIL]` blocks to the end of the file as an appendix.
- After auto-correction, re-check. If still out of range, note in the self-check comment and let the human gate decide.

Run the Python self-check script to verify:
```bash
python3 - << 'PY'
import re, sys
text = open('<session>/speaker_notes.md').read()
# Strip markdown comment blocks from word count
text_no_comments = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
# Strip delimiter lines
text_no_delim = re.sub(r'^---.*---$', '', text_no_comments, flags=re.MULTILINE)
words = len(text_no_delim.split())
print(f"words: {words}")
PY
```

---

## After generating

1. Write `speaker_notes.md` with self-check comment.
2. Verify self-check passes (all slides in 80–140% range, PSE bridges present).
3. Update manifest: `generatedArtifacts.draftNotes = { status: "complete", filePath: "speaker_notes.md", version: <n>, word_count: X, target_word_count: Y, ratio: Z }`.
4. Hand off to `p2d-editor-review` (AI pre-screen), then back to the orchestrator for the Content Review Gate.

## On revision

`<!-- REVISION LOG -->` comment block at the top of the file, one fix per feedback point. Re-run the word-count self-check after every revision.
