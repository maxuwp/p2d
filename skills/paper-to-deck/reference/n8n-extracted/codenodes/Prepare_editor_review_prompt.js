// NODE NAME: Prepare editor review prompt

// ===================================================================
// IMPROVED EDITOR/REVIEWER AGENT PROMPT - COMPLETE CODE
// Enhanced with specialGuidelines validation and clearer hierarchy checks
// ===================================================================

// Extract input data
const input = $input.first().json;
const parsedContent = input.parsed_content;
const metrics = input.metrics;
const validations = input.validations;
const metadata = input.section_metadata;

console.log('Preparing editor review for:', metadata.subtopic_title);

// Extract content
const slides = parsedContent.slides;
const notes = parsedContent.notes;
const references = parsedContent.references;

// ===================================================================
// Extract context and guidelines
// ===================================================================
const context = input.context || {}; 
const specialGuidelines = context.specialGuidelines || null;

// ===================================================================
// Build Guideline Components (if they exist)
// ===================================================================
let guidelinesChecklist = '';
if (specialGuidelines) {
    guidelinesChecklist = `
- [ ] **Special Guidelines - Content Rules**: All content-related rules from [Special Guidelines] were applied (e.g., word limits per slide, specific topics, required examples)
- [ ] **Special Guidelines - Formatting Rules**: Formatting-only rules (e.g., fonts, colors, spacing) were correctly IGNORED by the drafter
`;
}

let guidelinesContext = '';
if (specialGuidelines) {
    guidelinesContext = `
## INPUT: [Special Guidelines for Review]

The drafter was instructed to:
- **APPLY** content rules (word limits, topics, examples, pedagogical approaches)
- **IGNORE** formatting rules (fonts, colors, spacing, visual layout)

**Guidelines provided to drafter:**
\`\`\`
${specialGuidelines}
\`\`\`

**Your review responsibility:**
1. Verify the drafter correctly applied all content-related rules
2. Verify the drafter correctly ignored formatting-related rules
3. Deduct points if content rules were violated or if the drafter tried to address formatting (which is outside their scope)
`;
}

// ===================================================================
// Build comprehensive review prompt
// ===================================================================
const editorPrompt = `
# CONTENT QUALITY EVALUATION: Section ${metadata.section_index + 1}

You are an expert instructional design reviewer evaluating academic lecture materials.

## CONTENT UNDER REVIEW

### Section Information
- **Subtopic**: ${metadata.subtopic_title}
- **Section ID**: ${metadata.section_id}
- **Iteration**: ${metadata.current_iteration} of ${metadata.max_iterations}
- **Expected Slide Count**: ${metadata.slide_count}
- **Target Word Count**: ${metadata.target_word_count} (±10%)

### SLIDES CONTENT
(${metrics.slides_found} '###' slide headers detected, ${slides.length} characters)

\`\`\`markdown
${slides || '[ERROR: NO SLIDES CONTENT FOUND]'}
\`\`\`

### INSTRUCTOR NOTES
(${metrics.notes_word_count} words, target: ${metadata.target_word_count})

\`\`\`markdown
${notes || '[ERROR: NO NOTES CONTENT FOUND]'}
\`\`\`

### REFERENCES
${references ? `\`\`\`\n${references}\n\`\`\`` : '[No references provided]'}

---

## EVALUATION CRITERIA (100 points total)

### 1. Content Accuracy & Completeness (25 points)
- [ ] All required topics from outline covered
- [ ] Information accurate and properly sourced
- [ ] **CRITICAL**: If references are provided, all references are real and not fabricated placeholders (e.g., no "Author (Year)" patterns without actual citations). If no references were provided in context, absence of references is acceptable.
- [ ] Key concepts clearly explained with appropriate depth
- [ ] Appropriate for target academic audience
- [ ] No factual errors or misrepresentations

**Scoring Guide**:
- 23-25: Excellent - All topics covered accurately with strong detail, references handled appropriately (real if provided, empty if not)
- 20-22: Good - Minor gaps or slight lack of depth
- 15-19: Satisfactory - Some content missing or surface-level treatment
- 10-14: Needs work - Significant gaps or accuracy concerns
- 0-9: Inadequate - Major content issues or fabricated references

### 2. Pedagogical Effectiveness (25 points)
- [ ] Clear learning progression from simple to complex
- [ ] Good balance of theory, examples, and applications
- [ ] Concepts scaffolded appropriately
- [ ] Engaging and maintains interest
- [ ] Promotes active learning and critical thinking

**Scoring Guide**:
- 23-25: Excellent - Highly effective learning design
- 20-22: Good - Solid pedagogical structure
- 15-19: Satisfactory - Adequate but could be more engaging
- 10-14: Needs work - Pedagogical issues present
- 0-9: Inadequate - Poor learning design

### 3. Slide Design & Structure (20 points)

**CRITICAL HIERARCHY CHECK:**
The slides MUST follow this exact markdown structure:
1. **ONE** \`##\` header for section title (e.g., \`## 2. Background\`)
2. **Multiple** \`###\` headers for slide titles (e.g., \`### 2.1 The Problem\`)
3. **Multiple** \`####\` headers for key points under each slide (e.g., \`#### 2.1.1 What is the Gap?\`)
4. **Multiple** \`-\` bullets for elaboration under each \`####\` key point
5. **ONE** \`(PPT: ...)\` visual suggestion per slide (after all \`####\` blocks for that slide)

**Hierarchy Validation Checklist:**
- [ ] **STRUCTURE PHILOSOPHY CHECK**: Slides correctly prioritize single-line \`####\` key points. Sub-bullets (\`-\`) are used rarely and only for essential comparisons/lists
- [ ] **EFFICIENCY CHECK**: No unnecessary \`-\` sub-bullets. The AI correctly combined simple ideas into a single \`####\` line
- [ ] **CRITICAL**: Proper markdown hierarchy: One \`##\` section → \`###\` slides → \`####\` key points → \`-\` bullets (rarely)
- [ ] No \`##\` headers used for individual slides (should be \`###\`)
- [ ] No \`###\` headers used for key points (should be \`####\`)
- [ ] **CRITICAL VERBOSITY CHECK**: Total word count for each slide (all content under one \`###\`) is minimal (e.g., < 40 words)
- [ ] **FRAGMENT CHECK**: Slide bullets (\`-\`) are short fragments (2-8 words), not full sentences
- [ ] Visual suggestions \`(PPT: ...)\` included for each slide
- [ ] Not overcrowded (3-5 \`####\` main points per \`###\` slide)
- [ ] Consistent formatting throughout
- [ ] Appropriate use of emphasis (bold, italics)

**Current Status**:
${validations.has_slides ? '✓ Slides present' : '✗ CRITICAL: No slides found'}
${validations.slide_count_matches ? `✓ Slide count correct (${metrics.slides_found} '###' headers)` : `✗ Slide mismatch: ${metrics.slides_found} '###' headers found, ${metadata.slide_count} expected`}
${validations.has_visual_suggestions ? '✓ Visual suggestions included' : '⚠ Missing visual suggestions'}

**Scoring Guide**:
- 18-20: Excellent - Perfect hierarchy, slides are minimal, key points are correctly conveyed on single \`####\` lines with no unnecessary sub-bullets
- 15-17: Good - Clear structure with minor hierarchy/formatting issues
- 11-14: Satisfactory - Acceptable but needs refinement (possible hierarchy mistakes)
- 6-10: Needs work - Structural problems or systemic overuse of unnecessary \`-\` sub-bullets
- 0-5: Inadequate - Major hierarchy failures or systemically verbose slides (bullets are full sentences)

### 4. Instructor Notes Quality (20 points)
- [ ] Conversational, natural speaking tone using \`## Slide X.Y - Title\` structure (e.g., \`## Slide 1.1 - Introduction\`, \`## Slide 2.3 - Analysis\`)
- [ ] Appropriate word count: ${metrics.notes_word_count} / ${metadata.target_word_count} (${Math.round(metrics.word_count_ratio * 100)}%)
- [ ] Interaction cues included: [ASK CLASS], [PAUSE], [DEMO], [POLL]
- [ ] Smooth transitions between topics
- [ ] Elaborates on slide content effectively
- [ ] First-person perspective maintained (as Dr. ${metadata.instructor_name || '[Instructor]'})
- [ ] Time-appropriate (can be delivered in ~1.5 min per slide)
- [ ] Notes are in prose format (paragraphs), not bullet points

**Current Status**:
${validations.has_notes ? '✓ Notes present' : '✗ CRITICAL: No notes found'}
${validations.word_count_acceptable ? '✓ Word count in range' : metrics.word_count_ratio < 0.85 ? '⚠ Notes too brief - need elaboration' : '⚠ Notes too verbose - consider condensing'}
${validations.has_interaction_cues ? '✓ Interaction cues found' : '⚠ Missing interaction cues'}

**Scoring Guide**:
- 18-20: Excellent - Natural, engaging, well-timed delivery notes in prose
- 15-17: Good - Solid notes with minor improvements needed
- 11-14: Satisfactory - Adequate but lacks polish or depth
- 6-10: Needs work - Tone, length, or engagement issues
- 0-5: Inadequate - Major notes quality problems

### 5. Alignment, Integration, & Guidelines Compliance (10 points)
- [ ] Slides (\`###\`, \`####\`) and notes (\`##\`) complement each other seamlessly
- [ ] Consistent technical terminology throughout
- [ ] References properly handled: **If sources were provided in context**, they are properly integrated and not fabricated. **If no sources were provided**, empty reference section is correct.
- [ ] Cohesive narrative flow
- [ ] Maintains academic tone and rigor
${guidelinesChecklist}

${guidelinesContext}

**Scoring Guide**:
- 9-10: Excellent - Perfect alignment, integration, and guidelines compliance
- 7-8: Good - Strong cohesion with minor gaps or guideline misses
- 5-6: Satisfactory - Acceptable alignment
- 3-4: Needs work - Noticeable disconnects or guideline violations
- 0-2: Inadequate - Poor integration, ignored content guidelines, or fabricated references

---

## AUTOMATIC DEDUCTIONS

${!validations.has_slides ? '- **CRITICAL FAILURE**: No slides content (-50 points)' : ''}
${!validations.has_notes ? '- **CRITICAL FAILURE**: No notes content (-50 points)' : ''}
${metrics.word_count_ratio < 0.70 ? '- **MAJOR ISSUE**: Notes far too short (-15 points)' : ''}
${metrics.word_count_ratio > 1.30 ? '- **MAJOR ISSUE**: Notes far too long (-15 points)' : ''}
${!validations.slide_count_matches ? `- **ERROR**: Slide count mismatch (${metrics.slides_found} found vs ${metadata.slide_count} expected) (-10 points)` : ''}

**Additional deductions to consider:**
- Incorrect markdown hierarchy (using \`##\` for slides or \`###\` for key points): -10 to -20 points depending on severity
- Fabricated references: -10 points
- Ignored content guidelines from [Special Guidelines]: -5 to -15 points depending on severity
- **CRITICAL FAILURE**: Ignored a hard word-limit from [Special Guidelines] (-30 points)
- **MAJOR ISSUE**: Any single slide's content (under one \`###\`) exceeds 40 words (-20 points)
- **ISSUE**: Slide bullets are written as full sentences instead of fragments (-10 points)
- **STYLISTIC ERROR**: Overused \`-\` sub-bullets for simple ideas that should have been on one \`####\` line (-10 points)

---

## OUTPUT FORMAT REQUIREMENTS

You MUST respond with ONLY a valid JSON object (no markdown code blocks, no additional text):

{
  "score": [0-100 integer],
  "feedback": [
    "Specific positive observation about content quality",
    "Another strength or well-executed element",
    "Critical issue, concern, or area needing attention (explicitly mention hierarchy errors if present)",
    "Guideline compliance observation (if applicable)"
  ],
  "improvements": [
    "Most important specific improvement needed with actionable guidance (if hierarchy is broken, this should be priority #1)",
    "Second priority improvement with concrete suggestions",
    "Additional enhancement recommendations",
    "Guideline-related improvements (if applicable)"
  ],
  "word_count_assessment": "${metrics.word_count_ratio < 0.85 ? 'too_short' : metrics.word_count_ratio > 1.15 ? 'too_long' : 'acceptable'}",
  "critical_issues": [
    ${!validations.has_slides ? '"Missing slides content"' : ''}
    ${!validations.has_notes ? (!validations.has_slides ? ',' : '') + '"Missing notes content"' : ''}
    ${(!validations.has_slides && !validations.has_notes) ? '' : (validations.has_slides || validations.has_notes ? '"None"' : '')}
  ],
  "recommendation": "[approve | revise | reject]"
}

**Recommendation Guidelines**:
- **"approve"**: Score ≥ 85, all critical elements present, hierarchy correct, ready for use
- **"revise"**: Score 60-84, content salvageable with specific improvements (or minor hierarchy issues fixable)
- **"reject"**: Score < 60, critical content missing, fundamental structural failures (like completely broken hierarchy throughout), extensive fabricated references, or systemic, excessive slide verbosity (e.g., full sentences)

---

## EVALUATION INSTRUCTIONS

1. **Carefully review ALL content** above, paying special attention to:
   - The **markdown hierarchy** in the Slides section (is it \`##\` → \`###\` → \`####\` → \`-\`?)
   - The **slide verbosity** - count total words per slide (under each \`###\` header). Flag if > 40 words.
   - The **bullet style** - are bullets short fragments (2-8 words) or full sentences? Deduct heavily for full sentences.
   - The **[Special Guidelines]** (if provided) - did the drafter apply content rules and ignore formatting rules?
   - The **references** section - are these real sources or fabricated placeholders? **Important**: Only penalize if references are fabricated. An empty reference section is acceptable if no sources were provided to the drafter.

2. **Assign points for each of the 5 criteria** based on scoring guides:
   - Deduct significantly for incorrect hierarchy (Criterion 3)
   - Deduct heavily (-20 pts) if ANY slide exceeds 40 words total (Criterion 3)
   - Deduct moderately (-10 pts) if bullets are full sentences instead of fragments (Criterion 3)
   - Deduct for ignoring content guidelines or applying formatting guidelines (Criterion 5)
   - Deduct for fabricated references ONLY (Criteria 1 and 5) - do not penalize empty references if none were provided

3. **Apply any automatic deductions** listed above

4. **Calculate final score (0-100)** by summing all criteria and applying deductions

5. **Provide 3-5 specific, actionable feedback points:**
   - Include both strengths and areas for improvement
   - If hierarchy is incorrect, explicitly state which header levels are wrong
   - If guidelines were not followed, specify which content rules were violated

6. **List 3-5 prioritized improvements with concrete suggestions:**
   - If hierarchy is broken, fixing it should be improvement #1
   - Be specific (e.g., "Change all slide headers from \`##\` to \`###\`" not just "fix hierarchy")
   - If guideline violations occurred, specify how to correct them

7. **Make final recommendation** based on score and critical issues:
   - Broken hierarchy throughout = likely "reject"
   - Systemically verbose slides (full sentences, > 40 words per slide) = likely "reject"
   - Minor hierarchy issues in 1-2 places = "revise"
   - Perfect hierarchy + minimal slides + good content = "approve"

**Be thorough, objective, and constructive.** Focus on actionable feedback that will improve content quality for the next iteration if revision is needed.

**Current Iteration**: ${metadata.current_iteration} of ${metadata.max_iterations}
${metadata.current_iteration >= metadata.max_iterations ? '\n⚠️ **FINAL ITERATION** - This is the last automatic revision opportunity. Be especially thorough.' : ''}
`;

// Return the complete input object with the editor prompt
return {
    ...input,
    editor_prompt: editorPrompt
};