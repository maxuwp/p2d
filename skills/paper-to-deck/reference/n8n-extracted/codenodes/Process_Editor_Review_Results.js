// NODE NAME: Process Editor Review Results

// ============================================================================
// Node: Process Editor Review Results
// Purpose: Analyze user decision and prepare data for routing
// ============================================================================

const input = $input.first().json;

console.log('=== Processing HIL Review Decision ===');

// Extract form fields
const userChoice = input['What would you like to do?'];
const feedbackText = input['Feedback to AI (if you choose option 2)'] || '';

// Get merged analysis data from previous node
const previousNode = $('Process Paper Structure').first().json;
const mergedAnalysis = previousNode.merged_analysis;
const metadata = previousNode.metadata;

// Get session info from manifest context
const manifestContext = $('Obtain Manifest Information for Paper Analysis').first().json;
const sessionId = manifestContext.sessionId;
const sessionFolder = manifestContext.sessionFolder;

console.log('User selected:', userChoice);

// Initialize result object
let result = {
  session_id: sessionId,
  session_folder: sessionFolder,
  proceed_to_save: false,
  needs_revision: false,
  final_analysis: null,
  data: null,
  file_path: null
};

// Parse user choice
if (userChoice.includes('Option 1')) {
  // Approve - proceed to save merged analysis
  console.log('User approved analysis - proceeding to save merged structure');
  result.proceed_to_save = true;
  result.needs_revision = false;
  result.final_analysis = mergedAnalysis;
  
  // Format for file conversion - put JSON string in 'data' field
  result.data = JSON.stringify(mergedAnalysis, null, 2);
  result.file_path = `${sessionFolder}paper_analysis.json`;

  // Minimal metadata - just timestamp
  result.approval_timestamp = new Date().toISOString();
  result.final_iteration = metadata.iteration;

  console.log('✓ Merged analysis prepared for saving:', {
    total_fields: Object.keys(mergedAnalysis).length,
    thematic_fields: ['main_thesis', 'paper_type', 'key_themes', 'key_comparisons', 'implicit_structures', 'evidence_types'].length,
    structure_fields: ['paper_structure', 'main_contribution', 'main_objective', 'references_text'].length,
    final_iteration: metadata.iteration
  });

} else if (userChoice.includes('Option 2')) {
  // Refine - loop back to Thematic Analyst
  console.log('User requested refinement - looping back to Thematic Analyst');
  
  if (!feedbackText || feedbackText.trim().length < 10) {
    throw new Error('Option 2 selected but no feedback provided. Please provide specific feedback.');
  }
  
  result.needs_revision = true;
  result.proceed_to_save = false;
  
  // FLAT revision data structure (not nested in revision_data)
  result.is_revision = true;
  result.iteration = metadata.iteration + 1;
  result.editor_feedback = feedbackText.trim();
  result.previous_thematic_analysis = previousNode.thematic_data;
  result.previous_analysis = previousNode.structure_data;

  console.log('✓ Revision requested:', {
    iteration: result.iteration,
    feedback_length: feedbackText.length
  });

} else {
  throw new Error('Invalid option selected. Please choose Option 1 or 2.');
}

console.log('Decision processed:', {
  proceed_to_save: result.proceed_to_save,
  needs_revision: result.needs_revision,
  has_data: !!result.data,
  final_iteration: metadata.iteration
});

return result;