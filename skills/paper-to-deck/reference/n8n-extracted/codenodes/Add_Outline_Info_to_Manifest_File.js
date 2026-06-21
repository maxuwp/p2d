// NODE NAME: Add Outline Info to Manifest File

// ============================================================================
// Node: Add Outline Info to Manifest File (UPDATED FOR SECTIONS STRUCTURE)
// Purpose: Update manifest with outline file path and metadata
// ============================================================================

console.log('=== Add Outline Info to Manifest File ===');

// Get outline file info from the router decision
const outlineDecision = $('Outline pass?').item.json;
const outlineFilePath = outlineDecision.file_path;
const outlineContent = outlineDecision.data || '{}';

if (!outlineFilePath) {
  throw new Error('Outline file path is missing from pass decision.');
}

// Parse outline to extract metadata
let outlineData;
try {
  outlineData = JSON.parse(outlineContent);
} catch (error) {
  throw new Error('Failed to parse outline content: ' + error.message);
}

// Calculate metadata from sections structure
const wordCount = outlineContent.split(/\s+/).filter(word => word.length > 0).length;
const charCount = outlineContent.length;

let totalSlides = 0;
let contentSlides = 0;
let totalSections = 0;
let contentSections = 0;

if (Array.isArray(outlineData.sections)) {
  totalSections = outlineData.sections.length;
  
  outlineData.sections.forEach(section => {
    if (Array.isArray(section.slides)) {
      totalSlides += section.slides.length;
      
      section.slides.forEach(slide => {
        if (slide.slide_type === 'Content') {
          contentSlides++;
        }
      });
      
      // Count content sections (exclude Title and End)
      if (section.subtopic_title !== 'Title Slide' && 
          section.subtopic_title !== 'End Slide') {
        contentSections++;
      }
    }
  });
}

// Get the manifest content from the beginning of the subflow
const manifestContext = $('Obtain Manifest Information and Select Next Step').first().json;
const manifestContent = manifestContext.manifestContent;
const manifestPath = manifestContext.manifestPath;

// Update detailedOutline artifact with comprehensive metadata
manifestContent.generatedArtifacts.detailedOutline = {
  status: "completed",
  filePath: outlineFilePath,
  format: "json",
  structure: "sections", // Indicate we're using sections structure
  version: manifestContent.generatedArtifacts.detailedOutline.version || 1,
  startedAt: manifestContent.generatedArtifacts.detailedOutline.startedAt,
  completedAt: new Date().toISOString(),
  iterationCount: manifestContent.generatedArtifacts.detailedOutline.iterationCount + 1,
  
  // Presentation metadata
  presentationTitle: outlineData.presentation_title || 'Untitled',
  targetDuration: outlineData.target_duration_minutes || null,
  
  // Structure metadata
  totalSections: totalSections,
  contentSections: contentSections,
  totalSlides: totalSlides,
  contentSlides: contentSlides,
  
  // File metadata
  wordCount: wordCount,
  characterCount: charCount,
  lastError: null
};

// Add audit trail entry
manifestContent.auditTrail.push({
  timestamp: new Date().toISOString(),
  event: 'Detailed Outline Completed',
  step: 'outline_creation',
  filePath: outlineFilePath,
  instructor: manifestContext.instructorName,
  iteration: manifestContent.generatedArtifacts.detailedOutline.iterationCount,
  totalSections: totalSections,
  contentSections: contentSections,
  totalSlides: totalSlides,
  contentSlides: contentSlides,
  presentationTitle: outlineData.presentation_title
});

// Update process state
manifestContent.processState.currentStep = "Outline Creation Complete";
manifestContent.processState.lastUpdated = new Date().toISOString();

console.log('✓ Manifest updated with outline metadata:', {
  sessionId: manifestContext.sessionId,
  outlineFile: outlineFilePath,
  instructor: manifestContext.instructorName,
  format: 'json',
  structure: 'sections',
  totalSections: totalSections,
  contentSections: contentSections,
  totalSlides: totalSlides,
  contentSlides: contentSlides,
  wordCount: wordCount
});

// Return updated manifest for writing
return {
  manifestPath: manifestPath,
  manifestContent: manifestContent,
  data: JSON.stringify(manifestContent, null, 2)
};