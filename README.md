# Paper-to-Deck — Claude Code Plugin

**Academic Paper → Polished Presentation Deck**

A Claude Code plugin that converts any academic paper (PDF) into an audience-tuned slide deck with speaker notes, using a three-stage pipeline with human-in-the-loop approval gates. Ported from Dr. Xiaoguang Ma's n8n paper-to-presentation v2.4.1 workflow (192 nodes).

> **Codex version**: see [github.com/maxuwp/p2d-codex](https://github.com/maxuwp/p2d-codex)  
> **POSED (lecture authoring)**: see [github.com/maxuwp/posed](https://github.com/maxuwp/posed)

---

## The Three-Stage Pipeline

```
Stage 1: Content Creation
  Ingest paper → Extract MCS + PSE (anti-divergence anchor)
  Build outline (PSE-anchored, two-agent review ≥85/100)
  Draft slides + notes (PSE self-trace, word-count check)
                        ↓ HITL Gate 1

Stage 2: Humanization
  Remove 32 AI-tell patterns
  Apply presenter voice from your style profile
  Score /50 — threshold 40 to pass
                        ↓ HITL Gate 2

Stage 3: Visual Enhancement
  3-template preview (choose your visual style)
  Generate self-contained deck.html (1920×1080)
                        ↓ HITL Gate 3
```

**No image generation.** Visual enhancement = template selection + layout + design tokens. Visual hints become placeholder figure elements you can fill offline.

---

## Anti-Divergence: Why It Matters

The most common failure in AI-generated presentations is drift — the AI latches onto an interesting sub-detail and forgets the paper's main contribution. In our ASEE 2026 demo, v00 covered only Phases 1–2 of a 4-phase protocol.

**Fix:** At ingest, the skill extracts:
- **MCS** (Main Contribution Statement, 1–2 sentences) — what ONE thing does this paper contribute?
- **PSE** (Primary Structural Elements) — the paper's top-level phases/sections/findings

These are confirmed with you and locked into `manifest.canonical_facts`. Every downstream stage self-checks PSE coverage before opening its gate. The outline must map 1:1 to PSEs. Slides must trace to a PSE. The takeaway must echo the MCS.

---

## Install

```bash
claude plugin install github:maxuwp/p2d
```

Or for local development:

```bash
claude --plugin-dir ./p2d-plugin
```

---

## Quickstart

```
@paper-to-deck
```

POSED will ask for: paper PDF path, audience mode, and duration. Everything else runs automatically with your approval at each gate.

**Audience modes:**
- `conference-talk` — strict time budget, one main message
- `grad-seminar` — methods-heavy, technical depth
- `undergrad-intro` — motivation-first, plain language
- `research-group-share` — informal, discussion-oriented
- `self-study` — complete notes, no live audience

---

## Skill Reference

| Skill | Invoke | What it does |
|---|---|---|
| **Orchestrator** | `@paper-to-deck` | Entry point — runs all three stages with HITL gates |
| Ingest | `@p2d-ingest` | Extract text + two-pass analysis + MCS/PSE extraction + quality check |
| Verify | `@p2d-verify` | Fact-check the AI's paper analysis against the original PDF |
| Persona | `@p2d-persona` | Build your Presentation Style Profile (delivery voice, rhythm, audience moves) |
| Outline | `@p2d-outline` | PSE-anchored outline — two-agent review cycle, threshold 85/100 |
| Draft slides | `@p2d-draft-slides` | Slide markdown with PSE trace comments and faithfulness check |
| Draft notes | `@p2d-draft-notes` | Speaker script with word-count self-check and PSE bridges |
| Editor review | `@p2d-editor-review` | AI quality pre-screen (100-point rubric, faithfulness-weighted) |
| **Humanizer** | `@p2d-humanizer` | Stage 2 — 32-pattern AI-tell removal + presenter voice personalization |
| Style | `@p2d-style` | Visual style tokens |
| **Compile** | `@p2d-compile` | Stage 3 — 3-template preview gate + full HTML deck |
| **Final review** | `@p2d-final-review` | Cross-artifact consistency audit (facts, citations, PSE coverage, MCS echo) |
| **Reflect** | `@p2d-reflect` | Stage 6 — update Presentation Style Profile, log pipeline improvements |

Skills in **bold** are new in v1.1/v1.2.

---

## What Humanization Does

The `p2d-humanizer` applies the full 32-pattern AI-tell taxonomy from [`blader/humanizer`](https://github.com/blader/humanizer), adapted for academic presentations:

- Significance inflation ("groundbreaking", "revolutionary", "pivotal")
- Vague attribution ("experts argue", "studies show")
- Copula avoidance ("serves as", "boasts")
- AI-vocabulary clusters ("delve", "leverage", "tapestry", "seamless")
- Signposting ("Let's dive in", "It's worth noting that")
- Presentation-specific: removes generic note openers, flattens bullet grammar, tightens section bridges
- **Zero em-dashes** hard rule — every `—` replaced with period/comma/colon/parentheses

Then personalizes for the presenter's voice from `presentation_style.md`: delivery register, rhythm, audience-adaptive moves.

---

## Template Preview

Before generating the full deck, `p2d-compile` shows you **3 live HTML cover slides** (with your real paper title and tagline). Pick A, B, or C — or describe what to change. The full deck only generates after you choose.

Templates come from the [frontend-slides bold-template-pack](https://github.com/zarazhangrui/frontend-slides) (47 templates including `uw-brand` for UW System presenters).

---

## Intermediate Artifacts

Everything is saved to disk at every step. Nothing held only in context.

| Step | Files saved |
|---|---|
| Ingest | `paper_text.md`, `paper_analysis.json`, `manifest.json` |
| MCS+PSE gate | `manifest.canonical_facts` confirmed |
| Persona | `presentation_style.md` |
| Outline | `presentation_outline.json`, `outline_review.json` |
| Draft | `slides.md`, `speaker_notes.md`, `review_log.json` |
| Gate 1 snapshot | `versions/content_v1/` |
| Humanization | `slides_humanized.md`, `speaker_notes_humanized.md`, `humanization_report.md` |
| Gate 2 snapshot | `versions/humanized_v1/` |
| Compile | `slide-previews/style-a/b/c.html` → `deck.html` |
| Gate 3 snapshot | `versions/final_v1/` |
| Reflect | `presentation_style.md` (updated), `p2d_improvements.md` |

---

## Requirements

- Claude Code (latest)
- Python 3.9+ (for word-count self-checks and the HITL web app)
- `frontend-slides-main/` at `~/Documents/claudecode/frontend-slides-main/` (for HTML deck generation)

---

## Versioning

Uses `p2d_skill.X.Y` versioning (see [CHANGELOG.md](CHANGELOG.md)):
- **Y** increments after each reflection session with universal improvements
- **X** increments on major structural changes

Current version: **p2d_skill.1.3**

---

## Credits

This skill set builds on the following open-source Claude Code skills:

| Skill | Author | Used for |
|---|---|---|
| [blader/humanizer](https://github.com/blader/humanizer) | @blader | 32-pattern AI-tell taxonomy; core detection/rewriting approach. Based on Wikipedia's "Signs of AI Writing" (WikiProject AI Cleanup). |
| [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) | @hardikpandya | Additional pattern coverage; /50 quality scoring rubric (via the `humanizer-zh` adaptation). |
| [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides) | @zarazhangrui | Phase 2 "show don't tell" 3-preview template gate; 47-template bold-template-pack; 1920×1080 fixed-stage engine. |
| [op7418/guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) | @op7418 (歸藏) | Visual quality checklist approach; distinctive typography + palette philosophy. |

The paper-to-deck pipeline structure is ported from Dr. Ma's n8n paper-to-presentation v2.4.1 workflow (192 nodes).

---

## Designed at

ECE Department, University of Wisconsin–Platteville  
Dr. Xiaoguang Ma · ASEE 2026 case study  

---

## License

MIT
