// NODE NAME: Prepare Persona Review File

// ============================================================================
// Node: Save Persona Review Log
// Purpose: Generate HTML review log matching step1 format
// ============================================================================

console.log('=== Generating Persona Review Log HTML ===');

const reviewData = $input.first().json.review_log_data;
const manifestContext = $('Obtain Manifest Information and Select Next Step').first().json;
const sessionId = manifestContext.sessionId;
const sessionFolder = manifestContext.sessionFolder;
const cleanInstructorName = manifestContext.clean_instructor_name || manifestContext.instructorName.replace(/[^a-zA-Z0-9]/g, '');

// Read existing review log if it exists
let existingRounds = [];
let totalRounds = 0;
let finalStatus = 'in-progress';

try {
  const existingLog = $('Read Existing Review Log', true);
  if (existingLog && existingLog.first()) {
    // Parse existing HTML to extract rounds (simplified - just count)
    const existingContent = existingLog.first().json.data || '';
    const roundMatches = existingContent.match(/<div id="round\d+"/g);
    totalRounds = roundMatches ? roundMatches.length : 0;
    console.log('Found existing review log with', totalRounds, 'rounds');
  }
} catch (error) {
  console.log('No existing review log found - creating new one');
}

// Increment round counter
totalRounds++;
const currentRound = totalRounds;

// Determine final status
if (reviewData.approved) {
  finalStatus = 'approved';
} else {
  finalStatus = 'in-progress';
}

// Generate current timestamp
const now = new Date();
const formattedDate = now.toLocaleDateString('en-US');
const formattedTime = now.toLocaleTimeString('en-US');

// Build HTML content
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Persona Retrieval Review Log - Session ${sessionId}</title>
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
        <h1>👨‍🏫 Persona Retrieval Review Log</h1>
        <p>Complete audit trail of persona analysis iterations and human review decisions</p>
        <p class="timestamp">Session: ${sessionId} | Generated: ${formattedDate}, ${formattedTime}</p>
    </div>

    ${finalStatus === 'in-progress' ? `
    <div class="in-progress">
        <strong>⚠️ Review In Progress</strong><br>
        This persona analysis is still being refined based on your feedback. The process will continue until you approve the final version.
    </div>
    ` : ''}

    <div class="summary">
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <strong>Total Rounds</strong>
                <span>${totalRounds}</span>
            </div>
            <div class="summary-item">
                <strong>Current Status</strong>
                <span style="color: ${finalStatus === 'approved' ? '#059669' : '#d97706'};">${finalStatus === 'approved' ? 'Approved' : 'In Progress'}</span>
            </div>
            <div class="summary-item">
                <strong>Instructor</strong>
                <span style="font-size: 1em;">${manifestContext.instructorName}</span>
            </div>
            <div class="summary-item">
                <strong>Session Date</strong>
                <span style="font-size: 1em;">${formattedDate}</span>
            </div>
        </div>
    </div>

    <div class="toc">
        <h2>📑 Table of Contents</h2>
        <div class="toc-links">
            ${Array.from({length: totalRounds}, (_, i) => i + 1).map(n => 
                `<a href="#round${n}" class="toc-link">Round ${n}${n === currentRound ? ' (Current)' : ''}</a>`
            ).join('\n            ')}
        </div>
    </div>

    <div id="round${currentRound}" class="round ${reviewData.approved ? 'final' : 'refining'}">
        <div class="round-header">
            <div class="round-title">Round ${currentRound}${reviewData.approved ? ' (Final)' : ' (Current)'}</div>
            <div class="round-badge ${reviewData.approved ? 'badge-approved' : 'badge-refine'}">
                ${reviewData.approved ? 'Approved' : 'Refining'}
            </div>
        </div>

        <div class="section">
            <div class="section-title">👨‍🏫 Generated Persona Profile</div>
            <div class="content-box">${reviewData.personaFull.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>

        <div class="section">
            <div class="section-title">💬 User Review Decision</div>
            <div class="content-box">Decision: ${reviewData.decision}
Timestamp: ${reviewData.timestamp}</div>
            ${reviewData.feedback ? `
            <div class="feedback-box">
                <strong>📝 User Feedback:</strong><br>
                ${reviewData.feedback.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;

// Prepare output
const reviewLogFilePath = `${sessionFolder}step2_persona_retrieval_review.html`;

console.log('Review log generated:', {
  filePath: reviewLogFilePath,
  totalRounds: totalRounds,
  currentRound: currentRound,
  status: finalStatus
});

return {
  review_log_path: reviewLogFilePath,
  data: htmlContent,
  metadata: {
    totalRounds: totalRounds,
    currentRound: currentRound,
    finalStatus: finalStatus,
    timestamp: reviewData.timestamp
  }
};