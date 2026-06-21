// NODE NAME: Consolidate Paper Analyzer Agent Prompts

// ============================================================================
// Node: Consolidate Paper Analyzer Agent Prompts
// Purpose: Create enhanced prompt with thematic context (initial path only)
// Note: Revision loop goes back to Thematic Analyst, not here
// ============================================================================

// Get manifest context
const manifestContext = $('Obtain Manifest Information for Paper Analysis').first().json;
const sessionId = manifestContext.sessionId;

// Get thematic analysis from upstream (always fresh/regenerated)
let thematicAnalysis;
let hasThematicFeedbackResponse = false;
try {
  const thematicNode = $('Process Thematic Analysis').first().json;
  thematicAnalysis = thematicNode.thematic_analysis_json;
  hasThematicFeedbackResponse = thematicNode.has_feedback_response || false;
} catch (error) {
  throw new Error('Failed to retrieve thematic analysis: ' + error.message);
}

// Validate thematic analysis exists
if (!thematicAnalysis || !thematicAnalysis.main_thesis) {
  throw new Error('Thematic analysis is incomplete or missing. Check upstream nodes.');
}

// Stringify thematic context for prompt injection
const thematicContext = JSON.stringify(thematicAnalysis, null, 2);

// Get the combined paper text
let paperText = '';
try {
  const combinedData = $('Combine Paper Contents').first().json;
  paperText = combinedData.fullText || '';
} catch (error) {
  throw new Error('Failed to retrieve combined paper text: ' + error.message);
}

// Validate paper text
if (!paperText || paperText.length < 100) {
  throw new Error(`Paper text is empty or too short (${paperText.length} chars). Check PDF extraction.`);
}

// Check if there's user feedback available (for reference, not for revision)
const thematicMetadata = $('Consolidate Thematic Analyst Agent Prompts').first().json.metadata;
const hasUserFeedback = thematicMetadata.has_feedback || false;
const isRevisionCycle = thematicMetadata.is_revision || false;

console.log(`Paper text retrieved: ${paperText.length} characters`);
console.log('Thematic context retrieved:', {
  thesis_length: thematicAnalysis.main_thesis.length,
  paper_type: thematicAnalysis.paper_type,
  themes_count: thematicAnalysis.key_themes.length,
  is_revision_cycle: isRevisionCycle,
  has_user_feedback: hasUserFeedback,
  has_thematic_feedback_response: hasThematicFeedbackResponse
});

// Build the enhanced analysis prompt
const analysisPrompt = `You are analyzing an academic paper to extract structured information for a presentation.
You MUST analyze the [Paper Text] and use the [Thematic Analysis] as a guide.

## [Paper Text]
Here is the full text of the academic paper you must analyze:
--- START OF PAPER TEXT ---
${paperText}
--- END OF PAPER TEXT ---

## [Thematic Analysis] (Use this as a guide for insight)
The following thematic analysis has been performed on this paper. Use this to inform your structural analysis:
--- START OF THEMATIC ANALYSIS ---
${thematicContext}
--- END OF THEMATIC ANALYSIS ---

${isRevisionCycle && hasThematicFeedbackResponse ? `
## [IMPORTANT: This is a Revision Cycle]
The thematic analysis above is a REVISED version based on user feedback. The thematic analyst has identified structures and comparisons that were missed in the first pass. 

The thematic analyst explained their changes in the "response_to_feedback" field above. Use this improved thematic context to generate a more insightful paper structure analysis.

**YOU MUST ALSO EXPLAIN** how the revised thematic analysis helped you improve your own analysis. Include a "response_to_thematic_revision" field in your output.
` : ''}

## [Task]
Carefully analyze the [Paper Text] provided above and extract the following information.
Use the [Thematic Analysis] to help you formulate the \`main_contribution\` and \`main_objective\`.

1. **Paper Structure**: Identify and list the main section headings as they appear in the paper (e.g., Abstract, Introduction, Methodology, Results, Discussion, Conclusion, References). Look for the actual section titles used by the authors.

2. **Main Contributions**: List the specific, factual contributions or findings that the authors claim in their paper. These should be the novel aspects of their work - what makes this research new or different.
   
   **GUIDANCE**: Your list should reflect the 'key_themes' and 'implicit_structures' from the [Thematic Analysis]. For example:
   - If the [Thematic Analysis] identifies "key_themes" like ["neural architectures", "optimization techniques"], ensure your contributions address these themes.
   - If "implicit_structures" shows ["Three-level taxonomy: Entry/Mid/Expert"], structure your contributions to reflect this organizational pattern.
   - If "key_comparisons" shows ["ECE vs. Business", "Faculty vs. Student perspectives"], ensure your contributions capture these comparative dimensions.

3. **Main Objectives (Key Takeaways)**: Identify the 2-3 most important messages that a presentation audience should remember about this paper.
   
   **GUIDANCE**: Your list should be guided by the 'main_thesis' from the [Thematic Analysis]. The thesis statement provides the central argument - ensure your objectives communicate this effectively to the audience.

4. **References**: Extract the complete, unedited text from the References or Bibliography section. Copy it exactly as it appears, including all formatting, numbering, and citations.

## [Required Output Format]
You MUST output a single, valid JSON object with these exact keys:

{
${isRevisionCycle && hasThematicFeedbackResponse ? `  "response_to_thematic_revision": "1-3 sentences explaining: (1) What key insights from the REVISED thematic analysis helped you, (2) What specific improvements you made to your contributions/objectives based on this, (3) Why this produces a better analysis for the presentation audience.",
` : ''}  "paper_structure": "Brief summary of the paper's section structure",
  "main_contribution": [
    "First distinct contribution (guided by key_themes from Thematic Analysis)",
    "Second distinct contribution (reflecting implicit_structures if present)",
    "Third distinct contribution (capturing key_comparisons if relevant)"
  ],
  "main_objective": [
    "First key takeaway (guided by main_thesis from Thematic Analysis)",
    "Second key takeaway (addressing paper's central argument)",
    "Third key takeaway"
  ],
  "references_text": "Complete references section text exactly as it appears in the paper"
}

CRITICAL RULES:
- Output ONLY valid JSON - no explanatory text before or after
- DO NOT use markdown code blocks around the JSON
- Ensure all strings are properly escaped
- Base your analysis ONLY on the actual paper text provided above
- Use the [Thematic Analysis] as contextual guidance to identify what matters most
- Your \`main_contribution\` should align with the 'key_themes', 'implicit_structures', and 'key_comparisons'
- Your \`main_objective\` should be informed by the 'main_thesis'
${isRevisionCycle && hasThematicFeedbackResponse ? '- MUST include "response_to_thematic_revision" field explaining how the revised thematic analysis improved your work\n' : ''}- Do NOT invent content - if a section is missing, note that it's missing
- For references_text, copy the ENTIRE references section verbatim`;

// Prepare metadata for downstream nodes
const metadata = {
  session_id: sessionId,
  paper_text_length: paperText.length,
  has_thematic_context: true,
  is_revision_cycle: isRevisionCycle,
  expects_response_field: isRevisionCycle && hasThematicFeedbackResponse,
  timestamp: new Date().toISOString()
};

console.log('Enhanced prompt prepared for paper analysis:', {
  session_id: sessionId,
  text_length: paperText.length,
  has_thematic_context: true,
  is_revision_cycle: isRevisionCycle,
  expects_response_field: metadata.expects_response_field,
  prompt_length: analysisPrompt.length
});

return {
  prompt: analysisPrompt,
  metadata: metadata,
  session_id: sessionId,
  paper_text_length: paperText.length,
  thematic_context: thematicAnalysis
};