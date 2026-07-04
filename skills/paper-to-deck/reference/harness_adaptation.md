# Harness Adaptation Notes (paper-to-deck)

Same content as `<harness-skills-dir>/posed/reference/harness_adaptation.md` — both skill sets follow the Agent Skills open standard (agentskills.io) and use the same tool-agnostic language.

See that file for the full tool-name mapping table.

## Paper-to-deck specifics

- **Stage 1 fact-check offer.** Before the standard 4-option gate on the paper analysis, the orchestrator asks one extra question ("Want the Learning Assistant to fact-check the analysis first?"). In Codex, format this as a two-option prompt:
  ```
  Want the Learning Assistant to fact-check the AI's analysis against the original paper before you review it?
    1. Yes, run verification (recommended for unfamiliar papers)
    2. No, I already know this paper well
  ```
- **Audience-mode selector.** When opening a session, present the five modes as a numbered list. Don't try to coerce the response into a strict enum — accept free text and map common variants ("conference" → `conference-talk`, "grad" → `grad-seminar`, etc.).
- **HTML preview at Stage 5b gate.** After `p2d-compile` produces `deck.html`, suggest the OS-appropriate open command (`open deck.html` on macOS, `xdg-open` on Linux, `start` on Windows). If the harness can preview files inline, use that instead.
- **PDF/PPTX export.** The Anthropic `pptx` skill is not installed by default in Codex. If the user wants PPTX output, either install the `pptx` skill manually (it's part of the agentskills.io catalog) or fall back to HTML→PDF via headless Chromium or WeasyPrint.

## What stays the same

- The 5-stage pipeline (Paper Analysis → Persona → Outline → Content → HTML Assembly).
- The five audience modes (`undergrad-intro`, `grad-seminar`, `conference-talk`, `research-group-share`, `self-study`).
- The two-pass paper analysis (Paper Analyzer + Thematic Analyst).
- The Learning Assistant ✓/⚠ verification format.
- The 100-point editor rubric with paper-faithfulness weighted at 30 points.
- The visual theming/content split (`p2d-style` separated from `p2d-compile`).
- The pacing timer in `p2d-compile`.

All of these are described in the SKILL.md bodies and reference files in tool-agnostic language. The agent in any harness can follow them directly.
