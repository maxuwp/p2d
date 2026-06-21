// NODE NAME: Slide Content Parser for Presentation Implementation

// Slide Content Parser for Presentation Implementation
// Parse markdown slides into structured slide objects with proper navigation

const mergedInput = $input.first().json;

// Extract content from the previous node's output structure
const slidesMarkdown = mergedInput.slidesMarkdown || '';
const notesMarkdown = mergedInput.notesMarkdown || '';
const personaText = mergedInput.persona || '';
const paperText = mergedInput.originalPaper || '';
const sessionInfo = mergedInput.sessionInfo || {};

console.log('=== Parsing Slide Content ===');
console.log('Input keys available:', Object.keys(mergedInput));
console.log('Slides markdown length:', slidesMarkdown.length);
console.log('Notes markdown length:', notesMarkdown.length);

if (!slidesMarkdown || slidesMarkdown.trim().length === 0) {
  throw new Error('No slides content found. Check that Subflow 4 completed successfully.');
}

// Count expected slides by counting ### markers (excluding ####)
const expectedSlideCount = (slidesMarkdown.match(/^### \d+\.\d+/gm) || []).length;
console.log('Expected slide count (from ### markers):', expectedSlideCount);

// Parse slides markdown into structured objects
// Uses <!-- SECTION X: ... --> comments to identify sections
// Uses ### X.X as slide delimiters (NOT ##)
function parseSlides(markdown) {
  const slides = [];
  const lines = markdown.split('\n');
  
  let currentSlide = null;
  let currentSection = '';
  let currentSectionNumber = 0;
  let slideCounterInSection = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      continue;
    }
    
    // CRITICAL: Check for section comment markers
    // Format: <!-- SECTION 1: Introduction & Context -->
    if (line.startsWith('<!-- SECTION')) {
      const sectionMatch = line.match(/<!-- SECTION (\d+):\s*(.+?)\s*-->/);
      if (sectionMatch) {
        currentSectionNumber = parseInt(sectionMatch[1]);
        currentSection = sectionMatch[2].trim();
        slideCounterInSection = 0;
        console.log(`Found section ${currentSectionNumber}: ${currentSection}`);
      }
      continue;
    }
    
    // Skip other HTML comments
    if (line.startsWith('<!--')) {
      continue;
    }
    
    // CORRECTED: Slide title marker is ### X.X (H3, not H2)
    // This matches the actual markdown structure from the drafter
    if (line.startsWith('### ') && line.match(/^### \d+\.\d+/)) {
      // Save previous slide if exists
      if (currentSlide) {
        slides.push(currentSlide);
      }
      
      slideCounterInSection++;
      const slideTitle = line.substring(4).trim(); // Remove "### "
      const slideId = `${currentSectionNumber}.${slideCounterInSection}`;
      
      currentSlide = {
        id: slideId,
        sectionNumber: currentSectionNumber,
        section: currentSection || 'Main',
        slideNumberInSection: slideCounterInSection,
        title: slideTitle,
        content: [],
        visualSuggestions: [],
        notes: '',
        hasNotes: false,
        rawContent: []
      };
      
      console.log(`  Slide ${slideId}: ${slideTitle}`);
      continue;
    }
    
    // Skip horizontal rules and metadata lines
    if (line.startsWith('---') || line.startsWith('===') || 
        line.startsWith('**Generated**') || line.startsWith('**Instructor**') || 
        line.startsWith('**Total') || line.startsWith('*End of')) {
      continue;
    }
    
    // Skip the ## section_XX lines that the Drafter produces
    // These are section dividers, not slide content
    if (line.startsWith('## section_')) {
      console.log(`  Skipping section divider: ${line.substring(0, 50)}...`);
      continue;
    }
    
    // Handle content if we have a current slide
    if (currentSlide && line) {
      // Visual suggestion markers (PPT:)
      if (line.includes('(PPT:') || line.includes('**PPT:')) {
        const suggestion = line
          .replace(/\*\*/g, '')
          .replace(/\(PPT:\s*/g, '')
          .replace(/\)$/g, '')
          .trim();
        currentSlide.visualSuggestions.push(suggestion);
      } else {
        // Regular content (bullet points, text)
        currentSlide.content.push(line);
      }
      // Always store in rawContent
      currentSlide.rawContent.push(line);
    }
  }
  
  // Add last slide
  if (currentSlide) {
    slides.push(currentSlide);
  }
  
  return slides;
}

// Parse notes markdown - FIXED VERSION: Uses ## Slide X.X headers
function parseNotes(markdown) {
  if (!markdown || markdown.trim().length === 0) {
    console.log('No notes markdown provided');
    return {};
  }
  
  const slideNotesMap = {};
  const lines = markdown.split('\n');
  
  let currentSlideId = null;
  let currentNotes = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for slide header markers
    // Format: ## Slide 1.1, ## Slide 2.3, etc.
    if (trimmedLine.startsWith('## Slide ')) {
      // Save previous slide's notes if they exist
      if (currentSlideId !== null && currentNotes.length > 0) {
        slideNotesMap[currentSlideId] = currentNotes.join('\n').trim();
        console.log(`Captured notes for slide ${currentSlideId} (${currentNotes.length} lines)`);
      }
      
      // Extract slide ID from header
      // Example: "## Slide 1.1" -> "1.1"
      const slideIdMatch = trimmedLine.match(/## Slide (\d+\.\d+)/);
      if (slideIdMatch) {
        currentSlideId = slideIdMatch[1];
        currentNotes = [];
        console.log(`Found notes section for slide ${currentSlideId}`);
      }
      continue;
    }
    
    // Skip other markdown headers (###, ####, etc.)
    if (trimmedLine.startsWith('#')) {
      continue;
    }
    
    // Skip HTML comments
    if (trimmedLine.startsWith('<!--')) {
      continue;
    }
    
    // Skip metadata lines
    if (trimmedLine.startsWith('**Section') || 
        trimmedLine.startsWith('**Duration') || 
        trimmedLine.startsWith('**Slide') || 
        trimmedLine.startsWith('*End of')) {
      continue;
    }
    
    // Collect note content lines (including empty lines for paragraph breaks)
    if (currentSlideId !== null) {
      currentNotes.push(line);
    }
  }
  
  // Save last slide's notes
  if (currentSlideId !== null && currentNotes.length > 0) {
    slideNotesMap[currentSlideId] = currentNotes.join('\n').trim();
    console.log(`Captured notes for slide ${currentSlideId} (${currentNotes.length} lines)`);
  }
  
  console.log(`✓ Parsed notes for ${Object.keys(slideNotesMap).length} slides`);
  
  // Log summary of parsed notes
  Object.keys(slideNotesMap).forEach(slideId => {
    const noteLength = slideNotesMap[slideId].length;
    console.log(`  - Slide ${slideId}: ${noteLength} chars`);
  });
  
  return slideNotesMap;
}

// Execute parsing
const slides = parseSlides(slidesMarkdown);
const slideNotesMap = parseNotes(notesMarkdown);

console.log('\n=== Parsing Results ===');
console.log(`✓ Parsed ${slides.length} slides`);
console.log(`✓ Parsed notes for ${Object.keys(slideNotesMap).length} slides`);

// CRITICAL VALIDATION: Check if parsed count matches expected count
if (expectedSlideCount > 0 && slides.length !== expectedSlideCount) {
  console.error(`❌ PARSING ERROR: Expected ${expectedSlideCount} slides but parsed ${slides.length}`);
  console.error('This indicates the parser failed to correctly identify slide boundaries.');
  console.error('First 1000 chars of markdown:', slidesMarkdown.substring(0, 1000));
  throw new Error(`Slide parsing mismatch: Expected ${expectedSlideCount} slides, got ${slides.length}. Check markdown structure.`);
}

if (slides.length === 0) {
  throw new Error('No slides were parsed from the markdown. Check that markdown contains <!-- SECTION X: --> comments and ### X.X headings.');
}

console.log('✓ Slide count validation passed');

// Attach slide-specific notes to each slide
slides.forEach(slide => {
  const slideId = slide.id;
  
  if (slideNotesMap[slideId]) {
    slide.notes = slideNotesMap[slideId];
    slide.hasNotes = true;
    console.log(`✓ Attached notes to slide ${slideId}`);
  } else {
    slide.notes = '';
    slide.hasNotes = false;
    console.log(`○ No notes found for slide ${slideId}`);
  }
});

// Build hierarchical section structure FIRST to get section counts
const sections = {};
const sectionOrder = [];

slides.forEach(slide => {
  const sectionNum = slide.sectionNumber;
  
  if (!sections[sectionNum]) {
    sections[sectionNum] = {
      sectionNumber: sectionNum,
      sectionTitle: slide.section,
      slides: [],
      slideCount: 0,
      hasNotes: false,
      notes: ''
    };
    sectionOrder.push(sectionNum);
  }
  
  sections[sectionNum].slides.push(slide);
  sections[sectionNum].slideCount++;
});

// NOW add totalSlidesInSection to each slide
slides.forEach(slide => {
  const sectionNum = slide.sectionNumber;
  slide.totalSlidesInSection = sections[sectionNum].slideCount;
});

console.log('\n=== Section Structure ===');
sectionOrder.forEach(sectionNum => {
  const section = sections[sectionNum];
  console.log(`Section ${sectionNum} (${section.sectionTitle}): ${section.slideCount} slides`);
});

// Add position metadata and navigation data to each slide
slides.forEach((slide, index) => {
  slide.slideIndex = index;
  slide.totalSlides = slides.length;
  slide.isFirstSlide = index === 0;
  slide.isLastSlide = index === slides.length - 1;
  
  // Check if this is the last slide in its section
  slide.isLastInSection = (slide.slideNumberInSection === slide.totalSlidesInSection);
  
  // Check if this is the first slide in its section
  slide.isFirstInSection = (slide.slideNumberInSection === 1);
  
  // Determine prevSlide
  if (index > 0) {
    slide.prevSlide = slides[index - 1].id;
  } else {
    slide.prevSlide = null;
  }
  
  // Determine nextSlide - CRITICAL FIX
  if (index < slides.length - 1) {
    slide.nextSlide = slides[index + 1].id;
  } else {
    slide.nextSlide = null;
  }
  
  // Check if this is the last slide of the last section
  const lastSectionNum = sectionOrder[sectionOrder.length - 1];
  slide.isLastSlideOfLastSection = (slide.sectionNumber === lastSectionNum && slide.isLastInSection);
  
  // Set section path for navigation
  slide.sectionPath = `section_${slide.sectionNumber}.html`;
  
  // Set next section path if this is last slide in section
  if (slide.isLastInSection && !slide.isLastSlideOfLastSection) {
    const currentSectionIndex = sectionOrder.indexOf(slide.sectionNumber);
    if (currentSectionIndex < sectionOrder.length - 1) {
      const nextSectionNum = sectionOrder[currentSectionIndex + 1];
      slide.nextSectionPath = `section_${nextSectionNum}.html`;
    }
  }
});

console.log('\n=== Navigation Data Added ===');
slides.forEach(slide => {
  console.log(`Slide ${slide.id}:`);
  console.log(`  Position: ${slide.slideNumberInSection}/${slide.totalSlidesInSection} in section`);
  console.log(`  Overall: ${slide.slideIndex + 1}/${slide.totalSlides}`);
  console.log(`  Prev: ${slide.prevSlide || 'none'}`);
  console.log(`  Next: ${slide.nextSlide || 'none'}`);
  console.log(`  isLastInSection: ${slide.isLastInSection}`);
  console.log(`  isFirstInSection: ${slide.isFirstInSection}`);
  console.log(`  isLastSlideOfLastSection: ${slide.isLastSlideOfLastSection}`);
  console.log(`  hasNotes: ${slide.hasNotes}`);
});

// Log sample of first slide for verification
if (slides.length > 0) {
  console.log('\n=== First Slide Sample ===');
  console.log('ID:', slides[0].id);
  console.log('Section Number:', slides[0].sectionNumber);
  console.log('Section:', slides[0].section);
  console.log('Slide # in Section:', slides[0].slideNumberInSection);
  console.log('Total Slides in Section:', slides[0].totalSlidesInSection);
  console.log('Title:', slides[0].title);
  console.log('Content lines:', slides[0].content.length);
  console.log('Has notes:', slides[0].hasNotes);
  console.log('Notes preview:', slides[0].notes.substring(0, 100) + '...');
  console.log('Visual suggestions:', slides[0].visualSuggestions.length);
}

// ===========================================
// RETURN: Dual structure for flexibility
// - slides: flat array (for linear processing)
// - sections: hierarchical (for section-based processing)
// ===========================================
return [{
  slides: slides,              // Flat array of all slides
  sections: sections,          // Hierarchical: { 1: {...}, 2: {...}, ... }
  sectionOrder: sectionOrder,  // Ordered array: [1, 2, 3, ...]
  context: {
    persona: personaText,
    originalPaper: paperText,
    sessionInfo: sessionInfo
  }
}];