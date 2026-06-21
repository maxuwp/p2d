---
name: p2d-humanizer
description: Paper-to-deck Stage 2 — Presentation Humanization. Applies the full 32-pattern AI-tell removal taxonomy to both slides.md and speaker_notes.md, then personalizes the voice from presentation_style.md (delivery voice, rhythm, audience-adaptive moves). Zero em-dashes hard rule. Runs a Python self-check script (em-dash count, AI-vocab count, copula count, signpost count — must all be 0 before proceeding). Quality score /50 (threshold 40 to pass gate). Built from humanizer-main's 32-pattern taxonomy, adapted for academic conference and classroom presentation contexts. Triggers: automatically after HITL Gate 1 (Content Approval), before Stage 3 (Visual Enhancement).
version: "1.1"
---

# Paper-to-Deck Stage 2: Presentation Humanizer

Students and conference audiences respond poorly to AI-sounding presentations. This stage removes the statistical tells of AI-generated writing from both the slide text and speaker notes, then re-grounds the prose in the presenter's actual delivery voice from `presentation_style.md`.

Built from the `blader/humanizer` Claude Code skill's 32-pattern taxonomy and the `posed-humanizer` personalization model, adapted for academic presentation contexts: preserve technical precision and citations while making the delivery feel human.

---

## Inputs

| Input | Source |
|-------|--------|
| `slides` | `<session>/slides.md` (approved at Gate 1) |
| `speaker_notes` | `<session>/speaker_notes.md` (approved at Gate 1) |
| `presentation_style` | `<session>/presentation_style.md` (approved at persona stage) |
| `canonical_facts` | `manifest.canonical_facts` (mcs + pse — to verify not removed during humanization) |
| `audience_mode` | from manifest |

**Refuse to run** if slides or speaker_notes are not approved, or if presentation_style.md doesn't exist.

---

## Principle C: Two Things This Stage Does

1. **Remove the 32 AI-tell patterns** (taxonomy below). Every detected pattern is replaced or removed.
2. **Apply the presenter's voice** from `presentation_style.md`:
   - **Delivery Voice & Tone** section → register, directness, hedging style
   - **Slide Rhythm & Pacing** section → sentence length variation, transition density
   - **Audience-Adaptive Moves** section → apply the mode-specific voice for this session's `audience_mode`

---

## The 32-Pattern AI-Tell Taxonomy

### Category 1: Significance Inflation (6 patterns)
1. "marks a pivotal moment" / "pivotal" (as filler)
2. "plays a crucial role" / "crucial" (as filler)
3. "reflects broader trends" / "broader implications"
4. "in today's fast-paced world" / "in the modern era"
5. "groundbreaking" / "revolutionary" / "transformative" (unless quantified)
6. "at the forefront" / "cutting-edge" (unless technical context)

**Fix:** state the fact directly. If it's pivotal, say why in numbers.

### Category 2: Vague Attribution (4 patterns)
7. "experts argue" / "researchers suggest" (without citation)
8. "studies show" / "research indicates" (without citation)
9. "it is widely believed" / "many argue"
10. "some would say" / "one could argue"

**Fix:** cite the actual source (paper section, author name) or cut the claim.

### Category 3: Copula Avoidance (4 patterns)
11. "serves as" → use *is*
12. "boasts" → use *has*
13. "stands as a testament to" → use *demonstrates*
14. "represents a significant advancement" → state the advancement

### Category 4: AI-Vocabulary Clusters (8 patterns)
15. "delve" / "delve into" → "look at", "explore", "examine"
16. "leverage" (as filler) → "use", "apply"
17. "underscore" (as filler) → "show", "emphasize"
18. "foster" / "fostering" → "build", "develop", "encourage"
19. "tapestry" (abstract) → cut or restate concretely
20. "interplay" (abstract) → describe the actual relationship
21. "seamless" / "robust" (as filler) → describe the actual property
22. "navigate" (abstract, non-spatial) → "handle", "manage", "address"

### Category 5: Signposting & Meta-Commentary (4 patterns)
23. "Let's dive in" / "Let's explore" → start with the content
24. "Here's what you need to know" → just say it
25. "It is worth noting that" / "It's important to mention that" → cut the preamble
26. "In this section/slide, we will / we can see" → say what it means

### Category 6: Filler & Over-Hedging (3 patterns)
27. "in order to" → "to"
28. "due to the fact that" → "because"
29. "it could potentially possibly" / stacked qualifiers → "it may" (one qualifier max)

### Category 7: False Profundity (3 patterns)
30. "At its core" → state the core thing directly
31. "The real question is" → ask the real question
32. "This raises important questions" → name the questions

### HARD RULE: Zero Em Dashes

**ZERO em dashes (—) in any output.** This is a non-negotiable hard rule.

Every em dash must be replaced with one of:
- A period (strongest break)
- A comma (lighter break)
- A colon (for lists or clarification)
- Parentheses (for asides)
- "which" or "that" (for relative clauses)

Never leave even one em dash in the output.

### Presentation-specific additional removes

**Slide bullet grammar:**
- "Enables the system to perform X" → "Performs X"
- "Allows users to achieve Y" → "Users achieve Y" (or just "Y is achievable")
- "Facilitates Z" → "Supports Z" or name the mechanism

**Speaker note openers to remove:**
- "Let's talk about..." → just say the thing
- "Now I'd like to..." → just say the thing
- "Moving on to..." → use a content transition
- "In this slide, we can see..." → describe what the visual means, not that it exists

**Section bridge sentences (remove generic transitions):**
- "With that in mind, let us now turn to..." → "That covers X. Y is where [specific thing happens]."
- "Having established X, we can now look at Y" → "[X] sets up [Y]'s challenge: [1 sentence]."

---

## Process (two-pass, persona-grounded)

### Pass 1: Load the presenter's voice

Read `<session>/presentation_style.md`. Extract:
- **Delivery Voice & Tone:** the presenter's register, directness level, hedging style
- **Writing Voice block** (if present): rhythm patterns, favored/avoided constructions, signature moves
- **Audience-Adaptive Moves for this session's `audience_mode`:** e.g., conference-talk = scripted + terse; grad-seminar = peer-level + technical; undergrad-intro = analogies + definitions inline

If Writing Voice is "insufficient sample," fall back to the persona's teaching register and note it in the report.

### Pass 2: Humanize slides.md

1. Scan `slides.md` — list all pattern matches by category (32-pattern taxonomy + hard rule).
2. Rewrite slides:
   a. Remove AI tells per taxonomy.
   b. Apply persona voice — rhythm variation, concrete-over-abstract, direct-address style.
3. Rules for slide bullets specifically:
   - Light touch only. Slides are already terse fragments. Do NOT turn a 6-word bullet into a sentence.
   - Keep technical terms exact — never trade precision for casualness.
   - Preserve every `<!-- TRACES: ... -->` comment and `<!-- PSE: ... -->` comment verbatim.
   - Preserve every `(per §N.M)` citation.
   - Preserve every `<!-- NOTES: -->` embedded note (these belong to speaker notes, leave in place).
   - The `<!-- SLIDES-SELF-CHECK: ... -->` comment at the top of slides.md — preserve it.
4. Output: `<session>/slides_humanized.md`

### Pass 3: Humanize speaker_notes.md

1. Scan `speaker_notes.md` — list all pattern matches.
2. Rewrite notes with the presenter's full voice:
   - Speaker notes ARE the presenter's script. Lean into the Writing Voice block — direct, plain, conversational. This is them talking.
   - Vary sentence length deliberately. Short punchy sentence after a long one reads human; uniform medium sentences read AI.
   - Prefer concrete: "the LED stays dark" over "the system fails to actuate".
   - Preserve all `[PAUSE]`, `[POINT AT FIGURE]`, `[CHECK TIME]`, `[ANTICIPATE Q]`, and `[OPTIONAL DETAIL]` cues verbatim.
   - Preserve PSE section bridge sentences — humanize them but keep the PSE reference intact.
   - Preserve all paper section references (`§N.M`).
3. Output: `<session>/speaker_notes_humanized.md`

### Pass 4: Python self-check (MANDATORY before scoring)

Run on both output files before scoring:

```bash
python3 - << 'PY'
import re, sys

def check_file(path):
    t = open(path).read()
    # Skip comment blocks for em-dash count to avoid false positives in trace comments
    t_no_comments = re.sub(r'<!--.*?-->', '', t, flags=re.DOTALL)
    tells = {
        "em_dash": t_no_comments.count("—"),
        "ai_vocab": sum(t.lower().count(w) for w in [
            "crucial","pivotal","testament","tapestry","interplay","delve",
            "seamless","robust ","leverage","underscore","foster","groundbreaking",
            "revolutionary","transformative","cutting-edge","at the forefront"
        ]),
        "copula": (t.lower().count("serves as") + t.lower().count("boasts") +
                   t.lower().count("stands as a testament")),
        "signpost": (t.lower().count("let's dive") + t.lower().count("it's worth noting") +
                     t.lower().count("in today's") + t.lower().count("here's what you need to know")),
        "meta_commentary": (t.lower().count("in this slide, we can see") +
                            t.lower().count("in this section, we will"))
    }
    total = sum(tells.values())
    print(f"{path}: {tells}")
    print("CLEAN" if total == 0 else f"STILL HAS TELLS ({total}) — must revise before scoring")
    return total

slides_tells = check_file("<session>/slides_humanized.md")
notes_tells = check_file("<session>/speaker_notes_humanized.md")
print(f"\nTotal tells: {slides_tells + notes_tells}")
PY
```

If any tells remain after the self-check → re-run the affected pass. Do NOT proceed to scoring until tells = 0.

### Pass 5: Quality scoring (/50)

Score 5 dimensions × 10 points each:

| Dimension | Score | What to evaluate |
|---|---|---|
| **Directness** | /10 | No filler phrases, no preamble, no passive over-use; bullets state facts not describe them |
| **Rhythm** | /10 | Sentence length varies deliberately; short punchy sentences exist; no uniform medium cadence |
| **Trust** | /10 | Every claim still sourced; no precision lost; technical terms exact; MCS still echoed in takeaway |
| **Authenticity** | /10 | Voice matches the presenter's Writing Voice block from presentation_style.md; concrete specifics present |
| **Refinement** | /10 | Zero em-dashes confirmed; zero AI-vocab tells; copula removed; signposting gone |

**Threshold: 40/50.** Below threshold:
- Score ≥35 and <40 → auto-revise with lowest-scoring dimension feedback (max 2 rounds).
- Score <35 → escalate to user: show score + top 3 issues; ask to accept, revise manually, or re-humanize.

---

## Output

Save three files:

1. **`<session>/slides_humanized.md`** — humanized slides with all trace comments preserved.
2. **`<session>/speaker_notes_humanized.md`** — humanized notes with all PSE bridges and interaction cues preserved.
3. **`<session>/humanization_report.md`** — summary of the humanization pass:

```markdown
# Humanization Report

**Score:** 44/50

## Dimensions
- Directness: 9/10
- Rhythm: 9/10
- Trust: 10/10
- Authenticity: 8/10
- Refinement: 8/10

## Patterns Removed
- Em dashes: 7 → 0
- AI-vocab terms: 12 → 0
- Signpost phrases: 3 → 0
- Copula constructions: 4 → 0

## Voice Personalization Applied
- Presenter: [name from presentation_style.md]
- Audience mode: [conference-talk / grad-seminar / etc.]
- Voice source: [Writing Voice block | teaching register fallback]
- Key moves applied: [2-3 concrete examples]

## What Was Preserved
- PSE trace comments: YES
- Paper section citations: YES
- MCS echo on takeaway: YES
- Interaction cues: YES
- Technical terms exact: YES
```

Update manifest: `generatedArtifacts.humanizedContent = { status: "complete", slidesPath: "slides_humanized.md", notesPath: "speaker_notes_humanized.md", reportPath: "humanization_report.md", score: 44, passed: true }`.

---

## HITL Gate 2: Humanization Approval

Present to the presenter:

```
Stage 2 Humanization complete. Score: N/50.

slides_humanized.md and speaker_notes_humanized.md are ready for your review.
Key changes: [3 bullets from the report]

Options:
  A. Approve → proceed to Stage 3 (Visual Enhancement)
  B. Edit directly — open files, make changes, then type 'approved'
  C. Request targeted re-humanization — describe what to fix
```

After approval: snapshot both files to `versions/humanized_v<N>/slides_humanized.md` and `versions/humanized_v<N>/speaker_notes_humanized.md`. Update manifest approval status.
