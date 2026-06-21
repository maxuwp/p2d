// NODE NAME: Prepare Input for HTML Designer Agent

// Prepare Input for HTML Designer Agent - ULTRA-EXPLICIT VERSION
const inputData = $input.first().json;

if (!inputData.optimizedSlide || !inputData.navigationData) {
    throw new Error("Missing required data from Process Multimedia Optimization Results");
}

const slideData = inputData.optimizedSlide;
const navData = inputData.navigationData;

console.log(`✓ Preparing slide ${slideData.id}`);

// Get design system
let designSystem;
try {
    const integrateNodeName = 'Integrate Output of the Presentation Style Designer Agent';
    designSystem = $(integrateNodeName).first().json.context.designSystem;
} catch (e) {
    designSystem = {
        colors: { primary: '#003366', secondary: '#005599', accent: '#ffa500' },
        typography: { headingFont: 'Lato, sans-serif', bodyFont: 'Source Sans Pro, sans-serif' }
    };
}

const hasVisual = slideData.visual && slideData.visual.type !== 'none';
const bulletCount = slideData.content?.bullets?.length || 0;

let slideType = 'Content';
if (slideData.id.includes('section_overview') || slideData.id.endsWith('.0')) {
    slideType = 'SectionHeader';
} else if (slideData.id === '0.0') {
    slideType = 'Title';
}

// Clean markdown from bullet text
function cleanText(text) {
    if (!text) return '';
    return text.replace(/^#{1,6}\s+/, '').trim();
}

// Format bullets - REMOVE sequence numbers
const formattedBullets = slideData.content.bullets.map(bullet => {
    let cleanBulletText = cleanText(bullet.text);
    // Remove sequence numbers like "1.1.1", "1.1.2" etc from the beginning
    cleanBulletText = cleanBulletText.replace(/^\d+\.\d+(\.\d+)*\s+/, '');
    
    let html = `<li>${cleanBulletText}`;
    if (bullet.children && bullet.children.length > 0) {
        html += '\n<ul>\n' + bullet.children.map(child => 
            `<li>${cleanText(child.text || child)}</li>`
        ).join('\n') + '\n</ul>';
    }
    html += '</li>';
    return html;
}).join('\n');

let visualDescription = 'No visual';
if (hasVisual) {
    if (slideData.figureStatement) {
        visualDescription = slideData.figureStatement;
    } else if (slideData.visual.type === 'image') {
        visualDescription = 'An illustrative figure';
    } else if (slideData.visual.type === 'chart') {
        visualDescription = 'A data visualization';
    }
}

// Calculate optimal font size based on bullet count
let fontSize = '2.2em';
let spacing = '45px';
if (bulletCount > 5) {
    fontSize = '1.8em';
    spacing = '35px';
} else if (bulletCount > 3) {
    fontSize = '2em';
    spacing = '40px';
}

const designPrompt = `You are creating the content area for a professional academic presentation slide. Create ONLY the inner HTML structure with inline styles.

**CRITICAL LAYOUT REQUIREMENTS:**

${hasVisual ? `
**WITH VISUAL (Side-by-Side Layout):**
\`\`\`
Structure:
<div class="ai-content-wrapper" style="display: flex; width: 100%; height: 100%; padding: 50px 60px;">
  <div class="content-column" style="flex: 0 0 50%; padding-right: 40px;">
    [BULLET LIST HERE]
  </div>
  <div class="visual-column" style="flex: 0 0 50%; display: flex; align-items: center; justify-content: center;">
    <div id="visual-placeholder" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"></div>
  </div>
</div>
\`\`\`

REQUIREMENTS:
- Content and visual MUST be 50/50 split
- Content MUST be vertically centered (use display: flex; flex-direction: column; justify-content: center;)
- Visual placeholder MUST be COMPLETELY EMPTY (no text, no content)
- Bullets font-size: ${fontSize}
- Bullets spacing: ${spacing} between items
` : `
**WITHOUT VISUAL (Centered Layout):**
\`\`\`
Structure:
<div class="ai-content-wrapper" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 50px 80px;">
  <div class="content-column" style="max-width: 900px;">
    [BULLET LIST HERE]
  </div>
</div>
\`\`\`

REQUIREMENTS:
- Content MUST be centered both horizontally and vertically
- Bullets font-size: ${fontSize}
- Bullets spacing: ${spacing} between items
- Content width: maximum 900px
`}

**BULLET LIST HTML (Use this EXACTLY as provided):**
\`\`\`html
<ul class="slide-bullets" style="list-style: none; padding: 0; margin: 0;">
${formattedBullets}
</ul>
\`\`\`

**BULLET STYLING REQUIREMENTS:**
\`\`\`css
.slide-bullets li {
    font-size: ${fontSize};
    line-height: 1.7;
    margin-bottom: ${spacing};
    padding-left: 1.8em;
    position: relative;
    color: #333;
    font-family: '${designSystem.typography.bodyFont}';
}

.slide-bullets li::before {
    content: '▸';
    position: absolute;
    left: 0;
    top: 0;
    color: ${designSystem.colors.primary};
    font-weight: bold;
    font-size: 1.3em;
}
\`\`\`

**ABSOLUTE REQUIREMENTS:**
1. Use inline styles for ALL layout properties (flex, width, height, padding, alignment)
2. Font size MUST be ${fontSize} for bullets
3. Spacing MUST be ${spacing} between bullets
4. Content MUST be vertically centered using flexbox
5. NO placeholder text anywhere
6. Visual placeholder must be EMPTY <div id="visual-placeholder"></div>
7. Use the EXACT bullet HTML provided above
8. DO NOT wrap in <html>, <head>, or <body>
9. DO NOT add any explanatory text
10. Start with <div class="ai-content-wrapper" and end with </div>

**COLOR SCHEME:**
- Primary: ${designSystem.colors.primary}
- Accent: ${designSystem.colors.accent}
- Text: #333

Create the HTML now with inline styles:`;

return {
    prompt: designPrompt,
    optimizedSlide: slideData,
    navigationData: navData,
    designSystem: designSystem,
    slideMetadata: {
        slideId: slideData.id,
        slideType: slideType,
        hasVisual: hasVisual,
        bulletCount: bulletCount
    }
};