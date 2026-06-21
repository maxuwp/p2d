// NODE NAME: Prepare Slides and Notes Human Review Form

// Prepare Human Review Form Data - UPDATED for ## -> ### -> #### format
// No optional comments field - keep only essential inputs

const input = $input.first().json;
const parsedContent = input.parsed_content;
const metadata = input.section_metadata;
const editorReview = input.editor_review;
const decision = input.decision;

console.log('=== Preparing Human Review Form ===');
console.log('Section:', metadata.subtopic_title);
console.log('AI Score:', editorReview.score);

// Extract content for editing
const slides = parsedContent.slides || '';
const notes = parsedContent.notes || '';
const references = parsedContent.references || '';

// Calculate metrics
const notesWordCount = notes.split(/\s+/).filter(w => w.length > 0).length;
const slidesLineCount = slides.split('\n').filter(l => l.trim()).length;
const hasVisualSuggestions = slides.includes('(PPT:');
const hasInteractionCues = /\[.*?\]/.test(notes);

// Determine review reason (Using corrected logic from previous fix)
let reviewReason = '';
if (decision.auto_approved) {
    reviewReason = '✅ Quality Approved (Score >= 85)';
} else if (decision.ai_approved) {
    reviewReason = '✅ AI editor approved this content (Score < 85)';
} else if (decision.max_iterations_reached) {
    reviewReason = '⚠️ Maximum iterations reached - human decision required';
} else {
    reviewReason = '⚠️ Manual review required (AI recommended revision)';
}

// Build streamlined HTML form description
const formDescription = `
<style>
  /* (Your existing CSS styles remain unchanged) */
  .review-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1400px; margin: 0 auto; padding: 20px; background: #f8fafc; }
  .review-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
  .review-header h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: 700; }
  .review-header p { margin: 5px 0; font-size: 16px; opacity: 0.95; }
  .status-banner { background: ${decision.auto_approved || decision.ai_approved ? '#10b981' : '#f59e0b'}; color: white; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px; font-weight: 600; font-size: 16px; text-align: center; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
  .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; margin: 25px 0; }
  .metric-card { background: white; border: 2px solid #e5e7eb; border-radius: 10px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
  .metric-value { font-size: 32px; font-weight: 800; color: #667eea; margin: 0; line-height: 1; }
  .metric-label { font-size: 12px; color: #6b7280; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .feedback-section { background: ${editorReview.score < 85 ? '#fef3c7' : '#d1fae5'}; border: 2px solid ${editorReview.score < 85 ? '#f59e0b' : '#10b981'}; border-radius: 10px; padding: 20px; margin: 20px 0; }
  .feedback-section h3 { margin: 0 0 15px 0; color: ${editorReview.score < 85 ? '#92400e' : '#065f46'}; font-size: 18px; font-weight: 700; }
  .feedback-list { margin: 10px 0; padding-left: 25px; }
  .feedback-list li { margin: 8px 0; color: #374151; line-height: 1.6; }
  .content-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
  .stat-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; }
  .stat-box h4 { margin: 0 0 10px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-box p { margin: 5px 0; font-size: 14px; color: #374151; }
  .stat-value { font-weight: 700; color: #667eea; }
  .decision-guide { background: #e0f2fe; border: 2px solid #0284c7; border-radius: 10px; padding: 20px; margin: 25px 0; }
  .decision-guide h3 { margin: 0 0 15px 0; color: #0c4a6e; font-size: 18px; font-weight: 700; }
  .decision-option { background: white; border-left: 4px solid #0284c7; padding: 12px 15px; margin: 10px 0; border-radius: 4px; }
  .decision-option strong { color: #0c4a6e; display: block; margin-bottom: 5px; font-size: 15px; }
  .decision-option p { margin: 0; color: #374151; font-size: 14px; line-height: 1.5; }
  .warning-box { background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 15px; margin: 15px 0; color: #991b1b; font-weight: 600; }
  .success-box { background: #dcfce7; border: 2px solid #22c55e; border-radius: 8px; padding: 15px; margin: 15px 0; color: #166534; font-weight: 600; }
  .info-box { background: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 15px 0; color: #1e40af; }
  .collapsible-preview { background: white; border: 2px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 20px 0; }
  .collapsible-preview h3 { margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 700; }
  .preview-content { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; line-height: 1.5; max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word; color: #374151; }
</style>

<div class="review-container">
  <div class="review-header">
    <h1>📝 Section Review Required</h1>
    <p><strong>Section ${metadata.section_index + 1}:</strong> ${metadata.subtopic_title}</p>
    <p><strong>Iteration ${metadata.current_iteration}</strong> of ${metadata.max_iterations} | <strong>AI Score:</strong> ${editorReview.score}/100</p>
  </div>

  <div class="status-banner">
    ${reviewReason}
  </div>

  <div class="metrics-grid">
    <div class="metric-card"><div class="metric-value">${editorReview.score}</div><div class="metric-label">AI Score</div></div>
    <div class="metric-card"><div class="metric-value">${metadata.current_iteration}</div><div class="metric-label">Iteration</div></div>
    <div class="metric-card"><div class="metric-value">${notesWordCount}</div><div class="metric-label">Words (Notes)</div></div>
    <div class="metric-card"><div class="metric-value">${metadata.slide_count}</div><div class="metric-label">Expected Slides</div></div>
    <div class="metric-card"><div class="metric-value">${slidesLineCount}</div><div class="metric-label">Lines (Slides)</div></div>
    <div class="metric-card"><div class="metric-value">${hasVisualSuggestions ? '✓' : '✗'}</div><div class="metric-label">Visual Cues</div></div>
    <div class="metric-card"><div class="metric-value">${hasInteractionCues ? '✓' : '✗'}</div><div class="metric-label">Interaction</div></div>
  </div>

  ${editorReview.score < 85 ? `
    <div class="warning-box">
      <strong>⚠️ Below Target:</strong> AI editor score is ${editorReview.score}/100 (target: 85+).
      ${decision.max_iterations_reached ? 'Maximum iterations reached - your decision is required.' : 'Consider requesting changes or editing manually.'}
    </div>
  ` : `
    <div class="success-box">
      <strong>✅ Quality Approved:</strong> AI editor gave this content ${editorReview.score}/100. Content meets quality standards.
    </div>
  `}

  <div class="content-stats">
    <div class="stat-box">
      <h4>Slides Analysis</h4>
      <p><span class="stat-value">${slidesLineCount}</span> lines of content</p>
// =================== FORMAT FIX HERE ===================
      <p><span class="stat-value">${(slides.match(/^### .+/gm) || []).length}</span> '###' slide headers detected</p>
// =================== END OF FIX ===================
      <p>Visual suggestions: <span class="stat-value">${hasVisualSuggestions ? 'Yes ✓' : 'No ✗'}</span></p>
    </div>

    <div class="stat-box">
      <h4>Notes Analysis</h4>
      <p><span class="stat-value">${notesWordCount}</span> words (target: ~${metadata.target_word_count})</p>
      <p>Word count status: <span class="stat-value">${Math.abs(notesWordCount - (metadata.target_word_count || 0)) < (metadata.target_word_count || 0) * 0.15 ? 'Within range ✓' : 'Outside range ⚠'}</span></p>
      <p>Interaction cues: <span class="stat-value">${hasInteractionCues ? 'Yes ✓' : 'No ✗'}</span></p>
    </div>
  </div>

  ${editorReview.feedback && editorReview.feedback.length > 0 ? `
    <div class="feedback-section">
      <h3>💬 AI Editor Feedback</h3>
      <ul class="feedback-list">
        ${editorReview.feedback.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
  ` : ''}

  ${editorReview.improvements && editorReview.improvements.length > 0 && editorReview.improvements[0] !== 'N/A - Unable to parse detailed feedback' ? `
    <div class="feedback-section">
      <h3>🔧 AI Suggested Improvements</h3>
      <ul class="feedback-list">
        ${editorReview.improvements.map(imp => `<li>${imp}</li>`).join('')}
      </ul>
    </div>
  ` : ''}

  <div class="collapsible-preview">
    <h3>📊 Slides Content Preview</h3>
    <div class="preview-content">${slides.substring(0, 2000)}${slides.length > 2000 ? '\n\n... [Full content available in edit fields below]' : ''}</div>
  </div>

  <div class="collapsible-preview">
    <h3>🎤 Notes Content Preview</h3>
    <div class="preview-content">${notes.substring(0, 2000)}${notes.length > 2000 ? '\n\n... [Full content available in edit fields below]' : ''}</div>
  </div>

  ${references ? `
    <div class="collapsible-preview">
      <h3>📚 References</h3>
      <div class="preview-content">${references}</div>
    </div>
  ` : ''}

  <div class="decision-guide">
    <h3>✅ Make Your Decision</h3>
    <div class="decision-option"><strong>Option 1: Approve</strong><p>Content is ready. Section will be saved and workflow continues to next section.</p></div>
    <div class="decision-option"><strong>Option 2: Request AI Revision</strong><p>Provide specific feedback in the text field that appears. AI will regenerate with your instructions.</p></div>
    <div class="decision-option"><strong>Option 3: Edit Manually</strong><p>Current content will load into editable fields. Make your changes directly and submit.</p></div>
  </div>

  <div class="info-box">
    <strong>💡 Quick Tip:</strong> Choose "Edit Manually" for quick fixes. The content loads automatically - no copy/paste needed!
  </div>
</div>
`;

console.log('✓ Form description prepared');

// Return only essential data
return {
    ...input,
    form_description: formDescription,
    slides_content_for_editing: slides,
    notes_content_for_editing: notes,

    review_context: {
        section_index: metadata.section_index,
        section_id: metadata.section_id,
        subtopic_title: metadata.subtopic_title,
        ai_score: editorReview.score,
        iteration: metadata.current_iteration,
        max_iterations: metadata.max_iterations,
        word_count: notesWordCount,
        target_word_count: metadata.target_word_count,
        timestamp: new Date().toISOString()
    }
};