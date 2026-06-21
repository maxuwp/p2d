// NODE NAME: Process Learning Assistant Output

// ============================================================================
// Node: Process Learning Assistant Output
// Purpose: Convert markdown to beautiful HTML and prepare for file save
// ============================================================================

const input = $input.first().json;

console.log('=== Processing Learning Assistant Output ===');

// Get the AI output (markdown)
let markdownOutput = input.output || input.text || input.response || '';

if (!markdownOutput || markdownOutput.length < 100) {
  throw new Error('Learning Assistant produced no output or output too short');
}

console.log('Markdown output length:', markdownOutput.length);

// Get session info
const manifestContext = $('Obtain Manifest Information for Paper Analysis').first().json;
const sessionFolder = manifestContext.sessionFolder;
const sessionId = manifestContext.sessionId;

// Construct file path
const learningGuideFileName = `paper_learning_guide.html`;
const learningGuidePath = `${sessionFolder}${learningGuideFileName}`;

// Convert markdown to HTML with beautiful styling
function markdownToHtml(md) {
  let html = md;
  
  // Escape HTML first
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Headers (process from largest to smallest)
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold and italic (process bold first)
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code blocks (before inline code)
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // Lists (unordered)
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  
  // Lists (ordered)
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
  
  // Wrap consecutive list items
  html = html.replace(/(<li>.*?<\/li>\n?)+/gs, function(match) {
    if (match.includes('<li>')) {
      return '<ul>' + match + '</ul>';
    }
    return match;
  });
  
  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr>');
  
  // Line breaks and paragraphs
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraphs
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  return html;
}

const htmlBody = markdownToHtml(markdownOutput);

// Build complete HTML document
const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Learning Guide: Paper Analysis with Evidence</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f7fa;
            color: #2c3e50;
        }
        h1 {
            color: #1e3a8a;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 10px;
            margin: 30px 0 20px 0;
            font-size: 2em;
        }
        h2 {
            color: #7c3aed;
            border-left: 4px solid #a855f7;
            padding-left: 15px;
            margin: 25px 0 15px 0;
            font-size: 1.5em;
        }
        h3 {
            color: #059669;
            margin: 20px 0 10px 0;
            font-size: 1.25em;
        }
        h4 {
            color: #0369a1;
            margin: 15px 0 10px 0;
            font-size: 1.1em;
        }
        p {
            margin: 10px 0;
        }
        ul, ol {
            margin: 10px 0 10px 25px;
        }
        li {
            margin: 8px 0;
        }
        strong {
            color: #1e40af;
            font-weight: 600;
        }
        em {
            color: #7c3aed;
            font-style: italic;
        }
        code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', Consolas, monospace;
            font-size: 0.9em;
            color: #dc2626;
        }
        pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            line-height: 1.5;
            margin: 15px 0;
        }
        pre code {
            background: none;
            color: inherit;
            padding: 0;
        }
        .header-box {
            background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header-box h1 {
            color: white;
            border: none;
            margin: 0;
            padding: 0;
        }
        .header-box p {
            margin: 10px 0 0 0;
            font-size: 1.1em;
        }
        .session-info {
            background: #fef3c7;
            border: 2px solid #fbbf24;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        .verification-pass {
            color: #059669;
            font-weight: bold;
        }
        .verification-warning {
            color: #dc2626;
            font-weight: bold;
        }
        hr {
            margin: 30px 0;
            border: none;
            border-top: 2px solid #cbd5e1;
        }
        a {
            color: #2563eb;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .info-box {
            background: #f0f9ff;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #0ea5e9;
            margin: 20px 0;
        }
        .info-box h3 {
            margin-top: 0;
        }
    </style>
</head>
<body>
    <div class="header-box">
        <h1>📚 Learning Guide: Paper Analysis with Evidence</h1>
        <p>AI-Generated Analysis with Fact-Checking and Supporting Quotes</p>
    </div>
    
    <div class="session-info">
        <strong>Session ID:</strong> ${sessionId}<br>
        <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
        <strong>Purpose:</strong> Help instructor review AI analysis with supporting evidence from the paper
    </div>
    
    ${htmlBody}
    
    <hr>
    
    <div class="info-box">
        <h3>💡 How to Use This Guide</h3>
        <p>This document helps you review the AI-generated analysis by providing:</p>
        <ul>
            <li>✓ <strong>Supporting Quotes</strong>: Exact text from the paper that backs up each claim</li>
            <li>✓ <strong>Verification Status</strong>: Whether claims could be verified in the source paper</li>
            <li>⚠️ <strong>Warnings</strong>: Claims that couldn't be verified need your attention</li>
        </ul>
        <p><strong>Next Step:</strong> Review the verification summary and decide whether to approve or request refinement.</p>
    </div>
</body>
</html>`;

console.log('✓ HTML document generated');
console.log('HTML length:', htmlDocument.length);

// ============================================================================
// Parse the AI's verification summary to extract counts
// ============================================================================

let verifiedCount = 0;
let warningCount = 0;

// Look for patterns like:
// **Verified Claims**: 22 ✓
// **Unverified Claims**: 0 ⚠️
const verifiedMatch = markdownOutput.match(/\*\*Verified Claims\*\*:\s*(\d+)/i);
const unverifiedMatch = markdownOutput.match(/\*\*Unverified Claims\*\*:\s*(\d+)/i);

if (verifiedMatch) {
  verifiedCount = parseInt(verifiedMatch[1]);
  console.log('✓ Parsed verified claims from summary:', verifiedCount);
} else {
  // Fallback: count "✓ VERIFIED" occurrences
  verifiedCount = (markdownOutput.match(/✓ VERIFIED/g) || []).length;
  console.log('⚠️ Could not parse summary, using text count:', verifiedCount);
}

if (unverifiedMatch) {
  warningCount = parseInt(unverifiedMatch[1]);
  console.log('✓ Parsed unverified claims from summary:', warningCount);
} else {
  // Fallback: count "⚠️ WARNING" occurrences (not just emoji)
  warningCount = (markdownOutput.match(/⚠️\s*WARNING/gi) || []).length;
  console.log('⚠️ Could not parse summary, using warning count:', warningCount);
}

console.log('Final counts:', {
  verified: verifiedCount,
  warnings: warningCount
});

return {
  file_path: learningGuidePath,
  file_name: learningGuideFileName,
  data: htmlDocument,
  wordCount: markdownOutput.split(/\s+/).length,
  verificationWarnings: warningCount,
  verifiedClaims: verifiedCount,
  sessionFolder: sessionFolder,
  sessionId: sessionId,
  timestamp: new Date().toISOString()
};