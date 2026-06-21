// NODE NAME: Consolidate Thematic Analyst Agent Prompts

// ============================================================================
// Node: Consolidate Thematic Analyst Agent Prompts
// Purpose: Handle both initial analysis and revision loop iterations
// Pattern: Single item input - use $input.first().json
// Memory: Generate memory key for Simple Memory node
// ============================================================================

console.log('=== Consolidate Thematic Analyst Prompts ===');

// Get manifest context (always available)
const manifestContext = $('Obtain Manifest Information for Paper Analysis').first().json;
const sessionId = manifestContext.sessionId;

// Generate memory key for Simple Memory node
// This key must be consistent across all iterations for the same session
const memoryKey = `thematic_analysis_${sessionId}`;
console.log('Memory key:', memoryKey);

// Get the single input item (either from initial path or revision path)
const input = $input.first().json;

console.log('Input keys received:', Object.keys(input));

// Detect which path by checking field signatures
const isRevision = input.is_revision === true || !!input.editor_feedback;
const feedbackText = input.editor_feedback || null;
const previousThematic = input.previous_thematic_analysis || null;
const previousPaper = input.previous_analysis || null;
const iteration = input.iteration || 0;

console.log('Path detected:', {
  is_revision: isRevision,
  has_feedback: !!feedbackText,
  has_previous_thematic: !!previousThematic,
  has_previous_paper: !!previousPaper,
  iteration: iteration,
  memory_key: memoryKey
});

// Get paper text (only needed for initial run)
let paperText = '';
if (!isRevision) {
  // Initial path - get paper text from input or from Combine node
  paperText = input.fullText || '';
  
  if (!paperText) {
    // Fallback: try to get from Combine Paper Contents node
    try {
      const combinedData = $('Combine Paper Contents').first().json;
      paperText = combinedData.fullText || '';
    } catch (error) {
      throw new Error('Failed to retrieve paper text: ' + error.message);
    }
  }
  
  if (!paperText || paperText.length < 100) {
    throw new Error(`Paper text is empty or too short (${paperText.length} chars). Check PDF extraction.`);
  }
  
  console.log(`Paper text retrieved: ${paperText.length} characters`);
  console.log('ℹ️ Initial run: Paper text will be stored in memory for future iterations');
} else {
  console.log('ℹ️ Revision mode: Paper text will be accessed from Simple Memory (context window = 10)');
}

// Validate revision data
if (isRevision) {
  if (!feedbackText || feedbackText.trim().length < 10) {
    throw new Error('Revision requested but no feedback provided. User feedback is required for revision.');
  }
  
  if (!previousThematic) {
    console.warn('⚠️ WARNING: Revision mode but no previous thematic analysis found');
  }
  
  if (!previousPaper) {
    console.warn('⚠️ WARNING: Revision mode but no previous paper analysis found');
  }
}

// Build the thematic analysis prompt
let thematicPrompt = '';

if (isRevision && feedbackText) {
  // REVISION PATH
  console.log('Building REVISION prompt (iteration ' + (iteration) + ')');
  console.log('Memory will provide: Paper text + previous ' + (iteration - 1) + ' interactions');
  
  thematicPrompt = `You previously analyzed an academic paper and produced a thematic analysis.
The user reviewed your work and found it lacking in insight and depth.

## USER FEEDBACK - WHY YOUR ANALYSIS WAS INSUFFICIENT
${feedbackText}

${previousPaper ? `
## DOWNSTREAM IMPACT OF YOUR PREVIOUS ANALYSIS
Your thematic analysis was used to create this paper structure analysis:
${JSON.stringify(previousPaper, null, 2)}

The paper structure above shows what the Paper Analyzer extracted based on YOUR thematic work. If the user is unhappy, it may be because your thematic analysis missed key structures that would have informed better paper analysis.
` : ''}

## INSTRUCTIONS FOR REVISION
1. **Re-read the paper in your memory** - You clearly missed important insights the first time
2. **Pay special attention to the user's feedback** - They told you exactly what's missing
3. **Look deeper for implicit structures** - Don't just skim the surface this time
4. **Identify ALL comparison dimensions** - By discipline, by level, by tool, by stakeholder group, by methodology
5. **Recognize the paper's actual methodology** - Is this a survey? An experiment? A case study? A comparative analysis?
6. **Find the organizing frameworks** - Taxonomies, progressions, levels, phases, hierarchies that the authors use
7. **Detect cross-cutting themes** - What patterns emerge across different sections?

**Example of what users expect:**
- If the paper compares "Faculty vs. Student perspectives on AI tools", your key_comparisons should include this
- If the paper surveys "three disciplines: ECE, Business, and Education", your implicit_structures should capture this taxonomy
- If the paper presents "novice, intermediate, expert levels of usage", this progression should be in implicit_structures

The user expects you to find the REAL intellectual structure of this paper, not just a surface-level summary.

## REQUIRED OUTPUT FORMAT
You MUST output a single, valid JSON object with these exact keys, INCLUDING a response field:

{
  "response_to_feedback": "I understood from your feedback that [specific issues]. I have now re-analyzed the paper and found [specific new insights]. These changes improve the analysis because [explanation].",
  "main_thesis": "A single, concise sentence stating the paper's main argument or central claim.",
  "paper_type": "Classify the paper (e.g., 'Survey Paper', 'Methods Paper', 'Position Paper', 'Case Study', 'Literature Review', 'Comparative Analysis').",
  "key_themes": [
    "A list of 3-5 main thematic topics or concepts the paper explores."
  ],
  "key_comparisons": [
    "A list of key comparisons made in the paper (e.g., 'Method A vs. Method B', 'ECE vs. Business', 'Novice vs. Expert', 'Faculty vs. Student perspectives'). If none, return an empty array."
  ],
  "implicit_structures": [
    "A list of any progressions, levels, taxonomies, or organizing frameworks the paper uses (e.g., 'Three-level taxonomy: Entry/Mid/Expert', 'Phases: 1, 2, 3', 'Stakeholder groups: Faculty, Students, Administrators', 'Discipline comparison: ECE, Business, Education'). If none, return an empty array."
  ],
  "evidence_types": [
    "A list of the primary types of evidence used to support the thesis (e.g., 'Survey Data with Likert Scales', 'Case Studies', 'Quantitative Comparisons', 'Usage Statistics', 'Interview Transcripts', 'Content Analysis')."
  ]
}

## CRITICAL RULES FOR REVISION:
- Output ONLY valid JSON - no markdown code blocks, no explanatory text
- DO NOT include any text outside the JSON object
- The "response_to_feedback" field is **REQUIRED** and must be 2-4 sentences explaining what you changed
- The paper is in your memory context - reference it as needed without reproducing it
- Your previous analysis is also in your memory - compare your new insights to what you said before
- Address the user's feedback thoroughly and specifically
- Go DEEPER this time - find the structures, comparisons, and frameworks you missed before
- Be concrete and specific in your analysis - avoid vague generalities`;

} else {
  // INITIAL PATH
  console.log('Building INITIAL prompt (full paper text included)');
  console.log('Paper text will be stored in memory for context window = 10 interactions');
  
  thematicPrompt = `You are a world-class Research Analyst. Your task is to read the following [Paper Text] and extract its core argumentative and structural elements. Do not just summarize; I need you to find the *implicit* structure and themes.

## [Paper Text]
---
${paperText}
---

## [Your Task]
Analyze the paper and return a single, valid JSON object with the following schema:

{
  "main_thesis": "A single, concise sentence stating the paper's main argument or central claim.",
  "paper_type": "Classify the paper (e.g., 'Survey Paper', 'Methods Paper', 'Position Paper', 'Case Study', 'Literature Review', 'Comparative Analysis').",
  "key_themes": [
    "A list of 3-5 main thematic topics or concepts the paper explores."
  ],
  "key_comparisons": [
    "A list of key comparisons made in the paper (e.g., 'Method A vs. Method B', 'Discipline 1 vs. Discipline 2', 'Faculty vs. Student perspectives'). If none, return an empty array."
  ],
  "implicit_structures": [
    "A list of any progressions, levels, or taxonomies the paper uses to organize its argument (e.g., 'Levels: Entry/Mid/Expert', 'Phases: 1, 2, 3', 'Taxonomy: Type A, Type B', 'Stakeholder groups: Faculty, Students'). If none, return an empty array."
  ],
  "evidence_types": [
    "A list of the primary types of evidence used to support the thesis (e.g., 'Survey Data', 'Case Studies', 'Benchmarks', 'Code Examples', 'Logical Arguments', 'Interview Data')."
  ]
}

## IMPORTANT GUIDANCE FOR FINDING IMPLICIT STRUCTURES:
Look for these common patterns in academic papers:

**For Survey/Empirical Papers:**
- Demographic breakdowns (by discipline, role, experience level, institution type)
- Rating scales and frequency distributions
- Comparison groups (treatment vs. control, before vs. after)

**For Technical/Methods Papers:**
- Proposed method vs. baseline methods
- Performance metrics comparisons
- System components or architectural layers

**For Literature Reviews/Position Papers:**
- Taxonomies or typologies of approaches
- Chronological phases or eras
- Schools of thought or theoretical frameworks

**For Case Studies:**
- Multiple cases compared along dimensions
- Stakeholder perspectives
- Temporal phases or stages

## CRITICAL RULES:
- Output ONLY the valid JSON object - no markdown code blocks, no explanatory text
- DO NOT include any text outside the JSON object
- Base your analysis ONLY on the paper text provided above
- Be specific and concrete - avoid vague generalities
- If you find comparison dimensions or organizing frameworks, capture them precisely

NOTE: This paper text will be stored in your memory for future reference. You may be asked to revise your analysis based on user feedback in subsequent interactions.`;
}

// Prepare metadata for downstream nodes
const metadata = {
  session_id: sessionId,
  memory_key: memoryKey,
  is_revision: isRevision,
  iteration: isRevision ? iteration : 0,
  paper_text_length: isRevision ? 0 : paperText.length,
  has_feedback: !!feedbackText,
  timestamp: new Date().toISOString(),
  analysis_phase: 'thematic',
  memory_optimized: isRevision,
  context_window: 10
};

console.log('✓ Thematic analysis prompt prepared:', {
  session_id: sessionId,
  memory_key: memoryKey,
  is_revision: isRevision,
  iteration: metadata.iteration,
  has_feedback: !!feedbackText,
  prompt_length: thematicPrompt.length,
  memory_optimized: isRevision,
  context_window: 10
});

return {
  prompt: thematicPrompt,
  metadata: metadata,
  session_id: sessionId,
  memory_key: memoryKey,
  previous_thematic_analysis: previousThematic,
  previous_paper_analysis: previousPaper,
  paper_text_length: isRevision ? 0 : paperText.length
};