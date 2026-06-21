// NODE NAME: Add Persona Info to Manifest File

// ============================================================================
// Node: Add Persona Info to Manifest File (Updated)
// Purpose: Update manifest with persona file AND review log metadata
// ============================================================================

console.log('=== Add Persona Info to Manifest File ===');

// Get persona file info from the router decision
const personaDecision = $('Persona Analyze Pass?').item.json;
const personaFilePath = personaDecision.filePath;
const personaContent = personaDecision.data || '';

if (!personaFilePath) {
  throw new Error('Persona file path is missing from review decision.');
}

// Calculate metadata
const wordCount = personaContent.split(/\s+/).filter(word => word.length > 0).length;
const charCount = personaContent.length;
const lineCount = personaContent.split('\n').length;

// Get the manifest content from the beginning of the subflow
const manifestContext = $('Obtain Manifest Information and Select Next Step').first().json;
const manifestContent = manifestContext.manifestContent;
const manifestPath = manifestContext.manifestPath;

// Check if review logging is enabled
const reviewLoggingEnabled = manifestContent.userPreferences?.reviewLogging === 'Yes - Help improve this system (recommended)';

// Get review log data if logging was enabled
let reviewLogPath = null;
let totalReviewRounds = 0;
let finalReviewStatus = 'approved';

if (reviewLoggingEnabled) {
  try {
    // Try to get review log info from the merge node or save review log node
    const reviewLogNode = $('Save Persona Review Log', true);
    if (reviewLogNode && reviewLogNode.first()) {
      reviewLogPath = reviewLogNode.first().json.review_log_path;
      totalReviewRounds = reviewLogNode.first().json.metadata?.totalRounds || 1;
      finalReviewStatus = reviewLogNode.first().json.metadata?.finalStatus || 'approved';
      console.log('Review log info retrieved:', {
        path: reviewLogPath,
        rounds: totalReviewRounds,
        status: finalReviewStatus
      });
    }
  } catch (error) {
    console.log('Could not retrieve review log info (might not exist yet)');
  }
}

// Update professorPersona artifact with metadata
manifestContent.generatedArtifacts.professorPersona = {
  status: "completed",
  filePath: personaFilePath,
  format: "markdown",
  version: manifestContent.generatedArtifacts.professorPersona.version || 1,
  startedAt: manifestContent.generatedArtifacts.professorPersona.startedAt || new Date().toISOString(),
  completedAt: new Date().toISOString(),
  iterationCount: (manifestContent.generatedArtifacts.professorPersona.iterationCount || 0) + 1,
  wordCount: wordCount,
  characterCount: charCount,
  lineCount: lineCount,
  lastError: null
};

// Update review logs section if logging is enabled
if (reviewLoggingEnabled && reviewLogPath) {
  manifestContent.reviewLogs.personaReview = {
    filePath: reviewLogPath,
    totalRounds: totalReviewRounds,
    finalStatus: finalReviewStatus,
    lastUpdated: new Date().toISOString()
  };
  console.log('✓ Review log metadata added to manifest');
}

// Add audit trail entry
manifestContent.auditTrail.push({
  timestamp: new Date().toISOString(),
  event: 'Professor Persona Completed',
  step: 'persona_analysis',
  filePath: personaFilePath,
  instructor: manifestContext.instructorName,
  iteration: manifestContent.generatedArtifacts.professorPersona.iterationCount,
  wordCount: wordCount,
  reviewLogEnabled: reviewLoggingEnabled,
  reviewRounds: totalReviewRounds
});

// Update process state
manifestContent.processState.currentStep = "Persona Analysis Complete";
manifestContent.processState.lastUpdated = new Date().toISOString();

console.log('✓ Manifest updated:', {
  sessionId: manifestContext.sessionId,
  personaFile: personaFilePath,
  instructor: manifestContext.instructorName,
  format: 'markdown',
  wordCount: wordCount,
  reviewLogEnabled: reviewLoggingEnabled,
  reviewLogPath: reviewLogPath
});

// Return updated manifest for writing
return {
  manifestPath: manifestPath,
  manifestContent: manifestContent,
  data: JSON.stringify(manifestContent, null, 2)
};