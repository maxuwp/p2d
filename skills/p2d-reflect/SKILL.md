---
name: p2d-reflect
description: Paper-to-deck Stage 6 — Reflection Loop. After the final deck is approved, extracts presenter preferences from gate decisions and appends to presentation_style.md. Logs universal p2d skill gaps to p2d_improvements.md. Offers an email feedback draft to maxuwplatt@gmail.com (draft only, never sends). Snapshots all approved artifacts to versions/final_v<N>/. Mirror of posed-reflect, adapted for paper-to-presentation context. Triggers: automatically after HITL Gate 3 (Final Deck Approval), or when user says "run the reflection", "update my presentation style".
version: "1.2"
---

# Paper-to-Deck Stage 6: Reflection Loop

Every paper-to-deck run surfaces something about how the presenter likes to present and where the pipeline could be better. This stage captures that learning so the NEXT run starts smarter.

Mirror of `posed-reflect`, adapted for the paper-to-presentation context: instead of teaching style, this captures presentation delivery preferences; instead of course materials knowledge, this captures the presenter's preferred talk structure.

---

## Inputs

| Input | Source |
|-------|--------|
| `presentation_style` | `<session>/presentation_style.md` |
| `manifest` | `<session>/manifest.json` (all HITL decisions + gate history) |
| `humanization_report` | `<session>/humanization_report.md` |
| `final_review` | `<session>/final_review.md` (if it exists) |
| `approved deck` | `<session>/deck.html` (confirmed at Gate 3) |
| `outline` | `<session>/presentation_outline.json` |

---

## Step 1: Extract Presenter Preferences from Gate History

Read `manifest.json` history for all gate decisions. Look for signals of preference:

| Gate | Signal to extract |
|---|---|
| MCS+PSE Gate | Did they edit the MCS? What did they change? → Note how they frame their own contribution. |
| Outline Gate | Did they add/remove sections? Did they shift slide counts? → Note their preferred section weight ratios. |
| Content Gate | What did they revise in slides? In notes? → Note their slide density preference, vocabulary choices. |
| Humanization Gate | Did they accept or edit? If they edited: what did they put back or further remove? → Note voice direction. |
| Template Gate | Which template did they pick? Did they reject A, B, or C? → Note design preferences. |
| Final Deck Gate | Did they request any layout/structure changes after seeing the full deck? |

Synthesize into 3–7 learnable preferences. Examples:
- "Prefers 1.5 min/slide average, even in conference mode"
- "Prefers Phase titles over section numbers in section headers"
- "Likes explicit timing cues every 3 slides, not every section"
- "Rejects slides with more than 3 bullets, regardless of content density"

---

## Step 2: Update `presentation_style.md`

Append a new section to `<session>/presentation_style.md`:

```markdown
## Reflections from [Paper Title] — [ISO Date]

**Paper type:** <Empirical / Technical / Survey / Position>
**Audience mode:** <conference-talk / grad-seminar / etc.>
**Duration:** <N> minutes

### Preferences Observed
1. [Preference 1 — concrete and specific]
2. [Preference 2]
...

### MCS Framing Style
[How the presenter framed their own contribution at the MCS gate — 1 sentence]

### Template Preference
Chose [template name] over [A] and [B]. [1 sentence on why, inferred from their comments if any]

### Humanization Direction
Score: N/50. [1 sentence: what the presenter kept, what they revised, net direction]

### What Worked Well
- [1-3 things the pipeline produced that required no revision]

### What to Watch Next Time
- [1-3 things the presenter had to fix at gate — signals for the pipeline to catch earlier]
```

This section accumulates across sessions — each paper adds one `## Reflections from ...` block to the same `presentation_style.md`. Future runs of `p2d-persona` can read this history to calibrate the new session's style.

---

## Step 3: Log Universal Pipeline Improvements

Read the gate history and `final_review.md` for patterns that indicate a p2d skill gap — something the pipeline consistently produced wrong that the human had to fix.

Write to `<session>/p2d_improvements.md` (create if not exists):

```markdown
# p2d Pipeline Improvement Log

## [Paper Title] — [ISO Date]

### Gate-observed gaps
| Skill | Issue | Frequency | Suggested fix |
|---|---|---|---|
| p2d-outline | PSE-3 underrepresented (1 slide for a major phase) | 1x | Add weight factor per PSE based on paper section length |
| p2d-draft-slides | "12-15 steps" instead of "12 steps" on 1 slide | 1x | Tighten numerical faithfulness check |

### Humanization patterns still present after auto-clean
(Any tells the self-check script missed that the human caught)
| Pattern | Frequency | Proposed addition to taxonomy |
|---|---|---|

### Template gate patterns
| Which slot picked | Frequency | Notes |
|---|---|---|
| Slot A (context match) | 1x | Presenter picked uw-brand directly — default it |
```

If `p2d_improvements.md` already exists from a prior session, append a new dated section — do not overwrite.

---

## Step 4: Artifact Snapshot

Snapshot all approved files:

```bash
mkdir -p <session>/versions/final_v<N>/
cp <session>/slides_humanized.md <session>/versions/final_v<N>/
cp <session>/speaker_notes_humanized.md <session>/versions/final_v<N>/
cp <session>/deck.html <session>/versions/final_v<N>/
cp <session>/presentation_outline.json <session>/versions/final_v<N>/
cp <session>/humanization_report.md <session>/versions/final_v<N>/
```

Where `<N>` = current version number (1 if first complete run, increment otherwise).

Update manifest: `reflection.snapshot_path = "versions/final_v<N>/"`.

---

## Step 5: Offer Email Feedback Draft

After updating `presentation_style.md` and `p2d_improvements.md`, ask once:

```
Would you like me to draft a feedback email to the skill creator (maxuwplatt@gmail.com)?
The email would summarize:
  - What worked well in this p2d run
  - 2-3 improvement suggestions from the pipeline gap log
  - The paper type and audience mode (for pattern tracking)

Reply 'yes' to see the draft, or skip to finish.
```

If "yes": draft the email (do NOT send — draft only). Example format:

```
To: maxuwplatt@gmail.com
Subject: p2d Session Feedback — [Paper Title] [audience_mode] [date]

Hi Dr. Ma,

Here are notes from a p2d run on "[Paper Title]":

Paper type: [type]
Audience mode: [mode], [N] minutes
Final deck: [N] slides, template: [name]

What worked well:
- [1-3 items]

Suggested improvements:
- [Improvement 1 from p2d_improvements.md]
- [Improvement 2]

The humanization score was N/50. The human gate [accepted / edited] the humanized content.

[Presenter name] used the reflection to update presentation_style.md with N new preferences.
```

Present the draft in chat. Ask: "Send this email?" — then wait for explicit "yes, send" before doing anything. If they approve, use the email tool to draft and send. Do NOT auto-send.

---

## After completing

1. Update `presentation_style.md` with the new Reflections section.
2. Ensure `p2d_improvements.md` is saved.
3. Ensure snapshot is complete.
4. Update manifest: `reflection.status = "complete", reflection.completed_at = <iso8601>`.
5. Close the session with a summary in chat:

```
Session complete.

Paper: [title]
Deck: [N] slides — [template name] — approved
Humanization score: N/50

Your presentation style has been updated with [N] new preferences.
[N] pipeline improvement notes logged to p2d_improvements.md.

All artifacts saved to: <session>/
Snapshot at: <session>/versions/final_v<N>/

To give a future talk on a different paper, run @paper-to-deck with the new PDF.
Your updated presentation_style.md will carry forward.
```
