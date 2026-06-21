// NODE NAME: Parse & Validate HTML Designer Output Duo Mode

// Parse & Validate HTML Designer Output - With Fixed Navigation
// Assembles final slide HTML with proper next/previous navigation

console.log('=== ASSEMBLING FINAL SLIDE HTML WITH FIXED NAVIGATION ===');

const aiOutput = $input.first().json;
let aiSnippet = '';

// Extract AI response
if (typeof aiOutput.output === 'string') {
    aiSnippet = aiOutput.output;
} else if (typeof aiOutput.text === 'string') {
    aiSnippet = aiOutput.text;
} else if (typeof aiOutput.response === 'string') {
    aiSnippet = aiOutput.response;
} else if (typeof aiOutput === 'string') {
    aiSnippet = aiOutput;
} else {
    throw new Error('Could not extract AI HTML snippet. Keys: ' + Object.keys(aiOutput).join(', '));
}

// Clean markdown
aiSnippet = aiSnippet.trim();
if (aiSnippet.startsWith('```html')) {
    aiSnippet = aiSnippet.replace(/```html\n?/, '').replace(/```\n?$/, '');
} else if (aiSnippet.startsWith('```')) {
    aiSnippet = aiSnippet.replace(/```\n?/, '').replace(/```\n?$/, '');
}
aiSnippet = aiSnippet.trim();

console.log(`✓ AI snippet extracted (${aiSnippet.length} chars)`);

// Get context data
let slide, navData, designSys;

if (aiOutput.optimizedSlide && aiOutput.navigationData) {
    slide = aiOutput.optimizedSlide;
    navData = aiOutput.navigationData;
    designSys = aiOutput.designSystem;
    console.log('✓ Data from AI passthrough');
} else {
    try {
        const prepareNodeName = 'Prepare Input for HTML Designer Agent';
        const prepareItems = $(prepareNodeName).all();
        
        if (prepareItems.length === 0) {
            throw new Error('No items from Prepare node');
        }
        
        const currentIndex = $itemIndex;
        const prepareData = prepareItems[currentIndex].json;
        
        slide = prepareData.optimizedSlide;
        navData = prepareData.navigationData;
        designSys = prepareData.designSystem;
        
        console.log(`✓ Data from Prepare node (item ${currentIndex})`);
    } catch (error) {
        throw new Error(`Cannot access slide data: ${error.message}`);
    }
}

if (!slide || !navData) {
    throw new Error('Missing slide or navigation data');
}

// Image mode configuration
const IMAGE_MODE = 'external';

console.log(`✓ IMAGE MODE: ${IMAGE_MODE}`);
console.log(`✓ Assembling slide ${slide.id}: ${slide.title}`);

// Clean title by removing sequence numbers
function cleanTitle(title) {
    return title.replace(/^\d+\.\d+(\.\d+)?(\.\d+)?\s+/, '');
}

const cleanedTitle = cleanTitle(slide.title);

// Extract bullet content
let bulletItems = [];
const bulletMatch = aiSnippet.match(/<li[^>]*>(.*?)<\/li>/gis);
if (bulletMatch) {
    bulletItems = bulletMatch.map(li => {
        let text = li.replace(/<li[^>]*>/, '').replace(/<\/li>/, '').trim();
        text = text.replace(/<ul>[\s\S]*?<\/ul>/gi, '').trim();
        text = text.replace(/<[^>]+>/g, '').trim();
        text = text.replace(/^\d+\.\d+\.\d+(\.\d+)?\s+/, '');
        return text;
    });
    console.log(`✓ Extracted ${bulletItems.length} bullet items`);
} else {
    bulletItems = slide.content.bullets.map(b => {
        let text = b.text.replace(/^\d+\.\d+\.\d+(\.\d+)?\s+/, '');
        return text;
    });
    console.log(`✓ Using fallback content: ${bulletItems.length} items`);
}

// Format bullets with academic styling
function formatAcademicBullet(text, index) {
    const colonIndex = text.indexOf(':');
    if (colonIndex > 0 && colonIndex < 50) {
        let header = text.substring(0, colonIndex).trim();
        let description = text.substring(colonIndex + 1).trim();
        header = header.charAt(0).toUpperCase() + header.slice(1);
        return `<strong>${header}:</strong> ${description}`;
    } else {
        const words = text.split(' ');
        if (words.length >= 2) {
            const firstTwo = words.slice(0, 2).join(' ');
            const rest = words.slice(2).join(' ');
            const capitalized = firstTwo.charAt(0).toUpperCase() + firstTwo.slice(1);
            return `<strong>${capitalized}</strong> ${rest}`;
        } else {
            return text.charAt(0).toUpperCase() + text.slice(1);
        }
    }
}

const hasVisual = slide.visual && slide.visual.type !== 'none';
const bulletCount = bulletItems.length;

// Determine if agenda slide
const isAgendaSlide = cleanedTitle.toLowerCase().includes('agenda') || 
                      cleanedTitle.toLowerCase().includes('overview') ||
                      cleanedTitle.toLowerCase().includes('outline');

const useNumberedList = isAgendaSlide;

console.log(`✓ Slide type: ${isAgendaSlide ? 'AGENDA (numbered)' : 'CONTENT (bullets)'}`);

// Calculate font size
let fontSize = '2.2em';
let lineSpacing = '45px';
if (bulletCount > 5) {
    fontSize = '1.8em';
    lineSpacing = '35px';
} else if (bulletCount > 3) {
    fontSize = '2em';
    lineSpacing = '40px';
}

// Build bullet list HTML
let bulletListHTML;
if (useNumberedList) {
    bulletListHTML = '<ol class="slide-bullets">\n' + 
        bulletItems.map((item, i) => `<li>${formatAcademicBullet(item, i + 1)}</li>`).join('\n') + 
        '\n</ol>';
} else {
    bulletListHTML = '<ul class="slide-bullets">\n' + 
        bulletItems.map((item, i) => `<li>${formatAcademicBullet(item, i + 1)}</li>`).join('\n') + 
        '\n</ul>';
}

// Build visual HTML
let visualHTML = '';

if (hasVisual) {
    let imgSrc = '';
    
    if (slide.visual.type === 'image' && slide.visual.data) {
        if (IMAGE_MODE === 'embedded') {
            const base64Data = slide.visual.data.startsWith('data:') 
                ? slide.visual.data 
                : `data:${slide.visual.mimeType || 'image/png'};base64,${slide.visual.data}`;
            imgSrc = base64Data;
            console.log('✓ Using EMBEDDED image (base64 in HTML)');
        } else {
            const slideIdFormatted = slide.id;
            const imageFileName = `slide_${slideIdFormatted}.png`;
            imgSrc = `AiImage/${imageFileName}`;
            
            console.log(`✓ Using EXTERNAL image: ${imgSrc}`);
        }
        
    } else if (slide.visual.imageUrl) {
        imgSrc = slide.visual.imageUrl;
        console.log(`✓ Using external URL: ${imgSrc}`);
    }
    
    if (imgSrc) {
        visualHTML = `<img src="${imgSrc}" alt="${cleanedTitle}" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">`;
        
        if (slide.figureStatement && !slide.figureStatement.includes('Figure Statement:')) {
            const caption = slide.figureStatement.length > 200 
                ? slide.figureStatement.substring(0, 200) + '...' 
                : slide.figureStatement;
            visualHTML += `<p class="figure-caption" style="margin-top: 12px; font-size: 0.85em; color: #555; font-style: italic; text-align: center; max-width: 90%;">${caption}</p>`;
        }
        
        console.log('✓ Visual HTML created');
    }
}

// Build content area
let contentAreaHTML;
if (hasVisual) {
    contentAreaHTML = `
<div style="display: flex; width: 100%; height: 100%; padding: 50px 60px; gap: 50px;">
    <div style="flex: 0 0 60%; display: flex; flex-direction: column; justify-content: center;">
        ${bulletListHTML}
    </div>
    <div style="flex: 0 0 40%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
        ${visualHTML}
    </div>
</div>`;
} else {
    contentAreaHTML = `
<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 50px 80px;">
    <div style="max-width: 1000px; width: 100%;">
        ${bulletListHTML}
    </div>
</div>`;
}

// Format notes
const hasNotes = slide.pedagogicalNote && slide.pedagogicalNote.trim().length > 0;
let formattedNotes = '';
if (hasNotes) {
    formattedNotes = slide.pedagogicalNote
        .replace(/Figure Statement:/g, '<strong>Figure Statement:</strong>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

// Navigation generation - FIXED VERSION
function generateNav(slide, navData, hasNotes, slideIndex, totalSlides) {
    const safeSlideIndex = typeof slideIndex === 'number' ? slideIndex : 0;
    const safeTotalSlides = typeof totalSlides === 'number' && totalSlides > 0 ? totalSlides : 1;
    
    const slideRatio = `${safeSlideIndex + 1}/${safeTotalSlides}`;
    const progressPercent = ((safeSlideIndex + 1) / safeTotalSlides * 100).toFixed(1);
    
    const slideIdParts = slide.id.split('.');
    const sectionNum = parseInt(slideIdParts[0]);
    
    let html = '<div class="navigation-bar">\n    <div class="nav-left">';
    
    // PREVIOUS BUTTON
    let prevLink = '';
    let prevText = '← Previous';
    
    if (navData.isFirstSlide) {
        prevLink = 'toc.html';
        prevText = '← Contents';
    } else if (navData.isFirstInSection) {
        prevLink = `section_${sectionNum}.html`;
        prevText = `← Section ${sectionNum}`;
    } else if (navData.prevSlide) {
        prevLink = `slide_${navData.prevSlide.replace(/\./g, '_')}.html`;
    } else {
        prevLink = `section_${sectionNum}.html`;
        prevText = `← Section ${sectionNum}`;
    }
    
    if (prevLink) {
        html += `<a href="${prevLink}" class="nav-button">${prevText}</a>`;
    } else {
        html += '<span class="nav-button disabled">← Previous</span>';
    }
    
    html += `
    </div>
    
    <div class="nav-center-group">
        <div class="progress-container">
            <div class="progress-bar-wrapper">
                <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
            </div>
            <div class="progress-text">${slideRatio}</div>
        </div>
        
        <div class="timer-display" id="timer">
            <span class="timer-icon">⏱️</span>
            <span id="timer-text">0:00</span>
        </div>
    </div>
    
    <div class="nav-center">
        <a href="${navData.tocPath || 'toc.html'}" class="nav-button">Contents</a>
        <a href="${navData.indexPath || 'index.html'}" class="nav-button">Home</a>`;
    
    if (hasNotes) {
        html += `
        <button class="notes-toggle nav-button" onclick="
            var notes = document.querySelector('.instructor-notes');
            var isVisible = notes.style.display === 'block';
            notes.style.display = isVisible ? 'none' : 'block';
            this.textContent = isVisible ? '📋 Notes' : '🙈 Hide';
        ">📋 Notes</button>`;
    }
    
    html += `
    </div>
    <div class="nav-right">`;
    
    // NEXT BUTTON - FIXED LOGIC
    let nextLink = '';
    let nextText = 'Next →';
    
    if (navData.isLastSlideOfLastSection || navData.isLastSlide) {
        // This is the very last slide of the presentation
        nextLink = 'bibliography.html';
        nextText = 'Bibliography →';
    } else if (navData.nextSlide) {
        // Use the pre-calculated nextSlide from the parser
        nextLink = `slide_${navData.nextSlide.replace(/\./g, '_')}.html`;
        nextText = 'Next →';
    } else {
        // Fallback (shouldn't happen if parser is correct)
        nextLink = 'bibliography.html';
        nextText = 'Bibliography →';
    }
    
    if (nextLink) {
        html += `<a href="${nextLink}" class="nav-button ${nextText.includes('Bibliography') ? 'bibliography' : ''}">${nextText}</a>`;
    } else {
        html += '<span class="nav-button disabled">Next →</span>';
    }
    
    html += '\n    </div>\n</div>';
    
    return html;
}

// Dynamic font loading
const headingFont = designSys.typography.headingFont || 'Lato';
const bodyFont = designSys.typography.bodyFont || 'Source Sans Pro';
const fontLoadUrl = `https://fonts.googleapis.com/css2?family=${headingFont.replace(/ /g, '+')}:wght@300;400;700&family=${bodyFont.replace(/ /g, '+')}:wght@400;600;700&display=swap`;

// Assemble final HTML
const finalHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Slide ${slide.id}: ${cleanedTitle}</title>
    <link href="${fontLoadUrl}" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: '${bodyFont}', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .slide-wrapper {
            width: 100%;
            max-width: 1600px;
            aspect-ratio: 16 / 9;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        
        .slide-header {
            background: linear-gradient(135deg, ${designSys.colors.primary} 0%, ${designSys.colors.secondary} 100%);
            color: white;
            padding: 30px 50px 25px;
            border-bottom: 3px solid ${designSys.colors.accent};
        }
        .slide-meta {
            font-size: 1em;
            opacity: 0.95;
            margin-bottom: 8px;
            font-weight: 500;
        }
        .slide-header h1 { 
            font-family: '${headingFont}', sans-serif;
            font-size: 2.5em;
            font-weight: 700;
            line-height: 1.2;
            margin: 0;
        }
        .slide-content-area {
            flex: 1;
            overflow-y: auto;
            position: relative;
        }
        
        ul.slide-bullets, ol.slide-bullets {
            padding: 0 !important;
            margin: 0 !important;
            list-style-position: inside !important;
        }
        
        ol.slide-bullets {
            counter-reset: item !important;
            list-style: none !important;
        }
        
        ol.slide-bullets li {
            font-size: ${fontSize} !important;
            line-height: 1.7 !important;
            margin-bottom: ${lineSpacing} !important;
            padding-left: 0 !important;
            position: relative !important;
            color: #333 !important;
            font-family: '${bodyFont}', sans-serif !important;
            counter-increment: item !important;
        }
        
        ol.slide-bullets li::before {
            content: counter(item) ". " !important;
            font-weight: 700 !important;
            color: ${designSys.colors.primary} !important;
            margin-right: 0.5em !important;
            font-size: 1em !important;
        }
        
        ul.slide-bullets {
            list-style: none !important;
        }
        
        ul.slide-bullets li {
            font-size: ${fontSize} !important;
            line-height: 1.7 !important;
            margin-bottom: ${lineSpacing} !important;
            padding-left: 2em !important;
            position: relative !important;
            color: #333 !important;
            font-family: '${bodyFont}', sans-serif !important;
        }
        
        ul.slide-bullets li::before {
            content: '▸' !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            color: ${designSys.colors.primary} !important;
            font-weight: bold !important;
            font-size: 1.3em !important;
        }
        
        ul.slide-bullets li strong,
        ol.slide-bullets li strong {
            color: ${designSys.colors.primary} !important;
            font-weight: 700 !important;
        }
        
        ul.slide-bullets li:last-child,
        ol.slide-bullets li:last-child {
            margin-bottom: 0 !important;
        }
        
        .notes-toggle {
            background: ${designSys.colors.accent};
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.3s;
            font-weight: 600;
        }
        .notes-toggle:hover {
            background: #ff6b35;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(255, 165, 0, 0.4);
        }
        
        .instructor-notes {
            position: absolute;
            bottom: 100px;
            right: 50px;
            width: 500px;
            max-height: 400px;
            overflow-y: auto;
            display: none;
            z-index: 50;
            background: #fffef0;
            padding: 25px;
            border-left: 5px solid ${designSys.colors.accent};
            border-radius: 8px;
            box-shadow: 0 -8px 20px rgba(0,0,0,0.15);
        }
        .notes-content {
            line-height: 1.75;
            color: #444;
            font-size: 0.95em;
        }
        .notes-content strong {
            color: #222;
            display: block;
            margin-top: 12px;
            margin-bottom: 6px;
            font-size: 1.05em;
        }
        
        .navigation-bar {
            background: #f8f9fa;
            padding: 20px 50px;
            border-top: 2px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 80px;
            gap: 20px;
        }
        
        .nav-left, .nav-right {
            flex: 0 0 auto;
        }
        
        .nav-center-group {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 20px;
            max-width: 400px;
        }
        
        .progress-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .progress-bar-wrapper {
            width: 100%;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, ${designSys.colors.primary} 0%, ${designSys.colors.accent} 100%);
            transition: width 0.3s ease;
        }
        
        .progress-text {
            font-size: 0.85em;
            color: #666;
            font-weight: 600;
            text-align: center;
        }
        
        .timer-display {
            display: flex;
            align-items: center;
            gap: 6px;
            background: white;
            padding: 8px 16px;
            border-radius: 6px;
            border: 2px solid ${designSys.colors.accent};
            font-size: 0.95em;
            font-weight: 600;
            color: #333;
            white-space: nowrap;
        }
        
        .timer-icon {
            font-size: 1.1em;
        }
        
        .nav-center {
            display: flex;
            gap: 15px;
            flex: 0 0 auto;
        }
        
        .nav-button {
            background: ${designSys.colors.primary};
            color: white;
            padding: 12px 25px;
            border-radius: 6px;
            text-decoration: none;
            transition: all 0.3s;
            font-size: 1em;
            font-weight: 600;
            display: inline-block;
            white-space: nowrap;
        }
        .nav-button:hover {
            background: ${designSys.colors.secondary};
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 51, 102, 0.3);
        }
        .nav-button.disabled {
            background: #ccc;
            cursor: not-allowed;
            opacity: 0.6;
            pointer-events: none;
        }
        .nav-button.bibliography {
            background: linear-gradient(135deg, ${designSys.colors.accent} 0%, #ff6b35 100%);
        }
    </style>
</head>
<body>
<div class="slide-wrapper">
    <div class="slide-header">
        <div class="slide-meta">Slide ${slide.id}${slide.section ? ' - ' + slide.section : ''}</div>
        <h1>${cleanedTitle}</h1>
    </div>

    <div class="slide-content-area">
        ${contentAreaHTML}
    </div>
    
    ${hasNotes ? `
    <div class="instructor-notes">
        <div class="notes-content">
            <strong>Instructor Notes:</strong>
            ${formattedNotes}
        </div>
    </div>
    ` : ''}

    ${generateNav(slide, navData, hasNotes, slide.slideIndex, slide.totalSlides)}
</div>

<script>
// Timer functionality
(function() {
    const startTimeKey = 'presentation_start_time';
    let startTime = localStorage.getItem(startTimeKey);
    
    if (document.referrer.includes('index.html') || document.referrer.includes('cover.html') || !startTime) {
        startTime = Date.now();
        localStorage.setItem(startTimeKey, startTime);
    }
    
    function updateTimer() {
        const elapsed = Math.floor((Date.now() - parseInt(startTime)) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('timer-text').textContent = 
            minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }
    
    updateTimer();
    setInterval(updateTimer, 1000);
    
    if (window.location.href.includes('index.html') || window.location.href.includes('cover.html')) {
        localStorage.removeItem(startTimeKey);
    }
})();
</script>
</body>
</html>`;

console.log(`✓ HTML assembled for ${slide.id}`);
console.log(`✓ Image mode: ${IMAGE_MODE}`);
console.log(`✓ Progress: ${slide.slideIndex + 1}/${slide.totalSlides}`);

// Log navigation info
console.log(`✓ Navigation - Prev: ${navData.prevSlide || 'none'}, Next: ${navData.nextSlide || 'none'}`);
console.log(`✓ Is last in section: ${navData.isLastInSection}, Is last overall: ${navData.isLastSlide}`);

// CRITICAL: Return as an object, not a string
return {
    slideHTML: finalHTML,
    slideFileName: `slide_${slide.id.replace(/\./g, '_')}.html`,
    slideId: slide.id,
    optimizedSlide: slide,
    imageMode: IMAGE_MODE
};