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

---

## p2d_skill.1.4 — 2026-07-02

**Fit-First Layout Protocol + geometric overflow QA.** Fixes the min-font-size vs. frame-capacity conflict: the template system locks font sizes (min 24px) for back-of-room readability, but nothing budgeted content to frame geometry, so frames overflowed (text crossing card borders) on dense slides — especially figure + card-row slides.

### Root cause

Three compounding gaps: (1) no capacity math anywhere — the compiler poured arbitrary-length text into fixed-geometry frames at locked sizes; (2) the old "Layout Optimization Rule" mandated `flex:1` stretch on every visual child and "maximize font size", directly contradicting the template contract ("cards are content-sized, never flex:1") — when space ran short, stretch squeezed frames below their content's needs; (3) the visual QA word-count checks were per-slide heuristics (120 words/slide), blind to per-frame geometry.

### Skill changes

| Skill | Version | Key changes |
|---|---|---|
| `p2d-compile` | 1.1 → 1.2 | "Layout Optimization Rule" replaced by the **Fit-First Layout Protocol**: (Step 1) budget check before writing HTML — read the template design.md's "Content Capacity Budgets" if present, else compute chars/line and lines-available from frame geometry; over-budget content triggers the **overflow ladder**: trim words (detail moves to speaker notes) → re-arrange (stacked rows over narrow columns, 2×2 over 1×4) → split the slide (one frame family per slide). Explicit mixed-slide rule (figure + cards = halved card budgets or split). (Step 2) arrangement chosen among arrangements that FIT, minimizing dead space. (Step 3) leftover space distributed BETWEEN frames, never by inflating card interiors — `flex:1` on cards banned. Phase 4 gains **Check Group 6: geometric overflow scan** — a dev-only `window.__qaScan()` hook inlined in every deck measures `scrollHeight`/`clientHeight` per element per slide; run via preview eval (machine-readable) or `deck.html?qa=1` (red outlines + alert). ERROR per overflowing frame; resolution is the ladder, never font shrinking or `overflow:hidden` clipping |
| `p2d-draft-slides` | 1.1 → 1.2 | Source-level budget: ≤14 words per bullet, ≤30 words per card/panel item — points that need more words go to speaker notes |

### Template pack (local, not in this repo)

`frontend-slides-main/bold-template-pack/templates/uw-brand/design.md` gained a "Content Capacity Budgets" section: hard word budgets per layout (bullets ≤4×13 words; 3-up stance ≤28 words/card; tool row 3/4/5-up ≤26/18/12; action rows ≤3×16; etc.), the mixed-slide halving rule, and the overflow ladder. The compile skill reads these budgets when present and computes them for templates that lack the section.

### Plugin version

`plugin.json`: `1.3.0` → `1.4.0`

*Next reflection → p2d_skill.1.5*

---

## p2d_skill.1.5 — 2026-07-04

**The POSED lessons, applied to paper-to-deck.**

### Guided app unfrozen and ported (v3 → current shared build)

`skills/paper-to-deck/scripts/posed_app.py` updated from the frozen v3 (intake+gate only, 660 lines) to the current shared build — the "port over once POSED is finalized" condition is met. p2d gains: **cloud-storage-safe staging** (`--cloud-safe auto`; OneDrive/iCloud/Dropbox sessions stage via /private/tmp, decisions sync back), **`--status-file` launcher handoff** for sandboxed harnesses, **gate § section feedback** (keep/revise/split/remove + comment per section; accept + feedback = accepted-with-required-revision), and **`items` mode** for narrow item-list gates. Verified: `intake --flow p2d` renders in the current build.

### Grounding (presentation-specific master map)

New `skills/paper-to-deck/reference/grounding_frameworks.md`: Doumont (message before medium; audience law), Alley (assertion–evidence; the critical assertion — the MCS is grounded here), Mayer (coherence/signaling/redundancy/segmenting), Kosslyn (discriminability/salience for compile), CLT (outline segmenting), SIFT claim-tracing (p2d-verify traces analysis claims to the paper), plus the humanizer's existing taxonomy citations. Scope notes included (communication frameworks ≠ pedagogy; POSED's instructional anchors apply additionally for undergrad-intro decks). Umbrella grounding rule: state your framework, cite it for its original scope; "we made it up" is a review finding.

### Dependency model + HITL conduct (from POSED 1.9/1.11)

- Chain: canonical_facts (MCS+PSE) → outline → slides+notes → humanized → style/deck. Upstream approval marks downstream stale (`valid_from_stage` / `stale_due_to` / `needs_regeneration` / `superseded_by`); compile blocked while stale; MCS/PSE revisions route back to Stage 1 and cascade.
- Outline gate prefers the `items` page (one item per PSE section: keep/revise/split/remove + comment + reorder) over one big document gate (p2d-outline 1.2).
- Never accept a gate on the presenter's behalf; prefill ≠ bypass; wait quietly while a page is open.
- Stage-end summaries after every gate; optional screenshot capture (`capture_screenshots`, `p2d_screenshots/1_mcs_pse.png` … `7_final_deck_gate.png`; failures never block).

### Skill versions

paper-to-deck 1.1→1.2 · p2d-outline 1.1→1.2 · p2d-draft-slides 1.2→1.3 (Alley/Mayer grounding) · p2d-compile 1.2→1.3 (Mayer/Kosslyn in design rules) · p2d-editor-review 1.0→1.1 (criteria trace to map). MAINTAINING.md rule 0: release lint before push.

### Plugin version

`plugin.json` (both manifests): `1.4.0` → `1.5.0`

*Next reflection → p2d_skill.1.6*

---

## p2d_skill.1.6 — 2026-07-05

**Part B audience simulation is opt-in with the cost stated.** The presenter/audience read-through reads the full deck + notes twice — the most token-expensive step in the pipeline. It now asks before launching (run / skip; `self-study` audience mode still auto-invokes since no live presenter will catch problems), records `finalReview.part_b_mode`, states a skip prominently in `final_review.md`, and re-offers on every re-run. p2d-final-review 1.2 → 1.3.

### Plugin version

`plugin.json` (both manifests): `1.5.0` → `1.6.0`

*Next reflection → p2d_skill.1.7*

---

## p2d_skill.1.7 — 2026-07-05

**Shared app synced + macOS Codex Desktop HITL rule added.** Ports the current `posed_app.py` (now byte-identical to the POSED copy, including the new generic `scope` mode) and adds `skills/paper-to-deck/reference/codex_desktop_hitl_launcher.md` — the umbrella already referenced this file but it had never been created (latent broken reference, now fixed). Same macOS rule as POSED: run the approved `posed_app.py` command directly with `--status-file`, read `Form ready: <url>`, open in the Codex in-app browser — never Finder/`.app`/external browser/`file://`; command prefix approved before the stage; scoped to macOS (Windows/Linux not yet validated). CR2's Source Scope Gate is POSED-only (p2d's corpus is the paper itself) and is deliberately NOT ported.

### Plugin version

`plugin.json` (both manifests): `1.6.0` → `1.7.0`

*Next reflection → p2d_skill.1.8*
