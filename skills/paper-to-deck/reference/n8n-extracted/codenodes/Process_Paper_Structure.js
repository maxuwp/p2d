// NODE NAME: Process Paper Structure

// ============================================================================
// Node: Process Paper Structure
// Purpose: Format BOTH analyses (Thematic + Paper Structure) for HIL review
//          and prepare merged flat JSON structure
// Enhancement: Add warning if expected response_to_feedback is missing
// FIX: Correct file path display in HTML (was showing expression, not value)
// ============================================================================

const input = $input.first().json;

console.log('=== Processing Paper Structure for HIL Review ===');

// Extract AI output with multiple fallback keys
let aiOutput = input.output || input.text || input.response || '';

if (!aiOutput) {
  throw new Error('No AI output received. Check Paper Analyzer node.');
}

// Parse JSON if it's a string
let analysisData;
try {
  if (typeof aiOutput === 'string') {
    // Strip markdown code blocks if present
    aiOutput = aiOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    analysisData = JSON.parse(aiOutput);
  } else {
    analysisData = aiOutput;
  }
} catch (error) {
  console.error('Failed to parse AI output:', aiOutput.substring(0, 500));
  throw new Error('AI output is not valid JSON: ' + error.message);
}

// Validate required fields for paper analysis
const requiredFields = ['paper_structure', 'main_contribution', 'main_objective', 'references_text'];
const missingFields = requiredFields.filter(field => !analysisData[field]);

if (missingFields.length > 0) {
  throw new Error('AI output missing required fields: ' + missingFields.join(', '));
}

// Get thematic analysis from upstream
const thematicNode = $('Process Thematic Analysis').first().json;
const thematicData = thematicNode.thematic_analysis_json;

// Get metadata from upstream
const thematicMetadata = $('Consolidate Thematic Analyst Agent Prompts').first().json.metadata;

// Get session folder and manifest path for file path display
const manifestContext = $('Obtain Manifest Information for Paper Analysis').first().json;
const sessionFolder = manifestContext.sessionFolder;
const manifestPath = manifestContext.manifestPath; // FIX: Get the actual manifest path

console.log('Session info:', {
  sessionFolder: sessionFolder,
  manifestPath: manifestPath
});

// Check if we have AI responses to feedback
const hasThematicResponse = !!thematicData.response_to_feedback;
const hasPaperAnalyzerResponse = !!analysisData.response_to_thematic_revision;

console.log('AI Response fields detected:', {
  has_thematic_response: hasThematicResponse,
  has_paper_analyzer_response: hasPaperAnalyzerResponse,
  is_revision: thematicMetadata.is_revision
});

// Warn if revision but no response
if (thematicMetadata.is_revision && !hasThematicResponse) {
  console.warn('⚠️ WARNING: This is a revision cycle but Thematic Analyst did not generate response_to_feedback field!');
}

// CREATE MERGED FLAT JSON STRUCTURE
const mergedAnalysis = {
  // Thematic analysis fields
  main_thesis: thematicData.main_thesis,
  paper_type: thematicData.paper_type,
  key_themes: thematicData.key_themes,
  key_comparisons: thematicData.key_comparisons,
  implicit_structures: thematicData.implicit_structures,
  evidence_types: thematicData.evidence_types,
  
  // Paper structure analysis fields
  paper_structure: analysisData.paper_structure,
  main_contribution: analysisData.main_contribution,
  main_objective: analysisData.main_objective,
  references_text: analysisData.references_text
};

console.log('✓ Merged analysis structure created:', {
  thematic_fields: 6,
  structure_fields: 4,
  total_fields: 10
});

// Helper function: Convert arrays to HTML lists
function arrayToHTML(arr, ordered = false) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return '<p style="color: #94a3b8; font-style: italic;">None provided</p>';
  }
  const tag = ordered ? 'ol' : 'ul';
  const listStyle = ordered 
    ? 'margin: 0; padding-left: 20px; list-style: decimal;' 
    : 'margin: 0; padding-left: 20px; list-style: disc;';
  const items = arr.map(item => `<li style="margin: 8px 0; line-height: 1.6;">${item}</li>`).join('');
  return `<${tag} style="${listStyle}">${items}</${tag}>`;
}

// BUILD AI RESPONSE SECTION (if this is a revision)
let aiResponseSection = '';

if (hasThematicResponse || hasPaperAnalyzerResponse) {
  aiResponseSection = '<div style="margin-bottom: 24px;">';
  
  if (hasThematicResponse) {
    aiResponseSection += `
    <!-- Thematic Analyst Response -->
    <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 1.1rem; font-weight: 700;">
        🤖 Thematic Analyst's Response to Your Feedback
      </h3>
      <div style="background: white; border-radius: 6px; padding: 15px; color: #78350f; line-height: 1.7; font-size: 0.95rem;">
        ${thematicData.response_to_feedback}
      </div>
    </div>`;
  }
  
  if (hasPaperAnalyzerResponse) {
    aiResponseSection += `
    <!-- Paper Analyzer Response -->
    <div style="background: #e0f2fe; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px 0; color: #075985; font-size: 1.1rem; font-weight: 700;">
        🤖 Paper Analyzer's Response to Improved Thematic Analysis
      </h3>
      <div style="background: white; border-radius: 6px; padding: 15px; color: #0c4a6e; line-height: 1.7; font-size: 0.95rem;">
        ${analysisData.response_to_thematic_revision}
      </div>
    </div>`;
  }
  
  aiResponseSection += '</div>';
}

// Add warning notice if revision but no response
if (thematicMetadata.is_revision && !hasThematicResponse) {
  aiResponseSection += `
  <div style="background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
    <h3 style="margin: 0 0 12px 0; color: #991b1b; font-size: 1.1rem; font-weight: 700;">
      ⚠️ Notice: AI Response Missing
    </h3>
    <div style="background: white; border-radius: 6px; padding: 15px; color: #7f1d1d; line-height: 1.7; font-size: 0.95rem;">
      The AI did not generate a response to your feedback. This may indicate that your feedback did not reach the AI properly, or the AI failed to include the required "response_to_feedback" field in its output. 
      <br><br>
      <strong>Recommendation:</strong> If this happens repeatedly, please report this issue. The analysis below may still be improved, but without explicit acknowledgment of your feedback.
    </div>
  </div>`;
}

// Build styled HTML content showing BOTH analyses in separate tables
const htmlContent = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 100%; margin: 0; padding: 20px; background: #f8fafc; color: #334155; line-height: 1.6;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: #ffffff; padding: 24px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
    <h1 style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 700;">📊 Two-Pass Analysis Results</h1>
    <p style="margin: 0; font-size: 0.9rem; color: #f1f5f9;">Review Both Thematic Analysis and Paper Structure</p>
    ${thematicMetadata.is_revision ? '<p style="margin: 8px 0 0 0; font-size: 0.85rem; color: #fbbf24; font-weight: 600;">⚠️ Revision Cycle ' + thematicMetadata.iteration + '</p>' : ''}
  </div>

  ${aiResponseSection}

  <!-- File Location Info Box -->
  <div style="background: #fefce8; border: 2px solid #fde047; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px 0; color: #854d0e; font-size: 1rem; font-weight: 600;">📁 File Location</h3>
    <p style="margin: 0 0 8px 0; color: #713f12; font-size: 0.9rem;">
      Once approved, this analysis will be saved to:
    </p>
    <code style="display: block; background: #ffffff; padding: 10px; border-radius: 4px; color: #1e293b; font-family: 'Courier New', monospace; font-size: 0.85rem; word-break: break-all;">
      ${sessionFolder}paper_analysis.json
    </code>
    <p style="margin: 8px 0 0 0; color: #713f12; font-size: 0.85rem; font-style: italic;">
      You can manually edit this file later if needed.
    </p>
  </div>

  <!-- Pass 1: Thematic Analysis Table -->
  <div style="background: #ffffff; border: 2px solid #7c3aed; border-radius: 8px; margin-bottom: 24px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 16px; font-size: 1.1rem; font-weight: 600; text-align: center;">
      Pass 1: Thematic Analysis
    </div>
    
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 16px; width: 30%; background: #faf5ff; font-weight: 600; color: #5b21b6; vertical-align: top;">Main Thesis</td>
        <td style="padding: 16px; vertical-align: top;">
          <div style="background: #faf5ff; border-left: 4px solid #7c3aed; padding: 12px; font-style: italic; color: #5b21b6;">
            ${thematicData.main_thesis}
          </div>
        </td>
      </tr>
      
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 16px; width: 30%; background: #faf5ff; font-weight: 600; color: #5b21b6; vertical-align: top;">Paper Type</td>
        <td style="padding: 16px; vertical-align: top;">
          <strong style="color: #7c3aed;">${thematicData.paper_type}</strong>
        </td>
      </tr>
      
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 16px; width: 30%; background: #faf5ff; font-weight: 600; color: #5b21b6; vertical-align: top;">Key Themes</td>
        <td style="padding: 16px; vertical-align: top;">
          ${arrayToHTML(thematicData.key_themes, false)}
        </td>
      </tr>
      
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 16px; width: 30%; background: #faf5ff; font-weight: 600; color: #5b21b6; vertical-align: top;">Key Comparisons</td>
        <td style="padding: 16px; vertical-align: top;">
          ${arrayToHTML(thematicData.key_comparisons, false)}
        </td>
      </tr>
      
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 16px; width: 30%; background: #faf5ff; font-weight: 600; color: #5b21b6; vertical-align: top;">Implicit Structures</td>
        <td style="padding: 16px; vertical-align: top;">
          ${arrayToHTML(thematicData.implicit_structures, false)}
        </td>
      </tr>
      
      <tr>
        <td style="padding: 16px; width: 30%; background: #faf5ff; font-weight: 600; color: #5b21b6; vertical-align: top;">Evidence Types</td>
        <td style="padding: 16px; vertical-align: top;">
          ${arrayToHTML(thematicData.evidence_types, false)}
        </td>
      </tr>
    </table>
  </div>

  <!-- Pass 2: Paper Structure Analysis Table -->
  <div style="background: #ffffff; border: 2px solid #2563eb; border-radius: 8px; margin-bottom: 24px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 16px; font-size: 1.1rem; font-weight: 600; text-align: center;">
      Pass 2: Paper Structure Analysis
    </div>
    
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 16px; width: 30%; background: #eff6ff; font-weight: 600; color: #1e40af; vertical-align: top;">Paper Structure</td>
        <td style="padding: 16px; vertical-align: top;">
          ${analysisData.paper_structure}
        </td>
      </tr>
      
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 16px; width: 30%; background: #eff6ff; font-weight: 600; color: #1e40af; vertical-align: top;">Main Contributions</td>
        <td style="padding: 16px; vertical-align: top;">
          ${arrayToHTML(analysisData.main_contribution, false)}
        </td>
      </tr>
      
      <tr>
        <td style="padding: 16px; width: 30%; background: #eff6ff; font-weight: 600; color: #1e40af; vertical-align: top;">Main Objectives<br/><span style="font-size: 0.85rem; font-weight: 400; color: #64748b;">(Key Takeaways)</span></td>
        <td style="padding: 16px; vertical-align: top;">
          ${arrayToHTML(analysisData.main_objective, true)}
        </td>
      </tr>
    </table>
  </div>

  <!-- References Section -->
  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; overflow: hidden;">
    <div style="background: #f8fafc; padding: 12px 16px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">
      References
    </div>
    <div style="padding: 16px; font-family: 'Courier New', monospace; font-size: 0.85rem; color: #334155; white-space: pre-wrap; max-height: 300px; overflow-y: auto; background: #f8fafc;">
${analysisData.references_text}
    </div>
  </div>

  <!-- Instructions -->
  <div style="background: #f0f9ff; border: 2px solid #bae6fd; border-radius: 8px; padding: 20px;">
    <h3 style="margin: 0 0 12px 0; color: #0369a1; font-size: 1.1rem;">🔄 Review Instructions</h3>
    <p style="margin: 0 0 12px 0; color: #0c4a6e; font-weight: 600;">Both analyses are shown above. If you request refinement, BOTH passes will re-run.</p>
    <ul style="margin: 0 0 16px 0; padding-left: 20px; list-style: disc;">
      <li style="margin: 8px 0;"><strong>Option 1 - Approve:</strong> Accept both analyses and save the merged paper analysis file</li>
      <li style="margin: 8px 0;"><strong>Option 2 - Refine:</strong> Provide feedback and both AI agents will re-analyze the paper${thematicMetadata.is_revision ? ' (and explain what they changed)' : ''}</li>
    </ul>
    
    <!-- File path info (repeated at bottom) - FIX: Show actual manifest path -->
    <div style="background: #ffffff; border-left: 4px solid #0ea5e9; padding: 12px; margin-top: 16px; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; color: #0c4a6e; font-weight: 600; font-size: 0.9rem;">📁 Save this manifest path for the next steps:</p>
      <code style="display: block; background: #f8fafc; padding: 8px; border-radius: 4px; color: #1e293b; font-family: 'Courier New', monospace; font-size: 0.8rem; word-break: break-all;">
        ${manifestPath}
      </code>
      <p style="margin: 8px 0 0 0; color: #475569; font-size: 0.85rem;">
        💡 <em>Tip: You can manually edit the paper_analysis.json file after approval if needed.</em>
      </p>
    </div>
  </div>
</div>
`;

console.log('Successfully formatted analysis for review');

return {
  formDescription: htmlContent,
  merged_analysis: mergedAnalysis,
  thematic_data: thematicData,
  structure_data: analysisData,
  metadata: thematicMetadata,
  raw_output: aiOutput,
  has_ai_responses: hasThematicResponse || hasPaperAnalyzerResponse
};