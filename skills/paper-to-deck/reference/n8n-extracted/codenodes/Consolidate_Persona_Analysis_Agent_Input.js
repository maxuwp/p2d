// NODE NAME: Consolidate Persona Analysis Agent Input

// ============================================================================
// Node: Consolidate Persona Analysis Agent Input (WITH PROMPT CONSTRUCTION)
// Purpose: Build complete prompt for AI agent - prevents hallucinations
// Pattern: Matches content generation workflow (prompt built in code)
// ============================================================================

console.log('=== Consolidate Persona Analysis Agent Input (With Prompt) ===');

// Get manifest context
const manifestContext = $('Obtain Manifest Information and Select Next Step').first().json;

// Session context (always needed)
const sessionContext = {
  session_id: manifestContext.sessionId,
  instructor_name: manifestContext.instructorName,
  clean_instructor_name: manifestContext.clean_instructor_name || manifestContext.instructorName.replace(/[^a-zA-Z0-9]/g, ''),
  session_folder: manifestContext.sessionFolder,
  processing_timestamp: new Date().toISOString()
};

// Get all inputs
const allInputs = $input.all();
console.log('Input count:', allInputs.length);

// Initialize data collectors
let isRefinementLoop = false;
let teachingExamples = '';
let previousPersona = '';
let refinementFeedback = '';
let mode = 'creation';

// Process inputs to determine mode and extract data
allInputs.forEach((item, index) => {
  console.log(`\nProcessing input ${index + 1}:`, Object.keys(item.json || {}));
  
  const itemData = item.json || {};
  
  // DETECTION: Refinement loop (from HIL form output)
  if (itemData.fullPersona || itemData['What would you like to do?']) {
    console.log('DETECTED: Refinement loop iteration');
    isRefinementLoop = true;
    mode = 'refinement';
    
    // Extract previous persona
    previousPersona = itemData.rawMarkdown || itemData.fullPersona?.output || '';
    
    // Extract user feedback (Option 2 only)
    const userChoice = itemData['What would you like to do?'];
    if (userChoice && userChoice.includes('Option 2')) {
      refinementFeedback = itemData['Feedback to AI (if you choose option 2)'] || '';
      console.log('User provided refinement feedback:', refinementFeedback.length, 'chars');
    }
    
  } else {
    // CREATION MODE: Extract teaching examples
    if (itemData.fullText) {
      teachingExamples = itemData.fullText.trim();
      console.log('Found teaching examples (fullText):', teachingExamples.length, 'chars');
    } else if (itemData.text) {
      teachingExamples = itemData.text.trim();
      console.log('Found teaching examples (text):', teachingExamples.length, 'chars');
    }
  }
});

console.log('\n=== Data Collection Summary ===');
console.log('Mode:', mode);
console.log('Teaching examples length:', teachingExamples.length);
console.log('Previous persona length:', previousPersona.length);
console.log('Refinement feedback length:', refinementFeedback.length);

// ============================================================================
// BUILD COMPLETE PROMPT FOR AI AGENT
// ============================================================================

let fullPrompt = '';
let taskType = '';

if (mode === 'refinement' && previousPersona && refinementFeedback) {
  // ====================================
  // REFINEMENT MODE PROMPT
  // ====================================
  taskType = 'REFINEMENT';
  
  fullPrompt = `You are refining an existing presentation style persona based on specific user feedback.

## YOUR TASK: REFINEMENT MODE

### CRITICAL INSTRUCTIONS:
1. **START with the existing persona below** as your foundation
2. **APPLY EVERY POINT from the user's feedback** - this is mandatory
3. **DO NOT change aspects** the user didn't mention
4. **PRESERVE the professor's name EXACTLY** as it appears in the existing persona
5. **DO NOT invent new information** - only refine what's already provided
6. **Maintain the same structure** - keep all sections (Executive Summary, Structural Organization, etc.)

---

### EXISTING PERSONA (YOUR STARTING POINT):

\`\`\`markdown
${previousPersona}
\`\`\`

---

### USER'S REFINEMENT FEEDBACK (ADDRESS ALL POINTS):

\`\`\`
${refinementFeedback}
\`\`\`

---

## OUTPUT FORMAT (FOLLOW EXACTLY)

Your response MUST be ONLY the raw Markdown text following this structure.
**DO NOT include conversational text, preambles, explanations, or meta-commentary.**
**START immediately with the heading below.**

### **Presentation Style Profile: [PRESERVE EXACT NAME FROM EXISTING PERSONA]**

#### **Executive Summary**
(Refine this 1-2 sentence summary based on user feedback. Maintain essence unless feedback requests changes.)

#### **Structural Organization & Flow**
(Refine this 1-paragraph summary. Apply relevant feedback points. Keep observations the user didn't mention.)

#### **Slide-Level Design & Layout**
(Refine this 1-paragraph summary. Address any feedback about visual style. Preserve accurate observations.)

#### **Language & Tone**
(Refine this 1-paragraph summary. Apply feedback about language/tone. Keep other accurate details.)

#### **Content & Data Visualization**
(Refine these 3-4 bullet points. Apply relevant feedback. Keep accurate observations not mentioned in feedback.)

---

## QUALITY REQUIREMENTS FOR REFINEMENT

- **Maximum length:** 400 words total
- **Instructor name:** MUST be preserved EXACTLY from existing persona
- **Feedback application:** ALL feedback points must be addressed
- **Consistency:** Don't change aspects not mentioned in feedback
- **Accuracy:** Don't invent new facts about the professor

---

## CRITICAL REMINDERS

✅ Start with existing persona as foundation
✅ Apply ALL feedback points systematically
✅ Preserve professor's name EXACTLY
✅ Keep same markdown structure
❌ DO NOT invent new information
❌ DO NOT change unmentioned aspects
❌ DO NOT alter the professor's name

**BEGIN YOUR REFINED PERSONA IMMEDIATELY. NO OTHER TEXT.**
`;

} else if (mode === 'creation' && teachingExamples) {
  // ====================================
  // CREATION MODE PROMPT
  // ====================================
  taskType = 'CREATION';
  
  // Truncate if too long (keep first 20000 chars for context window)
  const examplesForPrompt = teachingExamples.length > 20000 
    ? teachingExamples.substring(0, 20000) + '\n\n[Content truncated for length - analyze patterns from the materials shown above]'
    : teachingExamples;
  
  fullPrompt = `You are creating a new presentation style persona by analyzing teaching materials.

## YOUR TASK: CREATION MODE

### CRITICAL INSTRUCTIONS:
1. **ANALYZE the teaching examples** provided below carefully
2. **EXTRACT observable patterns** in slide structure, language, visual style, and content organization
3. **IDENTIFY the instructor's name** from the materials:
   - Check title slides for "Presented by:", "Instructor:", "Dr./Prof. [Name]"
   - Look in headers, footers, or metadata
   - If multiple names appear, use the primary instructor
   - If NO name is found, use "Professor [Subject Area]" (e.g., "Professor Computer Science")
4. **BE SPECIFIC** - cite concrete examples from the materials
5. **DO NOT invent information** - only describe what you observe
6. **Focus on patterns** - what consistently appears across multiple slides?

---

### TEACHING MATERIALS TO ANALYZE:

\`\`\`
${examplesForPrompt}
\`\`\`

---

## OUTPUT FORMAT (FOLLOW EXACTLY)

Your response MUST be ONLY the raw Markdown text following this structure.
**DO NOT include conversational text, preambles, explanations, or meta-commentary.**
**START immediately with the heading below.**

### **Presentation Style Profile: [EXTRACT INSTRUCTOR NAME FROM MATERIALS]**

#### **Executive Summary**
(Provide a 1-2 sentence summary capturing the essence of this presenter's slide design and communication style based on patterns you observe.)

#### **Structural Organization & Flow**
(Provide a 1-paragraph summary of presentation structure. Does it use an agenda? What sections appear (Introduction, Methodology, Results, etc.)? How are topics transitioned? Cite specific examples.)

#### **Slide-Level Design & Layout**
(Provide a 1-paragraph summary of visual style. Is it minimalist or dense? What layouts appear (Title Slide, Title + Bullets, Full-bleed Image, Diagrams)? Note colors, fonts, branding patterns you observe.)

#### **Language & Tone**
(Provide a 1-paragraph summary of on-slide text. Is it formal/academic or conversational? Full sentences, short bullets, or keywords? Describe text density per slide with examples.)

#### **Content & Data Visualization**
(Provide 3-4 bullet points on content types observed. Examples: "Heavy use of code snippets in Python," "Prefers bar charts over tables," "Uses flowcharts for process explanations," "Minimal decorative images.")

---

## QUALITY REQUIREMENTS FOR CREATION

- **Maximum length:** 400 words total
- **Instructor name:** MUST be extracted from materials (check title slides, headers, footers)
- **Specificity:** Cite concrete examples from materials
- **Objectivity:** Describe patterns observed, don't prescribe what should be done
- **Evidence-based:** Every claim should be supported by something in the materials

---

## CRITICAL REMINDERS

✅ Analyze actual teaching materials provided
✅ Extract instructor's name from materials
✅ Cite specific examples and patterns
✅ Only describe what you observe
❌ DO NOT invent information not in materials
❌ DO NOT use placeholder names like "Professor X"
❌ DO NOT make assumptions beyond observable patterns
❌ DO NOT prescribe what presenter "should" do

**BEGIN YOUR PERSONA ANALYSIS IMMEDIATELY. NO OTHER TEXT.**
`;

} else {
  // ERROR: Invalid input combination
  throw new Error(`Cannot create persona. Mode: ${mode}, Teaching examples: ${teachingExamples.length} chars, Previous persona: ${previousPersona.length} chars, Feedback: ${refinementFeedback.length} chars. Need either teaching examples (creation) or previous persona + feedback (refinement).`);
}

console.log('\n=== Prompt Construction Complete ===');
console.log('Task type:', taskType);
console.log('Prompt length:', fullPrompt.length, 'characters');

// Return structured output for AI agent
return [{
  json: {
    // The complete prompt for AI agent
    prompt: fullPrompt,
    
    // Metadata for tracking
    consolidation_info: {
      mode: mode,
      task_type: taskType,
      data_sources: {
        has_teaching_examples: teachingExamples.length > 0,
        has_previous_persona: previousPersona.length > 0,
        has_refinement_feedback: refinementFeedback.length > 0,
        is_refinement_loop: isRefinementLoop
      },
      content_analysis: {
        teaching_examples_length: teachingExamples.length,
        previous_persona_length: previousPersona.length,
        refinement_feedback_length: refinementFeedback.length,
        prompt_length: fullPrompt.length
      }
    },
    
    // Session context
    session_context: sessionContext,
    
    // Ready flag
    ready_for_processing: true
  }
}];