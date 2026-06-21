---
name: p2d-compile
description: Paper-to-deck Stage 5b — Template Preview Gate + HTML Deck Assembly. Before generating the full HTML deck, runs a mandatory Phase 2 template preview gate: 3 live single-slide HTML cover previews from the 47-template bold-template-pack (audience/context match, bold aesthetic match, wildcard), presenter picks a style, then the full deck.html is generated using that template's design.md verbatim. No Claude image generation — visual hints become placeholder figure elements. Uses the frontend-slides 1920x1080 fixed-stage system with pacing timer. Triggers: when the umbrella paper-to-deck skill dispatches Stage 5b after humanization is approved.
version: "1.1"
---

# Paper-to-Deck Stage 5b: Template Preview Gate + HTML Compile

You are an **expert web designer specializing in presentation slides** (per the n8n HTML Designer Agent). The deck must be:

- 16:9, 1920×1080 fixed stage, letterbox/pillarbox scaled uniformly to viewport.
- Template-faithful: all CSS comes from the chosen template's `design.md`. No improvised styles.
- **WCAG AA compliant** — accessibility is not optional.
- Self-contained: all CSS/JS inline in the HTML file, Google Fonts loaded via `<link>`.
- Pacing timer enabled by default (the n8n workflow's signature feature).

**No image generation.** Claude does not generate images for slides. Visual hints become placeholder `<figure>` elements (see Visual section below).

---

## Inputs

From the manifest:

| Input | Source | Required? |
|-------|--------|-----------|
| `slides_humanized` | `<session>/slides_humanized.md` (approved at Gate 2) | Yes |
| `speaker_notes_humanized` | `<session>/speaker_notes_humanized.md` (approved at Gate 2) | Yes |
| `style_tokens` | `<session>/style_tokens.json` (from p2d-style) | Yes |
| `outline` | `<session>/presentation_outline.json` | For section labels, timing budgets |
| `paper_analysis` | `<session>/paper_analysis.json` | For references list at end |
| `canonical_facts` | `manifest.canonical_facts` | For MCS echo on takeaway slide |
| `audience_mode`, `eventDuration` | from manifest | Yes |

**Refuse to run** if slides_humanized, speaker_notes_humanized, or style_tokens aren't approved. Use humanized versions — not the raw Stage 1 drafts.

---

## Phase 2: Mandatory Template Preview Gate

Before generating ANY full deck, present 3 live HTML cover slide previews. This gate is MANDATORY — do not skip even if the user says "just build the deck."

The only exception: if the user already named a specific template in this session (e.g., "use uw-brand"), skip to Phase 3 directly with that template.

### Step 1 — Select 3 template candidates

Read `~/Documents/claudecode/frontend-slides-main/bold-template-pack/selection-index.json` to find the 47 available templates (34 bold aesthetic templates + 13 scenario templates). Pick 3:

| Slot | How to pick |
|---|---|
| **A — Audience/context match** | Pick based on paper venue and audience_mode. Quick guide: |
| | `conference-talk` → `uw-brand` (if UW), `mainstage`, or `meridian` |
| | `grad-seminar` or `research-group-share` → `schematic` or `vital` |
| | `undergrad-intro` → `chalk` |
| | Medical/clinical paper → `vital` |
| | Data/empirical paper → `cadence` |
| | CS/engineering paper → `schematic` |
| | UW-Platteville / Wisconsin System presenter → **`uw-brand` is the default** |
| **B — Bold aesthetic match** | From the 34 bold templates; pick by tone: Signal = scholarly authority, Vellum = literary/quiet, Nebula = AI/tech product |
| **C — Wildcard** | Contrasting personality from A and B — lighter, darker, or differently typeset |

For each selected template, read its `preview.md` from `bold-template-pack/templates/<slug>/preview.md` before generating the preview slide.

### Step 2 — Generate 3 single-slide HTML cover previews

Create: `<session>/slide-previews/style-a.html`, `style-b.html`, `style-c.html`

Each must be a **complete, self-contained HTML** file that renders the cover/title slide of the actual paper presentation.

**NON-NEGOTIABLE rules:**

1. **Use real content.** Show the actual paper title, presenter name, audience mode label, venue if known, and a meaningful tagline drawn from the MCS. No lorem ipsum.

2. **Never show template labels on the slide canvas.** Do not render "Style A", "uw-brand", "Option 1", "preview", or any internal label on the slide itself.

3. **1920×1080 fixed stage.** Stage scaling JS required:
   ```js
   const stage = document.getElementById('deckStage');
   function scaleStage() {
     const f = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
     const x = (window.innerWidth - 1920 * f) / 2;
     const y = (window.innerHeight - 1080 * f) / 2;
     stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + f + ')';
   }
   scaleStage();
   window.addEventListener('resize', scaleStage);
   ```

4. **Required viewport-base.css to inline in every preview:**
   ```css
   html, body { width:100%; height:100%; margin:0; overflow:hidden; background:#000; }
   .deck-viewport { position:fixed; inset:0; overflow:hidden; background:#000; }
   .deck-stage { position:absolute; left:0; top:0; width:1920px; height:1080px; overflow:hidden; transform-origin:0 0; }
   .slide { position:absolute; inset:0; width:1920px; height:1080px; overflow:hidden; display:block; visibility:hidden; opacity:0; pointer-events:none; }
   .slide.active, .slide.visible { visibility:visible; opacity:1; pointer-events:auto; z-index:1; }
   ```

5. **Trigger entrance animations** via double `requestAnimationFrame` after adding `.visible`:
   ```js
   requestAnimationFrame(function() {
     requestAnimationFrame(function() {
       document.querySelector('.slide').classList.add('visible');
     });
   });
   ```

6. **Load fonts from Google Fonts / Fontshare only.** Follow the template's `design.md` font spec exactly.

### Step 3 — Open previews and present to presenter

After writing all three files:
```bash
open <session>/slide-previews/style-a.html
open <session>/slide-previews/style-b.html
open <session>/slide-previews/style-c.html
```

Present this table in chat:

```
Three style previews are open in your browser.

| Preview | Template | Vibe |
|---------|----------|------|
| style-a.html | <name> | <one-sentence description> |
| style-b.html | <name> | <one-sentence description> |
| style-c.html | <name> | <one-sentence description> |

Which style would you like for the full deck? (A, B, or C — or describe what you'd like to change)
```

Do not reveal template names on the slides themselves — only in this chat table.

### Step 4 — Wait for selection

Accept: "A", "B", "C", the template name, a letter with comments, or a description of desired changes. If they describe changes, offer to generate a revised preview before committing to the full deck.

### Step 5 — Read the full design spec

Once a template is chosen, read `~/Documents/claudecode/frontend-slides-main/bold-template-pack/templates/<chosen>/design.md` for: all color values, exact typography scale at 1920×1080, spacing tokens, component specs, dos/don'ts. This is the only source of CSS values for the full deck — never improvise.

---

## Phase 3: Full Deck Generation

### Parse slides_humanized.md

The humanized slides format follows the same `---SLIDES START/END---` delimiter contract as v1.0. Map each `## N.` to a chapter/section opener slide. Map each `### N.M` to a content slide. First slide = cover. Last slide = references.

### Slide type → layout mapping

| Slide type | What it contains |
|---|---|
| Cover | Paper title + tagline (from MCS) + presenter + venue + date |
| Chapter opener | Section number + PSE label + 1-line bridge sentence |
| Content | Chrome bar + headline + bullets + visual area + section source |
| Takeaway | MCS echoed in the presenter's voice (max 3 bullets) |
| References | Paper's bibliography entries |

### Visual treatment (NO image generation)

For each slide's `(Visual: …)` line:

- **Data chart** (numbers exist in paper): render as QuickChart URL `<img src="https://quickchart.io/chart?c=...">` or inline `<canvas>` + Chart.js CDN. Include a `<!-- Figure Statement: [3-5 sentences, exact data values, source section] -->` comment.
- **Diagram / process flow** (described in paper): render as clean SVG using the template's color palette. Box-and-arrow diagrams work well inline.
- **Photo / illustration / abstract image** (no real data): leave a `<figure class="placeholder" data-prompt="<the visual description from slides.md>">` element with a visible centered label showing the visual description. The presenter can drop in their own image offline.

Never hallucinate image content. If it's not a real chart or SVG-expressible diagram, use the placeholder.

### Speaker notes embedding

Embed as HTML comments immediately after each `<section>` open tag:
```html
<!-- NOTES: <humanized speaker notes text here> -->
```

### Pacing timer

Always included (the n8n workflow's signature feature). Disable only if user explicitly asks:
- Elapsed time display
- Per-section budget vs actual (from outline timing)
- Color flip to warning at 80% of section budget
- `t` key to pause/resume

### Navigation controller

Full slide controller — keyboard (`← →`, Space, Home, End), touch swipe (50px threshold), mouse wheel (60ms debounce), `E` key for inline editing, progress bar at bottom, stage scaling on resize. Go to slide 0 via JS (`go(0)`) — do NOT hard-code `active` class in HTML.

---

## Phase 4: Output

1. Write `<session>/deck.html` (single self-contained file).
2. Open in browser: `open <session>/deck.html`
3. Update manifest: `generatedArtifacts.finalPresentation = { status: "complete", htmlPath: "deck.html", template: "<name>", slide_count: N }`.
4. Present HITL Gate 3 summary:
   - Navigation instructions
   - Slide count + template name
   - Takeaway slide location
   - Approval question

Clean up `slide-previews/` only after the deck is approved.

---

## Design quality rules (non-negotiable)

- **Template-faithful only.** Use exactly the CSS from the chosen template's `design.md`. No improvised card styles, colors, or font sizes.
- **No AI slop.** No generic infographic layouts, clip-art icon vibes, or rainbow gradients.
- **Content-sized cards, never stretched.** Use explicit `min-height`; never `flex:1` on card containers.
- **Title anchors at top.** `justify-content:flex-start` with generous top padding on the slide body. No vertical centering.
- **Chrome labels don't wrap.** `white-space:nowrap` on chrome bar labels and counters.
- **Minimum 24px type** at 1920×1080 stage. Readable from the back of a conference room.

---

## Optional output paths

### PDF export

If user requests PDF: `chromium --headless --print-to-pdf=<session>/deck.pdf <session>/deck.html` or `weasyprint`. Update manifest with `pdfPath`.

### PPTX export

If user requests PPTX AND the Anthropic `pptx` skill is installed: translate to pptx skill input format. Save as `<session>/deck.pptx`.

## Recompile policy

Recompiling is cheap. If the user revises `slides_humanized.md` or `speaker_notes_humanized.md` after this skill ran, re-invoke without redoing upstream stages.
