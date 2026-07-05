# Paper-to-Deck Design Principles

Most principles match POSED (see `posed_principles.md` in the POSED plugin (maxuwp/posed, skills/posed/reference/)). The ones below are paper-to-deck-specific:

## 1. The paper is ground truth

Unlike POSED (which sources from a curated web/local corpus), paper-to-deck treats the input paper as the *only* source of factual claims. Restated from the n8n Outlining Agent: "The outline structure must be derived ONLY from the full Source Paper Text — do not invent content not present in the paper."

Practical consequences:
- Drafters must not introduce numbers, dates, or claims that aren't in the paper.
- References listed on slides must come from the paper's bibliography (ported via the Paper Analyzer's `references_text` field). No inventing citations.
- If the user wants outside context (e.g., "compare this to prior work X"), it must be an explicit add-on with its own source.

## 2. Two-pass paper analysis

The n8n flow uses two distinct agents on the paper, in order:
- **Paper Analyzer** — extracts structure, contributions (factual findings), objectives (≤3 takeaways), references text.
- **Thematic Analyst** — extracts thesis, paper type, key themes, key comparisons, implicit structures (taxonomies, progressions, levels), evidence types.

Both pass through `p2d-ingest`. The thematic analysis is what lets the outline reflect the paper's *argument shape*, not just its section headings.

## 3. Fact-checking is optional but recommended for unfamiliar papers

The Learning Assistant (`p2d-verify`) is unique to paper-to-deck. It re-reads the original paper and, for every claim in the AI's analysis, finds the exact supporting text (in quotation marks, with section/paragraph location) or marks it `⚠ WARNING` if no support exists. The instructor reviews the verification report before approving the analysis.

This is the paper-flow equivalent of POSED's source validation gate — applied to the AI's interpretation of the paper, not to web sources.

## 4. Audience mode is the master dial

Five modes propagate through every stage:

| Mode | Slides/min | Tone | Methods depth |
|------|------------|------|---------------|
| `undergrad-intro` | ~1 slide / 1.5 min | Plain English, analogies | Light |
| `grad-seminar` | ~1 slide / 2 min | Technical vocabulary OK | Heavy |
| `conference-talk` | ~1 slide / 1.5 min (strict budget) | One main message | Compressed |
| `research-group-share` | ~1 slide / 2.5 min | Informal, discussion-driven | Medium with detours |
| `self-study` | No time constraint; ~1 slide / 200 words notes | Complete, cited | Full |

Sub-skills read `audienceMode` from the manifest and adapt; the user shouldn't have to repeat preferences.

## 5. Style separated from content

POSED couples content and visuals during compile. Paper-to-deck splits them:
- `p2d-style` generates JSON design tokens (colors, fonts, layout principles) from persona + `specialGuidelines` (e.g., conference template requirements).
- `p2d-compile` consumes those tokens when rendering HTML.

This separation lets the same slide content render in multiple themes (e.g., generate once, render for IEEE template AND a UW-Platteville internal template).

## 6. HTML-first output, no markdown-bound layout

The n8n HTML Designer Agent emits a complete `<!DOCTYPE html>` document directly (16:9, 1920×1080, WCAG AA). The Claude Code port keeps this approach: `p2d-compile` produces real HTML, not reveal.js markdown. Slide content stays portable (`slides.md`) but the final artifact is a self-contained `deck.html`.

## 7. Pacing timer is a default-on feature

The user's published paper explicitly calls out the pacing timer as a faculty-led feature added during the second build. Default ON for paper-to-deck (the typical use case is timed presentations). Default OFF only if the user disables it.

## 8. Same governance principles as POSED apply

- AI for text, code for JSON.
- Artifact-first state, manifest-indexed.
- Mandatory HITL gates.
- Persona as long-term memory.
- Visuals are data-grounded.
- Three-level debug triage.

See POSED principles (maxuwp/posed → skills/posed/reference/posed_principles.md) for the full list — they apply here unchanged.
