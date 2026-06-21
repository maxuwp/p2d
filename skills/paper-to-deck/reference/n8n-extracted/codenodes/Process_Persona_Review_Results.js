// NODE NAME: Process Persona Review Results

// ============================================================================
// Node: Process Persona Review Results (Updated)
// Purpose: Route based on user decision (Approve/Refine) + prepare review log data
// ============================================================================

const input = $input.first().json;

console.log('=== Processing HIL Persona Review Decision ===');

// Extract form fields
const userChoice = input['What would you like to do?'];
const feedbackText = input['Feedback to AI (if you choose option 2)'] || '';

// Get previous persona data
const previousNode = $('Process User Persona').first().json;
const personaMarkdown = previousNode.rawMarkdown || '';

// Get session info from manifest context
const manifestContext = $('Obtain Manifest Information and Select Next Step').first().json;
const sessionId = manifestContext.sessionId;
const sessionFolder = manifestContext.sessionFolder;
const cleanInstructorName = manifestContext.clean_instructor_name || manifestContext.instructorName.replace(/[^a-zA-Z0-9]/g, '');
const manifestContent = manifestContext.manifestContent;

console.log('User selected:', userChoice);

// Construct file paths
const personaFilePath = `${sessionFolder}professor_persona_${cleanInstructorName}.md`;
const reviewLogPath = `${sessionFolder}step2_persona_retrieval_review.html`;

// Get current iteration count
const currentIteration = (manifestContent.generatedArtifacts?.professorPersona?.iterationCount || 0) + 1;

// Initialize result object
let result = {
  session_id: sessionId,
  session_folder: sessionFolder,
  instructor_name: manifestContext.instructorName,
  clean_instructor_name: cleanInstructorName,
  proceed_to_save: false,
  needs_revision: false,
  final_persona: null,
  filePath: personaFilePath,
  data: null,
  
  // Review log data (for conditional logging)
  review_log_data: {
    timestamp: new Date().toISOString(),
    roundNumber: currentIteration,
    userChoice: userChoice,
    feedback: feedbackText,
    personaSnippet: personaMarkdown.substring(0, 200) + '...', // First 200 chars
    personaFull: personaMarkdown,
    approved: false
  }
};

// Parse user choice
if (userChoice.includes('Option 1')) {
  // Approve - proceed to save
  console.log('User approved persona - proceeding to save');
  result.proceed_to_save = true;
  result.final_persona = personaMarkdown;
  result.data = personaMarkdown;
  result.review_log_data.approved = true;
  result.review_log_data.decision = 'Approved';

} else if (userChoice.includes('Option 2')) {
  // Refine - loop back to AI
  console.log('User requested refinement');
  
  if (!feedbackText || feedbackText.trim().length < 10) {
    throw new Error('Option 2 selected but no feedback provided. Please provide specific feedback (at least 10 characters) on how to improve the persona.');
  }
  
  result.needs_revision = true;
  result.refinement_feedback = feedbackText.trim();
  result.previous_persona = personaMarkdown;
  result.refinement_type = 'iterative_improvement';
  result.review_log_data.approved = false;
  result.review_log_data.decision = 'Refine with feedback';

} else {
  throw new Error('Invalid option selected. Please choose Option 1 or Option 2.');
}

console.log('Decision processed:', {
  proceed_to_save: result.proceed_to_save,
  needs_revision: result.needs_revision,
  file_path: result.filePath,
  content_length: result.data ? result.data.length : 0,
  review_log_enabled: manifestContent.userPreferences?.reviewLogging === 'Yes - Help improve this system (recommended)'
});

return result;