// NODE NAME: Obtain Manifest Information for Paper Analysis

// ============================================================================
// Node: Obtain Manifest Information for Paper Analysis
// Purpose: Extract manifest data and user preferences
// ============================================================================

// Get the manifest path from the upstream node
const manifestPath = $('only allow the manifest file path').first().json.manifestPath;

// The Extract from File node returns an array with the data nested inside
const extractedArray = $input.all();
const manifestContent = extractedArray[0].json.data;

// Extract relevant information for paper analysis subflow
const sessionId = manifestContent.sessionInfo.sessionId;
const sessionFolder = manifestContent.sessionInfo.sessionFolderPath;
const initialRequest = manifestContent.initialRequest;

// Initialize generatedArtifacts if it doesn't exist
if (!manifestContent.generatedArtifacts) {
  manifestContent.generatedArtifacts = {};
}

// Initialize originalPaper artifact if not present (with null filePath)
if (!manifestContent.generatedArtifacts.originalPaper) {
  manifestContent.generatedArtifacts.originalPaper = {
    status: "pending",
    filePath: null,
    uploadedAt: null,
    textLength: null,
    wordCount: null,
    lineCount: null
  };
}

// Initialize paper analysis artifact if not present (with null filePath)
if (!manifestContent.generatedArtifacts.paperAnalysis) {
  manifestContent.generatedArtifacts.paperAnalysis = {
    status: "in_progress",
    filePath: null,
    version: 1,
    startedAt: new Date().toISOString(),
    completedAt: null,
    iterationCount: 0,
    lastError: null
  };
} else {
  manifestContent.generatedArtifacts.paperAnalysis.status = "in_progress";
  manifestContent.generatedArtifacts.paperAnalysis.startedAt = new Date().toISOString();
  manifestContent.generatedArtifacts.paperAnalysis.iterationCount = 
    (manifestContent.generatedArtifacts.paperAnalysis.iterationCount || 0);
}

// Initialize auditTrail if it doesn't exist
if (!manifestContent.auditTrail) {
  manifestContent.auditTrail = [];
}

// Add audit trail entry
manifestContent.auditTrail.push({
  timestamp: new Date().toISOString(),
  event: 'Paper Analysis Started',
  step: 'paper_analysis'
});

// Update process state
if (!manifestContent.processState) {
  manifestContent.processState = {
    currentStep: "Paper Analysis",
    isComplete: false,
    hasError: false,
    errorDetails: null
  };
} else {
  manifestContent.processState.currentStep = "Paper Analysis";
}

// Extract user preferences for learning assistance and review logging
const userPreferences = manifestContent.userPreferences || {};
const learningAssistEnabled = (userPreferences.learningAssistance || '').includes('Yes');
const reviewLoggingEnabled = (userPreferences.reviewLogging || '').includes('Yes');

console.log('✓ Manifest loaded for Paper Analysis:', {
  sessionId: sessionId,
  sessionFolder: sessionFolder,
  previousIterations: manifestContent.generatedArtifacts.paperAnalysis.iterationCount,
  learningAssist: learningAssistEnabled,
  reviewLogging: reviewLoggingEnabled
});

// Return context for downstream nodes
return {
  json: {
    manifestPath: manifestPath,
    manifestContent: manifestContent,
    sessionId: sessionId,
    sessionFolder: sessionFolder,
    initialRequest: initialRequest,
    paperAnalysisConfig: {
      currentFilePath: manifestContent.generatedArtifacts.paperAnalysis.filePath,
      version: manifestContent.generatedArtifacts.paperAnalysis.version
    },
    originalPaperConfig: {
      currentFilePath: manifestContent.generatedArtifacts.originalPaper.filePath,
      status: manifestContent.generatedArtifacts.originalPaper.status
    },
    learningAssistEnabled: learningAssistEnabled,
    reviewLoggingEnabled: reviewLoggingEnabled
  }
};