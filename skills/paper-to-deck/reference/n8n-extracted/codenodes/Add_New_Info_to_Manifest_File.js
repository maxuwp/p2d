// NODE NAME: Add New Info to Manifest File

// ============================================================================
// Node: Add New Info to Manifest File
// Purpose: Update manifest with ACTUAL file paths after files are created
// Philosophy: Manifest is an INDEX only - no content duplication
// Handles: Original paper, paper analysis, review log (optional), learning guide (optional)
// ============================================================================

// Get the gathered file information from the Set node
const gatheredInfo = $input.first().json;

console.log('=== Add New Info to Manifest File ===');
console.log('Gathered file info keys:', Object.keys(gatheredInfo));

// Validate required file paths (these must always exist)
if (!gatheredInfo.Original_paper_fileName) {
  throw new Error('Original paper file path is missing from Set node.');
}

if (!gatheredInfo.Papaer_analysis_fileName) {
  throw new Error('Paper analysis file name is missing from Set node.');
}

// Get optional file paths (may be null/undefined if features not enabled)
const reviewLogPath = gatheredInfo.step1_review_filePath || null;
const learningGuidePath = gatheredInfo.file_path || null;

console.log('File paths detected:', {
  original_paper: gatheredInfo.Original_paper_fileName,
  paper_analysis: gatheredInfo.Papaer_analysis_fileName,
  review_log: reviewLogPath || 'NOT GENERATED (review logging disabled)',
  learning_guide: learningGuidePath || 'NOT GENERATED (learning assist disabled)'
});

// Get file paths and metadata (NOT content)
const paperTextInfo = $('Prepare Paper Text as Resource File').first().json;
if (!paperTextInfo) {
  throw new Error('Cannot retrieve paper text info.');
}

const analysisRouterOutput = $('Paper Analyze Pass?').item.json;
const analysisFilePath = analysisRouterOutput.file_path;

// Get the manifest content from the beginning of the subflow
const manifestContext = $('Obtain Manifest Information for Paper Analysis').first().json;
const manifestContent = manifestContext.manifestContent;
const manifestPath = manifestContext.manifestPath;

// Update originalPaper - METADATA ONLY
manifestContent.generatedArtifacts.originalPaper = {
  status: "completed",
  filePath: paperTextInfo.filePath,
  uploadedAt: paperTextInfo.timestamp,
  textLength: paperTextInfo.textLength,
  wordCount: paperTextInfo.wordCount,
  lineCount: paperTextInfo.lineCount
};

// Update paperAnalysis - FILE PATH ONLY, NO CONTENT
manifestContent.generatedArtifacts.paperAnalysis = {
  status: "completed",
  filePath: analysisFilePath,
  version: manifestContent.generatedArtifacts.paperAnalysis.version || 1,
  startedAt: manifestContent.generatedArtifacts.paperAnalysis.startedAt,
  completedAt: new Date().toISOString(),
  iterationCount: manifestContent.generatedArtifacts.paperAnalysis.iterationCount + 1,
  lastError: null
};

// Update paperLearningGuide - OPTIONAL (only if learning assistance was enabled)
if (learningGuidePath) {
  console.log('✓ Learning guide path found, updating manifest');
  
  // Get learning guide metadata if available
  let learningGuideWordCount = null;
  let verificationWarnings = 0;
  
  try {
    const learningGuideInfo = $('Process Learning Assistant Output').first().json;
    learningGuideWordCount = learningGuideInfo.wordCount || null;
    verificationWarnings = learningGuideInfo.verificationWarnings || 0;
  } catch (error) {
    console.warn('⚠️ Could not retrieve learning guide metadata:', error.message);
  }
  
  manifestContent.generatedArtifacts.paperLearningGuide = {
    status: "completed",
    filePath: learningGuidePath,
    requested: true,
    createdAt: new Date().toISOString(),
    wordCount: learningGuideWordCount,
    verificationWarnings: verificationWarnings
  };
} else {
  console.log('ℹ️ No learning guide path - feature was not enabled');
  // Keep status as pending or mark as not requested
  manifestContent.generatedArtifacts.paperLearningGuide.status = "not_requested";
  manifestContent.generatedArtifacts.paperLearningGuide.requested = false;
}

// Update reviewLogs.paperAnalysisReview - OPTIONAL (only if review logging was enabled)
if (reviewLogPath) {
  console.log('✓ Review log path found, updating manifest');
  
  // Get review log metadata if available
  let totalRounds = 0;
  let finalStatus = 'unknown';
  let learningAssistUsed = false;
  
  try {
    const reviewLogInfo = $('Prepare Paper Analysis Review File').first().json;
    totalRounds = reviewLogInfo.totalRounds || 0;
    finalStatus = reviewLogInfo.finalStatus || 'unknown';
    learningAssistUsed = reviewLogInfo.learningAssistUsed || false;
  } catch (error) {
    console.warn('⚠️ Could not retrieve review log metadata:', error.message);
  }
  
  manifestContent.reviewLogs.paperAnalysisReview = {
    filePath: reviewLogPath,
    totalRounds: totalRounds,
    finalStatus: finalStatus,
    lastUpdated: new Date().toISOString(),
    learningAssistUsed: learningAssistUsed
  };
} else {
  console.log('ℹ️ No review log path - review logging was not enabled');
  // Keep reviewLogs.paperAnalysisReview as is (with null filePath)
  manifestContent.reviewLogs.paperAnalysisReview.filePath = null;
  manifestContent.reviewLogs.paperAnalysisReview.lastUpdated = new Date().toISOString();
}

// Update process state
manifestContent.processState.currentStep = "Paper Analysis Complete";
manifestContent.processState.lastUpdated = new Date().toISOString();

console.log('✓ Manifest updated successfully:', {
  sessionId: manifestContext.sessionId,
  originalPaperFile: paperTextInfo.filePath,
  analysisFile: analysisFilePath,
  learningGuideFile: learningGuidePath || 'N/A',
  reviewLogFile: reviewLogPath || 'N/A'
});

// Return updated manifest
return {
  manifestPath: manifestPath,
  manifestContent: manifestContent,
  data: JSON.stringify(manifestContent, null, 2)
};