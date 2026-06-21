// NODE NAME: Integrate Output of the Presentation Style Designer

// Integrate Output of the Presentation Style Designer Agent
// Adds the generated style design to the context after originalPaper

console.log('=== Integrating Style Output ===');

// Get the AI agent's output from current input
const styleOutput = $input.first().json.output;
console.log('Style output received, type:', typeof styleOutput);

// Get all other data using ABSOLUTE REFERENCE to the prepare node
// CRITICAL: Use the exact node name as it appears in your workflow
const prepareNodeName = 'Prepare information for Presentation Style Designer Agent';
const prepareData = $(prepareNodeName).first().json;

console.log('Retrieved data from prepare node:', prepareNodeName);

// Extract all the data we need from the prepare node
const slides = prepareData.slides;
const persona = prepareData.persona;
const originalPaper = prepareData.originalPaper || '';
const sessionInfo = prepareData.sessionInfo;

console.log('Number of slides:', slides.length);
console.log('Presentation title:', sessionInfo.presentationTitle);

// Parse the style output (it should be a JSON string from the AI agent)
let designSystem;
try {
  // The AI agent might return the JSON as a string, so we need to parse it
  if (typeof styleOutput === 'string') {
    // Strip potential markdown code blocks
    let cleanOutput = styleOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    designSystem = JSON.parse(cleanOutput);
  } else {
    designSystem = styleOutput;
  }
  console.log('✓ Design system parsed successfully');
} catch (error) {
  console.error('Failed to parse style output:', error.message);
  console.error('Raw output (first 500 chars):', styleOutput.substring(0, 500));
  throw new Error('Failed to parse design system from AI response. Ensure AI returns valid JSON.');
}

// Validate the design system has the expected structure
if (!designSystem.designSystem) {
  console.warn('Design system missing expected root "designSystem" property');
  // Try to use the object directly if it has the expected properties
  if (designSystem.colors && designSystem.typography) {
    console.log('Wrapping flat structure in designSystem wrapper');
    designSystem = { designSystem: designSystem };
  } else {
    console.error('Design system structure:', Object.keys(designSystem));
    throw new Error('Invalid design system structure received from AI');
  }
}

console.log('✓ Design system validated');
console.log('Design philosophy:', designSystem.designSystem.metadata?.designPhilosophy || 'Not specified');
console.log('Primary color:', designSystem.designSystem.colors?.primary || 'Not specified');
console.log('Heading font:', designSystem.designSystem.typography?.headingFont || 'Not specified');

// Return the original structure with designSystem added to context
// Structure: context now includes persona, originalPaper, sessionInfo, AND designSystem
return {
  slides: slides,
  context: {
    persona: persona,
    originalPaper: originalPaper,      // PRESERVED
    sessionInfo: sessionInfo,
    designSystem: designSystem.designSystem    // ADDED after originalPaper
  }
};