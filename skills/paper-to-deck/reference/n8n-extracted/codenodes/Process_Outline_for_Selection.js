// NODE NAME: Process Outline for Selection

// ============================================================================
// Node: Process Outline for Selection (UPDATED FOR SECTIONS STRUCTURE)
// Purpose: Parse AI outline and format for human review
// ============================================================================

console.log('=== Process Outline for Selection ===');

// Parse the AI response
const rawInput = $json.output || $json.text || $json.response || $json;
let outline;

// Attempt to parse the outline
if (typeof rawInput === 'object' && rawInput !== null && !Array.isArray(rawInput)) {
  outline = rawInput;
  console.log('✓ Input is already a parsed object');
} else if (typeof rawInput === 'string') {
  try {
    // Remove markdown code blocks if present
    let cleanedInput = rawInput.trim()
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    outline = JSON.parse(cleanedInput);
    console.log('✓ Successfully parsed as JSON');
  } catch (error) {
    console.error('Failed to parse outline JSON:', error.message);
    throw new Error('AI output is not valid JSON. Please regenerate. Error: ' + error.message);
  }
} else {
  throw new Error('Unexpected input type: ' + typeof rawInput);
}

// Validate required structure
const requiredFields = ['presentation_title', 'sections'];
const missingFields = requiredFields.filter(field => !outline[field]);

if (missingFields.length > 0) {
  throw new Error('Invalid outline structure - missing fields: ' + missingFields.join(', '));
}

if (!Array.isArray(outline.sections) || outline.sections.length === 0) {
  throw new Error('Sections array is empty or invalid');
}

// Calculate statistics
let totalSlides = 0;
let contentSlides = 0;
let contentSections = 0;

outline.sections.forEach(section => {
  if (Array.isArray(section.slides)) {
    totalSlides += section.slides.length;
    section.slides.forEach(slide => {
      if (slide.slide_type === 'Content') {
        contentSlides++;
      }
    });
    if (section.subtopic_title !== 'Title Slide' && section.subtopic_title !== 'End Slide') {
      contentSections++;
    }
  }
});

console.log('✓ Parsed outline:', {
  title: outline.presentation_title,
  totalSections: outline.sections.length,
  contentSections: contentSections,
  totalSlides: totalSlides,
  contentSlides: contentSlides,
  targetDuration: outline.target_duration_minutes
});

// Get session folder for file path display
const manifestContext = $('Obtain Manifest Information and Select Next Step').first().json;
const sessionFolder = manifestContext.sessionFolder;
const outlineFilePath = `${sessionFolder}detailed_outline.json`;

// Create formatted HTML display for review form
let formDescription = `
<style>
  .outline-container {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
    background: #f9fafb;
  }
  .outline-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px;
    border-radius: 12px;
    margin-bottom: 30px;
  }
  .outline-header h1 {
    margin: 0 0 10px 0;
    font-size: 1.8rem;
  }
  .outline-meta {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    font-size: 0.9rem;
    opacity: 0.9;
    margin-top: 15px;
  }
  .meta-item {
    background: rgba(255,255,255,0.1);
    padding: 6px 14px;
    border-radius: 20px;
  }
  
  /* File location info box */
  .file-location-box {
    background: #fefce8;
    border: 2px solid #fde047;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
  }
  .file-location-box h3 {
    margin: 0 0 8px 0;
    color: #854d0e;
    font-size: 1rem;
    font-weight: 600;
  }
  .file-location-box p {
    margin: 0 0 8px 0;
    color: #713f12;
    font-size: 0.9rem;
  }
  .file-location-box code {
    display: block;
    background: #ffffff;
    padding: 10px;
    border-radius: 4px;
    color: #1e293b;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    word-break: break-all;
  }
  .file-location-box .tip {
    margin: 8px 0 0 0;
    color: #713f12;
    font-size: 0.85rem;
    font-style: italic;
  }
  
  .section-container {
    background: white;
    border: 2px solid #667eea;
    border-radius: 12px;
    margin-bottom: 25px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .section-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .section-title {
    font-size: 1.3rem;
    font-weight: 600;
  }
  .section-badge {
    background: rgba(255,255,255,0.2);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.85rem;
  }
  .section-meta {
    background: #f8f9ff;
    padding: 15px 20px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.9rem;
  }
  .section-meta strong {
    color: #4338ca;
  }
  .learning-objectives {
    margin-top: 8px;
    padding-left: 20px;
  }
  .learning-objectives li {
    margin: 4px 0;
    color: #475569;
  }
  
  .slides-container {
    padding: 20px;
  }
  .slide-item {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 18px;
    margin-bottom: 12px;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .slide-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .slide-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .slide-number {
    display: inline-block;
    background: #667eea;
    color: white;
    padding: 6px 14px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .slide-type {
    display: inline-block;
    background: #e0e7ff;
    color: #4338ca;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
  }
  .slide-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
    margin-top: 8px;
    line-height: 1.4;
  }
  .key-points {
    margin-top: 12px;
    padding-left: 20px;
  }
  .key-points li {
    margin: 6px 0;
    color: #475569;
    line-height: 1.5;
  }
  
  .instructions {
    background: #f0f9ff;
    border: 2px solid #bae6fd;
    border-radius: 12px;
    padding: 24px;
    margin-top: 30px;
  }
  .instructions h3 {
    color: #0369a1;
    margin-top: 0;
    font-size: 1.2rem;
  }
  .instructions ul {
    margin: 12px 0;
    padding-left: 25px;
  }
  .instructions li {
    margin: 10px 0;
    color: #0c4a6e;
    line-height: 1.6;
  }
  .instructions strong {
    color: #0369a1;
  }
  .file-location-bottom {
    background: #ffffff;
    border-left: 4px solid #0ea5e9;
    padding: 12px;
    margin-top: 16px;
    border-radius: 4px;
  }
  .file-location-bottom p {
    margin: 0 0 8px 0;
    color: #0c4a6e;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .file-location-bottom code {
    display: block;
    background: #f8fafc;
    padding: 8px;
    border-radius: 4px;
    color: #1e293b;
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    word-break: break-all;
  }
  .file-location-bottom .tip-text {
    margin: 8px 0 0 0;
    color: #475569;
    font-size: 0.85rem;
  }
</style>

<div class="outline-container">
  <div class="outline-header">
    <h1>${outline.presentation_title || 'Untitled Presentation'}</h1>
    <div class="outline-meta">
      <div class="meta-item">⏱️ Duration: ${outline.target_duration_minutes || 'N/A'} min</div>
      <div class="meta-item">📊 Total Slides: ${totalSlides}</div>
      <div class="meta-item">📝 Content Slides: ${contentSlides}</div>
      <div class="meta-item">📚 Sections: ${outline.sections.length}</div>
    </div>
  </div>

  <!-- File Location Info Box (TOP) -->
  <div class="file-location-box">
    <h3>📁 File Location</h3>
    <p>Once approved, this outline will be saved to:</p>
    <code>${outlineFilePath}</code>
    <p class="tip">You can manually edit this file later if needed.</p>
  </div>
`;

// Add each section with its slides
outline.sections.forEach((section, sectionIdx) => {
  const slideCount = section.slides ? section.slides.length : 0;
  
  formDescription += `
  <div class="section-container">
    <div class="section-header">
      <div class="section-title">${section.subtopic_title || 'Untitled Section'}</div>
      <div class="section-badge">${slideCount} slide${slideCount !== 1 ? 's' : ''}</div>
    </div>
    <div class="section-meta">
      <strong>Paper Alignment:</strong> ${section.paper_section_alignment || 'Not specified'}
      ${section.learning_objectives && section.learning_objectives.length > 0 ? `
        <br><strong>Learning Objectives:</strong>
        <ul class="learning-objectives">
          ${section.learning_objectives.map(obj => `<li>${obj}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
    <div class="slides-container">
  `;
  
  // Add slides in this section
  if (section.slides && Array.isArray(section.slides)) {
    section.slides.forEach(slide => {
      formDescription += `
      <div class="slide-item">
        <div class="slide-header">
          <span class="slide-number">${slide.slide_number || '?'}</span>
          <span class="slide-type">${slide.slide_type || 'Unknown'}</span>
        </div>
        <div class="slide-title">${slide.slide_title || 'Untitled Slide'}</div>
        ${slide.key_points && Array.isArray(slide.key_points) && slide.key_points.length > 0 ? `
          <ul class="key-points">
            ${slide.key_points.map(point => `<li>${point}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
      `;
    });
  }
  
  formDescription += `
    </div>
  </div>
  `;
});

// Add instructions with file location at bottom
formDescription += `
  <div class="instructions">
    <h3>🔄 Review Instructions</h3>
    <ul>
      <li><strong>Option 1 - Approve:</strong> Accept and save this outline</li>
      <li><strong>Option 2 - Request Changes:</strong> Provide feedback for AI to regenerate</li>
    </ul>
    
    <!-- File path info (repeated at bottom) -->
    <div class="file-location-bottom">
      <p>📁 Save Location:</p>
      <code>${outlineFilePath}</code>
      <p class="tip-text">💡 <em>Tip: After approval, you can manually edit this JSON file at the location shown above.</em></p>
    </div>
  </div>
</div>
`;

// Get metadata from previous nodes
const preparePromptData = $('Prepare Prompt for Outlining Agent').first().json;
const metadata = preparePromptData.metadata || {};

// Track iteration
const iterationCount = (metadata.iteration || 0) + 1;

// Return data for both form display and downstream processing
return {
  original_outline: outline,
  formDescription: formDescription,
  metadata: {
    generated_at: new Date().toISOString(),
    presentation_title: outline.presentation_title,
    total_slides: totalSlides,
    content_slides: contentSlides,
    total_sections: outline.sections.length,
    content_sections: contentSections,
    target_duration: outline.target_duration_minutes,
    iteration_count: iterationCount,
    session_id: metadata.session_id
  }
};