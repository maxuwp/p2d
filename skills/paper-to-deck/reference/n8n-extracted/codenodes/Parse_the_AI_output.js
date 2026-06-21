// NODE NAME: Parse the AI output

// Parse the AI Output - Extract multimedia suggestions (ENHANCED VERSION)
// Processes AI agent response with robust error handling and multiple parsing strategies

const input = $input.first().json;
const agentOutput = input.output || input.text || '';

console.log('=== Parsing AI Multimedia Output (Enhanced) ===');
console.log('Raw output length:', agentOutput.length);
console.log('Raw output preview (first 300 chars):', agentOutput.substring(0, 300));

// Get slide info using ABSOLUTE REFERENCE
const prepareNodeName = 'Prepare Input for the Multimedia Agent';
let slideInfo;

try {
  slideInfo = $(prepareNodeName).first().json;
  console.log('✓ Retrieved slide info from:', prepareNodeName);
  console.log('Slide:', slideInfo.slides.id, '-', slideInfo.slides.title);
} catch (error) {
  console.error('✗ Failed to retrieve slide info:', error.message);
  throw new Error(`Cannot retrieve slide context from node '${prepareNodeName}': ${error.message}`);
}

let multimediaData;
let parsingStrategy = 'none';

// STRATEGY 1: Standard cleaning and parsing
try {
  console.log('\n--- Strategy 1: Standard JSON parsing ---');
  
  let cleanedOutput = agentOutput.trim();
  
  // Remove markdown code blocks (multiple patterns)
  cleanedOutput = cleanedOutput
    .replace(/```json\s*/gi, '')
    .replace(/```javascript\s*/gi, '')
    .replace(/```\s*\n/g, '')
    .replace(/```\s*$/g, '')
    .replace(/^```/g, '')
    .trim();
  
  console.log('Cleaned output preview:', cleanedOutput.substring(0, 200));
  
  multimediaData = JSON.parse(cleanedOutput);
  parsingStrategy = 'standard';
  console.log('✓ Strategy 1 succeeded');
  
} catch (error1) {
  console.warn('⚠ Strategy 1 failed:', error1.message);
  
  // STRATEGY 2: Extract JSON object using regex
  try {
    console.log('\n--- Strategy 2: Regex extraction ---');
    
    // Find the first complete JSON object
    const jsonMatch = agentOutput.match(/\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/);
    
    if (jsonMatch) {
      console.log('Found JSON match, length:', jsonMatch[0].length);
      multimediaData = JSON.parse(jsonMatch[0]);
      parsingStrategy = 'regex';
      console.log('✓ Strategy 2 succeeded');
    } else {
      throw new Error('No JSON object found in output');
    }
    
  } catch (error2) {
    console.warn('⚠ Strategy 2 failed:', error2.message);
    
    // STRATEGY 3: Extract JSON between first { and last }
    try {
      console.log('\n--- Strategy 3: Boundary extraction ---');
      
      const firstBrace = agentOutput.indexOf('{');
      const lastBrace = agentOutput.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const extractedJson = agentOutput.substring(firstBrace, lastBrace + 1);
        console.log('Extracted JSON length:', extractedJson.length);
        console.log('Extracted JSON preview:', extractedJson.substring(0, 200));
        
        multimediaData = JSON.parse(extractedJson);
        parsingStrategy = 'boundary';
        console.log('✓ Strategy 3 succeeded');
      } else {
        throw new Error('Could not find JSON boundaries');
      }
      
    } catch (error3) {
      console.warn('⚠ Strategy 3 failed:', error3.message);
      
      // STRATEGY 4: Try to parse line by line to find valid JSON
      try {
        console.log('\n--- Strategy 4: Line-by-line search ---');
        
        const lines = agentOutput.split('\n');
        let jsonBuffer = '';
        let braceCount = 0;
        let foundValidJson = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Start capturing when we find an opening brace
          if (line.includes('{')) {
            jsonBuffer += line + '\n';
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
          } else if (braceCount > 0) {
            jsonBuffer += line + '\n';
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
          }
          
          // When braces are balanced, try to parse
          if (braceCount === 0 && jsonBuffer.length > 0) {
            try {
              multimediaData = JSON.parse(jsonBuffer);
              foundValidJson = true;
              parsingStrategy = 'line-by-line';
              console.log('✓ Strategy 4 succeeded at line', i);
              break;
            } catch (e) {
              // Continue searching
              jsonBuffer = '';
            }
          }
        }
        
        if (!foundValidJson) {
          throw new Error('No valid JSON found in line-by-line search');
        }
        
      } catch (error4) {
        console.warn('⚠ Strategy 4 failed:', error4.message);
        console.warn('⚠ All parsing strategies exhausted');
        
        // FALLBACK: Default to no visual
        console.log('\n--- Fallback: Using default values ---');
        multimediaData = {
          visualType: 'none',
          visualTypeIndex: 5,
          asset: {
            type: 'none'
          },
          rationale: `Parsing error - all strategies failed. Last error: ${error4.message}`,
          _parsingError: true,
          _rawOutputPreview: agentOutput.substring(0, 500)
        };
        parsingStrategy = 'fallback';
      }
    }
  }
}

console.log('\n=== Parsing Result ===');
console.log('Strategy used:', parsingStrategy);
console.log('Visual type:', multimediaData.visualType);
console.log('Visual type index:', multimediaData.visualTypeIndex);

// VALIDATION: Ensure required fields exist
if (!multimediaData.visualType) {
  console.warn('⚠ Missing visualType, adding default');
  multimediaData.visualType = 'none';
}

if (typeof multimediaData.visualTypeIndex === 'undefined') {
  console.warn('⚠ Missing visualTypeIndex, deriving from visualType');
  
  // Derive index from type
  const typeIndexMap = {
    'image': 0,
    'bar_chart': 1,
    'pie_chart': 2,
    'line_chart': 3,
    'diagram': 4,
    'generated_image': 4,
    'none': 5
  };
  
  multimediaData.visualTypeIndex = typeIndexMap[multimediaData.visualType] || 5;
}

// VALIDATION: Verify visualTypeIndex is valid
if (typeof multimediaData.visualTypeIndex !== 'number' || 
    multimediaData.visualTypeIndex < 0 || 
    multimediaData.visualTypeIndex > 5) {
  console.warn('⚠ Invalid visualTypeIndex:', multimediaData.visualTypeIndex, '- defaulting to 5 (none)');
  multimediaData.visualTypeIndex = 5;
  multimediaData.visualType = 'none';
}

// VALIDATION: Ensure asset object exists with proper structure
if (!multimediaData.asset || typeof multimediaData.asset !== 'object') {
  console.warn('⚠ Missing or invalid asset object, creating default');
  multimediaData.asset = { type: 'none' };
}

// Ensure asset.type exists
if (!multimediaData.asset.type) {
  console.warn('⚠ Missing asset.type, setting to none');
  multimediaData.asset.type = 'none';
}

// ============================================================================
// CRITICAL FIX: Ensure chart_json structure is properly accessible
// ============================================================================
if (multimediaData.asset.chart_json) {
  console.log('\n--- Processing chart_json data ---');
  console.log('Chart JSON structure:', JSON.stringify(multimediaData.asset.chart_json, null, 2));
  
  // Validate chart_json structure
  if (!multimediaData.asset.chart_json.data) {
    console.warn('⚠ Missing chart_json.data, creating default structure');
    multimediaData.asset.chart_json = {
      data: {
        labels: [],
        datasets: [{ data: [], backgroundColor: [] }]
      }
    };
  }
  
  // Ensure labels exist and are an array
  if (!Array.isArray(multimediaData.asset.chart_json.data.labels)) {
    console.warn('⚠ chart_json.data.labels is not an array, converting');
    multimediaData.asset.chart_json.data.labels = [];
  }
  
  // Ensure datasets exist and have proper structure
  if (!Array.isArray(multimediaData.asset.chart_json.data.datasets) || 
      multimediaData.asset.chart_json.data.datasets.length === 0) {
    console.warn('⚠ chart_json.data.datasets is missing or empty, creating default');
    multimediaData.asset.chart_json.data.datasets = [{ data: [], backgroundColor: [] }];
  }
  
  // Ensure dataset data is an array
  if (!Array.isArray(multimediaData.asset.chart_json.data.datasets[0].data)) {
    console.warn('⚠ chart_json.data.datasets[0].data is not an array, converting');
    multimediaData.asset.chart_json.data.datasets[0].data = [];
  }
  
  // Add flattened chart data for easy access by chart nodes
  multimediaData.chartLabels = multimediaData.asset.chart_json.data.labels;
  multimediaData.chartData = multimediaData.asset.chart_json.data.datasets[0].data;
  multimediaData.chartColors = multimediaData.asset.chart_json.data.datasets[0].backgroundColor || [];
  
  console.log('✓ Chart data flattened:');
  console.log('  Labels:', multimediaData.chartLabels);
  console.log('  Data:', multimediaData.chartData);
  console.log('  Colors:', multimediaData.chartColors);
}

// VALIDATION: Add rationale if missing
if (!multimediaData.rationale) {
  console.warn('⚠ Missing rationale, adding default');
  multimediaData.rationale = `Visual suggestion generated using ${parsingStrategy} parsing strategy`;
}

// Add slide context
multimediaData.slideId = slideInfo.slides.id;
multimediaData.slideTitle = slideInfo.slides.title;

// Add metadata about parsing
multimediaData._metadata = {
  parsingStrategy: parsingStrategy,
  timestamp: new Date().toISOString(),
  inputLength: agentOutput.length,
  parsingSuccessful: parsingStrategy !== 'fallback'
};

console.log('\n=== Final Output ===');
console.log('Slide ID:', multimediaData.slideId);
console.log('Slide Title:', multimediaData.slideTitle);
console.log('Visual Type Index for routing:', multimediaData.visualTypeIndex);
console.log('Asset type:', multimediaData.asset.type);
console.log('Parsing successful:', multimediaData._metadata.parsingSuccessful);

// FINAL VALIDATION: Ensure output structure is complete
const requiredFields = ['visualType', 'visualTypeIndex', 'asset', 'rationale', 'slideId', 'slideTitle'];
const missingFields = requiredFields.filter(field => !(field in multimediaData));

if (missingFields.length > 0) {
  console.error('✗ Critical: Missing required fields:', missingFields);
  throw new Error(`Output validation failed. Missing fields: ${missingFields.join(', ')}`);
}

console.log('✓ All validations passed');
console.log('✓ Ready for routing to output:', multimediaData.visualTypeIndex);

return multimediaData;