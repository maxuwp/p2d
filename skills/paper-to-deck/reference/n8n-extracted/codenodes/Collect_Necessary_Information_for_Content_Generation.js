// NODE NAME: Collect Necessary Information for Content Generation

// Collect Necessary Information and Initialize Session - V9 (Hierarchical Slide Numbering)
// This version implements hierarchical slide numbering (1.1, 1.2, 2.1, etc.)
// and filters out sections with empty slides arrays.

console.log('=== Collecting Necessary Information (V9 - Hierarchical Numbering) ===');

// Get manifest info (for paths and global context)
const manifestInfo = $('Obtain Manifest Information and Select Next Step').first().json;
const manifestContent = manifestInfo.manifestContent;

// Get merged file contents
const mergedData = $('Merge Information for Slides and Notes').all();
console.log('Merge inputs received:', mergedData.length);

if (mergedData.length < 3) {
  throw new Error('Merge node expects 3 inputs. Received ' + mergedData.length + '. Please connect [Outline, Persona, OriginalPaper] in that order.');
}

// ===========================================
// EXTRACT ALL INPUTS (CORRECT ORDER)
// ===========================================

// Input 0: Outline (JSON)
let outlineData = null;
const outlineRaw = mergedData[0].json;
if (outlineRaw.data) {
  outlineData = (typeof outlineRaw.data === 'string') 
    ? JSON.parse(outlineRaw.data) 
    : outlineRaw.data;
} else {
  outlineData = outlineRaw;
}
if (outlineData && outlineData.auditTrail) {
  delete outlineData.auditTrail;
}
console.log('✓ Loaded Outline (JSON)');

// Input 1: Persona (Text/Markdown)
const personaRaw = mergedData[1].json;
const personaText = personaRaw.data || '';
if (!personaText || !personaText.includes('Presentation Style')) {
  console.warn('Input 1 does not look like a Persona file.');
}
console.log(`✓ Loaded Persona (Text, ${personaText.length} chars)`);

// Input 2: Original Paper (Text)
const paperRaw = mergedData[2].json;
const originalPaperText = paperRaw.data || paperRaw.text || '';
console.log(`✓ Loaded Original Paper (Text, ${originalPaperText.length} chars)`);

// ===========================================
// DERIVE PAPER ANALYSIS FROM OUTLINE
// ===========================================
console.log('Deriving paper analysis context from outline...');
const allObjectives = [];
const contributions = [];

if (outlineData && outlineData.sections) {
  outlineData.sections.forEach(section => {
    const title = (section.subtopic_title || '').toLowerCase();
    const isMetaSlide = title.includes('title slide') || 
                        title.includes('end slide') ||
                        title.includes('thank you') ||
                        title.includes('questions');
                        
    if (!isMetaSlide && section.subtopic_title) {
       const cleanTitle = section.subtopic_title
          .replace(/^(Introduction to |Overview of |Understanding )/i, '')
          .replace(/( & Context| & Discussion| & Future Directions)$/i, '');
      contributions.push(cleanTitle);
    }
    if (section.learning_objectives && Array.isArray(section.learning_objectives)) {
      allObjectives.push(...section.learning_objectives);
    }
  });
}

const paperAnalysisData = {
  main_contribution: contributions.length > 0 ? contributions : [outlineData?.presentation_title || "Main Topic"],
  main_objective: allObjectives.length > 0 ? allObjectives.slice(0, 5) : ["Understand key concepts"],
  paper_structure: "Derived from outline sections"
};
console.log('✓ Derived paper context:', paperAnalysisData.main_contribution);

// ===========================================
// EXTRACT GLOBAL CONTEXT (from Manifest)
// ===========================================
const presentationTitle = outlineData?.presentation_title || 
                          manifestContent.initialRequest?.mainTopic || 
                          'Presentation';
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

// ===========================================
// PROCESS SECTIONS (FILTER OUT META SLIDES)
// ===========================================
const allSections = outlineData?.sections || [];
const contentSections = [];

allSections.forEach((section, originalIndex) => {
  const title = (section.subtopic_title || '').toLowerCase();
  const isExcluded = title === 'title slide' || 
                     title === 'end slide' || 
                     title === 'thank you' ||
                     title === 'questions' ||
                     (title.includes('title') && title.includes('slide') && originalIndex === 0) ||
                     (title.includes('end') && title.includes('slide') && originalIndex === allSections.length - 1);
  
  if (!isExcluded) {
    contentSections.push(section);
  }
});

if (contentSections.length === 0) {
  console.warn('WARNING: No content sections found, creating default structure');
  contentSections.push({
    subtopic_title: paperAnalysisData.main_contribution[0] || "Main Topic",
    slides: [{ slide_number: 1, slide_type: 'Content', slide_title: 'Overview', key_points: ['...'] }],
    learning_objectives: paperAnalysisData.main_objective.slice(0, 1),
    paper_section_alignment: 'General'
  });
}

// Calculate timing
const totalMinutes = context.eventDuration;
const minutesPerSection = totalMinutes / Math.max(contentSections.length, 1);

// ===========================================
// BUILD FINAL SECTIONS ARRAY WITH HIERARCHICAL NUMBERING
// ===========================================
console.log('=== APPLYING HIERARCHICAL SLIDE NUMBERING ===');

const sections = contentSections
  .filter(section => {
    // Filter out sections with no slides or empty slides array
    const hasSlides = section.slides && Array.isArray(section.slides) && section.slides.length > 0;
    if (!hasSlides) {
      console.warn(`⚠️  Removing section "${section.subtopic_title}" - no slides found`);
    }
    return hasSlides;
  })
  .map((section, i) => {
    const sectionNumber = i + 1; // Major number (1, 2, 3...)
    const originalSlides = section.slides || [];
    
    // Renumber all slides in this section with hierarchical format
    const renumberedSlides = originalSlides.map((slide, j) => {
      const minorNumber = j + 1; // Minor number (1, 2, 3...)
      const newSlideNumber = `${sectionNumber}.${minorNumber}`; // e.g., "1.1", "1.2", "2.1"
      
      console.log(`  Section ${sectionNumber}, Slide ${j + 1}: "${slide.slide_title}" → ${newSlideNumber}`);
      
      return {
        ...slide,
        slide_number: newSlideNumber // OVERWRITE with hierarchical format
      };
    });
    
    const slideCount = renumberedSlides.length;
    const sectionDuration = minutesPerSection;
    const targetWords = Math.round(sectionDuration * 175); // 175 words per minute

    console.log(`✓ Section ${sectionNumber} "${section.subtopic_title}": ${slideCount} slides (${renumberedSlides[0]?.slide_number} to ${renumberedSlides[slideCount - 1]?.slide_number})`);

    return {
      section_index: i,
      section_id: `section_${String(sectionNumber).padStart(2, '0')}`,
      subtopic_title: section.subtopic_title || `Section ${sectionNumber}`,
      paper_section_alignment: section.paper_section_alignment || 'General',
      learning_objectives: section.learning_objectives || [],
      slides: renumberedSlides, // Use renumbered slides
      slide_count: slideCount,
      target_word_count: targetWords,
      duration_minutes: sectionDuration,
      current_iteration: 1,
      max_iterations: 3,
    };
  });

// ===========================================
// FINAL OUTPUT
// ===========================================
console.log('✓ Session ready with hierarchical numbering:');
console.log(`  Title: ${presentationTitle}`);
console.log(`  Sections: ${sections.length}`);
console.log(`  Total slides: ${sections.reduce((sum, s) => sum + s.slide_count, 0)}`);

// Validate that we have at least one section
if (sections.length === 0) {
  throw new Error('CRITICAL: No valid content sections remain after filtering. Check outline structure.');
}

return {
  // Global Session/Context data
  presentationTitle: presentationTitle,
  instructorName: instructorName,
  sessionFolder: sessionFolder,
  sessionId: sessionId,
  context: context,
  
  // Global Content (processed from files)
  paperAnalysis: paperAnalysisData,
  persona: personaText,
  originalPaper: originalPaperText.substring(0, 5000), // Truncate
  
  // The clean sections array with hierarchical slide numbering
  sections: sections,

  // Data needed by other nodes (via absolute reference)
  manifestPath: manifestInfo.manifestPath,
  filePaths: {
    paperAnalysis: manifestInfo.paperAnalysisPath,
    persona: manifestInfo.professorPersonaPath,
    originalPaper: manifestInfo.originalPaperPath,
    outline: manifestInfo.detailedOutlinePath,
    manifest: manifestInfo.manifestPath
  },
};