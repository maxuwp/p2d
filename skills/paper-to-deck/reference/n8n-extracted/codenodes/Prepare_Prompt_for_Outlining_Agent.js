// NODE NAME: Prepare Prompt for Outlining Agent

// ===========================================================================
// Node: Prepare Prompt for Outlining Agent (COMPLETE REWRITE)
// Purpose: Build comprehensive prompts with full paper text for both initial 
//          creation and revision paths
// ===========================================================================

console.log('=== Prepare Prompt for Outlining Agent (Enhanced with Full Paper) ===');

// ALWAYS get manifest context using absolute reference
const manifestContext = $('Obtain Manifest Information and Select Next Step').first().json;
const sessionId = manifestContext.sessionId;
const initialRequest = manifestContext.initialRequest;
const instructorName = manifestContext.instructorName;

// Check which path we're on by looking at the router decision
let inputData;
let isRevision = false;

try {
  // Try to get data from the router (revision path)
  inputData = $('Outline pass?').last().json;
  isRevision = inputData.is_revision || false;
  console.log('Got input from router node (revision path)');
} catch (error) {
  // If router hasn't run yet, we're on initial path
  inputData = {};
  isRevision = false;
  console.log('Router not available, assuming initial path');
}

const userFeedback = inputData.revision_data?.user_feedback || null;
const previousOutline = inputData.revision_data?.previous_outline || null;

console.log('Execution mode:', {
  isRevision: isRevision,
  hasUserFeedback: !!userFeedback,
  hasPreviousOutline: !!previousOutline
});

// Extract presentation parameters from initial request
const mainTopic = initialRequest.mainTopic || 'Untitled Topic';
const audienceLevel = initialRequest.audienceLevel || 'General Audience';
const eventDuration = parseInt(initialRequest.eventDuration) || 15;
const prerequisites = initialRequest.prerequisites || 'None specified';
const modulePurpose = initialRequest.modulePurpose || 'Educational presentation';
const otherContext = initialRequest.otherContext || '';

// Calculate timing constraints
const timePerContentSlide = initialRequest.minutesPerSlide || 1.5;
const totalContentSlides = Math.round(eventDuration / timePerContentSlide);
const totalSlides = totalContentSlides + 2; // +2 for Title and End

// ===========================================================================
// Extract ALL three data sources from the merge node
// ===========================================================================

let mergedData;
try {
  mergedData = $('Merge Information from paper analysis and persona file').all();
  
  if (!mergedData || mergedData.length < 3) {
    throw new Error(`Merge node has insufficient outputs. Expected 3, got ${mergedData?.length || 0}`);
  }
  
  console.log('✓ Retrieved merged data using absolute reference:', {
    itemCount: mergedData.length
  });
} catch (error) {
  console.error('Failed to get merge node data:', error.message);
  throw new Error('Cannot access merge node. Ensure all three inputs (Paper Analysis, Persona, Original Paper) are connected and executed. Error: ' + error.message);
}

// ===========================================================================
// 1. Extract Paper Analysis (Index 0) - FLEXIBLE VALIDATION
// ===========================================================================
let paperAnalysis;
try {
  const paperAnalysisData = mergedData[0].json;
  
  if (paperAnalysisData.data) {
    paperAnalysis = typeof paperAnalysisData.data === 'string' 
      ? JSON.parse(paperAnalysisData.data) 
      : paperAnalysisData.data;
  } else {
    paperAnalysis = paperAnalysisData;
  }
  
  // Flexible validation - check what fields we have (not required, just informational)
  const expectedFields = [
    'main_thesis', 'paper_type', 'key_themes', 'key_comparisons', 
    'implicit_structures', 'evidence_types',
    'paper_structure', 'main_contribution', 'main_objective', 'references_text'
  ];
  
  const presentFields = expectedFields.filter(field => paperAnalysis[field]);
  const missingFields = expectedFields.filter(field => !paperAnalysis[field]);
  
  console.log('✓ Paper analysis loaded (flexible mode):', {
    totalFields: Object.keys(paperAnalysis).length,
    expectedFields: expectedFields.length,
    presentFields: presentFields.length,
    missingFields: missingFields.length > 0 ? missingFields : 'none'
  });
  
  // Log detailed field presence for debugging
  console.log('Field availability:', {
    // Thematic fields
    hasThesis: !!paperAnalysis.main_thesis,
    hasPaperType: !!paperAnalysis.paper_type,
    themesCount: paperAnalysis.key_themes?.length || 0,
    comparisonsCount: paperAnalysis.key_comparisons?.length || 0,
    structuresCount: paperAnalysis.implicit_structures?.length || 0,
    evidenceTypesCount: paperAnalysis.evidence_types?.length || 0,
    // Structure fields
    hasStructure: !!paperAnalysis.paper_structure,
    contributionsCount: paperAnalysis.main_contribution?.length || 0,
    objectivesCount: paperAnalysis.main_objective?.length || 0,
    hasReferences: !!paperAnalysis.references_text
  });
  
  // Only fail if the file is completely empty or invalid
  if (!paperAnalysis || Object.keys(paperAnalysis).length === 0) {
    throw new Error('Paper analysis file is empty or invalid JSON');
  }
  
  // Warn if critical presentation fields are missing, but continue
  if (!paperAnalysis.main_contribution && !paperAnalysis.main_objective) {
    console.warn('⚠️ WARNING: Both main_contribution and main_objective are missing. Presentation outline may lack detail.');
  }
  
} catch (error) {
  console.error('Paper analysis error:', error.message);
  throw new Error('Failed to parse paper analysis from merge node: ' + error.message);
}

// ===========================================================================
// 2. Extract Professor Persona (Index 1) - FLEXIBLE VALIDATION
// ===========================================================================
let professorPersona;
try {
  const personaData = mergedData[1].json;
  
  if (personaData.data) {
    professorPersona = personaData.data;
  } else if (personaData.text) {
    professorPersona = personaData.text;
  } else {
    professorPersona = JSON.stringify(personaData);
  }
  
  console.log('✓ Professor persona loaded (flexible mode):', {
    length: professorPersona.length,
    preview: professorPersona.substring(0, 100) + '...'
  });
  
  // Only fail if completely empty
  if (!professorPersona || professorPersona.trim().length === 0) {
    throw new Error('Professor persona is empty');
  }
  
  // Warn if unusually short, but continue
  if (professorPersona.length < 100) {
    console.warn('⚠️ WARNING: Professor persona is unusually short (' + professorPersona.length + ' chars). Outline may lack style guidance.');
  }
  
} catch (error) {
  console.error('Persona error:', error.message);
  throw new Error('Failed to parse professor persona from merge node: ' + error.message);
}

// ===========================================================================
// 3. Extract Full Paper Text (Index 2) - FLEXIBLE VALIDATION
// ===========================================================================
let fullPaperText;
try {
  const paperData = mergedData[2].json;
  
  if (paperData.data) {
    fullPaperText = paperData.data;
  } else if (paperData.text) {
    fullPaperText = paperData.text;
  } else {
    fullPaperText = JSON.stringify(paperData);
  }
  
  console.log('✓ Full paper text loaded (flexible mode):', {
    length: fullPaperText.length,
    wordCount: fullPaperText.split(/\s+/).length,
    preview: fullPaperText.substring(0, 200) + '...'
  });
  
  // Only fail if completely empty
  if (!fullPaperText || fullPaperText.trim().length === 0) {
    throw new Error('Full paper text is empty');
  }
  
  // Warn if unusually short, but continue
  if (fullPaperText.length < 500) {
    console.warn('⚠️ WARNING: Full paper text is unusually short (' + fullPaperText.length + ' chars). May lack sufficient content for detailed outline.');
  }
  
} catch (error) {
  console.error('Full paper text error:', error.message);
  throw new Error('Failed to extract full paper text from merge node: ' + error.message);
}

// ===========================================================================
// Prepare common data elements
// ===========================================================================
const paperAnalysisJson = JSON.stringify(paperAnalysis, null, 2);

let completePrompt = '';
let metadata = {};

// ===========================================================================
// BRANCH: REVISION PATH
// ===========================================================================
if (isRevision && userFeedback && previousOutline) {
  console.log('✓ Building REVISION prompt with full paper text');
  
  const iterationCount = inputData.revision_data?.iteration_count || 1;
  
  completePrompt = `You are an expert Presentation Strategist and Research Analyst. Your task is to REVISE the existing presentation outline based on the [User Feedback] provided below.

## [1. Source Paper Text] (Ground Truth for Verification)
This is the full academic paper. Use this to verify facts, find additional details, or restructure arguments as needed based on feedback.
---
${fullPaperText}
---

## [2. Paper Analysis]
Comprehensive analysis with thematic and structural insights to guide your outline.
---
${paperAnalysisJson}
---

## [3. Persona Profile] (Style Guide)
This is the presenter's style. Maintain this tone in all slide titles and content.
---
${professorPersona}
---

## [4. Previous Outline] (Current Version to Revise)
This is the outline that needs revision.
---
${JSON.stringify(previousOutline, null, 2)}
---

## [5. User Feedback] (Required Changes)
The user has requested the following changes:
---
${userFeedback}
---

## [6. Presentation Constraints] (Must Be Maintained)
- **Main Topic:** ${mainTopic}
- **Audience:** ${audienceLevel}
- **Duration:** ${eventDuration} minutes
- **Target Total Slides:** ${totalSlides}
- **Target Content Slides:** ${totalContentSlides}

## [Your Revision Task]

**CRITICAL: Factual Accuracy and User Guidance**
You must balance two requirements:
1. **Ground in Source:** By default, all content derives from [Source Paper Text]
2. **Follow User Directives:** If [User Feedback] explicitly requests NEW content beyond the paper (e.g., "add future directions," "include this idea"), incorporate it exactly as requested

**Rules:**
- Paper-based content: Never invent. Only use what's in [Source Paper Text]
- User-directed content: If feedback says "add X" or "include my idea about Y", add it faithfully
- Ambiguous feedback: If unclear whether user wants paper content or new content, prefer paper content

1. **Address All Feedback:** You MUST incorporate every point from the [User Feedback]. 
   - If feedback requests structural changes, reorganize sections accordingly
   - If feedback adds new content directives, create slides reflecting those directives

2. **Verify Against Source:** For paper-based content, consult the [Source Paper Text] to find supporting evidence or corrections.
   - For user-directed new content, use the feedback text directly

3. **Maintain Persona:** All revised slide titles and key points must still match the style in the [Persona Profile].

4. **Preserve Structure:** Unless feedback explicitly requests structural changes, maintain the sections-based JSON structure with proper slide numbering.

5. **Respect Constraints:** The revised outline must still target ${totalSlides} total slides (including Title and End slides) for ${eventDuration} minutes.

## [Required Output Format]
You MUST output a single, valid JSON object with the exact schema below. Do not include any text or markdown outside the JSON object.

{
  "presentation_title": "Revised title if requested, or original title",
  "target_duration_minutes": ${eventDuration},
  "total_slides": ${totalSlides},
  "sections": [
    {
      "subtopic_title": "Section Title",
      "paper_section_alignment": "Corresponding paper section",
      "learning_objectives": ["Objective 1", "Objective 2"],
      "slides": [
        {
          "slide_number": 1,
          "slide_type": "Title" or "Content" or "End",
          "slide_title": "Slide Title Matching Persona",
          "key_points": ["Point 1", "Point 2"] or null for Title/End slides
        }
      ]
    }
  ]
}`;

  metadata = {
    session_id: sessionId,
    instructor_name: instructorName,
    is_revision: true,
    iteration: iterationCount,
    target_slides: totalSlides,
    content_slides: totalContentSlides,
    event_duration: eventDuration,
    full_paper_length: fullPaperText.length,
    timestamp: new Date().toISOString()
  };

  console.log('✓ Revision prompt prepared:', {
    session_id: sessionId,
    iteration: iterationCount,
    prompt_length: completePrompt.length,
    feedback_length: userFeedback.length,
    full_paper_included: true
  });

// ===========================================================================
// BRANCH: INITIAL CREATION PATH
// ===========================================================================
} else {
  console.log('✓ Building INITIAL CREATION prompt with full paper text');
  
  completePrompt = `You are an expert Presentation Strategist and Research Analyst. Your task is to create a detailed, insightful, and story-driven presentation outline based on the [Paper Analysis], [Persona Profile], and the full [Source Paper Text].

## [1. Source Paper Text] (Ground Truth)
This is the full academic paper. You MUST read this to find the *true* structure, specific data, and key arguments.
---
${fullPaperText}
---

## [2. Paper Analysis]
Comprehensive analysis with thematic and structural insights to guide your outline.
---
${paperAnalysisJson}
---

## [3. Persona Profile] (Style Guide)
This is the presenter's style. The slide titles and flow should match this tone (e.g., academic, structured, uses acronyms).
---
${professorPersona}
---

## [4. Presentation Constraints]
- **Main Topic:** ${mainTopic}
- **Audience:** ${audienceLevel}
- **Duration:** ${eventDuration} minutes
- **Target Total Slides:** ${totalSlides}
- **Target Content Slides:** ${totalContentSlides}
- **Prerequisites:** ${prerequisites}
- **Purpose:** ${modulePurpose}
${otherContext ? `- **Additional Context:** ${otherContext}` : ''}

## [Your Task & Cognitive Process]

**CRITICAL: Ground All Content in Source Material**
- Every slide title and key point MUST be derived from the [Source Paper Text]
- Do NOT invent examples, data, or findings that are not explicitly in the paper
- Do NOT add speculative content or your own interpretations beyond what the paper states
- If the paper doesn't provide enough detail for a slide, indicate that rather than inventing content

1.  **Analyze the [Source Paper Text]:** First, read the full paper to identify its "argumentative DNA."
    * **Find the Thesis:** What is the central argument?
    * **Find Implicit Structures:** Look for any progressions, levels, or taxonomies (e.g., "Entry-Level vs. Mid-Level vs. Expert-Level," "Phase 1, 2, 3," "Type A vs. Type B").
    * **Find Key Comparisons:** Identify the core comparisons (e.g., "Discipline 1 vs. 2," "Our Method vs. Old Method").
    * **Find Evidence:** Note the key data sections (e.g., survey results, benchmark charts, case study findings).

2.  **Construct the Outline:** Now, create the JSON outline.
    * **Structure:** The outline *must* be structured around the "Implicit Structures" and "Key Comparisons" you found, not just a flat list of the paper's sections.
    * **Data Slides:** For any "Results" or "Analysis" sections, the slide titles *must* promise specific insights (e.g., "Finding 1: Student Perceptions by Discipline," not "Survey Results").
    * **Persona:** All slide titles and key points must match the *style* described in the [Persona Profile].
    * **Flow:** Ensure the outline tells a clear story, from problem to solution to impact.
    * **Slide Distribution:** Distribute the ${totalContentSlides} content slides logically across sections. Typical distribution: Introduction (2-3 slides), Background/Context (2-3 slides), Methodology (3-4 slides), Results (3-5 slides), Discussion/Implications (2-3 slides), plus Title and End slides.

## [Required Output Format]
You MUST output a single, valid JSON object with the exact schema below. Do not include any text or markdown outside the JSON object.

{
  "presentation_title": "A new, engaging title based on the thesis and persona",
  "target_duration_minutes": ${eventDuration},
  "total_slides": ${totalSlides},
  "sections": [
    {
      "subtopic_title": "Title Slide",
      "paper_section_alignment": "N/A",
      "learning_objectives": [],
      "slides": [
        {
          "slide_number": 1,
          "slide_type": "Title",
          "slide_title": "Presentation Title Matching Persona",
          "key_points": null
        }
      ]
    },
    {
      "subtopic_title": "Section 1: Introduction",
      "paper_section_alignment": "Introduction",
      "learning_objectives": ["Objective 1", "Objective 2"],
      "slides": [
        {
          "slide_number": 2,
          "slide_type": "Content",
          "slide_title": "Slide Title Matching Persona",
          "key_points": [
            "Key point 1 based on Source Text.",
            "Key point 2 reflecting Implicit Structures."
          ]
        }
      ]
    },
    {
      "subtopic_title": "Section 2: The Core Argument / Methodology",
      "paper_section_alignment": "Methods/Analysis",
      "learning_objectives": ["Objective 1"],
      "slides": [
        {
          "slide_number": 3,
          "slide_type": "Content",
          "slide_title": "Example: The Three Levels of AI Adoption",
          "key_points": [
            "Level 1: Entry (e.g., Q&A)",
            "Level 2: Mid (e.g., RAG/NotebookLM)",
            "Level 3: Expert (e.g., POSED Framework)"
          ]
        },
        {
          "slide_number": 4,
          "slide_type": "Content",
          "slide_title": "Example: Results: ECE vs. Business Perceptions",
          "key_points": [
            "Finding from Source Text about ECE students.",
            "Finding from Source Text about Business students."
          ]
        }
      ]
    },
    {
      "subtopic_title": "End Slide",
      "paper_section_alignment": "N/A",
      "learning_objectives": [],
      "slides": [
        {
          "slide_number": ${totalSlides},
          "slide_type": "End",
          "slide_title": "Thank You / Questions?",
          "key_points": null
        }
      ]
    }
  ]
}`;

  const iterationCount = 0;
  
  metadata = {
    session_id: sessionId,
    instructor_name: instructorName,
    is_revision: false,
    iteration: iterationCount,
    target_slides: totalSlides,
    content_slides: totalContentSlides,
    event_duration: eventDuration,
    full_paper_length: fullPaperText.length,
    timestamp: new Date().toISOString()
  };

  console.log('✓ Initial creation prompt prepared:', {
    session_id: sessionId,
    iteration: iterationCount,
    prompt_length: completePrompt.length,
    total_slides: totalSlides,
    content_slides: totalContentSlides,
    full_paper_included: true
  });
}

// ===========================================================================
// Return the complete prompt and metadata
// ===========================================================================
return {
  prompt: completePrompt,
  metadata: metadata,
  session_id: sessionId,
  target_slides: totalSlides,
  content_slides: totalContentSlides,
  event_duration: eventDuration
};