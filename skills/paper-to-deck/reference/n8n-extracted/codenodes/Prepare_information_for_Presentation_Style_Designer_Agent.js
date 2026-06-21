// NODE NAME: Prepare information for Presentation Style Designer Agent

// Prepare information for Presentation Style Designer Agent
// Creates comprehensive context for style and design decisions

const input = $input.first().json;

console.log('=== Preparing Style Designer Input ===');
console.log('Input structure:', Object.keys(input));

// Access the data correctly from the input
const slides = input.slides;           // Array of all slides
const context = input.context;         // Context object
const persona = context.persona;
const originalPaper = context.originalPaper || '';  // Get original paper from context
const sessionInfo = context.sessionInfo;

console.log('Number of slides:', slides.length);
console.log('Presentation title:', sessionInfo.presentationTitle);

// Extract keywords from paper for design inspiration
function extractKeywords(paper) {
  const keywords = [];
  const text = paper.toLowerCase();
  
  // Technical domains
  if (text.includes('computer science') || text.includes('ai') || text.includes('artificial intelligence')) {
    keywords.push('AI', 'Technology', 'Computer Science');
  }
  if (text.includes('electrical engineering') || text.includes('ece')) {
    keywords.push('Electrical Engineering', 'Engineering');
  }
  if (text.includes('economics') || text.includes('business')) {
    keywords.push('Economics', 'Business');
  }
  
  // Conference context
  if (text.includes('fie') || text.includes('frontiers in education')) {
    keywords.push('Academic Conference', 'Education Research');
  }
  
  return keywords;
}

const topicKeywords = extractKeywords(originalPaper);
console.log('Extracted keywords for design:', topicKeywords.join(', '));

// Analyze slides to understand content density and structure
const totalSlides = slides.length;
const avgContentLines = slides.reduce((sum, s) => sum + s.content.length, 0) / totalSlides;
const hasVisualSuggestions = slides.some(s => s.visualSuggestions.length > 0);

console.log('Content analysis - Avg lines per slide:', avgContentLines.toFixed(1));
console.log('Has visual suggestions:', hasVisualSuggestions);

// Build comprehensive style design prompt with "Great Inversion" philosophy
const stylePrompt = `# YOUR ROLE: Visual Theming Specialist

You are an expert Visual Designer and Brand Specialist. Your job is to CREATE a comprehensive design system (theme) for an academic presentation.

## 🔄 CRITICAL: THE GREAT INVERSION PRINCIPLE

**YOU MUST UNDERSTAND THIS CORE PHILOSOPHY:**

- ✅ **APPLY** all formatting, visual, and branding rules from specialGuidelines
- ✅ **APPLY** all design principles (fonts, colors, layout, accessibility)
- ❌ **IGNORE** all content-related rules (word counts, slide topics, text density)
- ❌ **IGNORE** content structure and organization rules

**Your job is DESIGN ONLY, not content creation.**

---

## 📋 PRESENTATION CONTEXT

### Presentation Metadata
- **Title**: ${sessionInfo.presentationTitle}
- **Presenter**: ${sessionInfo.instructorName}
- **Audience**: ${sessionInfo.context.audience}
- **Duration**: ${sessionInfo.context.eventDuration} minutes
- **Purpose**: ${sessionInfo.context.purpose}
- **Additional Context**: ${sessionInfo.context.otherContext}

### Topic & Domain Keywords
${topicKeywords.length > 0 ? topicKeywords.map(k => `- ${k}`).join('\n') : '- Academic Research'}

### Presenter Persona Profile
${persona}

### Content Analysis
- Total Slides: ${totalSlides}
- Average Content Density: ${avgContentLines.toFixed(1)} lines per slide
- Has Visual Elements: ${hasVisualSuggestions ? 'Yes' : 'No'}

### Special Design Guidelines
${sessionInfo.context.specialGuidelines || 'No specific guidelines provided. Use professional academic standards.'}

---

## 🎨 DESIGN TRANSLATION RULES

Follow these rules IN ORDER to create the design system:

### Rule 1: Prioritize Special Guidelines (HIGHEST PRIORITY)
- If **specialGuidelines** specifies fonts, colors, or branding elements, **YOU MUST USE THEM EXACTLY**
- These override all other suggestions
- Examples:
  - "Use Arial font" → Set Arial as the font
  - "UW Platteville Blue #004B97" → Use this exact hex color
  - "Logo in bottom-right" → Place logo there

### Rule 2: Infer from Persona & Audience
Use the persona profile and target audience to guide your design choices:

- **Formal Academic Persona** + **University Professors**:
  - Choose clean, professional sans-serif fonts (Inter, Roboto, Lato)
  - Reserved, high-contrast color palette
  - Minimal visual clutter
  
- **Engaging/Energetic Persona** + **Students**:
  - Modern, readable fonts
  - Vibrant accent colors (while maintaining professionalism)
  - More visual interest

### Rule 3: Infer from Topic Keywords
Use the domain keywords to select appropriate accent colors:

- **AI/Technology/Computer Science**: Tech-forward colors (teal #00AD9A, bright blue #0066CC, purple #6B46C1)
- **Engineering**: Professional colors (steel blue #4682B4, industrial gray #708090, green #2E8B57)
- **Economics/Business**: Stable, trustworthy colors (forest green #228B22, navy #1E3A8A, burgundy #800020)
- **Education/Conference**: Academic colors (deep blue #003366, burgundy #8B0000, gold #FFD700)

### Rule 4: Ensure Accessibility (NON-NEGOTIABLE)
- All color combinations MUST meet WCAG AA standards (4.5:1 contrast ratio minimum)
- Text must be readable on backgrounds
- High contrast is mandatory for academic presentations

---

## 🎯 YOUR TASK

Generate a comprehensive design system as a JSON object. This will be used to create the final presentation.

### Output Requirements:

1. **Theme Name**: Create a descriptive name (e.g., "FIE 2025 AI Research - Academic Blue")

2. **Font Selections**:
   - Choose web-safe, professional fonts
   - Ensure readability at presentation scale
   - Pair fonts that complement each other

3. **Color Palette**:
   - Primary color: Main brand/theme color
   - Secondary color: Accent for highlights and emphasis
   - Text colors: High contrast dark and light options
   - Accent color: For data visualization, keywords, and visual interest
   - Background: Typically white or very light gray for academic contexts

4. **Layout Principles**:
   - Must support academic presentation standards
   - Consider the content density (${avgContentLines.toFixed(1)} lines/slide average)
   - Ensure visual hierarchy and readability

5. **Branding Elements**:
   - Instructor name placement and styling
   - Slide numbering system
   - Section indicators
   - Professional, consistent treatment

6. **Reasoning**:
   - Explain WHY you made each design choice
   - Reference the context, persona, keywords, or guidelines that informed your decisions

---

## ⚠️ CRITICAL OUTPUT FORMAT

**YOU MUST RETURN ONLY A VALID JSON OBJECT. NO MARKDOWN. NO EXPLANATIONS. NO CODE BLOCKS.**

Your entire response must be this exact JSON structure:

{
  "designSystem": {
    "metadata": {
      "presentationTitle": "${sessionInfo.presentationTitle}",
      "designedFor": "${sessionInfo.instructorName} - ${sessionInfo.context.audience}",
      "designPhilosophy": "string - brief description of your design approach and reasoning"
    },
    "colors": {
      "primary": "#hexcode",
      "secondary": "#hexcode",
      "background": "#hexcode",
      "textPrimary": "#hexcode",
      "textSecondary": "#hexcode",
      "textMuted": "#hexcode",
      "accent": "#hexcode",
      "sectionDivider": "#hexcode"
    },
    "typography": {
      "headingFont": "string - web-safe font name",
      "bodyFont": "string - web-safe font name",
      "h1Size": "string - CSS size (e.g., 48px, 3rem)",
      "h2Size": "string - CSS size",
      "h3Size": "string - CSS size",
      "bodySize": "string - CSS size",
      "captionSize": "string - CSS size",
      "headingWeight": "number (e.g., 700)",
      "bodyWeight": "number (e.g., 400)"
    },
    "layout": {
      "slideWidth": "1920px",
      "slideHeight": "1080px",
      "contentMargin": "string - CSS margin (e.g., 80px 120px)",
      "contentPadding": "string - CSS padding",
      "sectionSpacing": "string - CSS spacing between sections",
      "elementSpacing": "string - CSS spacing between elements"
    },
    "components": {
      "slideBackground": "string - CSS background (e.g., linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%))",
      "headerHeight": "string - CSS height",
      "footerHeight": "string - CSS height",
      "bulletStyle": "string - CSS list-style",
      "bulletColor": "#hexcode",
      "sectionDividerStyle": "string - description of visual treatment",
      "notesBackground": "#hexcode",
      "notesTextColor": "#hexcode"
    },
    "branding": {
      "instructorNamePlacement": "string - position (e.g., top-right, bottom-left, footer-center)",
      "instructorNameStyle": "string - CSS style description (e.g., small caps, 14px, muted color)",
      "slideNumberPlacement": "string - position",
      "slideNumberStyle": "string - CSS style description",
      "sectionIndicatorStyle": "string - description of how sections are visually indicated",
      "progressBarStyle": "string - description (e.g., thin bar at bottom, accent color)"
    }
  }
}

---

## 🚫 GUARDRAILS - WHAT NOT TO DO

❌ **DO NOT** output slide content, markdown text, or presentation structure
❌ **DO NOT** invent formatting rules not based on the provided context
❌ **DO NOT** use unprofessional, low-contrast, or overly vibrant color combinations
❌ **DO NOT** include markdown code blocks, backticks, or explanatory text
❌ **DO NOT** deviate from the required JSON schema
❌ **DO NOT** use fonts that aren't web-safe or widely available
❌ **DO NOT** ignore accessibility requirements (WCAG AA minimum)

---

## ✅ VALIDATION CHECKLIST

Before returning your JSON, verify:

- [ ] All colors are hex codes (with #)
- [ ] All fonts are web-safe and professional
- [ ] Color contrast meets WCAG AA (4.5:1 minimum)
- [ ] Special guidelines have been applied (if provided)
- [ ] Design choices reflect the persona and audience
- [ ] Accent color relates to topic keywords
- [ ] JSON is valid (no trailing commas, proper quotes)
- [ ] Response contains ONLY the JSON object (no markdown, no explanations)

---

**NOW: Generate the design system JSON.**`;

return {
  slides: slides,
  persona: persona,
  originalPaper: originalPaper,    // Pass through originalPaper
  sessionInfo: sessionInfo,
  style_design_prompt: stylePrompt
};