# Paper-to-Deck Skill Set

Claude Code port of Dr. Xiaoguang Ma's **paper-to-presentation 2.4.1** n8n workflow (the second tool in his ASEE'26 case study). Sibling to the POSED skill set — same governance discipline (artifact-first, HITL-gated, manifest-indexed) but starts from a published academic paper instead of a teaching plan.

## What this is

An umbrella skill + 9 specialized sub-skills that together produce a teachable slide deck from an academic paper:

```
paper-to-deck   (umbrella — orchestrates the 5-step pipeline, owns the manifest, runs HITL gates)
│
├── p2d-ingest          Stage 1:   PDF → Paper Analyzer + Thematic Analyst → paper_analysis.json
├── p2d-verify          Stage 1.5: Learning Assistant fact-checks the analysis (optional but recommended)
├── p2d-persona         Stage 2:   Presentation Style Profile (400 words, audience-mode-aware)
├── p2d-outline         Stage 3:   Paper → slide map, strictly from paper text
├── p2d-draft-slides    Stage 4a:  Markdown slides
├── p2d-draft-notes     Stage 4b:  Speaker notes (audience-mode pacing)
├── p2d-editor-review   Stage 4c:  AI pre-screen — paper-faithfulness-weighted rubric
├── p2d-style           Stage 5a:  JSON design tokens (colors, typography, layout, pacing timer)
└── p2d-compile         Stage 5b:  HTML deck — 16:9, WCAG AA, keyboard nav, pacing timer
```

## How to invoke

- **Full workflow:** "make a presentation from this paper", "turn this PDF into a teachable deck", "I need a 15-min conference talk from this paper" — auto-discovers `paper-to-deck`.
- **Single stage:** invoke a sub-skill directly — "fact-check this analysis" → `p2d-verify`. Sub-skills read the manifest if present, or operate ad-hoc.
- **Re-entry:** point Claude at an existing session folder and ask to resume. The orchestrator reads `manifest.json`, finds the next incomplete step (per n8n `Obtain Manifest Information and Select Next Step` logic), and resumes there.

## Audience modes

This skill set introduces an audience-mode dial that propagates through every stage:

| Mode | Slides/min | Tone | Methods depth |
|------|------------|------|---------------|
| `undergrad-intro` | ~1 / 1.5 min | Plain English, analogies | Light |
| `grad-seminar` | ~1 / 2 min | Technical vocab OK | Heavy |
| `conference-talk` | ~1 / 1.5 min (strict) | One main message | Compressed |
| `research-group-share` | ~1 / 2.5 min | Informal, discussion-driven | Medium with detours |
| `self-study` | ~1 per ~200 notes-words | Complete, cited | Full |

The mode is set at session start and read by every sub-skill from the manifest.

## The session folder

```
p2d-sessions/
└── ai-hardware-paper-2026-05-28/
    ├── manifest.json
    ├── paper_text.md
    ├── paper_analysis.json
    ├── learning_guide.md         ← optional fact-check report
    ├── presentation_style.md
    ├── presentation_outline.json
    ├── slides.md
    ├── speaker_notes.md
    ├── review_log.json
    ├── style_tokens.json
    └── deck.html
```

Every file is human-editable. Edit between stages and re-run the orchestrator — it picks up your edits.

## How this differs from POSED

| Concern | POSED | Paper-to-Deck |
|---------|-------|---------------|
| Starting point | Topic + teaching plan | A specific paper PDF |
| Sourcing | Web search + user-approved corpus → RAG | Paper IS the corpus; web search optional |
| Reliability check | Sourcing gate + Editor Review | Fact-checking (Learning Assistant) + Editor Review |
| Outline source | Plan's SLOs + subtopics | Paper's structure + thematic analysis |
| Persona name | "Comprehensive Persona Profile" (350 words) | "Presentation Style Profile" (400 words) |
| Visual generation | One-pass during compile | Style designer + HTML designer as separate agents |
| Output default | Reveal.js HTML or PPTX | Direct HTML (16:9, 1920×1080) with pacing timer |
| Audience modes | Single audience per lecture | 5 explicit modes |

## Why "copy-fork" instead of sharing with POSED

The two workflows look similar at the SKILL.md level (both have outline/persona/drafters/review/compile), but the underlying logic and prompts differ enough that maintaining a single shared set with mode flags would be fragile:

- POSED's drafter expects a RAG corpus; paper-to-deck's drafter expects only paper text.
- POSED's editor weights pedagogical scaffolding; paper-to-deck's editor weights paper-faithfulness.
- POSED's persona is course-spanning; paper-to-deck's is per-talk-context.
- POSED's compile is markdown→reveal.js; paper-to-deck's is direct HTML.

The forked sub-skills are smaller and easier to reason about than a single multi-mode version would be. The cost is two near-duplicate copies; the benefit is each skill has a single clear contract.

## Provenance

Built from:
- `creating presentation from a paper 2.4.1 start working on the second step.json` — 192 nodes, the n8n source
- Two papers referenced in `the POSED repo's skills/posed/README.md (maxuwp/posed)`

Agent prompts ported verbatim where possible:
- **Paper Analyzer** — 4-key JSON schema (paper_structure, main_contribution, main_objective, references_text)
- **Thematic Analyst** — 6-key JSON schema with paper-type-specific search patterns for implicit_structures and key_comparisons
- **Learning Assistant** — fact-checker with ✓/⚠ marks, evidence-must-be-quoted discipline
- **Persona Agent** — "Presentation Style Profile" name, 400-word cap, CREATION/REFINEMENT modes
- **Outlining Agent** — strict "derive ONLY from full Source Paper Text" rule
- **Slides and Notes Drafter** — `---SLIDES START/END---` delimiter contract, no-fabricated-references rule
- **Editor Review** — same 100-point format but reweighted for paper-presentation context
- **Presentation Style Designer** — IGNORE content, APPLY visual rules philosophy; JSON tokens
- **HTML Designer** — 1920×1080, WCAG AA, semantic HTML5, complete `<!DOCTYPE html>` output

## Files

- `SKILL.md` — orchestrator
- `reference/manifest_schema.md` — paper-to-deck manifest (richer than POSED's)
- `reference/hitl_protocol.md` — gate semantics (same four options + Stage-1 fact-check offer)
- `reference/design_principles.md` — paper-to-deck-specific principles (paper is ground truth, two-pass analysis, audience-mode dial, style/content separation)
- `reference/n8n-extracted/` — verbatim agent prompts + Code nodes from the v2.4.1 workflow

## Re-running the extractor

If Dr. Ma updates the paper-to-presentation workflow (e.g. v2.5):

```bash
python3 <posed-skill-dir>/scripts/extract_n8n_prompts.py \
    "/path/to/new-paper-to-presentation.json" \
    <paper-to-deck-skill-dir>/reference/n8n-extracted
```

Same script as POSED uses (kept in the `posed` skill for now since both rely on it).
