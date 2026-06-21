// NODE NAME: Prepare Paper Analysis Review File

// ============================================================================
// Node: Prepare Paper Analysis Review File
// Purpose: Collect all review rounds and build comprehensive HTML review log
// ============================================================================

console.log('=== Preparing Paper Analysis Review File ===');

// Get session info
const manifestContext = $('Obtain Manifest Information for Paper Analysis').first().json;
const sessionFolder = manifestContext.sessionFolder;
const sessionId = manifestContext.sessionId;

// ✅ FIX: Get the CURRENT decision using absolute reference
const currentDecision = $('Process Editor Review Results').item.json;
const currentDecisionStatus = currentDecision.proceed_to_save ? 'Approved' : 'Refine';

console.log('Current decision:', {
  proceed_to_save: currentDecision.proceed_to_save,
  needs_revision: currentDecision.needs_revision,
  status: currentDecisionStatus,
  has_feedback: !!currentDecision.editor_feedback
});

// Collect all rounds from the review process using .all()
// n8n stores each iteration in separate items when looping
const thematicAnalystRounds = $('Thematic Analyst Agent').all();
const paperAnalyzerRounds = $('Paper Analyzer').all();
const reviewDecisions = $('Process Editor Review Results').all();

console.log('Review rounds collected:', {
  thematic_rounds: thematicAnalystRounds.length,
  analyzer_rounds: paperAnalyzerRounds.length,
  decision_rounds: reviewDecisions.length,
  current_status: currentDecisionStatus
});

// Build review history array
const reviewHistory = [];
const totalRounds = reviewDecisions.length;

for (let i = 0; i < totalRounds; i++) {
  const roundNum = i + 1;
  
  // Get thematic analysis for this round
  let thematicOutput = '';
  if (thematicAnalystRounds[i]) {
    const thematicData = thematicAnalystRounds[i].json;
    thematicOutput = thematicData.output || thematicData.text || thematicData.response || '';
    if (typeof thematicOutput === 'string') {
      thematicOutput = thematicOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
  }
  
  // Get paper analysis for this round
  let paperOutput = '';
  if (paperAnalyzerRounds[i]) {
    const paperData = paperAnalyzerRounds[i].json;
    paperOutput = paperData.output || paperData.text || paperData.response || '';
    if (typeof paperOutput === 'string') {
      paperOutput = paperOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
  }
  
  // Get user decision for this round
  const decision = reviewDecisions[i].json;
  const userDecision = decision.proceed_to_save ? 'Approved' : 'Refine';
  const userFeedback = decision.editor_feedback || null;
  const timestamp = decision.approval_timestamp || new Date().toISOString();
  
  reviewHistory.push({
    round: roundNum,
    timestamp: timestamp,
    thematicAnalysis: thematicOutput,
    paperAnalysis: paperOutput,
    userDecision: userDecision,
    userFeedback: userFeedback
  });
}

// Check if learning assistance was used
const learningAssistUsed = manifestContext.learningAssistEnabled || false;

// ✅ FIX: Use ACTUAL current status, not assuming final is approved
const finalStatusDisplay = currentDecisionStatus;
const isCompleted = currentDecisionStatus === 'Approved';

console.log('Status for display:', {
  final_status: finalStatusDisplay,
  is_completed: isCompleted,
  total_rounds: totalRounds
});

// Build HTML document
let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paper Analysis Review Log - Session ${sessionId}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: #f8fafc;
            color: #334155;
        }
        .header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0 0 10px 0;
        }
        .summary {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .summary-item {
            background: #f1f5f9;
            padding: 15px;
            border-radius: 6px;
        }
        .summary-item strong {
            display: block;
            color: #475569;
            font-size: 0.9em;
            margin-bottom: 5px;
        }
        .summary-item span {
            font-size: 1.5em;
            font-weight: 600;
            color: #0f172a;
        }
        .in-progress {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .toc {
            background: #eff6ff;
            border: 2px solid #bfdbfe;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .toc h2 {
            color: #1e40af;
            margin-bottom: 15px;
        }
        .toc-links {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .toc-link {
            background: white;
            color: #2563eb;
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            border: 1px solid #bfdbfe;
            transition: all 0.2s;
        }
        .toc-link:hover {
            background: #dbeafe;
            border-color: #2563eb;
        }
        .round {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 30px;
        }
        .round.final {
            border-color: #10b981;
            background: #f0fdf4;
        }
        .round.refining {
            border-color: #f59e0b;
            background: #fffbeb;
        }
        .round-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e2e8f0;
        }
        .round-title {
            font-size: 1.5em;
            font-weight: 700;
            color: #0f172a;
        }
        .round.final .round-title {
            color: #059669;
        }
        .round.refining .round-title {
            color: #d97706;
        }
        .round-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.9em;
        }
        .badge-approved {
            background: #d1fae5;
            color: #065f46;
        }
        .badge-refine {
            background: #fef3c7;
            color: #92400e;
        }
        .section {
            margin: 20px 0;
        }
        .section-title {
            background: #f1f5f9;
            padding: 10px 15px;
            border-left: 4px solid #3b82f6;
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 10px;
        }
        .content-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 400px;
            overflow-y: auto;
        }
        .feedback-box {
            background: #fef3c7;
            border: 2px solid #fbbf24;
            border-radius: 6px;
            padding: 15px;
            margin-top: 10px;
        }
        .timestamp {
            color: #64748b;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 Paper Analysis Review Log</h1>
        <p>Complete audit trail of AI analysis iterations and human review decisions</p>
        <p class="timestamp">Session: ${sessionId} | Generated: ${new Date().toLocaleString()}</p>
    </div>

    ${!isCompleted ? `<div class="in-progress">
        <strong>⚠️ Review In Progress</strong><br>
        This log shows ${totalRounds} round(s) of analysis. The workflow is currently in refinement mode and will continue until approved.
    </div>` : ''}

    <div class="summary">
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <strong>Total Rounds</strong>
                <span>${totalRounds}</span>
            </div>
            <div class="summary-item">
                <strong>Current Status</strong>
                <span style="color: ${isCompleted ? '#059669' : '#f59e0b'};">${finalStatusDisplay}</span>
            </div>
            <div class="summary-item">
                <strong>Learning Assist</strong>
                <span>${learningAssistUsed ? 'Yes ✓' : 'No'}</span>
            </div>
            <div class="summary-item">
                <strong>Session Date</strong>
                <span style="font-size: 1em;">${new Date().toLocaleDateString()}</span>
            </div>
        </div>
    </div>

    <div class="toc">
        <h2>📑 Table of Contents</h2>
        <div class="toc-links">`;

for (let i = 0; i < totalRounds; i++) {
  const roundNum = i + 1;
  const isCurrent = (i === totalRounds - 1);
  htmlContent += `
            <a href="#round${roundNum}" class="toc-link">Round ${roundNum}${isCurrent ? ' (Current)' : ''}</a>`;
}

htmlContent += `
        </div>
    </div>`;

// Add each round
for (let i = 0; i < reviewHistory.length; i++) {
  const round = reviewHistory[i];
  const isCurrent = (i === reviewHistory.length - 1);
  const roundClass = round.userDecision === 'Approved' ? 'final' : (isCurrent ? 'refining' : '');
  
  htmlContent += `
    <div id="round${round.round}" class="round ${roundClass}">
        <div class="round-header">
            <div class="round-title">Round ${round.round}${isCurrent ? ' (Current)' : ''}</div>
            <div class="round-badge badge-${round.userDecision.toLowerCase()}">${round.userDecision}</div>
        </div>

        <div class="section">
            <div class="section-title">🎯 Thematic Analysis Output</div>
            <div class="content-box">${round.thematicAnalysis.substring(0, 2000)}${round.thematicAnalysis.length > 2000 ? '\n\n... (truncated)' : ''}</div>
        </div>

        <div class="section">
            <div class="section-title">📊 Paper Structure Analysis Output</div>
            <div class="content-box">${round.paperAnalysis.substring(0, 2000)}${round.paperAnalysis.length > 2000 ? '\n\n... (truncated)' : ''}</div>
        </div>

        <div class="section">
            <div class="section-title">👤 User Review Decision</div>
            <div class="content-box">Decision: ${round.userDecision}
Timestamp: ${round.timestamp}</div>
            ${round.userFeedback ? `<div class="feedback-box"><strong>User Feedback:</strong><br>${round.userFeedback}</div>` : ''}
        </div>
    </div>`;
}

htmlContent += `
</body>
</html>`;

// Construct file path
const reviewLogFileName = `step1_paper_analysis_review.html`;
const reviewLogPath = `${sessionFolder}${reviewLogFileName}`;

console.log('✓ Review log HTML generated');
console.log('Total rounds:', totalRounds);
console.log('Current status:', finalStatusDisplay);
console.log('HTML length:', htmlContent.length);

return {
  file_path: reviewLogPath,
  file_name: reviewLogFileName,
  data: htmlContent,
  totalRounds: totalRounds,
  finalStatus: finalStatusDisplay.toLowerCase(),
  learningAssistUsed: learningAssistUsed,
  sessionFolder: sessionFolder,
  sessionId: sessionId,
  timestamp: new Date().toISOString()
};