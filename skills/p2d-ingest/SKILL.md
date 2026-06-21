---
name: p2d-ingest
description: Paper-to-deck Stage 1 — Paper Ingestion + Two-Pass Analysis + MCS/PSE Extraction. Extracts paper text, runs two analysis passes (Paper Analyzer + Thematic Analyst), then extracts and locks the Main Contribution Statement (MCS) and Primary Structural Elements (PSE) into manifest.canonical_facts — the anti-divergence anchor used by every downstream stage. Runs a text quality check before analysis and a brief HITL gate to confirm MCS+PSE before proceeding. Triggers: when the umbrella paper-to-deck skill dispatches Stage 1, or when the user says "analyze this paper", "extract this paper's structure". Output: paper_text.md, paper_analysis.json, updated manifest.canonical_facts.
version: "1.1"
---

# Paper-to-Deck Stage 1: Paper Ingestion + Analysis + Anti-Divergence Seeding

You play **three roles in sequence**: Paper Analyzer, Thematic Analyst, and Canonical Facts Extractor. The third role is new in v1.1 — it's the anti-divergence mechanism that prevents all downstream stages from drifting away from the paper's real contribution.

## Inputs

From the manifest:

| Field | Source |
|-------|--------|
| `paperPath` | from `initialRequest.paperPath` — required |
| `audienceMode` | from `initialRequest.audienceMode` — informs analysis depth |
| `mainTopic`, `audienceLevel`, `eventDuration` | from `initialRequest.*` |

If `paperPath` is missing, ask the user for it.

---

## Step 1 — Text extraction

Extract the paper's text from the PDF. Order of preference:
1. `pypdf` (Python — usually available): `python3 -c "import pypdf; print(pypdf.PdfReader('<path>').pages[i].extract_text())"`.
2. `pdftotext` (poppler) if installed.
3. The `pdf` skill from the Anthropic bundle if installed.

Save the extracted text to `<session>/paper_text.md` with page markers (`===== PAGE N =====`). Update manifest: `generatedArtifacts.originalPaper.{status: complete, filePath, textLength, wordCount}`.

### Text quality check (new)

Run immediately after extraction — before analysis:

1. **Word count check:** if `wordCount < 500`, warn the user: "Text extraction yielded only N words — OCR may have failed or the PDF is image-only. Offer to accept a manual text paste as an override." If the user pastes text, overwrite `paper_text.md` with it and proceed.
2. **Garbled character check:** count lines where >20% of characters are non-ASCII / non-punctuation symbols. If >5% of lines are garbled, show the user a 3-line sample and offer the manual override option.

If neither issue is detected, proceed silently to Step 2.

---

## Step 2 — Pass A: Paper Analyzer (verbatim port)

**Agent role:** expert research assistant. Output a single valid JSON object with exactly four keys:

```json
{
  "paper_structure": "Brief summary of section headings (Abstract, Introduction, Methods, ...)",
  "main_contribution": [
    "First distinct, factual contribution or finding",
    "Second contribution",
    "..."
  ],
  "main_objective": [
    "Key takeaway 1 — about impact and message, not just findings",
    "Key takeaway 2",
    "Key takeaway 3 (maximum 3 total)"
  ],
  "references_text": "Full unedited text from the References / Bibliography section"
}
```

**Critical:** no text or explanations outside the JSON.

---

## Step 3 — Pass B: Thematic Analyst (verbatim port)

**Agent role:** expert research analyst and thematic extraction specialist. Output a single valid JSON object with exactly six keys:

```json
{
  "main_thesis": "Concise sentence stating the paper's main argument",
  "paper_type": "Survey | Empirical | Technical/Methods | Literature Review | Position Paper | <other>",
  "key_themes": ["3-5 main thematic topics"],
  "key_comparisons": ["Key comparisons made in the paper"],
  "implicit_structures": ["Organizing frameworks, taxonomies, progressions, or levels"],
  "evidence_types": ["Types of evidence used to support the thesis"]
}
```

### How to find `implicit_structures` and `key_comparisons` (verbatim from n8n)

**Survey / Empirical Papers:**
- Look for: Groupings or demographic breakdowns ("by discipline", "by role", "by experience level").
- Look for: Rating scales, frequency data, and key findings from charts.
- Example `implicit_structures`: `["Student Perceptions", "Faculty Perceptions"]`.

**Technical / Methods Papers:**
- Look for: A new method, algorithm, or system being proposed.
- Look for: Comparisons against existing or "baseline" methods.
- Example `implicit_structures`: `["Problem Definition", "Our Proposed Method", "Baseline Method"]`.

**Literature Reviews / Position Papers:**
- Look for: Taxonomies or classifications of different approaches.
- Look for: Chronological progressions or historical phases.
- Example `implicit_structures`: `["Taxonomy of Methods: [Statistical, Neural, Hybrid]"]`.

**Critical:** return ONLY the valid JSON object.

---

## Step 4 — Merge into `paper_analysis.json`

Combine both passes into a single artifact:

```json
{
  "paper_title": "<auto-detected from text or null>",
  "paper_path": "<from manifest>",
  "extracted_at": "<iso8601>",
  "analyzer": { /* Pass A output */ },
  "thematic": { /* Pass B output */ }
}
```

Write to `<session>/paper_analysis.json`.

---

## Step 5 — Pass C: Canonical Facts Extractor (NEW — anti-divergence mechanism)

**Agent role:** you extract the irreducible structural spine of the paper that all downstream stages must honor.

### MCS — Main Contribution Statement

Write 1–2 sentences answering: "What ONE thing does this paper contribute that didn't exist before?"

Criteria:
- Must be *specific* — not "proposes a new method" but "a four-phase, 12-step protocol that reduced X from Y months to Z weeks."
- Must be *in the presenter's words* — draw from `main_thesis` and `main_contribution` but synthesize into a single coherent claim.
- Must NOT list multiple contributions — if the paper has several, identify the PRIMARY one.

Example (ASEE 2026 paper): *"A four-phase, 12-step 'Professor + AI Team' agile protocol that reduced faculty-led AI tool development from 8–13 months to approximately 6 weeks."*

### PSE — Primary Structural Elements

Extract the ordered list of the paper's top-level organizing structure — the elements that MUST all appear in the presentation outline.

Rules:
- Use the paper's actual section headings or phase/stage names where possible.
- 3–7 elements max. If the paper has 15 subsections, identify the 4–5 top-level groupings.
- For empirical papers: typically [Motivation, Method, Results, Discussion].
- For multi-phase protocols: each phase is a PSE.
- For surveys: each category/group is a PSE.
- Include the section location in `paper_text.md` (e.g., "Section 3").

Example (ASEE 2026 paper):
```json
[
  { "id": "pse-1", "label": "Phase 1: Preparation", "source_section": "Section IV-A" },
  { "id": "pse-2", "label": "Phase 2: Design & Pre-Implementation Validation", "source_section": "Section IV-B" },
  { "id": "pse-3", "label": "Phase 3: Implementation", "source_section": "Section IV-C" },
  { "id": "pse-4", "label": "Phase 4: Hardening & Reflection", "source_section": "Section IV-D" }
]
```

### paper_facts — Verifiable Claims

Extract 5–10 specific, verifiable facts from the paper: algorithm names, performance numbers, dates, author-specific claims, named tools. These will be cross-checked at the final review stage.

```json
[
  { "claim": "Reduces development time to ~6 weeks", "source": "Abstract" },
  { "claim": "12-step protocol", "source": "Section IV" }
]
```

### Seed manifest.canonical_facts

Write all three into the manifest:

```json
"canonical_facts": {
  "mcs": "<Main Contribution Statement — 1-2 sentences>",
  "pse": [
    { "id": "pse-1", "label": "Phase 1: ...", "source_section": "Section IV-A" },
    ...
  ],
  "paper_facts": [
    { "claim": "...", "source": "..." },
    ...
  ]
}
```

---

## Step 6 — MCS+PSE Confirmation Gate (brief HITL)

Present to the user — do NOT dump raw JSON. Render as:

```
Paper: <title>

Main Contribution (MCS):
  <mcs text>

Structural Spine (PSE — these elements MUST all appear in your presentation):
  1. <pse-1 label> (from <source_section>)
  2. <pse-2 label> (from <source_section>)
  ...

Verifiable Facts Locked:
  • <claim 1>
  • <claim 2>
  ...

Does this correctly capture what your paper contributes and how it's organized?
Options: Confirm | Edit | Re-extract
```

If the user edits the MCS or PSE list, update `manifest.canonical_facts` with their corrections. If "Re-extract," re-run Pass C with guidance.

After confirmation: update manifest `canonical_facts.confirmed: true, confirmed_at: <iso8601>`.

---

## After generating

1. Write `paper_text.md` and `paper_analysis.json`.
2. Seed and confirm `manifest.canonical_facts`.
3. Update manifest:
   - `generatedArtifacts.originalPaper = { status: "complete", filePath: "paper_text.md", textLength, wordCount }`
   - `generatedArtifacts.paperAnalysis = { status: "complete", filePath: "paper_analysis.json", version: 1, iterationCount: 0 }`
   - `canonical_facts.confirmed = true`
4. **Render a human-readable summary** to the user: paper title, paper type, thesis (1 sentence), 3 main contributions as bullets, 3 takeaways as bullets, key themes as a comma-separated list. Don't dump raw JSON.
5. Hand back to the umbrella `paper-to-deck` orchestrator. The orchestrator decides whether to invoke `p2d-verify` (fact-check) before the persona stage, based on the user's `learningAssistance` preference.

## On revision

If `refinement_feedback` is provided, re-run Pass A and/or Pass B with the feedback added to the prompt. If MCS or PSE was revised, re-run Pass C. Bump `iterationCount`.

## Standalone use

If invoked without a session, write the two outputs to the current directory and tell the user how to wrap them in a paper-to-deck session via the umbrella skill.
