---
name: paper-to-deck
description: Use this skill when the user wants to convert an academic paper (PDF) into a teachable slide deck — for classroom introduction, lab-group share-out, study material, or a conference-style talk. Triggers on phrases like "make a presentation from this paper", "turn this PDF into slides", "I need to give a talk on this paper", "paper-to-presentation", "build a deck from a publication", "presentation generator". This is the umbrella for the p2d-* sub-skill set, a Claude Code port of Dr. Ma's n8n paper-to-presentation workflow (the second tool in his ASEE'26 case study). Sibling system to POSED but distinct: POSED starts from a teaching plan; this skill starts from a published paper. Both produce slides + notes, both use HITL gates, both are manifest-indexed. Always confirm the paper path and audience mode (undergrad intro / grad seminar / conference talk / research-group share) before starting.
version: "1.2"
---

# Paper-to-Deck Orchestrator

## Grounding rule (all stages)

No stage invents its own process, criteria, or rubric where an established framework
exists. Drafters and reviewers work from the named anchors in
`reference/grounding_frameworks.md` (Doumont, Alley assertion-evidence, Mayer, Kosslyn,
CLT, SIFT claim-tracing, the humanizer taxonomies) and state which framework they are
using, cited FOR its original scope. "We made it up" is a review finding.

## Dependency model — upstream edits invalidate downstream artifacts

The pipeline is a dependency chain: `canonical_facts` (MCS+PSE) → outline → slides+notes
→ humanized content → style/deck. **Approving a change upstream marks every downstream
artifact stale** — track per-artifact `valid_from_stage`, `stale_due_to`,
`needs_regeneration`, `superseded_by` in the manifest (same schema as POSED's
outline_dependency_model). Superseded files are archived (`versions/` snapshots), never
silently overwritten; presenter edits live in decision files and are re-applied where
item ids still exist. Compile is blocked while anything `needs_regeneration`. If the
presenter revises the MCS/PSE at any gate, route back to Stage 1's confirmation and
cascade — never patch the deck directly for an upstream concern.

## Stage-end summaries & optional screenshots

After every gate, print a concise summary: files generated · review score/pass ·
decision file · snapshot taken · downstream artifacts now stale. **Screenshot capture**
is a run setting asked at intake (`manifest.userPreferences.capture_screenshots`): when
on, capture each HITL page (after reviewer findings attached, before presenter submit)
to `<session>/p2d_screenshots/` — `1_mcs_pse.png`, `2_persona.png`, `3_outline.png`,
`4_content_gate.png`, `5_humanization_gate.png`, `6_template_preview.png`,
`7_final_deck_gate.png`. A failed capture never blocks a gate.

This is the Claude Code port of Dr. Xiaoguang Ma's **paper-to-presentation 2.4.1** n8n workflow (192 nodes), restructured into a three-stage pipeline with anti-divergence enforcement and human-in-the-loop gates at every stage transition.

## When to invoke

Trigger on user requests like:
- "make a presentation from this paper"
- "turn this PDF into a teachable slide deck"
- "I need to give a 12-minute conference talk based on this paper"
- "convert this publication into class material"
- "build a paper-to-presentation"

For lecture material *not* tied to a specific paper, use the `posed` umbrella instead.

---

## The Three-Stage Pipeline

```
Stage 1: Content Creation
  p2d-ingest   → MCS+PSE confirmed at HITL gate
  p2d-persona  → presentation_style.md confirmed
  p2d-outline  → PSE-anchored outline confirmed (two-agent cycle, ≥85/100)
  p2d-draft-slides + p2d-draft-notes → content drafts confirmed (two-agent cycle, ≥85/100)
                              [HITL Gate 1: Content Approval]

Stage 2: Humanization
  p2d-humanizer → AI-tell removal + presenter voice from presentation_style.md
                  Humanization score ≥40/50 before gate
                              [HITL Gate 2: Humanization Approval]

Stage 3: Visual Enhancement
  p2d-style   → style tokens confirmed
  p2d-compile → 3-preview template gate → full deck.html
  p2d-compile → Phase 4 Visual QA Review → visual_review.json
                              [HITL Gate 3: Final Deck Approval]
```

**No Claude image generation.** Visual enhancement = template selection + layout + design tokens only. For image placeholders, `p2d-compile` leaves `<figure class="placeholder">` elements the presenter can fill offline.

### Anti-divergence contract

The biggest failure mode is AI drifting from the paper's main contribution into interesting sub-details. This is prevented by the **MCS + PSE mechanism** extracted at ingest and enforced downstream:

- **MCS (Main Contribution Statement):** 1–2 sentences — what ONE thing does this paper contribute?
- **PSE (Primary Structural Elements):** ordered list of the paper's top-level sections/phases/findings

Every downstream skill reads these from `manifest.canonical_facts` and self-checks coverage before opening its gate. See `p2d-ingest` for extraction spec.

### Two-agent cycle (applies to outline and content stages)

```
Creation Agent → saves artifact to disk → Reviewer Agent (cold, separate context)
     ↑                                              ↓
     ← revision feedback ← score < threshold ───────┘
                                                    ↓ score ≥ threshold
                                              HITL Gate opens
```

The reviewer sees ONLY: saved artifact file(s) + rubric + MCS + PSE list + paper text. Never the drafter's reasoning. This prevents cumulative hallucination.

### Intermediate artifact table (Principle B — everything saved to disk)

| Step | Files saved |
|---|---|
| `p2d-ingest` | `paper_text.md`, `paper_analysis.json`, `manifest.json` (with canonical_facts) |
| MCS+PSE gate | `manifest.json` updated with confirmed `mcs` and `pse` |
| `p2d-persona` | `presentation_style.md` |
| `p2d-outline` | `presentation_outline.json`, `outline_review.json` |
| `p2d-draft-slides` | `slides.md` |
| `p2d-draft-notes` | `speaker_notes.md` |
| `p2d-editor-review` | `review_log.json` |
| HITL Gate 1 approval | snapshot → `versions/content_v<N>/slides.md`, `speaker_notes.md` |
| `p2d-humanizer` | `slides_humanized.md`, `speaker_notes_humanized.md`, `humanization_report.md` |
| HITL Gate 2 approval | snapshot → `versions/humanized_v<N>/slides_humanized.md`, `speaker_notes_humanized.md` |
| `p2d-compile` previews | `slide-previews/style-a.html`, `style-b.html`, `style-c.html` |
| `p2d-compile` final | `deck.html` |
| `p2d-compile` visual QA | `visual_review.json` |
| HITL Gate 3 approval | snapshot → `versions/final_v<N>/deck.html`, `visual_review.json` |

---

## Orchestrator playbook

### Step 0 — Open or resume the session

**Guided HTML mode (preferred when a browser is available):** this skill set bundles `scripts/posed_app.py` — a zero-dependency local web app that replaces terminal prompts with browser forms (the original n8n Form-node UX).

Intake:
```bash
python3 <skill-dir>/scripts/posed_app.py intake --flow p2d --session <session-dir>
```
Opens a browser form with paper path, audience mode (5-option dropdown), duration, fact-check opt-in, visual style, special guidelines. **Blocks until submitted**, writes `<session>/hitl/intake.json`, prints the path. Read it and populate the manifest's `initialRequest` and `userPreferences` from it.

HITL gates after each stage:
```bash
python3 <skill-dir>/scripts/posed_app.py gate --session <session-dir> \
    --stage <analysis|mcs_pse|persona|outline|content|humanization|style|deck> \
    --artifact <path> --title "Stage N: <Name>"
```
**Run in the foreground with a long timeout (e.g. 600000 ms) — never in the background.** Tell the user once: "A review form is open in your browser."

**Fallback:** if the script can't run (headless, no browser), use the plain interactive prompt from `reference/hitl_protocol.md`.

**Auto-continue rule:** no chat prompts between stages. Each stage launches immediately after the previous gate is approved. Never ask "shall I start Stage N?" — just start it and state what's beginning in one sentence.

**Guided app is the current shared build (ported from POSED — the v3 freeze is lifted).**
It adds, and this skill set should use: **cloud-storage-safe staging** (`--cloud-safe
auto` default — OneDrive/iCloud/Dropbox sessions stage through
`/private/tmp/posed-local-sessions/`, decisions sync back, PROJECT path printed);
**`--status-file` handoff** for sandboxed harnesses that can't hold a blocking foreground
server; **gate § section feedback** — every major JSON section gets keep/revise/split/
remove + comment; `accept` with non-empty `section_feedback` is
**accepted-with-required-revision** (apply by section_id, re-review, re-gate); and
**`items` mode** for narrow item-list review (see the outline gate in `p2d-outline`).
**Never accept a gate on the presenter's behalf** — no clicking/submitting without
explicit current-turn permission; "prefer defaults" means prefill, never bypass. While a
page is open, wait quietly (no screenshot/narration loops).

If using terminal mode, ask the user:
1. **Path to the paper PDF.** Required.
2. **Audience mode.** Pick one:
   - `undergrad-intro` — sophomore/junior level, lots of motivation, less math
   - `grad-seminar` — peers can handle dense slides, focus on methods and contributions
   - `conference-talk` — strict time budget (12, 15, 20 min), one main message
   - `research-group-share` — informal, methodological depth, discussion-oriented
   - `self-study` — no live audience; emphasis on completeness and citations
3. **Event duration in minutes.** Drives slide count.
4. **Resuming?** Ask whether to resume an existing session (provide the session folder path) or start fresh.

Create the session folder at `<cwd>/p2d-sessions/<paper-slug>-<YYYY-MM-DD>/` (or user's preferred path) and write `manifest.json` per `reference/manifest_schema.md`. If resuming, read the existing manifest and skip to the next incomplete step.

### Step 1 — Dispatch Stage 1: Content Creation

For each stage in the content creation stage:
1. State what's starting in one sentence.
2. Invoke the sub-skill — it reads from `manifest.json` for its inputs.
3. Render the output for the user (rendered markdown for `.md`, pretty-printed/summarized for `.json`).
4. Run the HITL gate. Update the manifest (status, version, approval, history).

**Stage 1 dispatch order:**

| Sub-skill | What it does | Gate |
|---|---|---|
| `p2d-ingest` | Extract paper text; run two-pass analysis; extract MCS+PSE; seed `canonical_facts` | MCS+PSE confirmation gate (brief) |
| `p2d-verify` (optional) | Fact-check AI analysis against PDF; run if `learningAssistance: true` | Fact-check review gate |
| `p2d-persona` | Build `presentation_style.md` (delivery voice, rhythm, audience-adaptive moves) | Persona review gate |
| `p2d-outline` | PSE-anchored outline; two-agent review cycle (≥85/100); short-talk warning | Outline gate |
| `p2d-draft-slides` | Draft slides with PSE self-trace + anti-AI pre-check | Content review gate (with notes) |
| `p2d-draft-notes` | Draft notes with word-count self-check + anti-AI pre-check | (same gate) |
| `p2d-editor-review` | AI editor pre-screen (cold reviewer, scores against rubric); iterate if <85 | — |

**HITL Gate 1 — Content Approval:** opens after `p2d-editor-review` passes threshold or escalates. Gate summary must show: slide count, word-count compliance ratio, PSE coverage check, unverified claims count. Options: Approve → Stage 2, Request Revisions, Regenerate. After approval: snapshot content to `versions/content_v<N>/`.

### Step 2 — Dispatch Stage 2: Humanization

Immediately after Gate 1 approval, launch `p2d-humanizer` without pausing.

`p2d-humanizer` runs both slides and notes through:
1. 32-pattern AI-tell removal
2. Presenter voice personalization from `presentation_style.md`
3. Quality scoring /50 (threshold 40/50 to pass)
4. Python self-check (em-dash count must be zero)

**HITL Gate 2 — Humanization Approval:** options: Approve → Stage 3, Edit directly, Request targeted re-humanization. After approval: snapshot to `versions/humanized_v<N>/`.

### Step 3 — Dispatch Stage 3: Visual Enhancement

Immediately after Gate 2 approval, launch `p2d-style` then `p2d-compile`.

`p2d-compile` runs in sequence:
1. Phase 2 mandatory template preview gate (3 live HTML covers → user picks → full deck generates). See `p2d-compile` for the 47-template bold-template-pack integration.
2. Phase 4 Visual QA Review Agent — cold reviewer checks `deck.html` for word overflow, broken layouts, missing notes, visual consistency, and navigation presence. Outputs `visual_review.json`. Errors block Gate 3; warnings surface at the gate with user acknowledgment.

**HITL Gate 3 — Final Deck Approval:** shows visual QA result (errors/warnings) + deck summary. Open `deck.html` in browser; verify cover + 2 content slides + takeaway. Options: Approve, Request revision, Recompile with different template. After approval: snapshot to `versions/final_v<N>/`.

### Step 4 — Optional follow-up skills

After Gate 3 (or optionally before Stage 3 as a Stage 5.5):
- **`p2d-final-review`** — cross-artifact consistency audit + optional audience simulation. Recommended for conference talks.
- **`p2d-reflect`** — reflection loop: extracts preferences → `presentation_style.md`; logs universal improvements → `p2d_improvements.md`; offers feedback email draft.

### Step 5 — Re-entry rules

Same as POSED: if a stage is approved in the manifest, skip it; if not approved, resume from there.

---

## Audience-mode propagation

Every sub-skill receives `audience_mode` from the manifest. They adapt:
- `undergrad-intro`: emphasize motivation slides, plain English, analogies, fewer methods slides.
- `conference-talk`: strict slide budget (`duration_minutes / 1.5` slides), one key takeaway, methods compressed.
- `grad-seminar`: more methods/results slides, technical vocabulary OK.
- `research-group-share`: include open-question prompts, limitations section.
- `self-study`: completeness > brevity; full prose notes; no audience interaction cues.

**Pacing timer:** `p2d-compile` always includes a pacing timer (the n8n workflow's signature feature). Disable only if the user asks.

---

## How this differs from POSED

| Concern | POSED | Paper-to-Deck |
|---------|-------|---------------|
| Starting point | Topic + teaching plan | A specific paper |
| Sourcing | Web search + user-approved corpus → RAG | The paper itself is the corpus; web search is optional |
| Outline source | Plan's SLOs + subtopics | Paper's PSE (Primary Structural Elements) — anti-drift anchored |
| Persona name | "Professor Persona" | "Presentation Style Profile" |
| Humanization | posed-humanizer (persona reading voice) | p2d-humanizer (presenter delivery voice + 32-pattern taxonomy) |
| Visual generation | HTML via frontend-slides, 47-template | Same frontend-slides system + Phase 2 preview gate |
| Image generation | None (Claude) | None (Claude) — placeholder figures only |
| Reliability mechanism | Sourcing + RAG + Editor Review | MCS+PSE anti-divergence + Fact-checking + Editor Review + HITL |

---

## Files in this skill

- `reference/manifest_schema.md` — paper-to-deck's manifest format (tracks `canonical_facts`, `learningAssistance`, `visualStylePreference`, `reviewLogs`).
- `reference/hitl_protocol.md` — gate semantics (same four options as POSED).
- `reference/grounding_frameworks.md` — the master framework map (Doumont, Alley, Mayer, Kosslyn, CLT, SIFT claim-tracing); every stage's criteria trace here.
- `reference/design_principles.md` — paper-specific principles (paper is ground truth, no invented references, audience-mode propagation, anti-divergence enforcement).
- `reference/n8n-extracted/` — verbatim agent prompts + Code nodes from the paper-to-presentation v2.4.1 workflow.

Always read `reference/design_principles.md` before the first run of a new session.
