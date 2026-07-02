---
name: p2d-compile
description: Paper-to-deck Stage 5b — Template Preview Gate + HTML Deck Assembly. Before generating the full HTML deck, runs a mandatory Phase 2 template preview gate: 3 live single-slide HTML cover previews from the 47-template bold-template-pack (audience/context match, bold aesthetic match, wildcard), presenter picks a style, then the full deck.html is generated using that template's design.md verbatim. Content is laid out under the Fit-First Layout Protocol — font sizes are locked (min 24px), so content is budgeted to frame capacity before HTML is written (trim → re-arrange → split ladder, never shrink fonts). After compile, runs a mandatory Phase 4 Visual QA Reviewer pass (15 checks: word overflow, bullet count, notes embedding, visual directive fulfillment, heading consistency, navigation, pacing timer, self-containment, geometric frame-overflow scan) before the final HITL gate. No Claude image generation — visual hints become placeholder figure elements. Uses the frontend-slides 1920x1080 fixed-stage system with pacing timer. Triggers: when the umbrella paper-to-deck skill dispatches Stage 5b after humanization is approved.
version: "1.2"
---

# Paper-to-Deck Stage 5b: Template Preview Gate + HTML Compile

Two open-source skills informed the design of this stage:

- **[zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides)** — the Phase 2 "show don't tell" aesthetic discovery model (3 live previews with real content before committing to a template), the 47-template bold-template-pack, and the 1920×1080 fixed-stage engine.
- **[op7418/guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill)** — the visual quality checklist approach (no generic AI-slop layouts, distinctive typography hierarchy, committed color palette).

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

### Fit-First Layout Protocol (REQUIRED for every content slide)

Two failure modes, both real and both banned:
- **Overflow**: text set at the template's locked font sizes exceeds its frame and spills across the card border. Font sizes have a hard floor (back-of-room readability) — they can NEVER shrink to make text fit, so oversized content must be cut, re-arranged, or moved to another slide.
- **Dead space**: items rendered at natural size and centered, leaving large empty areas below.

The rule that prevents both: **fit first, then fill.**

**Step 1 — Budget check (before writing any HTML).** If the chosen template's `design.md` has a "Content Capacity Budgets" section, treat those budgets as hard limits. If it doesn't, compute capacity from its geometry: chars per line ≈ frame inner width ÷ (0.5 × font-size); lines available ≈ frame inner height ÷ (font-size × line-height). Check every text element against its frame's capacity at the template's locked size. Anything over budget triggers the **overflow ladder**, in order:

1. **Trim words.** Excess detail moves to the speaker notes (the presenter says it; the slide doesn't show it).
2. **Re-arrange.** Pick the arrangement that gives each item the line width it needs: sentence-length items go in full-width stacked rows, not narrow columns; 4 items fit 2×2 better than 1×4; 5+ items become a list or table.
3. **Split the slide.** One frame family per slide — a diagram slide followed by a takeaway-cards slide beats one crowded slide. An extra slide costs seconds; text crossing a card border costs credibility.

Never: shrink below the template minimum, allow text to cross a frame border, or clip content at the slide edge.

**Mixed slides (figure/diagram + text frames):** allocate the visual its needed height first, then verify the remaining height fits the text frames at their budgets. If not, halve the per-card word budgets or split the slide. This is the single most common overflow scenario — check it explicitly.

**Step 2 — Arrangement choice (among arrangements that fit).** Pick the arrangement with the least dead space:

| Items | Arrangements to compare |
|---|---|
| **1 item** (diagram, table) | Full-width; size the visual to the available area |
| **2 items** | (A) side-by-side `1fr 1fr` vs (B) stacked full-width rows — stacked wins when items are sentences |
| **3 items** | (A) 3-column row vs (B) 3 stacked rows — columns only if each item fits its column budget |
| **4 items** | 2×2 grid (almost always); 1×4 row only for single-number stats or ≤3-word labels |
| **5+ items** | List or table; distribute with `justify-content:space-between` — never cluster at the top |

**Step 3 — Space distribution.** Fill leftover height by distributing space BETWEEN frames — `gap`, `justify-content:space-between`, generous top/bottom margins on the group — never by inflating card interiors. Cards are content-sized (`min-height` gives shape); `flex:1`/`height:100%` on a card container is banned: it either leaves an empty interior or, when space runs short, squeezes the frame below its content's needs and causes the exact overflow this protocol exists to prevent.

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

## Phase 4: Visual QA Review Agent

**Role:** cold reviewer. Reads ONLY `deck.html`, `slides_humanized.md` (for visual directives), and `manifest.json`. Does NOT see the compiler's reasoning. Runs automatically after Phase 3 writes `deck.html`; HITL Gate 3 does not open until this pass completes.

### Check Group 1: Content Density

For each `<section class="slide">` (or equivalent slide element):

1. **Word count per slide**: Strip HTML tags from visible content. Exclude: `<!-- NOTES: ... -->` comments, `data-notes` attributes, elements with `display:none`/`visibility:hidden`. Count words in body text only (not the title).
   - **ERROR** if any slide exceeds 120 words of visible body text (overflow risk at conference viewing distance)
   - **WARNING** if any slide exceeds 80 words

2. **Bullet count per slide**: Count `<li>` elements per slide.
   - **ERROR** if any slide has >5 bullets; in `conference-talk` mode: >4

3. **Title length**: Count characters in each slide title element.
   - **WARNING** if any title exceeds 90 characters (may wrap at typical font sizes)

### Check Group 2: Structural Completeness

4. **Notes embedding**: Every content slide must have a notes block — one of: `<!-- NOTES: ... -->`, `data-notes="..."`, or `<div class="notes">`. Notes must be non-empty (>10 words).
   - **ERROR** if notes are missing or empty on a content slide (cover and Q&A slides exempt)

5. **Visual directives fulfilled**: For each slide in `slides_humanized.md` that contains a `(Visual: ...)` line, verify the compiled slide has at least one visual element: `<svg>`, `<canvas>`, `<figure>`, `<table>`, or a div with a visual class (`.diagram`, `.chart`, `.comparison`, `.placeholder`).
   - **WARNING** if a visual directive was silently dropped (no visual element on that slide)

6. **Slide count**: Verify actual slide count matches `manifest.generatedArtifacts.detailedOutline.totalSlides` (±1 for Q&A slide).
   - **WARNING** if mismatch

### Check Group 3: Visual Consistency

7. **Heading element consistency**: All content slide main titles should use the same element/class. Flag slides that use inline `style="font-size:..."` on headings instead of the template class.
   - **WARNING**

8. **Accent color tokens**: Hex color values in inline `style=""` attributes should match the template's token set from `style_tokens.json`. Flag improvised hex values not present in the `<style>` block's CSS variables.
   - **WARNING**

9. **Bottom bar**: Verify the gold bottom bar exists — either as a CSS `::after` rule on `.slide` in the `<style>` block, or as an explicit bar element on every slide.
   - **WARNING** if no bottom bar mechanism found

### Check Group 4: Navigation & Timer

10. **Keyboard navigation**: Verify JS handles at minimum `ArrowRight`, `ArrowLeft`, and `Space`.
    - **ERROR** if navigation is missing (presenter cannot advance slides)

11. **Pacing timer**: Verify timer setup — total-time variable (`totalSec`, `totalMinutes`, or equivalent) and a `setInterval`/`requestAnimationFrame` update loop.
    - **WARNING** if missing (timer is a signature feature of this pipeline)

12. **Progress bar**: Verify a progress element and JS that updates its width or value as slides advance.
    - **WARNING** if missing

### Check Group 5: Self-Containment

13. **External dependencies**: Scan all `<link href="...">` and `<script src="...">` tags. Only allowed: `fonts.googleapis.com` and `fonts.gstatic.com`. Any other external CDN load breaks the deck offline.
    - **WARNING** for each disallowed external load

14. **DOCTYPE**: Verify `<!DOCTYPE html>` is present as the first line.
    - **ERROR** if missing

### Check Group 6: Geometric overflow (authoritative)

The word-count thresholds in Group 1 are heuristics; this check measures actual rendered geometry. It is the authoritative test for the min-font-size vs. frame-capacity conflict: fonts are locked, so any frame whose content exceeds its box is a compile defect.

15. **Frame overflow scan**: Phase 3 must inline this QA hook in `deck.html` (dev-only; zero effect on presentation):

    ```js
    window.__qaScan = function(){
      var bad = [];
      document.querySelectorAll('.slide').forEach(function(s, i){
        var wasActive = s.classList.contains('active');
        s.classList.add('active','visible');
        s.querySelectorAll('*').forEach(function(el){
          var cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.position === 'fixed') return;
          if (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4){
            bad.push({ slide: i + 1, el: (el.className || el.tagName).toString().slice(0, 60),
                       over_y: el.scrollHeight - el.clientHeight, over_x: el.scrollWidth - el.clientWidth });
            el.style.outline = '3px solid red';
          }
        });
        if (!wasActive) s.classList.remove('active','visible');
      });
      return bad;
    };
    if (location.search.indexOf('qa=1') > -1) {
      window.addEventListener('load', function(){ setTimeout(function(){
        var r = window.__qaScan();
        console.log('QA overflow report:', JSON.stringify(r, null, 2));
        if (r.length) alert('OVERFLOW on slides: ' + r.map(function(x){ return x.slide; }).join(', ') + ' — offenders outlined in red');
      }, 800); });
    }
    ```

    Run it after compile:
    - **If browser preview tools are available**: load `deck.html`, wait for fonts, execute `window.__qaScan()` via eval, and read the returned array. This is the preferred path — the result is machine-readable.
    - **Otherwise**: instruct the presenter to open `deck.html?qa=1`; overflowing frames are outlined in red and listed in an alert + console. Ask at Gate 3 whether any red outlines appeared.

    - **ERROR** for every element with `over_y > 4` or `over_x > 4`. Resolution is the Fit-First overflow ladder (trim → re-arrange → split), then recompile and re-scan. Never resolve by shrinking fonts below the template scale or adding `overflow:hidden` to the frame — clipping is the same defect with the evidence hidden.

### Screenshot pass (run if preview tools are available)

If `mcp__Claude_Preview__preview_start` is available:
1. Start a local preview of `deck.html`
2. Screenshot the cover slide
3. Navigate to the slide with the highest word count found in Group 1
4. Screenshot
5. Navigate to the takeaway slide (second-to-last content slide)
6. Screenshot

Visually inspect for: text clipped at slide edges, overlapping elements, font too small to read from 3 meters, broken SVG diagrams, wrong background colors. Add findings as WARNINGs.

If preview tools are not available: set `screenshot_pass: "skipped"` in the report and add the note: "Recommend opening `deck.html` in a browser at full screen before presenting — check the densest content slide for overflow."

### Gate behavior

| Severity | What happens |
|---|---|
| **ERROR** | Auto-fix if unambiguous (see policy below). Otherwise: block Gate 3, present error list with a proposed fix per item. Gate opens only after all errors are resolved. |
| **WARNING** | Present with Gate 3 summary. Gate opens with user acknowledgment ("proceed with warnings"). |
| **CLEAN** (no errors, no warnings) | Gate 3 opens directly. |

### Auto-fix policy

Apply automatically, then note the fix in `visual_review.json`:

| Error type | Auto-fix |
|---|---|
| Notes missing on slide N | Pull the corresponding block from `speaker_notes_humanized.md`, embed as `data-notes="..."` on the slide element |
| Missing `<!DOCTYPE html>` | Prepend `<!DOCTYPE html>\n` to the file |

For all other errors (word overflow, bullet overflow, missing navigation): present the error and a proposed fix; apply only with user confirmation.

### Output: `visual_review.json`

```json
{
  "reviewed_at": "<iso8601>",
  "slide_count": 13,
  "errors": [
    {
      "slide": "Slide 7",
      "check": "word_count",
      "value": 127,
      "threshold": 120,
      "message": "Body exceeds 120 words — overflow risk at conference-room viewing distance",
      "auto_fix": null
    }
  ],
  "warnings": [
    {
      "slide": "Slide 3",
      "check": "heading_class",
      "message": "Title uses inline font-size instead of template heading class — visual inconsistency"
    }
  ],
  "screenshot_pass": "skipped | pass | fail",
  "error_count": 0,
  "warning_count": 1,
  "passed": true,
  "recommendation": "approve | revise"
}
```

Save to `<session>/visual_review.json`. Update manifest: `generatedArtifacts.visualReview = { status: "complete", passed: <bool>, errors: <N>, warnings: <N> }`.

---

## Phase 5: Output

1. Write `<session>/deck.html` (single self-contained file).
2. Open in browser: `open <session>/deck.html`
3. Update manifest: `generatedArtifacts.finalPresentation = { status: "complete", htmlPath: "deck.html", template: "<name>", slide_count: N }`.
4. Present HITL Gate 3 summary:
   - Visual QA result: passed/failed, error count, warning count (from `visual_review.json`)
   - Any unresolved warnings (presenter acknowledges before gate opens)
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
