// NODE NAME: Create wrapper HTML

// Create Wrapper HTML - Generate index, toc, bibliography, and section pages
// WITH REAL REFERENCES AND FIXED ABSOLUTE REFERENCES AND NO DOUBLE NUMBERING

const collectionReport = $json || {};

console.log('=== GENERATING WRAPPER PAGES (WITH REFERENCES) ===');

// Get design system from the Integrate node - ABSOLUTE REFERENCE
let designSystem;
try {
  const integrateNodeName = 'Integrate Output of the Presentation Style Designer';
  designSystem = $(integrateNodeName).first().json.context.designSystem;
  console.log('✓ Design system loaded');
} catch (e) {
  console.warn('⚠ Could not load design system, using defaults');
  designSystem = {
    colors: {
      primary: '#003366',
      secondary: '#005599',
      accent: '#ffa500',
      background: '#FFFFFF',
      textPrimary: '#000000'
    },
    typography: {
      headingFont: 'Lato, sans-serif',
      bodyFont: 'Lato, sans-serif'
    }
  };
}

// Get session info for instructor name - ABSOLUTE REFERENCE
let instructorName = 'Presenter';
let presentationTitle = 'Presentation';
let institution = 'University of Wisconsin-Platteville';

try {
  const integrateNodeName = 'Integrate Output of the Presentation Style Designer';
  const contextData = $(integrateNodeName).first().json.context;
  instructorName = contextData.sessionInfo.instructorName || 'Presenter';
  presentationTitle = contextData.sessionInfo.presentationTitle || 'Presentation';
  console.log('✓ Instructor name:', instructorName);
  console.log('✓ Presentation title:', presentationTitle);
} catch (e) {
  console.warn('Could not get session info:', e.message);
}

// ===== EXTRACT REFERENCES FROM PAPER ANALYSIS - ABSOLUTE REFERENCE =====
let references = [];
try {
  const paperAnalysisNodeName = 'Extract Paper Analysis for Presentation Implementation1';
  const paperAnalysis = $(paperAnalysisNodeName).first().json.data;
  
  const referencesText = paperAnalysis.references_text || '';
  
  if (referencesText && referencesText.length > 0) {
    console.log('✓ Found references_text, length:', referencesText.length);
    
    // Split by lines that start with [number]
    const refLines = referencesText.split('\n').filter(line => line.trim().length > 0);
    
    let currentRef = '';
    references = [];
    
    for (const line of refLines) {
      // Check if this line starts a new reference (begins with [number])
      if (/^\[\d+\]/.test(line.trim())) {
        // Save previous reference if exists
        if (currentRef.trim().length > 0) {
          references.push(currentRef.trim());
        }
        // Start new reference
        currentRef = line.trim();
      } else if (currentRef.length > 0) {
        // Continuation of previous reference
        currentRef += ' ' + line.trim();
      }
    }
    
    // Add the last reference
    if (currentRef.trim().length > 0) {
      references.push(currentRef.trim());
    }
    
    console.log(`✓ Extracted ${references.length} references from paper analysis`);
    console.log('Sample reference:', references[0]?.substring(0, 100) + '...');
  } else {
    console.warn('⚠ references_text is empty or missing');
  }
} catch (error) {
  console.error('❌ Failed to extract references:', error.message);
}

// Fallback if no references
if (references.length === 0) {
  console.warn('⚠ Using fallback - no references found');
  references = ['References not available - see original paper for complete bibliography.'];
}

// ===== GET SLIDES AND SECTIONS FROM COLLECT LIST NODE - ABSOLUTE REFERENCE =====
let sections = {};
let allSlides = [];
let metadata = {};

try {
  const collectNodeName = 'Collect List of Saved HTML Individual Slides';
  const collectData = $(collectNodeName).first().json;
  sections = collectData.fileList?.sections || {};
  allSlides = collectData.fileList?.slides || [];
  metadata = collectData.fileList?.metadata || {};
  console.log('✓ Loaded from Collect List node:');
  console.log('  - Sections:', Object.keys(sections).length);
  console.log('  - Slides:', allSlides.length);
} catch (error) {
  console.error('❌ Could not load from Collect List node:', error.message);
}

// Override metadata with actual values if available
if (presentationTitle !== 'Presentation') {
  metadata.title = presentationTitle;
  metadata.presentationTitle = presentationTitle;
}
if (instructorName !== 'Presenter') {
  metadata.author = instructorName;
  metadata.instructorName = instructorName;
}
metadata.institution = institution;

console.log(`Metadata:`, metadata);
console.log(`Sections: ${Object.keys(sections).length}`);
console.log(`Total slides: ${allSlides.length}`);

// Get processed slide IDs
const processedSlideIds = new Set();
allSlides.forEach(slide => {
  if (slide.processed) {
    processedSlideIds.add(slide.id);
  }
});

console.log(`Processed slides: ${processedSlideIds.size}/${allSlides.length}`);

// Find first slide for "Start Presentation" button
let firstSlideFileName = 'slide_1_1.html'; // default to first slide pattern
if (allSlides.length > 0 && allSlides[0].fileName) {
  firstSlideFileName = allSlides[0].fileName;
  console.log(`✓ First slide determined: ${firstSlideFileName}`);
} else if (allSlides.length > 0 && allSlides[0].id) {
  // Fallback: construct filename from ID
  firstSlideFileName = `slide_${allSlides[0].id.replace(/\./g, '_')}.html`;
  console.log(`✓ First slide constructed: ${firstSlideFileName}`);
}

// Font loading
const headingFont = designSystem.typography?.headingFont || 'Lato, sans-serif';
const bodyFont = designSystem.typography?.bodyFont || 'Lato, sans-serif';
const fontFamily = headingFont.split(',')[0].trim().replace(/['"]/g, '');
const fontLoadUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;700&display=swap`;

// Common styles for all pages - FOLLOWING DESIGN SYSTEM
const commonStyles = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
    font-family: ${bodyFont};
    background: linear-gradient(135deg, ${designSystem.colors.primary} 0%, ${designSystem.colors.secondary} 100%); 
    min-height: 100vh;
    padding: 40px 20px;
}
.container { 
    background: ${designSystem.colors.background}; 
    border-radius: 20px; 
    padding: 50px; 
    max-width: 1200px; 
    margin: 0 auto; 
    box-shadow: 0 25px 60px rgba(0,0,0,0.3);
}
h1 { 
    color: ${designSystem.colors.primary}; 
    font-family: ${headingFont};
    margin-bottom: 30px;
}
.navigation-bar {
    display: flex;
    justify-content: space-between;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e0e0e0;
}
.nav-button {
    background: ${designSystem.colors.primary};
    color: white;
    padding: 12px 25px;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.3s;
    font-weight: 600;
}
.nav-button:hover {
    background: ${designSystem.colors.secondary};
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}
`;

// ===== INDEX PAGE (Home/Cover) - WITH TIMER RESET =====
function generateIndexPage() {
    const title = metadata.title || metadata.presentationTitle || presentationTitle;
    const author = metadata.author || metadata.instructorName || instructorName;
    const inst = metadata.institution || institution;
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="${fontLoadUrl}" rel="stylesheet">
    <style>
        ${commonStyles}
        .container {
            text-align: center;
            padding: 100px 60px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 600px;
            background: linear-gradient(to bottom, ${designSystem.colors.background} 0%, #f8f9fa 100%);
        }
        h1 {
            font-size: 3.5em;
            line-height: 1.3;
            margin-bottom: 50px;
            color: ${designSystem.colors.primary};
            font-weight: 700;
            max-width: 900px;
        }
        .metadata {
            color: ${designSystem.colors.textSecondary || '#666'};
            font-size: 1.4em;
            margin: 40px 0;
            line-height: 1.8;
        }
        .metadata strong {
            color: ${designSystem.colors.primary};
            font-weight: 600;
        }
        .start-button {
            background: linear-gradient(135deg, ${designSystem.colors.accent} 0%, ${designSystem.colors.secondary} 100%);
            color: white;
            padding: 22px 65px;
            border-radius: 12px;
            text-decoration: none;
            font-size: 1.6em;
            font-weight: 700;
            margin-top: 60px;
            display: inline-block;
            transition: all 0.3s;
            box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            border: none;
            cursor: pointer;
        }
        .start-button:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 35px rgba(0,0,0,0.3);
        }
        .secondary-nav {
            margin-top: 35px;
            display: flex;
            gap: 20px;
            justify-content: center;
        }
        .secondary-nav a {
            color: ${designSystem.colors.primary};
            text-decoration: none;
            padding: 10px 20px;
            border: 2px solid ${designSystem.colors.primary};
            border-radius: 8px;
            transition: all 0.3s;
            font-weight: 600;
            font-size: 1.05em;
        }
        .secondary-nav a:hover {
            background: ${designSystem.colors.primary};
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        
        <div class="metadata">
            <p><strong>Presenter:</strong> ${author}</p>
            ${inst ? `<p><strong>Institution:</strong> ${inst}</p>` : ''}
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <button class="start-button" onclick="resetTimerAndStart()">
            Start Presentation →
        </button>
        
        <div class="secondary-nav">
            <a href="toc.html">View Table of Contents</a>
            <a href="bibliography.html">References</a>
        </div>
    </div>
    
    <script>
    function resetTimerAndStart() {
        localStorage.removeItem('presentation_start_time');
        localStorage.setItem('presentation_start_time', Date.now());
        window.location.href = '${firstSlideFileName}';
    }
    </script>
</body>
</html>`;
    
    return html;
}

// ===== TABLE OF CONTENTS ===== [CORRECTED WITH ABSOLUTE REFERENCE AND NO DOUBLE NUMBERING]
function generateTOCPage() {
    const title = metadata.title || metadata.presentationTitle || presentationTitle;
    
    // CRITICAL FIX: Use absolute reference to get data from "Collect List of Saved HTML Individual Slides" node
    let tocSections = {};
    let tocSlides = [];
    
    try {
        const collectNodeName = 'Collect List of Saved HTML Individual Slides';
        const collectData = $(collectNodeName).first().json;
        tocSections = collectData.fileList?.sections || {};
        tocSlides = collectData.fileList?.slides || [];
        console.log('✓ Successfully loaded data from Collect List node for TOC');
        console.log('  - Sections found:', Object.keys(tocSections).length);
        console.log('  - Slides found:', tocSlides.length);
    } catch (error) {
        console.error('❌ Could not load from Collect List node:', error.message);
        console.log('Falling back to global sections variable');
        tocSections = sections || {};
        tocSlides = allSlides || [];
    }
    
    console.log('=== TOC GENERATION DEBUG ===');
    console.log('tocSections keys:', Object.keys(tocSections));
    console.log('tocSlides count:', tocSlides.length);
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Table of Contents</title>
    <link href="${fontLoadUrl}" rel="stylesheet">
    <style>
        ${commonStyles}
        .section { 
            background: #f8f9fa; 
            border-radius: 10px; 
            padding: 25px; 
            margin-bottom: 20px; 
            border-left: 5px solid ${designSystem.colors.primary};
        }
        .section-title { 
            font-size: 1.5em; 
            color: ${designSystem.colors.primary}; 
            margin-bottom: 15px;
            cursor: pointer;
            font-weight: 700;
        }
        .section-title:hover {
            color: ${designSystem.colors.secondary};
        }
        .slide-link { 
            display: block; 
            padding: 12px 20px; 
            margin: 8px 0; 
            background: white; 
            border-radius: 5px; 
            text-decoration: none; 
            color: #333; 
            transition: all 0.3s;
            border-left: 3px solid transparent;
        }
        .slide-link:hover { 
            background: ${designSystem.colors.primary}; 
            color: white; 
            transform: translateX(5px);
            border-left-color: ${designSystem.colors.accent};
        }
        .slide-link.not-ready {
            opacity: 0.5;
            cursor: not-allowed;
            pointer-events: none;
            background: #f0f0f0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Table of Contents</h1>
        
        <div class="navigation-bar">
            <a href="index.html" class="nav-button">← Home</a>
            <a href="bibliography.html" class="nav-button">References →</a>
        </div>`;
    
    // Get section numbers, excluding section "0" if it exists
    const sectionNumbers = Object.keys(tocSections)
        .filter(num => num !== '0')
        .sort((a, b) => parseInt(a) - parseInt(b));
    
    console.log('Section numbers found:', sectionNumbers);
    
    if (sectionNumbers.length === 0) {
        console.warn('⚠ No sections found for TOC');
        html += `
        <div class="section">
            <p>No sections available. Slides may still be processing.</p>
        </div>`;
    } else {
        sectionNumbers.forEach(sectionNum => {
            const section = tocSections[sectionNum];
            
            if (!section || !section.slides || section.slides.length === 0) {
                console.warn(`⚠ Section ${sectionNum} is missing or has no slides`);
                return;
            }
            
            console.log(`✓ TOC: Section ${sectionNum} - "${section.sectionTitle}" (${section.slides.length} slides)`);
            
            html += `
        <div class="section">
            <h2 class="section-title" onclick="window.location.href='section_${sectionNum}.html'">
                Section ${sectionNum}: ${section.sectionTitle}
            </h2>`;
            
            section.slides.forEach(slide => {
                const isReady = slide.processed === true;
                
                // Remove redundant numbering from title if it starts with the slide ID
                let displayTitle = slide.title;
                const titlePrefix = slide.id + ' ';
                if (displayTitle.startsWith(titlePrefix)) {
                    displayTitle = displayTitle.substring(titlePrefix.length);
                }
                
                html += `
            <a href="${isReady ? slide.fileName : '#'}" 
               class="${isReady ? 'slide-link' : 'slide-link not-ready'}">
                ${slide.id}. ${displayTitle}
                ${!isReady ? ' (Not ready)' : ''}
            </a>`;
            });
            
            html += `
        </div>`;
        });
    }
    
    html += `
    </div>
</body>
</html>`;
    
    console.log(`✓ TOC page generated with ${sectionNumbers.length} sections`);
    return html;
}

// ===== BIBLIOGRAPHY PAGE - WITH REAL REFERENCES =====
function generateBibliographyPage() {
    const title = metadata.title || metadata.presentationTitle || presentationTitle;
    const author = metadata.author || metadata.instructorName || instructorName;
    const inst = metadata.institution || institution;
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>References</title>
    <link href="${fontLoadUrl}" rel="stylesheet">
    <style>
        ${commonStyles}
        .container {
            padding: 60px;
        }
        .thank-you {
            font-size: 2.5em;
            color: ${designSystem.colors.primary};
            margin: 30px 0 50px 0;
            font-weight: 700;
            text-align: center;
        }
        .content {
            text-align: left;
            margin: 40px auto;
            max-width: 1000px;
            line-height: 1.8;
            color: ${designSystem.colors.textPrimary || '#333'};
        }
        .content h2 {
            color: ${designSystem.colors.primary};
            margin-bottom: 30px;
            font-size: 2em;
            border-bottom: 3px solid ${designSystem.colors.accent};
            padding-bottom: 10px;
        }
        .reference-list {
            margin: 30px 0;
        }
        .reference-item {
            margin: 18px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            line-height: 1.7;
            font-size: 0.95em;
            border-left: 4px solid ${designSystem.colors.accent};
        }
        .reference-item:hover {
            background: #e9ecef;
        }
        .metadata {
            margin-top: 60px;
            padding-top: 40px;
            border-top: 3px solid ${designSystem.colors.primary};
            text-align: center;
            color: ${designSystem.colors.textSecondary || '#666'};
        }
        .metadata p {
            margin: 10px 0;
            font-size: 1.1em;
        }
        .metadata strong {
            color: ${designSystem.colors.primary};
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="thank-you">
            Thank You
        </div>
        
        <div class="content">
            <h2>References</h2>
            <div class="reference-list">
                ${references.map(ref => `<div class="reference-item">${ref}</div>`).join('\n                ')}
            </div>
        </div>
        
        <div class="metadata">
            <p><strong>${author}</strong></p>
            ${inst ? `<p>${inst}</p>` : ''}
            <p>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div class="navigation-bar" style="margin-top: 40px; padding-top: 40px;">
            <a href="toc.html" class="nav-button">← Table of Contents</a>
            <a href="index.html" class="nav-button">Home</a>
        </div>
    </div>
</body>
</html>`;
    
    return html;
}

// ===== SECTION PAGES ===== [FIXED DOUBLE NUMBERING]
function generateSectionPage(sectionNum, section) {
    const hasNotes = section.notes && section.notes.trim().length > 0;
    const firstSlide = section.slides[0];
    const firstSlideReady = firstSlide && firstSlide.processed === true;
    
    // Find prev/next sections
    const sectionNumbers = Object.keys(sections)
        .filter(n => n !== '0')
        .map(n => parseInt(n))
        .sort((a, b) => a - b);
    const currentIndex = sectionNumbers.indexOf(parseInt(sectionNum));
    const prevSection = currentIndex > 0 ? sectionNumbers[currentIndex - 1] : null;
    const nextSection = currentIndex < sectionNumbers.length - 1 ? sectionNumbers[currentIndex + 1] : null;
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Section ${sectionNum}: ${section.sectionTitle}</title>
    <link href="${fontLoadUrl}" rel="stylesheet">
    <style>
        ${commonStyles}
        .notes-toggle {
            background: ${designSystem.colors.accent};
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-bottom: 20px;
            transition: all 0.3s;
        }
        .notes-toggle:hover {
            opacity: 0.9;
            transform: translateY(-2px);
        }
        .instructor-notes {
            display: none;
            background: #fffef0;
            padding: 20px;
            border-left: 4px solid ${designSystem.colors.accent};
            border-radius: 4px;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .slide-card { 
            display: block; 
            padding: 20px; 
            margin: 10px 0; 
            background: #f8f9fa; 
            border-radius: 10px; 
            text-decoration: none; 
            color: #333; 
            transition: all 0.3s; 
            border-left: 4px solid ${designSystem.colors.primary};
        }
        .slide-card:hover { 
            background: ${designSystem.colors.primary}; 
            color: white; 
            transform: translateX(10px); 
        }
        .slide-card.not-ready {
            opacity: 0.5;
            cursor: not-allowed;
            pointer-events: none;
        }
        .start-button {
            background: linear-gradient(135deg, ${designSystem.colors.accent} 0%, #ff6b35 100%);
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            margin-top: 30px;
            transition: all 0.3s;
        }
        .start-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Section ${sectionNum}: ${section.sectionTitle}</h1>
        
        <div class="navigation-bar">
            <div>
                <a href="toc.html" class="nav-button">← Contents</a>
                ${prevSection ? `<a href="section_${prevSection}.html" class="nav-button">← Section ${prevSection}</a>` : ''}
            </div>
            <div>
                ${nextSection ? `<a href="section_${nextSection}.html" class="nav-button">Section ${nextSection} →</a>` : ''}
            </div>
        </div>`;
    
    // Notes toggle if available
    if (hasNotes) {
        const notesEscaped = section.notes.replace(/\n/g, '<br>');
        html += `
        <button class="notes-toggle" onclick="
            var notes = document.querySelector('.instructor-notes');
            notes.style.display = notes.style.display === 'none' ? 'block' : 'none';
            this.textContent = notes.style.display === 'none' ? '📋 Show Section Notes' : '🙈 Hide Section Notes';
        ">📋 Show Section Notes</button>
        <div class="instructor-notes">
            <strong>Section Overview:</strong><br>
            ${notesEscaped}
        </div>`;
    }
    
    // Slides list
    html += `
        <div class="slides-section">
            <h2 style="color: ${designSystem.colors.primary}; margin-bottom: 20px;">Slides in this Section:</h2>`;
    
    section.slides.forEach(slide => {
        const isReady = slide.processed === true;
        
        // Remove redundant numbering from title if it starts with the slide ID
        let displayTitle = slide.title;
        const titlePrefix = slide.id + ' ';
        if (displayTitle.startsWith(titlePrefix)) {
            displayTitle = displayTitle.substring(titlePrefix.length);
        }
        
        html += `
            <a href="${isReady ? slide.fileName : '#'}" 
               class="${isReady ? 'slide-card' : 'slide-card not-ready'}">
                <strong>${slide.id}</strong> - ${displayTitle}
                ${!isReady ? ' (Processing...)' : ''}
            </a>`;
    });
    
    if (firstSlideReady) {
        html += `
            <a href="${firstSlide.fileName}" class="start-button">
                Start Section ${sectionNum} →
            </a>`;
    }
    
    html += `
        </div>
    </div>
</body>
</html>`;
    
    return html;
}

// ===== GENERATE ALL PAGES =====
const pages = [];

// Home page
pages.push({
    filename: 'index.html',
    html: generateIndexPage()
});

// TOC page
pages.push({
    filename: 'toc.html',
    html: generateTOCPage()
});

// Bibliography page
pages.push({
    filename: 'bibliography.html',
    html: generateBibliographyPage()
});

// Section pages (skip section 0)
Object.keys(sections)
    .filter(num => num !== '0')
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(sectionNum => {
        const section = sections[sectionNum];
        if (section && section.slides && section.slides.length > 0) {
            pages.push({
                filename: `section_${sectionNum}.html`,
                html: generateSectionPage(sectionNum, section)
            });
        }
    });

console.log(`✓ Generated ${pages.length} wrapper pages`);
console.log(`  - index.html: Clean cover page with ${instructorName}`);
console.log(`  - toc.html: Table of contents`);
console.log(`  - bibliography.html: ${references.length} references from paper analysis`);
console.log(`  - ${pages.length - 3} section pages`);
console.log(`  - Start Presentation points to: ${firstSlideFileName}`);

return pages;