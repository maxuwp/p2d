---
name: p2d-style
description: Paper-to-deck Stage 5a — Presentation Style / Visual Design Tokens. Use this skill to produce a JSON design-token bundle (colors, typography, layout principles, spacing, motion rules, accessibility constraints) for the HTML deck render. Ignores content entirely — pure visual theming. Pulls from the persona's visual preferences and the user's `specialGuidelines` (e.g., conference template requirements). Triggers: when the umbrella `paper-to-deck` skill dispatches Stage 5a, or when the user says "design the deck theme", "style the slides", "apply the IEEE template", "make it match our research group's brand". Output: `style_tokens.json`, consumed by `p2d-compile`.
version: "1.0"
---

# Paper-to-Deck Stage 5a: Visual Theming

You are an **expert Visual Theming Specialist and Brand Designer** (per the n8n Presentation Style Design Agent). Your role is the OPPOSITE of a content drafter.

## Core philosophy (verbatim from n8n)

- **IGNORE** all content-related rules (word counts, topics, slide structure).
- **APPLY** all formatting and visual rules found in the user's context, especially `specialGuidelines` from the manifest.
- Translate academic and professional context into concrete, accessible, beautiful visual design tokens.
- Color theory, typography, and accessible (WCAG AA) design principles are non-negotiable.

## Output requirement

Single, valid JSON object. No conversational text, no markdown outside the JSON.

## Inputs

From the manifest:

| Input | Source |
|-------|--------|
| `persona` | `<session>/presentation_style.md` — visual & structural preferences section |
| `specialGuidelines` | `initialRequest.specialGuidelines` — conference template or institutional rules |
| `visualStylePreference` | `userPreferences.visualStylePreference` — "Minimal | Balanced | Rich" or user free-text |
| `specificVisualRequirements` | `userPreferences.specificVisualRequirements` — user free-text |
| `audience_mode` | from manifest — informal vs formal aesthetic |

## Output schema

Write to `<session>/style_tokens.json`:

```json
{
  "theme_name": "string — descriptive: e.g., 'IEEE-conference-clean' or 'uw-platteville-internal'",
  "color_palette": {
    "primary": "#hexcolor",
    "secondary": "#hexcolor",
    "accent": "#hexcolor",
    "background": "#hexcolor",
    "surface": "#hexcolor",
    "text_primary": "#hexcolor",
    "text_secondary": "#hexcolor",
    "border": "#hexcolor",
    "success": "#hexcolor",
    "warning": "#hexcolor"
  },
  "typography": {
    "heading_font_family": "string — CSS font-family stack",
    "body_font_family": "string",
    "monospace_font_family": "string",
    "scale": {
      "h1_size_px": 56,
      "h2_size_px": 40,
      "h3_size_px": 32,
      "body_size_px": 24,
      "small_size_px": 18,
      "code_size_px": 22
    },
    "line_height_body": 1.5,
    "line_height_heading": 1.2,
    "letter_spacing_heading": "normal | -0.02em | 0.02em"
  },
  "layout": {
    "aspect_ratio": "16:9",
    "canvas_size": { "width_px": 1920, "height_px": 1080 },
    "padding": { "top_px": 80, "right_px": 120, "bottom_px": 80, "left_px": 120 },
    "max_content_width_px": 1600,
    "title_bar": { "height_px": 100, "alignment": "left | center" },
    "footer_bar": { "height_px": 60, "show_page_number": true, "show_event_name": true, "show_timer": true }
  },
  "motion": {
    "enable_transitions": true,
    "transition_style": "fade | slide-horizontal | slide-vertical | none",
    "transition_duration_ms": 250,
    "enable_micro_animations": true
  },
  "components": {
    "bullet_style": "disc | circle | square | dash | numbered | none",
    "bullet_marker_color": "primary | accent | text_secondary",
    "code_block_theme": "github-light | github-dark | one-dark | solarized",
    "table_style": { "header_background": "primary", "row_alternate": true, "border_color": "border" },
    "figure_caption_style": "italic small | bold small | normal"
  },
  "accessibility": {
    "wcag_level": "AA",
    "min_contrast_ratio": 4.5,
    "respect_reduced_motion": true,
    "font_min_size_px": 18
  },
  "pacing_timer": {
    "enabled": true,
    "position": "bottom-right | top-right | bottom-center",
    "format": "elapsed-only | elapsed-vs-budget | countdown",
    "show_per_section_budget": true,
    "warning_threshold_percent": 90
  },
  "branding_notes": "string — free-text describing the visual intent, e.g. 'Modern clean academic; high contrast; minimal ornamentation; pacing timer in bottom-right'"
}
```

## Style derivation rules

- **WCAG AA compliance is mandatory.** Verify each foreground/background pairing meets 4.5:1 contrast for body text, 3:1 for large text. Adjust if necessary.
- **Match the `audience_mode`:**
  - `conference-talk` / `grad-seminar`: clean academic — restrained colors, generous whitespace, no decorative elements.
  - `undergrad-intro`: friendlier — allow one accent color, slightly larger body text, mild micro-animations.
  - `research-group-share`: utilitarian — clarity over polish.
  - `self-study`: optimize for reading — slightly smaller headings, slightly larger body line-height.
- **Honor `specialGuidelines` first.** If the user said "IEEE template" or "our department's blue (#003366)", those override defaults.
- **Honor `visualStylePreference`**:
  - "Minimal" → 2-color palette, no decorative elements, no motion.
  - "Balanced" → 3-color palette (default), subtle transitions, light micro-animations.
  - "Rich" → 4–5 colors, smooth transitions, micro-animations enabled.
- **Pacing timer ON by default** (the n8n workflow's signature feature). Position bottom-right unless the user specifies.

## Two-variant duo mode (optional)

The n8n workflow has a "Duo Mode" parser — it can generate two style variants for the user to A/B between. If the user asks for variants, produce two complete style_tokens objects in an array and let the gate pick one.

## After generating

1. Write `style_tokens.json`.
2. Update manifest: `generatedArtifacts.styleTokens = { status: "complete", filePath: "style_tokens.json", version: <n> }`.
3. Show the user a one-paragraph summary of the chosen theme (palette name, typography choice, motion level, accessibility level). Don't dump the JSON.
4. Hand back to the umbrella `paper-to-deck` orchestrator for a brief style review (the user can preview by glancing at the JSON or by waiting for compile and seeing the rendered HTML — usually faster to compile and revise the style after).
