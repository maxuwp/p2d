// NODE NAME: Prepare Lecture Agent Inputs

// ===========================================
// PREPARE LECTURE AGENT INPUTS - COMPLETE FIX
// ===========================================
// This node prepares prompts for the AI content generation agent
// Handles both first-run generation and revision loops
// ===========================================

// ===========================================
// MARKDOWN STRUCTURE REFERENCE
// ===========================================
// This workflow generates two markdown files with specific structures:
//
// SLIDES FILE STRUCTURE:
// # (H1) - Document title (presentation title)
// <!-- SECTION X: Section Title --> - Parser section markers
// ## section_0X. Section X: Full Section Title - Section dividers (skipped by parser)
// ### X.Y Slide Title - Individual slides (MAIN SLIDE MARKER for parser)
// #### X.Y.Z Point text - Bullet points within slides
// (PPT: ...) - Visual suggestions
//
// NOTES FILE STRUCTURE:
// # (H1) - Document title (presentation notes)
// <!-- SECTION X: Section Title --> - Parser section markers (MUST match slides)
// ## Slide X.Y - Slide Title - Individual slide notes headers (human-readable, skipped by parser)
// [Prose paragraphs] - Conversational notes content (captured by parser as section block)
//
// CRITICAL FOR PARSER COMPATIBILITY:
// - Both files MUST use identical <!-- SECTION X: Title --> comments
// - Slides MUST use ### X.Y format for slide numbers
// - Notes MUST use ## Slide X.Y format for consistency (even though parser ignores these headers)
// - Section X numbers MUST be consistent (e.g., section_02 = Section 2 = <!-- SECTION 2: -->)
// - All slides in a section share the section's notes block
// - The parser skips ## headers in notes, treating all content as one block per section
// ===========================================

console.log('=== Preparing Content Generation Prompt ===');

const currentItem = $input.first().json;
const isRevision = currentItem.is_revision || false;

console.log('Run type:', isRevision ? 'REVISION LOOPBACK' : 'FIRST RUN');

// --- Consistent Data Extraction ---
let sectionDataForPrompt; // Holds the specific section's outline/details
let currentSectionSlides; // Holds the specific section's slide outline structure
let staticData = {}; // Holds context, paperAnalysis, persona etc.

// Extract Static Data (Should be present on both paths)
staticData = {
    presentationTitle: currentItem.presentationTitle,
    instructorName: currentItem.instructorName,
    sessionFolder: currentItem.sessionFolder,
    sessionId: currentItem.sessionId,
    context: currentItem.context,
    paperAnalysis: currentItem.paperAnalysis,
    persona: currentItem.persona || '',
    originalPaper: currentItem.originalPaper,
    manifestPath: currentItem.manifestPath,
    filePaths: currentItem.filePaths,
    all_sections: currentItem.all_sections || currentItem.sections || []
};

// Defensive check for critical static data (like context)
if (!staticData.context) {
    const potentialContext = currentItem.sections?.context || currentItem.section_metadata?.context;
    if (potentialContext) {
        staticData.context = potentialContext;
        console.warn("Recovered context from nested structure.");
    } else if (isRevision && currentItem.context) {
        staticData.context = currentItem.context;
    } else {
        console.error("CRITICAL ERROR: 'context' object is missing from input item:", currentItem);
        throw new Error(`'context' object is missing. Cannot proceed.`);
    }
}

if (isRevision) {
    // LOOPBACK PATH
    sectionDataForPrompt = currentItem.section_metadata; // Metadata object
    currentSectionSlides = currentItem.slides || []; // Outline structure array

    if (!sectionDataForPrompt) {
        throw new Error("Loopback Error: 'section_metadata' is missing.");
    }
    console.log(`LOOPBACK: Section ID ${sectionDataForPrompt.section_id}, Iteration: ${sectionDataForPrompt.current_iteration}`);

} else {
    // FIRST RUN PATH (Input from Loop Over Sections)
    sectionDataForPrompt = currentItem.sections;

    if (!sectionDataForPrompt || typeof sectionDataForPrompt.section_index === 'undefined') {
        console.error("Invalid data structure from Loop node. Expected section data under 'sections' key. Input:", currentItem);
        throw new Error("First Run Error: 'sections' object is missing or invalid in input item.");
    }
    currentSectionSlides = sectionDataForPrompt.slides || [];
    console.log(`FIRST RUN: Section ID ${sectionDataForPrompt.section_id}, Index: ${sectionDataForPrompt.section_index}`);
}

// --- Extract Details from the Correct Source ---
const sectionIndex = sectionDataForPrompt.section_index;
const sectionId = sectionDataForPrompt.section_id;
const subtopicTitle = sectionDataForPrompt.subtopic_title;
const learningObjectives = sectionDataForPrompt.learning_objectives || currentItem.learning_objectives || [];
const slideCount = sectionDataForPrompt.slide_count;
const targetWordCount = sectionDataForPrompt.target_word_count;
const duration = sectionDataForPrompt.duration_minutes;
const currentIteration = sectionDataForPrompt.current_iteration || 1;
const maxIterations = sectionDataForPrompt.max_iterations || 3;

// ===================================================================
// Extract Special Guidelines
// ===================================================================
const specialGuidelines = staticData.context?.specialGuidelines || null;

// --- Build Prompt Components (Using extracted data) ---

// Handle revision context
let revisionContext = '';
if (isRevision) {
    const editorReview = currentItem.editor_review;
    const humanFeedback = sectionDataForPrompt.revision_context || currentItem.revision_context;

    if (humanFeedback) {
        revisionContext = humanFeedback;
        console.log('Using HUMAN revision feedback');
    } else if (editorReview && (editorReview.recommendation === 'revise' || editorReview.recommendation === 'reject')) {
        revisionContext = `\n${'='.repeat(80)}\n## 🤖 AI REVIEWER FEEDBACK - REQUIRED CHANGES (Iteration ${currentIteration})\n${'='.repeat(80)}\n**AI Score**: ${editorReview.score}/100\n**AI Feedback**:\n${(editorReview.feedback || []).map(f => `- ${f}`).join('\n')}\n**Required Improvements**:\n${(editorReview.improvements || []).map(i => `- ${i}`).join('\n')}\n${'='.repeat(80)}\n**CRITICAL**: Address all 'Required Improvements'. Re-generate the entire section content based on this feedback AND the original instructions below.\n${'='.repeat(80)}\n`;
        console.log('Using AI revision feedback');
    }
}

// Build Paper Context
let paperContextSection = '';
if (staticData.paperAnalysis && staticData.paperAnalysis.main_contribution) {
    const contributions = Array.isArray(staticData.paperAnalysis.main_contribution) ? staticData.paperAnalysis.main_contribution : [staticData.paperAnalysis.main_contribution];
    const objectives = Array.isArray(staticData.paperAnalysis.main_objective) ? staticData.paperAnalysis.main_objective : [staticData.paperAnalysis.main_objective];
    
    const references = staticData.paperAnalysis.references || staticData.originalPaper?.references || [];
    const referencesSection = references.length > 0 ? `\n**Source References to Use:**\n${references.map(ref => `- ${ref}`).join('\n')}` : '';
    
    paperContextSection = `\n## RESEARCH CONTEXT\n**Overall Paper Contributions:**\n${contributions.map(c => `- ${c}`).join('\n')}\n**Overall Paper Objectives:**\n${objectives.map(o => `- ${o}`).join('\n')}\n**This Section's Focus:** Align with '${sectionDataForPrompt.paper_section_alignment || subtopicTitle}'${referencesSection}`;
} else {
    paperContextSection = `\n## PRESENTATION CONTEXT\nFocus on ${subtopicTitle} within the broader topic of ${staticData.presentationTitle}.`;
}

// Build Teaching Style
const escapedPersonaText = staticData.persona ? staticData.persona.replace(/`/g, '\\`') : '';
const personaLines = escapedPersonaText.split('\n');
const styleLine = personaLines.length > 2 ? personaLines[2].trim() : 'Structured, academic approach.';
const elementsLine = personaLines.length > 6 ? personaLines[6].trim() : 'Clear explanations, examples.';
const toneLine = personaLines.length > 18 ? personaLines[18].trim() : 'Formal, academic, conversational notes.';
let teachingStyle = `\n## TEACHING STYLE\n- **Instructor**: Dr. ${staticData.instructorName}\n- **Style**: ${styleLine}\n- **Key Elements**: ${elementsLine}\n- **Tone**: ${toneLine}\n- **IMPORTANT**: This persona heavily uses **ACRONYMS**. Try to create one.`;

// Build Learning Objectives
const finalObjectives = learningObjectives.length > 0 ? learningObjectives : [`Understand ${subtopicTitle}`];

// ===================================================================
// Build Special Guidelines Section
// ===================================================================
let guidelinesSection = '';
if (specialGuidelines) {
    guidelinesSection = `

## SPECIAL GUIDELINES
The following guidelines have been provided. You MUST carefully distinguish between:
- **CONTENT RULES** (apply these): Word limits, topic requirements, specific examples to include, pedagogical approaches, etc.
- **FORMATTING RULES** (ignore these): Font sizes, colors, spacing, visual layout, etc.

**Guidelines provided:**
\`\`\`
${specialGuidelines}
\`\`\`

**Your responsibility:**
1. APPLY all content-related rules (e.g., "limit text to ≤20 words per slide", "include case study X")
2. IGNORE all formatting-related rules (e.g., "use 18pt font", "high contrast colors")
3. You are generating TEXT CONTENT only - visual formatting will be handled later in the workflow
`;
}

// Calculate Word Count Range
const wordRange = `${Math.round(targetWordCount * 0.9)}-${Math.round(targetWordCount * 1.1)}`;

// ===================================================================
// SECTION NUMBER for Parser Compatibility
// Extract the numeric section number from section_id (e.g., "section_02" -> 2)
// ===================================================================
const sectionNumericId = parseInt(sectionId.replace('section_', '').replace(/^0+/, '')) || (sectionIndex + 1);

// ===================================================================
// Build Slide and Notes Templates
// ===================================================================

// FIRST RUN TEMPLATE
const firstRunSlideTemplate = currentSectionSlides && currentSectionSlides.length > 0 ? 
`<!-- SECTION ${sectionNumericId}: ${subtopicTitle} -->
## ${sectionId}. ${subtopicTitle}

${currentSectionSlides.map((slide, idx) => `
### ${slide.slide_number} ${slide.slide_title}
${(slide.key_points || ['Main concept']).map((point, pIdx) => `#### ${slide.slide_number}.${pIdx + 1} ${point.split(/[:–-]/)[0].trim()}: [Complete concise fragment - DO NOT add sub-bullets unless exceptional case]`).join('\n')}
(PPT: ${slide.visual_idea || 'Relevant visual for ' + slide.slide_title})
`).join('\n')}` 
: `<!-- SECTION ${sectionNumericId}: ${subtopicTitle} -->
## ${sectionId}. ${subtopicTitle}

### ${sectionId}.1 Introduction
#### ${sectionId}.1.1 Overview: ${subtopicTitle} fundamentals
(PPT: Title slide visual)`;

const firstRunNotesTemplate = currentSectionSlides && currentSectionSlides.length > 0 ?
`<!-- SECTION ${sectionNumericId}: ${subtopicTitle} -->

${currentSectionSlides.map((slide, idx) => `
## Slide ${slide.slide_number} - ${slide.slide_title}
[${Math.round(targetWordCount / (slideCount || 1))} words of conversational, first-person explanation for Dr. ${staticData.instructorName}. Elaborate on these key points: ${(slide.key_points || ['Main concept']).join(', ')}.]
[Include interaction cues like [ASK CLASS], [PAUSE], [DEMO], or [POLL].]
[Provide a smooth transition sentence to the next slide's topic.]
`).join('\n')}` 
: `<!-- SECTION ${sectionNumericId}: ${subtopicTitle} -->

## Slide ${sectionId}.1 - Introduction
[~${targetWordCount} words of conversational intro notes for Dr. ${staticData.instructorName} covering ${subtopicTitle}. Include interaction cues and a transition.]`;

// REVISION TEMPLATE - EXPLICIT STRUCTURE WITH CORRECT NUMBERING
const revisionSlideTemplate = currentSectionSlides && currentSectionSlides.length > 0 ?
`<!-- SECTION ${sectionNumericId}: ${subtopicTitle} -->
## ${sectionId}. ${subtopicTitle}

[CRITICAL: Generate ${slideCount} slides with the EXACT numbering shown below. Create completely NEW #### key points that address all reviewer feedback, especially regarding verbosity and structure.]

${currentSectionSlides.map((slide, idx) => `
### ${slide.slide_number} ${slide.slide_title}
[Generate 3-5 NEW #### points for this slide, numbered as shown:]
#### ${slide.slide_number}.1 [NEW key point addressing feedback - single line, no sub-bullets]
#### ${slide.slide_number}.2 [NEW key point addressing feedback - single line, no sub-bullets]
#### ${slide.slide_number}.3 [NEW key point addressing feedback - single line, no sub-bullets]
(PPT: ${slide.visual_idea || 'Relevant visual for ' + slide.slide_title})
`).join('\n')}`
: firstRunSlideTemplate;

const revisionNotesTemplate = currentSectionSlides && currentSectionSlides.length > 0 ?
`<!-- SECTION ${sectionNumericId}: ${subtopicTitle} -->

[CRITICAL: Generate notes for ${slideCount} slides with the EXACT numbering shown below. Create completely NEW conversational notes that address all reviewer feedback.]

${currentSectionSlides.map((slide, idx) => `
## Slide ${slide.slide_number} - ${slide.slide_title}
[~${Math.round(targetWordCount / (slideCount || 1))} words - NEW conversational, first-person explanation for Dr. ${staticData.instructorName} that addresses reviewer feedback.]
[Include interaction cues: [ASK CLASS], [PAUSE], [DEMO], or [POLL]]
[Smooth transition to next topic]
`).join('\n')}`
: firstRunNotesTemplate;

// --- Build Final Prompt ---
const generationPrompt = `
# LECTURE CONTENT GENERATION
${revisionContext ? revisionContext : ''}
## 1. TASK OVERVIEW
Generate comprehensive lecture materials for section: **${subtopicTitle}** (Section ID: ${sectionId})
Create ${slideCount} slides with corresponding instructor notes (~${targetWordCount} words) based *only* on the provided context and structure.

## 2. SECTION DETAILS
- **Section**: ${sectionIndex + 1} of the presentation
- **Section Number for Parser**: ${sectionNumericId}
- **Topic**: ${subtopicTitle}
- **Duration**: ${duration ? duration.toFixed(1) : 'N/A'} minutes
- **Slides Required**: ${slideCount}
- **Target Word Count (Notes)**: ${wordRange} words

## 3. AUDIENCE & CONTEXT
**Audience**: ${staticData.context?.audience || 'University Students'}
**Prerequisites**: ${staticData.context?.prerequisites || 'Basic understanding of the field'}
**Purpose**: ${staticData.context?.purpose || 'To educate on the topic'}
${staticData.context?.otherContext ? `**Additional Context**: ${staticData.context.otherContext}` : ''}

## 4. CONTENT & STYLE GUIDANCE
${paperContextSection}
${teachingStyle}
${guidelinesSection}

## 5. SECTION LEARNING OBJECTIVES
${finalObjectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

## 6. GENERATION INSTRUCTIONS & OUTPUT FORMAT

**CRITICAL OUTPUT FORMAT (FOLLOW EXACTLY)**:
Your response MUST contain THREE distinct sections using these EXACT markers and markdown structure:

---SLIDES START---
${isRevision ? revisionSlideTemplate : firstRunSlideTemplate}
---SLIDES END---

---NOTES START---
${isRevision ? revisionNotesTemplate : firstRunNotesTemplate}
---NOTES END---

---REFERENCES---
${staticData.paperAnalysis?.references || staticData.originalPaper?.references ? '[Include the source references provided in the RESEARCH CONTEXT section above. Format them properly in academic citation style.]' : '[No source references were provided in the context. Leave this section empty as instructed.]'}
---REFERENCES END---

## 7. SLIDE STRUCTURE PHILOSOPHY (HIGHEST PRIORITY)

**Your primary goal is to convey each key point on a single \`####\` line.**

- **AVOID \`-\` sub-bullets.** Do not use them by default. They are for exceptions only.
- The \`####\` line is NOT just a title; it IS the content. Make it a complete, concise fragment (e.g., "AI Imperative: Role, Challenges, & Opportunities").
- **EXCEPTION**: Only use \`-\` sub-bullets when listing two or more distinct items that are essential for a direct comparison (e.g., Pros/Cons, Method A/Method B) or a named multi-step list.

**Example (Excellent - No sub-bullets):**
\`\`\`
#### 2.1 The AI Imperative: Role, Challenges, & Opportunities
#### 2.2 Interdisciplinary Approach: CS, EE, & Economics
\`\`\`

**Example (Bad - Unnecessary sub-bullets):**
\`\`\`
#### 2.1 The AI Imperative
- Role of AI
- Challenges, opportunities
\`\`\`

## 8. MARKDOWN HIERARCHY REQUIREMENTS

**CRITICAL - You MUST follow this exact structure:**

1. **Parser Section Marker:**
   - Use EXACTLY ONE \`<!-- SECTION ${sectionNumericId}: ${subtopicTitle} -->\` comment at the start
   - This is used by the parser to identify which section the content belongs to

2. **Section Header (## level):**
   - Use EXACTLY ONE \`##\` header: \`## ${sectionId}. ${subtopicTitle}\`
   - This appears ONCE at the very start of ---SLIDES START---

3. **Slide Titles (### level):**
   - Each slide gets ONE \`###\` header: \`### [Number] [Title]\`
   - Example: \`### 2.1 The Core Problem\`
   - **CRITICAL**: Use the EXACT slide numbers provided in the template above

4. **Key Points (#### level):**
   - Each main point under a slide uses \`####\`: \`#### [Number].[Index] [Point Title]\`
   - Example: \`#### 2.1.1 What is the Gap?\`
   - **CRITICAL**: Use the EXACT numbering format shown in the template

5. **Elaboration Bullets (- level):**
   - **Use ONLY as an exception**, as defined in Section 7
   - If used, you MUST have **two or more** sub-bullets
   - Bullets MUST be short **fragments** (2-8 words), NOT full sentences
   - **CRITICAL SLIDE VERBOSITY**: The TOTAL word count for a single slide (all text under one \`###\` header) MUST NOT exceed 30 words
   - All detailed explanations and full sentences MUST go into the ---NOTES START--- section

6. **Visual Suggestions:**
   - After ALL \`####\` blocks for a slide, add ONE line: \`(PPT: [suggestion])\`

7. **Notes Structure:**
   - Each slide's notes use \`##\`: \`## Slide [Number] - [Title]\`
   - **CRITICAL**: Use the EXACT slide numbers (e.g., \`## Slide 2.1 - Title\`, NOT \`## Slide 2 - Title\`)
   - Write in conversational, first-person prose (not bullets)
   - The parser groups all notes within a \`<!-- SECTION X -->\` block as one continuous text
   - However, the \`## Slide X.Y\` headers provide human readability and editor compatibility

**Incorrect hierarchy will result in automatic rejection.**

## 9. QUALITY CHECKLIST
- [ ] ALL content is inside the correct START/END markers.
- [ ] Slides strictly follow the \`<!-- SECTION X -->\` → \`##\` Section → \`###\` Slide → \`####\` Key Point → \`-\` Bullet structure.
- [ ] Visual suggestions (PPT:) included once per \`###\` slide section.
- [ ] Notes use \`<!-- SECTION ${sectionNumericId} -->\` marker at the start.
- [ ] Notes use \`## Slide X.Y - Title\` structure (matching slide numbers EXACTLY) and are in the ${wordRange} word range.
- [ ] Notes have interaction cues and a conversational tone for Dr. ${staticData.instructorName}.
- [ ] All learning objectives addressed.
- [ ] **Special Guidelines - Content Rules Applied:** All content-related rules from [Special Guidelines] are followed
- [ ] **Special Guidelines - Formatting Rules Ignored:** All formatting-related rules are correctly ignored
- [ ] **No fabricated references.** References section is empty if no real sources were used.

## 10. COMMON MISTAKES TO AVOID
1. ❌ Using multiple \`##\` headers for slides (should be \`###\`)
2. ❌ Using \`###\` for key points (should be \`####\`)
3. ❌ Missing the \`(PPT: ...)\` visual suggestion for each slide
4. ❌ Using bullet points in notes (should be prose paragraphs)
5. ❌ Fabricating references to sources not actually consulted
6. ❌ Applying font/color guidelines (you're generating text only)
7. ❌ Ignoring word-count or content guidelines from [Special Guidelines]
8. ❌ **WRITING FULL SENTENCES in slide bullets. Use short fragments ONLY.**
9. ❌ **EXCEEDING 30 WORDS for an entire slide's content. Move details to notes.**
10. ❌ **ADDING UNNECESSARY SUB-BULLETS. Default to single \`####\` lines. Only use \`-\` bullets for essential comparisons/lists.**
11. ❌ **Using wrong slide numbers in notes** (e.g., \`## Slide 2\` instead of \`## Slide 2.1\`)
12. ❌ **Missing the \`<!-- SECTION ${sectionNumericId}: ${subtopicTitle} -->\` parser markers**

BEGIN GENERATION:
`;

console.log(`✓ Prompt generated for Section ${sectionId}:`, generationPrompt.length, 'chars');

// --- Prepare Output ---

// Metadata SPECIFIC TO THIS SECTION for the current run
const output_section_metadata = {
    section_index: sectionIndex,
    section_id: sectionId,
    subtopic_title: subtopicTitle,
    slide_count: slideCount,
    target_word_count: targetWordCount,
    duration_minutes: duration,
    current_iteration: currentIteration,
    max_iterations: maxIterations,
    instructorName: staticData.instructorName,
    paper_section_alignment: sectionDataForPrompt.paper_section_alignment || null,
    revision_context: isRevision ? revisionContext : null,
    human_revision_count: sectionDataForPrompt.human_revision_count || currentItem.human_revision_count || 0
};

console.log(`OUTPUT: Section ${sectionId}, Iteration ${currentIteration}`);

// Return a standardized structure containing both static and dynamic data
return {
    // --- Static Data (Passed Through Consistently) ---
    ...staticData,

    // --- Dynamic Data for THIS Specific Run/Section ---
    generation_prompt: generationPrompt,
    section_metadata: output_section_metadata,
    slides: currentSectionSlides,

    // --- Control/Context Flags from previous step (if revision) ---
    editor_review: currentItem.editor_review || null,
    decision: currentItem.decision || null,

    // --- Flags Set by THIS Node ---
    is_revision: isRevision,
    human_requested_revision: isRevision && !!(sectionDataForPrompt.revision_context || currentItem.revision_context),

    timestamp: new Date().toISOString()
};