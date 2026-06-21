// NODE NAME: Prepare Paper Analysis with Learning Guide

// ============================================================================
// Node: Prepare Paper Analysis with Learning Guide
// Purpose: Enhance the HIL form description to include learning guide info
// ============================================================================

const input = $input.first().json;

console.log('=== Enhancing HIL Form with Learning Guide Info ===');

// Get the original form description from "Process Paper Structure" node
const paperStructureNode = $('Process Paper Structure').first().json;
const originalFormDescription = paperStructureNode.formDescription;

// Get learning guide info from the file save operation
const learningGuideInfo = $('Process Learning Assistant Output').first().json;
const learningGuidePath = learningGuideInfo.file_path;
const verificationWarnings = learningGuideInfo.verificationWarnings || 0;
const verifiedClaims = learningGuideInfo.verifiedClaims || 0;

console.log('Learning guide info retrieved:', {
  path: learningGuidePath,
  warnings: verificationWarnings,
  verified: verifiedClaims
});

// Build the learning guide notification box (simplified)
const learningGuideBox = `
  <!-- Learning Guide Available Box -->
  <div style="background: #ecfdf5; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
    <h3 style="margin: 0 0 12px 0; color: #065f46; font-size: 1.1rem; font-weight: 700;">📚 Learning Guide Available</h3>
    
    <p style="margin: 0 0 16px 0; color: #047857; font-size: 0.95rem; line-height: 1.6;">
      An AI fact-checker has analyzed both analyses below and verified each claim by finding supporting evidence in the original paper. 
      The detailed guide shows quotes, locations, and verification status for every claim 
      (<strong style="color: #059669;">${verifiedClaims} verified</strong>${verificationWarnings > 0 ? `, <strong style="color: #dc2626;">${verificationWarnings} warnings</strong>` : ''}).
    </p>
    
    <div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 6px; padding: 15px; margin: 16px 0;">
      <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 0.95rem; font-weight: 600;">
        📖 <strong>To review the learning guide:</strong>
      </p>
      <ol style="margin: 0 0 12px 0; padding-left: 20px; color: #1e40af; font-size: 0.9rem; line-height: 1.8;">
        <li>Right-click on the file path below</li>
        <li>Select "Copy"</li>
        <li>Paste into your browser's address bar</li>
        <li>Press Enter to open the learning guide</li>
      </ol>
      <div style="background: #ffffff; padding: 12px; border-radius: 4px; border: 1px solid #bfdbfe;">
        <code style="display: block; background: #f8fafc; padding: 10px; border-radius: 4px; color: #1e293b; font-family: 'Courier New', monospace; font-size: 0.9rem; word-break: break-all; border: 1px solid #e2e8f0; user-select: all;">${learningGuidePath}</code>
      </div>
    </div>
  </div>
`;

// 🆕 UPDATED INSERTION LOGIC
// Instead of looking for a specific marker, insert after the header div and any AI response sections
// Find the end of the header div (which always exists)
const headerEndMarker = '</div>\n\n  ';
const headerEndIndex = originalFormDescription.indexOf(headerEndMarker);

if (headerEndIndex === -1) {
  throw new Error('Could not find header end marker in form description. Check "Process Paper Structure" node output.');
}

// Check if there's an AI response section (it would come right after the header)
let insertionPoint = headerEndIndex + headerEndMarker.length;

// If the next content is the AI response div, skip past it
const nextContentPreview = originalFormDescription.substring(insertionPoint, insertionPoint + 200);
if (nextContentPreview.includes('🤖') || nextContentPreview.includes('response_to_feedback')) {
  // Find the end of the AI response section(s)
  const aiResponseEndMarker = '</div>\n\n  <!-- File Location Info Box -->';
  const aiResponseEndIndex = originalFormDescription.indexOf(aiResponseEndMarker, insertionPoint);
  
  if (aiResponseEndIndex !== -1) {
    insertionPoint = aiResponseEndIndex + 8; // After the closing </div> of AI response section
  }
}

// Insert the learning guide box
const enhancedFormDescription = 
  originalFormDescription.slice(0, insertionPoint) + 
  '\n\n' + 
  learningGuideBox +
  originalFormDescription.slice(insertionPoint);

console.log('✓ Form description enhanced with learning guide info');
console.log('Statistics:', {
  verified: verifiedClaims,
  warnings: verificationWarnings,
  guide_path: learningGuidePath,
  insertion_point: insertionPoint
});

// Return the enhanced form description along with all original data
return {
  formDescription: enhancedFormDescription,
  merged_analysis: paperStructureNode.merged_analysis,
  thematic_data: paperStructureNode.thematic_data,
  structure_data: paperStructureNode.structure_data,
  metadata: paperStructureNode.metadata,
  raw_output: paperStructureNode.raw_output,
  learning_guide_path: learningGuidePath,
  verification_stats: {
    verified: verifiedClaims,
    warnings: verificationWarnings
  }
};