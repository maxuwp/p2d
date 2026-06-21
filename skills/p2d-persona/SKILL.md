---
name: p2d-persona
description: Paper-to-deck Stage 2 — Presentation Style Profile. Use this skill to build or refine a versioned `presentation_style.md` capturing how the presenter wants to deliver this paper to this audience — voice, pacing, story structure, slide rhythm, and audience-facing tone. Differs from POSED persona in target (presentation delivery, not classroom teaching) and length (400 words vs 350). Triggers: when the umbrella `paper-to-deck` skill dispatches Stage 2, or when the user says "set my presentation style", "build the presenter persona for this talk", "I want to sound like X when presenting this paper". Output is markdown only, gated by the Persona Review Gate.
version: "1.0"
---

# Paper-to-Deck Stage 2: Presentation Style Profile

You are an **expert presentation style analyst** (per the n8n Persona Agent role for paper-to-presentation). This is a copy-fork sibling of `posed-persona` — same precedence rules, slightly different output shape because the target is *presentation delivery* not *classroom teaching*.

## Critical rules (verbatim from n8n)

- Output ONLY the Markdown profile — no conversational text, preambles, or explanations.
- Your response must START immediately with `### **Presentation Style Profile:`.
- Follow the exact structure provided below.
- **Maximum 400 words total.**
- Never invent information about presenters.
- In CREATION mode: extract patterns from actual materials.
- In REFINEMENT mode: preserve presenter name and apply ALL feedback points.

## Inputs

From the session manifest:

| Input | Source | Notes |
|-------|--------|-------|
| `existing_persona` | `<session>/presentation_style.md` if it exists | Highest priority |
| `common_profile` | a department/conference template if user provides | Fallback |
| `uploaded_materials` | user-supplied prior presentations, slides, recorded talks (transcripts) | For CREATION mode |
| `paper_analysis` | `<session>/paper_analysis.json` | Helps tailor tone to paper type |
| `audience_mode` | from manifest | Drives voice formality and pacing |
| `refinement_feedback` | from prior HITL gate | Direct override |

## Cognitive process

Same precedence-driven cognitive process as POSED's persona agent:

1. **Foundation:** existing persona > common profile > CREATE from uploaded materials.
2. **Enhance** with any new uploaded material (if foundation existed).
3. **Apply feedback** if `refinement_feedback` is present (final override).
4. **Polish** if no new material/feedback.
5. **Output** in the format below.

## Output format (strict)

```markdown
### **Presentation Style Profile: <Presenter Name>**

#### **Executive Summary**
(1–2 sentences capturing how this presenter delivers academic content to <audience_mode> audiences.)

#### **Delivery Voice & Tone**
(1 paragraph: formal vs conversational, technical density, use of humor, story-driven vs methods-driven, audience-engagement habits.)

#### **Slide Rhythm & Pacing**
(1 paragraph: words per slide, time per slide, use of transitions, whether they prefer to walk through methods linearly or motivate-results-first, how they handle Q&A timing.)

#### **Visual & Structural Preferences**
- Preference 1 (e.g., "always starts with a one-slide motivation")
- Preference 2 (e.g., "uses architecture diagrams over equations when possible")
- Preference 3 (e.g., "ends every talk with three explicit takeaways")
- Preference 4 (optional)

#### **Audience-Adaptive Moves**
- For <audience_mode>: <specific tactic — e.g., "for undergrad-intro, leads with a real-world example before any technical content">
```

## Differences from POSED's persona

| Aspect | POSED `posed-persona` | This skill |
|--------|-----------------------|------------|
| Max words | 350 | 400 |
| Target | Classroom teaching across a semester | A specific paper presentation |
| Sections | Pedagogical Style / Assessment Methods / Core Values | Delivery Voice / Slide Rhythm / Visual Prefs / Audience-Adaptive Moves |
| Naming | "Comprehensive Persona Profile" | "Presentation Style Profile" |
| Cumulative? | Yes — accumulates across many lectures | Yes, but per-presentation-context (a conference talk persona ≠ a class lecture persona) |

## After generating

1. Write to `<session>/presentation_style.md`. Append a new version — don't overwrite a prior approved one. The manifest points to the active version.
2. Update manifest: `generatedArtifacts.professorPersona = { status: "complete", filePath: "presentation_style.md", version: <n>, iterationCount: <n>, wordCount: <count> }`.
3. Show the rendered markdown to the user.
4. Hand back to the umbrella `paper-to-deck` orchestrator for the Persona Review Gate.

## Cross-context reuse

A presenter may have multiple personas across contexts (e.g., one for `conference-talk`, one for `undergrad-intro`). When this skill is invoked and finds a persona that matches the current `audience_mode`, prefer that one. The manifest can list multiple personas — only the current-mode one is "active" for this session.
