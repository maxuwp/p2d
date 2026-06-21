// NODE NAME: Obtain Manifest Information and Select Next Step

// ============================================================================
// Obtain Manifest Information and Select Next Step (CORRECTED)
// Purpose: For CONTINUE path - Step 1 is always done, so start from step2
// ============================================================================

const manifestPath = $('Initialization Step?').first().json['Session Manifest File Path (Required for Continue)'];
const extractedArray = $input.all();
const manifestContent = extractedArray[0].json.data;

console.log('=== Loading Manifest and Analyzing Progress ===');

// Validate manifest structure
if (!manifestContent?.sessionInfo) {
  throw new Error('Invalid manifest: missing sessionInfo');
}

if (!manifestContent?.generatedArtifacts) {
  throw new Error('Invalid manifest: missing generatedArtifacts');
}

// Extract essential information
const sessionId = manifestContent.sessionInfo.sessionId;
const sessionFolder = manifestContent.sessionInfo.sessionFolderPath;
const instructorName = manifestContent.instructorInfo?.name || 'Unknown Instructor';
const presentationTitle = manifestContent.initialRequest?.mainTopic || 'Untitled Presentation';

// Extract artifact file paths
const artifacts = manifestContent.generatedArtifacts;
const slidesPath = artifacts.draftSlides?.filePath;
const notesPath = artifacts.draftNotes?.filePath;
const professorPersonaPath = artifacts.professorPersona?.filePath;
const originalPaperPath = artifacts.originalPaper?.filePath;
const paperAnalysisPath = artifacts.paperAnalysis?.filePath;
const detailedOutlinePath = artifacts.detailedOutline?.filePath;

// Analyze Completed Steps (CONTINUE path assumes step1 is always done)
const completedSteps = ['step1']; // Step 1 always completed in continue path

if (artifacts.professorPersona?.status === 'completed') {
  completedSteps.push('step2');
  console.log('✓ Step 2: Persona Retrieval - Completed');
}

if (artifacts.detailedOutline?.status === 'completed') {
  completedSteps.push('step3');
  console.log('✓ Step 3: Outline Creation - Completed');
}

if (artifacts.draftSlides?.status === 'complete' && artifacts.draftNotes?.status === 'complete') {
  completedSteps.push('step4');
  console.log('✓ Step 4: Content Generation - Completed');
}

if (artifacts.finalPresentation?.status === 'completed') {
  completedSteps.push('step5');
  console.log('✓ Step 5: HTML Assembly - Completed');
}

if (!manifestContent.completedSteps) {
  manifestContent.completedSteps = completedSteps;
}

console.log('Total Completed Steps:', completedSteps.length, '/', 5);

// Define steps for CONTINUE path (step2-step5 only)
const continueSteps = [
  { id: 'step2', name: 'Persona Retrieval', description: 'Extract presenter style', outputIndex: 0 },
  { id: 'step3', name: 'Outline Creation', description: 'Generate outline', outputIndex: 1 },
  { id: 'step4', name: 'Content Generation', description: 'Create slides and notes', outputIndex: 2 },
  { id: 'step5', name: 'HTML Assembly', description: 'Compile final presentation', outputIndex: 3 }
];

// Find next step (only from step2-step5)
let nextStep = null;
for (const step of continueSteps) {
  if (!completedSteps.includes(step.id)) {
    nextStep = step;
    break;
  }
}

const totalSteps = 5; // Total including step1
const completedCount = completedSteps.length;
const percentComplete = Math.round((completedCount / totalSteps) * 100);

// Build progress display
let progressDisplay = '\n========================================\n';
progressDisplay += '      PRESENTATION CREATION PROGRESS\n';
progressDisplay += '========================================\n';
progressDisplay += `Session ID: ${sessionId}\n`;
progressDisplay += `Instructor: ${instructorName}\n`;
progressDisplay += `Topic: ${presentationTitle}\n\n`;

// Show all 5 steps in display
const allStepsDisplay = [
  { id: 'step1', name: 'Paper Analysis' },
  { id: 'step2', name: 'Persona Retrieval' },
  { id: 'step3', name: 'Outline Creation' },
  { id: 'step4', name: 'Content Generation' },
  { id: 'step5', name: 'HTML Assembly' }
];

for (const step of allStepsDisplay) {
  const isCompleted = completedSteps.includes(step.id);
  const isNext = nextStep && step.id === nextStep.id;
  
  let icon = isCompleted ? '✓' : (isNext ? '→' : ' ');
  let status = isCompleted ? '[COMPLETED]' : (isNext ? '[READY] ← Recommended' : '[LOCKED]');
  
  progressDisplay += `${icon} ${step.name.padEnd(25)} ${status}\n`;
}

progressDisplay += `\nProgress: ${percentComplete}% (${completedCount}/${totalSteps} steps)\n`;
progressDisplay += nextStep ? `Next: ${nextStep.name}\n` : 'Status: All Complete! 🎉\n';
progressDisplay += '========================================\n';

console.log(progressDisplay);

// Validate required files exist for next step
if (nextStep) {
  const missingFiles = [];
  
  // All steps need paper analysis
  if (!paperAnalysisPath) {
    missingFiles.push('paperAnalysis');
  }
  
  // Step3+ needs persona
  if (['step3', 'step4', 'step5'].includes(nextStep.id) && !professorPersonaPath) {
    missingFiles.push('professorPersona');
  }
  
  // Step4+ needs outline
  if (['step4', 'step5'].includes(nextStep.id) && !detailedOutlinePath) {
    missingFiles.push('detailedOutline');
  }
  
  // Step5 needs slides and notes
  if (nextStep.id === 'step5' && (!slidesPath || !notesPath)) {
    missingFiles.push('slides/notes');
  }
  
  if (missingFiles.length > 0) {
    throw new Error(`Cannot proceed with ${nextStep.name}. Missing required files: ${missingFiles.join(', ')}. Please complete previous steps first.`);
  }
}

// Return all data
return {
  manifestPath: manifestPath,
  manifestContent: manifestContent,
  sessionId: sessionId,
  sessionFolder: sessionFolder,
  instructorName: instructorName,
  presentationTitle: presentationTitle,
  professorPersonaPath: professorPersonaPath,
  originalPaperPath: originalPaperPath,
  paperAnalysisPath: paperAnalysisPath,
  detailedOutlinePath: detailedOutlinePath,
  slides_file: { path: slidesPath, type: 'markdown' },
  notes_file: { path: notesPath, type: 'markdown' },
  completedSteps: completedSteps,
  nextRecommendedStep: nextStep?.id || 'complete',
  nextStepName: nextStep?.name || 'All Complete',
  nextStepOutputIndex: nextStep?.outputIndex ?? -1,
  progressDisplay: progressDisplay,
  percentComplete: percentComplete,
  allStepsCompleted: !nextStep,
  timestamp: new Date().toISOString()
};