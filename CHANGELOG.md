# Paper-to-Deck — Claude Code Plugin Changelog

Version format: `p2d_skill.X.Y`
- **X** (major): increment when accumulated changes warrant a new major release
- **Y** (minor): increment after each reflect session that produces universal improvements

Plugin version and skill version are kept in sync.

---

## p2d_skill.1.3 — 2026-06-21

**Initial standalone release.** Paper-to-Deck extracted from the POSED plugin into its own dedicated repository. All 13 skills at version 1.1 (content pipeline) or 1.2 (new skills), reflecting the three-stage architecture built in posed_skill.1.3.

### Three-stage pipeline architecture (v1.1)

Restructures the previous flat 5-stage flow into three explicit stages, each with a HITL gate:

1. **Stage 1: Content Creation** — p2d-ingest → p2d-persona → p2d-outline → p2d-draft-slides + p2d-draft-notes → p2d-editor-review → Gate 1
2. **Stage 2: Humanization** — p2d-humanizer → Gate 2
3. **Stage 3: Visual Enhancement** — p2d-style → p2d-compile → Gate 3

### Anti-divergence mechanism (v1.1)

Root cause of AI drift (ASEE'26 demo: v00 covered only Phases 1–2 of a 4-phase paper): no anchor to the paper's structural spine at outline stage.

**Fix:** `p2d-ingest` now runs Pass C (Canonical Facts Extractor): extracts the MCS (Main Contribution Statement, 1–2 sentences) + PSE (Primary Structural Elements, ordered list) + paper_facts (verifiable claims). These are confirmed at a brief HITL gate and locked into `manifest.canonical_facts`. Every downstream stage self-checks PSE coverage before opening its gate.

### New skill: `p2d-humanizer` (v1.1)

Stage 2 humanization for presentation content:
- **32-pattern AI-tell taxonomy** from `humanizer-main`, adapted for presentations: significance inflation, vague attribution, copula avoidance, AI-vocabulary clusters, signposting, meta-commentary, plus presentation-specific patterns (bullet grammar, note openers, section bridges)
- **Zero em-dashes** hard rule — every `—` replaced with period/comma/colon/parentheses
- **Presenter voice personalization** from `presentation_style.md` — delivery voice, rhythm, audience-adaptive moves
- **Python self-check**: em-dash count, AI-vocab count, copula count, signpost count must all be 0 before scoring
- **Quality score /50**, threshold 40 to pass Gate 2

### New skill: `p2d-final-review` (v1.2, Stage 5.5)

Cross-artifact consistency audit before compilation:
- **Part A (always):** paper_facts accuracy check, in-slide citation validation, reference list verification, PSE coverage check, MCS echo on takeaway
- **Part B (optional):** presenter read-through simulation + audience read-through simulation
- Output: `final_review.md` with pass/fail per check and specific slide refs

### New skill: `p2d-reflect` (v1.2, Stage 6)

Reflection loop mirroring `posed-reflect`:
- Extracts presenter preferences from gate decisions → appends to `presentation_style.md`
- Logs universal pipeline gaps → `p2d_improvements.md`
- Offers email feedback draft to maxuwplatt@gmail.com (draft only, never auto-sends)
- Snapshots all approved artifacts to `versions/final_v<N>/`

### Modified skills

| Skill | Key changes |
|---|---|
| `paper-to-deck` | 3-stage pipeline diagram; auto-continue rule; anti-divergence overview; complete intermediate artifact table |
| `p2d-ingest` | Pass C (MCS+PSE extraction); text quality check (word count + garbled chars); MCS+PSE confirmation HITL gate; seeds `manifest.canonical_facts` |
| `p2d-outline` | PSE-anchored sections (1:1 PSE→section mapping); short-talk warning (≤4 slides); two-agent creator/reviewer cycle (≥85/100); self-check before gate; saves `outline_review.json` |
| `p2d-draft-slides` | `<!-- TRACES: pse-N -->` comment on every content slide; faithfulness check (unverified claims flagged ⚠); anti-AI vocabulary pre-scan; MCS echo enforced on takeaway |
| `p2d-draft-notes` | Word-count self-check (80–140% target; auto-expand/trim); anti-AI vocabulary scan; PSE section-closing bridge sentences required |
| `p2d-compile` | Phase 2 mandatory template preview gate (3 live HTML covers from 47-template bold-template-pack); uses humanized inputs; no-image-generation rule; `<figure class="placeholder">` for visual hints |

### Structural principles

| Principle | Description |
|---|---|
| A — Two-agent cycle | Creator saves artifact → cold reviewer scores (sees only artifact + rubric + MCS/PSE) → iterate until ≥threshold → HITL gate |
| B — Complete artifact save | Every step writes to a named file immediately; snapshot after each gate |
| C — Humanization = removal + personalization | Remove 32 AI-tell patterns AND apply presenter's voice from `presentation_style.md` |

### Skills in this release

| Skill | Version | Role |
|---|---|---|
| `paper-to-deck` | 1.1 | Umbrella orchestrator |
| `p2d-ingest` | 1.1 | Paper ingestion + MCS/PSE extraction |
| `p2d-verify` | 1.0 | Fact-check AI analysis against PDF |
| `p2d-persona` | 1.0 | Presentation Style Profile |
| `p2d-outline` | 1.1 | PSE-anchored outline (two-agent review) |
| `p2d-draft-slides` | 1.1 | PSE-faithful slide drafter |
| `p2d-draft-notes` | 1.1 | Speaker notes (word-count self-check) |
| `p2d-editor-review` | 1.0 | AI quality pre-screen |
| `p2d-style` | 1.0 | Visual style tokens |
| `p2d-compile` | 1.1 | Template preview gate + HTML deck |
| `p2d-humanizer` | 1.1 | Stage 2 humanization (NEW) |
| `p2d-final-review` | 1.2 | Consistency audit (NEW) |
| `p2d-reflect` | 1.2 | Reflection loop (NEW) |

*Next reflection → p2d_skill.1.4*
