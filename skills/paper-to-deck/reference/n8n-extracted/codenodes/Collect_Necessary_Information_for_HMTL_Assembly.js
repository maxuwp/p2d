// NODE NAME: Collect Necessary Information for HMTL Assembly

// Collect Necessary Information for Presentation Implementation
// Handles 4 inputs: [Slides MD, Notes MD, Persona, Original Paper]

console.log('=== Collecting Information for Presentation Implementation ===');

// Get manifest info for global context
const manifestInfo = $('Obtain Manifest Information and Select Next Step').first().json;
const manifestContent = manifestInfo.manifestContent;

// Get merged file contents
const mergedData = $('Merge Information for Presentation Implementation').all();
console.log('Merge inputs received:', mergedData.length);

if (mergedData.length < 4) {
  throw new Error('Merge node expects 4 inputs. Received ' + mergedData.length + '. Please connect [Slides MD, Notes MD, Persona, Paper] in that order.');
}

// ===========================================
// EXTRACT ALL INPUTS (CORRECT ORDER)
// ===========================================

// Input 0: Slides Markdown (from Subflow 4)
const slidesRaw = mergedData[0].json;
const slidesMarkdown = slidesRaw.data || '';
if (!slidesMarkdown || slidesMarkdown.trim().length === 0) {
  throw new Error('Input 0: Slides markdown is empty. Check Subflow 4 output.');
}
console.log(`✓ Loaded Slides MD (${slidesMarkdown.length} chars)`);

// Input 1: Notes Markdown (from Subflow 4)
const notesRaw = mergedData[1].json;
const notesMarkdown = notesRaw.data || '';
if (!notesMarkdown || notesMarkdown.trim().length === 0) {
  throw new Error('Input 1: Notes markdown is empty. Check Subflow 4 output.');
}
console.log(`✓ Loaded Notes MD (${notesMarkdown.length} chars)`);

// Input 2: Persona (Text)
const personaRaw = mergedData[2].json;
const personaText = personaRaw.data || '';
if (!personaText || !personaText.includes('Presentation Style')) {
  console.warn('Input 2 does not look like a Persona file.');
}
console.log(`✓ Loaded Persona (${personaText.length} chars)`);

// Input 3: Original Paper (Text)
const paperRaw = mergedData[3].json;
const originalPaperText = paperRaw.data || paperRaw.text || '';
console.log(`✓ Loaded Original Paper (${originalPaperText.length} chars)`);

// ===========================================
// EXTRACT GLOBAL CONTEXT
// ===========================================
const presentationTitle = manifestContent.initialRequest?.mainTopic || 'Presentation';
const instructorName = manifestContent.instructorInfo?.name || 'Instructor';
const sessionFolder = manifestContent.sessionInfo?.sessionFolderPath || '/files/session/';
const sessionId = manifestContent.sessionInfo?.sessionId || 'session';

const context = {
  audience: manifestContent.initialRequest?.audienceLevel || 'General Audience',
  prerequisites: manifestContent.initialRequest?.prerequisites || 'None',
  purpose: manifestContent.initialRequest?.modulePurpose || 'Educational presentation',
  otherContext: manifestContent.initialRequest?.otherContext || '',
  eventDuration: manifestContent.initialRequest?.eventDuration || 15,
  specialGuidelines: manifestContent.initialRequest?.specialGuidelines || ''  
};

console.log('✓ Session Info:');
console.log(`  Title: ${presentationTitle}`);
console.log(`  Instructor: ${instructorName}`);
console.log(`  Session: ${sessionId}`);

// ===========================================
// ✨ NEW: DEFINE PATHS & PREPARE FOLDER CREATION
// ===========================================
const finalPresentationFolder = `${sessionFolder}FinalPresentation/`;
const aiImageFolder = `${finalPresentationFolder}AiImage/`;

console.log(`✓ Defining presentation asset paths:`);
console.log(`  Presentation Folder: ${finalPresentationFolder}`);
console.log(`  AI Image Folder: ${aiImageFolder}`);

// 1. Update the manifest object with the new paths
manifestContent.generatedArtifacts.finalPresentation.status = 'in_progress_setup';
manifestContent.generatedArtifacts.finalPresentation.folderPath = finalPresentationFolder;
// Note: I'm adding a new key 'aiImagePath' for future reference.
manifestContent.generatedArtifacts.finalPresentation.aiImagePath = aiImageFolder; 

// 2. Create the shell command to create both directories
// The -p flag ensures parent directories are created and doesn't error if they exist
const shellCommand = `mkdir -p "${aiImageFolder}"`;
console.log(`  Shell Command: ${shellCommand}`);


// ===========================================
// RETURN COLLECTED DATA (for Slide Parser)
// ===========================================
return {
  // Content for parsing
  slidesMarkdown: slidesMarkdown,
  notesMarkdown: notesMarkdown,
  
  // Context data
  persona: personaText,
  originalPaper: originalPaperText.substring(0, 5000), // Truncate for context
  
  // Session info
  sessionInfo: {
    presentationTitle: presentationTitle,
    instructorName: instructorName,
    sessionFolder: sessionFolder,
    sessionId: sessionId,
    context: context
  },
  
  // Paths for reference
  manifestPath: manifestInfo.manifestPath,
  manifestContent: manifestContent, // This now contains the updated paths
  
  // ✨ NEW: Command for the next node
  shellCommand: shellCommand
};