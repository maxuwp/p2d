# Paper-to-Deck HITL Gate Protocol

Same gate pattern as POSED (see `<harness-skills-dir>/posed/reference/hitl_protocol.md` for the full rationale).

## Browser gate (default — via `scripts/posed_app.py gate`)

Run the guided gate form **in the foreground** (long timeout, never in the background):

```bash
python3 <skill-dir>/scripts/posed_app.py gate --session <session-dir> \
    --stage <analysis|persona|outline|content|style|deck> \
    --artifact <path> --title "Stage N: <Name>"
```

The page is a **single editable document** — JSON artifacts render as a structured form (editable fields, "+ Add item" / "× remove" on lists; the user never sees JSON syntax), markdown artifacts as a directly editable rich document (converted back to markdown on save). Two buttons; edits detected automatically:

| Button | `decision` in result | Manifest effect |
|--------|----------------------|-----------------|
| **✓ Accept and continue** | `accept` if unchanged; `edit` if the user modified the document | `accept` → append step to `completedSteps`, `status: complete`, log to `reviewLogs.<stage>`. `edit` → the script already wrote the user's edited version into the artifact file (original backed up to `<session>/hitl/<stage>_original.<ext>`); `status: complete`, `source: user_edited`, append to `completedSteps` |
| **↻ Regenerate…** | `regenerate` | bump `iterationCount` + `version`, do NOT add to `completedSteps`. If `guidance` is non-empty, pass it as `refinement_feedback`. If `artifact_updated` is true, the user edited the document first — the artifact file already contains their edits (original backed up); regenerate starting from the edited version. Treat user-added or user-modified content as authoritative: keep it verbatim where complete, fill in fields the user left blank, and rebalance the rest around it |

The old "Request revisions" and "Upload an override" options are subsumed: the user just edits the document in place (or pastes replacement text into it) and clicks Accept.

## Terminal fallback (headless / no browser)

Use the harness's interactive prompt with the four legacy options:

| Label | Manifest effect |
|-------|-----------------|
| **Approve as-is** | append to `completedSteps`, `status: complete` |
| **Request revisions** (collect feedback text) | bump `iterationCount`, re-run with feedback |
| **Regenerate (different version)** | bump `iterationCount` + `version`, re-run |
| **Upload an override** (file path or pasted content) | `status: complete`, `source: user_override` |

## Stage 1 special case — fact-check offer

The intake form already asks "Want the AI to fact-check its paper analysis?" (`learning_assistance` field). If the user opted in → invoke `p2d-verify` after Paper Analysis and gate on the *verified* analysis. If intake was skipped (terminal mode), ask:

```
"Want the Learning Assistant to fact-check the AI's analysis against the original paper before you review it?"
  - Yes, run verification (catches AI hallucination — recommended for unfamiliar papers)
  - No, I already know this paper well
```

## Stage 5 (HTML compile) special case — preview before approve

The HTML deck is the final artifact — the user should **open and preview the rendered deck itself** before approving, not just its source. Suggest `open <session>/deck.html` (or the OS equivalent), then run the gate on `slides.md` source if edits are needed (editing the compiled HTML directly is discouraged; edit the markdown and recompile).
