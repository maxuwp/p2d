// NODE NAME: Process Outline Feedback

// ============================================================================
// Node: Process Outline Feedback (UPDATED - REMOVED UPLOAD OPTION)
// Purpose: Process user feedback and determine routing path
// ============================================================================

console.log('=== Process Outline Feedback ===');

const formData = $json;
const userAction = formData['What would you like to do?'];

// Get the feedback field - n8n uses "Specific feedback for changes" as the field name
const userFeedback = formData['Specific feedback for changes'] || '';

console.log('User action:', userAction);
console.log('User feedback:', userFeedback ? `${userFeedback.length} chars` : 'empty');

// Get outline data from previous node
const outlineData = $('Process Outline for Selection').first().json;
const originalOutline = outlineData.original_outline;
const metadata = outlineData.metadata;

// Initialize result object
let result = {
  session_id: metadata.session_id,
  proceed_to_save: false,
  needs_revision: false,
  final_outline: null,
  revision_data: null,
  data: null,
  file_path: null,
  is_revision: false,
  iteration_count: metadata.iteration_count
};

// Get session folder from manifest context
const manifestContext = $('Obtain Manifest Information for Presentation Outline').first().json;
const sessionFolder = manifestContext.sessionFolder;

if (userAction.includes('1. Approve')) {
  // ========================================
  // OPTION 1: APPROVE AS-IS
  // ========================================
  console.log('✓ User approved outline');
  result.proceed_to_save = true;
  result.final_outline = originalOutline;
  result.data = JSON.stringify(originalOutline, null, 2);
  result.file_path = `${sessionFolder}detailed_outline.json`;

} else if (userAction.includes('2. Request Changes')) {
  // ========================================
  // OPTION 2: REQUEST AI REGENERATION
  // ========================================
  console.log('User requesting changes');
  
  // Validate that user provided feedback
  if (!userFeedback || userFeedback.trim().length < 10) {
    throw new Error('Option 2 selected but no feedback provided. Please describe what needs to be changed in the feedback field.');
  }
  
  const trimmedFeedback = userFeedback.trim();
  
  result.needs_revision = true;
  result.is_revision = true;
  result.revision_data = {
    is_revision: true,
    iteration_count: metadata.iteration_count + 1,
    user_feedback: trimmedFeedback,
    previous_outline: originalOutline
  };
  
  console.log('✓ Feedback captured for revision:', {
    feedbackLength: trimmedFeedback.length,
    iteration: metadata.iteration_count + 1,
    feedbackPreview: trimmedFeedback.substring(0, 100) + '...'
  });

} else {
  throw new Error('Invalid option selected. Please choose Option 1 or 2.');
}

console.log('Decision processed:', {
  proceed_to_save: result.proceed_to_save,
  needs_revision: result.needs_revision,
  has_data: !!result.data
});

return result;