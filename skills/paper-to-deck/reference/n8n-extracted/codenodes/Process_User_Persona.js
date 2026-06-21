// NODE NAME: Process User Persona

// Enhanced n8n Code Node: Process User Profile
// Implements beautiful, modern design with excellent readability
// FINAL VERSION: Fixed manual edit notice display issue

console.log('Starting: Enhanced Process User Profile');

// Get the persona markdown from the AI agent with multiple fallback keys
const personaProfileMarkdown = $input.first().json.output || 
                              $input.first().json.text || 
                              $input.first().json.response || 
                              '';

// Get manifest context for file path
const manifestContext = $('Obtain Manifest Information and Select Next Step').first().json;
const cleanInstructorName = manifestContext.clean_instructor_name || manifestContext.instructorName.replace(/[^a-zA-Z0-9]/g, '');
const sessionFolder = manifestContext.sessionFolder;
const personaFilePath = `${sessionFolder}professor_persona_${cleanInstructorName}.md`;

// Advanced markdown to HTML converter with comprehensive rule support
function convertMarkdownToHTML(markdown) {
  let html = markdown;
  
  // Normalize line breaks
  html = html.replace(/\r\n/g, '\n');
  
  // Convert headers (order matters - start with smallest)
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Convert bold and italic text (order matters)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Convert horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^-{3,}$/gm, '<hr>');
  
  // Convert lists - handle nested structure
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^  - (.+)$/gm, '<li class="nested">$1</li>');
  
  // Wrap consecutive li elements in ul
  html = html.replace(/(<li>.*?<\/li>\s*)+/g, function(match) {
    return '<ul>' + match + '</ul>';
  });
  
  // Handle nested lists
  html = html.replace(/<li class="nested">/g, '<li style="margin-left: 20px;">');
  
  // Convert code blocks and inline code
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Convert line breaks to paragraphs for better structure
  const lines = html.split('\n');
  const processedLines = [];
  let inHtmlBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if we're in an HTML block
    if (line.match(/^<(h[1-6]|ul|ol|li|pre|hr|div)/)) {
      inHtmlBlock = true;
    }
    
    if (line.match(/<\/(h[1-6]|ul|ol|li|pre|div)>$/)) {
      inHtmlBlock = false;
    }
    
    // If line is empty, add a break
    if (line === '') {
      if (!inHtmlBlock) {
        processedLines.push('<br>');
      }
    }
    // If line contains HTML tags or we're in HTML block, keep as is
    else if (line.match(/<[^>]+>/) || inHtmlBlock) {
      processedLines.push(line);
    }
    // Otherwise, wrap in paragraph
    else if (line.length > 0) {
      processedLines.push(`<p>${line}</p>`);
    }
  }
  
  return processedLines.join('\n');
}

// Beautiful, modern CSS styling based on 2024 design trends
const embeddedCSS = `
<style>
/* Import modern fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* CSS Reset and Base Styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Form Container Full Width Support */
.n8n-form {
  max-width: 95% !important;
  width: 95% !important;
  margin: 0 auto !important;
}

.n8n-form-content {
  max-width: 100% !important;
  width: 100% !important;
}

.n8n-form-description {
  max-width: 100% !important;
  width: 100% !important;
}

/* Main Container */
.profile-container {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.7;
  color: #475569;
  max-width: 100%;
  font-size: 16px;
  background: #f8fafc;
}

/* Form Content Wrapper */
.profile-content-wrapper {
  background: #ffffff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.04), 0 10px 15px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  position: relative;
  width: 100%;
  max-width: 1200px;
  margin: 20px auto;
}

/* Content Layer */
.profile-content {
  position: relative;
  z-index: 1;
}

/* Header Section */
.profile-header {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: #ffffff;
  padding: 32px;
  border-radius: 12px;
  margin-bottom: 32px;
  box-shadow: 0 4px 8px rgba(30, 41, 59, 0.2);
  text-align: center;
}

.profile-header h1 {
  margin: 0 0 12px 0;
  font-size: 1.875rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.025em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.profile-header p {
  margin: 0;
  color: #f1f5f9;
  font-size: 1rem;
  font-weight: 400;
  opacity: 1;
}

/* Typography Styles */
h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1.75em;
  margin-bottom: 0.75em;
  color: #1e293b;
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-top: 0;
}

h2 {
  font-size: 1.5rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.5em;
  position: relative;
}

h2::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 60px;
  height: 2px;
  background: #3b82f6;
}

h3 {
  font-size: 1.25rem;
  position: relative;
  padding-left: 20px;
  margin-top: 1.5em;
}

h3::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: #3b82f6;
  font-weight: 700;
  font-size: 1.1em;
}

h4 {
  font-size: 1.125rem;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 8px;
}

h4::before {
  content: '•';
  color: #3b82f6;
  font-weight: bold;
  font-size: 1.1em;
}

/* Section Cards */
.profile-section {
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  padding: 28px;
  margin: 24px 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.profile-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.06);
  border-color: #e2e8f0;
}

/* Paragraph Styles */
p {
  margin: 1em 0;
  color: #475569;
  line-height: 1.7;
  font-size: 1rem;
}

/* List Styles */
ul, ol {
  margin: 1.2em 0;
  padding-left: 0;
  list-style: none;
}

li {
  position: relative;
  padding: 0.5em 0 0.5em 2em;
  color: #475569;
  line-height: 1.7;
  transition: all 0.2s ease;
}

li:hover {
  color: #334155;
}

ul li::before {
  content: '◦';
  position: absolute;
  left: 0.75em;
  color: #059669;
  font-weight: bold;
  font-size: 1.2em;
  top: 0.5em;
}

ol {
  counter-reset: li-counter;
}

ol li {
  counter-increment: li-counter;
}

ol li::before {
  content: counter(li-counter);
  position: absolute;
  left: 0.5em;
  top: 0.3em;
  color: #059669;
  font-weight: 600;
  font-size: 0.875rem;
  background: rgba(5, 150, 105, 0.1);
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #059669;
}

/* Strong and Emphasis */
strong {
  font-weight: 600;
  color: #1e293b;
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 5px;
  border-radius: 4px;
}

em {
  font-style: italic;
  color: #64748b;
  background: rgba(100, 116, 139, 0.05);
  padding: 1px 2px;
  border-radius: 2px;
}

/* Code Styles */
code {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  background: #f1f5f9;
  padding: 0.25em 0.5em;
  border-radius: 4px;
  font-size: 0.875em;
  color: #334155;
  border: 1px solid #e2e8f0;
}

pre {
  background: #1e293b;
  color: #f1f5f9;
  padding: 1.5em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1.5em 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid #334155;
}

pre code {
  background: none;
  color: inherit;
  padding: 0;
  border: none;
}

/* Horizontal Rule */
hr {
  margin: 2.5em 0;
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, #e2e8f0 20%, #e2e8f0 80%, transparent);
}

/* Special Sections */
.refinement-section {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 12px;
  padding: 28px;
  margin-top: 32px;
  position: relative;
  box-shadow: 0 1px 3px rgba(186, 230, 253, 0.2);
}

.refinement-section::before {
  content: '🔄';
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 1.5rem;
  opacity: 0.7;
}

.refinement-section h3 {
  color: #0369a1;
  margin-top: 0;
}

.refinement-section h3::before {
  color: #0ea5e9;
}

.refinement-section h3::after {
  background: #0ea5e9;
}

.refinement-section p {
  color: #075985;
}

.refinement-section li {
  color: #075985;
}

.refinement-section ul li::before {
  color: #0ea5e9;
}

/* FIXED: Manual Edit Notice - Proper Containment */
.manual-edit-notice {
  background: #fef3c7;
  border: 2px solid #fbbf24;
  border-radius: 8px;
  padding: 16px;
  margin-top: 20px;
  display: block; /* Changed from flex for better wrapping */
  max-width: 100%;
  overflow: hidden;
}

.manual-edit-notice-icon {
  font-size: 1.5em;
  display: inline-block;
  vertical-align: top;
  margin-right: 8px;
}

.manual-edit-notice-content {
  display: inline-block;
  width: calc(100% - 40px); /* Account for icon width */
  vertical-align: top;
}

.manual-edit-notice strong {
  display: block;
  color: #92400e;
  margin-bottom: 8px;
  background: none;
  padding: 0;
  font-size: 1.1em;
}

.manual-edit-notice p {
  margin: 8px 0 0 0;
  color: #78350f;
  line-height: 1.5;
}

.manual-edit-notice code {
  background: #fde68a;
  color: #78350f;
  border: 1px solid #fbbf24;
  font-size: 0.75em;
  padding: 4px 6px;
  border-radius: 4px;
  display: inline;
  max-width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-all;
  line-height: 1.6;
}

/* Form Input Styling */
.n8n-form-input textarea {
  font-family: 'Inter', sans-serif !important;
  border-radius: 8px !important;
  border: 1px solid #cbd5e1 !important;
  padding: 16px !important;
  font-size: 16px !important;
  line-height: 1.5 !important;
  transition: all 0.2s ease !important;
  background: #ffffff !important;
  min-height: 120px !important;
  resize: vertical !important;
  color: #334155 !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
}

.n8n-form-input textarea:focus {
  border-color: #3b82f6 !important;
  outline: none !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
}

.n8n-form-input textarea::placeholder {
  color: #94a3b8 !important;
}

/* Form Labels */
.n8n-form-field label {
  font-weight: 600 !important;
  color: #334155 !important;
  margin-bottom: 8px !important;
  display: block !important;
  font-size: 16px !important;
}

/* Submit Button Styling */
.n8n-form-submit button {
  background: #2563eb !important;
  color: white !important;
  font-weight: 600 !important;
  padding: 16px 32px !important;
  border-radius: 8px !important;
  border: none !important;
  font-size: 16px !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2) !important;
  min-width: 140px;
}

.n8n-form-submit button:hover {
  background: #1d4ed8 !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 12px rgba(59, 130, 246, 0.25) !important;
}

/* Animation Classes */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.profile-content > * {
  animation: fadeInUp 0.3s ease-out forwards;
}

/* Responsive Design */
@media (max-width: 768px) {
  .profile-content-wrapper {
    padding: 24px;
    margin: 10px;
  }
  
  .profile-header {
    padding: 24px;
  }
  
  .profile-header h1 {
    font-size: 1.5rem;
    flex-direction: column;
    gap: 8px;
  }
  
  .profile-section {
    padding: 20px;
  }
  
  h2 {
    font-size: 1.375rem;
  }
  
  h3 {
    font-size: 1.125rem;
  }
  
  .n8n-form-submit button {
    width: 100% !important;
    padding: 16px !important;
  }
  
  .manual-edit-notice code {
    font-size: 0.7em;
  }
}

@media (min-width: 1200px) {
  .profile-content-wrapper {
    padding: 48px;
  }
  
  .profile-header h1 {
    font-size: 2rem;
  }
}

/* Ultra-wide screen support */
@media (min-width: 1920px) {
  .n8n-form {
    max-width: 1400px !important;
  }
  
  .profile-content-wrapper {
    padding: 56px;
  }
}

/* Print Styles */
@media print {
  .profile-content-wrapper {
    background: white;
    box-shadow: none;
    border: 1px solid #e5e7eb;
  }
  
  .n8n-form-submit,
  .n8n-form-input,
  .refinement-section,
  .manual-edit-notice {
    display: none;
  }
}
</style>
`;

// Convert the markdown content to enhanced HTML
const convertedContent = convertMarkdownToHTML(personaProfileMarkdown);

// Wrap everything in the styled container with header
const finalHTML = `
${embeddedCSS}
<div class="profile-container">
  <div class="profile-content-wrapper">
    <div class="profile-content">
      <div class="profile-header">
        <h1>👨‍🏫 Teaching Persona Profile</h1>
        <p>AI-Generated Pedagogical Profile Based on Your Teaching Examples</p>
      </div>
      
      <div class="profile-section">
        ${convertedContent}
      </div>
      
      <div class="refinement-section">
        <h3>Refinement Options</h3>
        <p>Review your teaching persona profile above. You can:</p>
        <ul>
          <li><strong>Approve as-is</strong> if the profile accurately represents your teaching style</li>
          <li><strong>Provide specific feedback</strong> below to refine particular aspects of the persona</li>
        </ul>
        <p><em>Your feedback will be used to further customize the AI's understanding of your teaching methodology.</em></p>
        
        <div class="manual-edit-notice">
          <span class="manual-edit-notice-icon">📝</span><div class="manual-edit-notice-content">
            <strong>Manual Editing Available</strong>
            <p>After approval, you can manually edit the saved persona file at:<br><code>${personaFilePath}</code></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

// Prepare the comprehensive output
const output = {
  formDescription: finalHTML,
  customStyling: '', // CSS embedded in HTML
  fullPersona: $input.first().json, // Preserve original input
  rawMarkdown: personaProfileMarkdown, // Keep raw markdown for reference
  personaFilePath: personaFilePath, // Add file path for reference
  metadata: {
    processing_timestamp: new Date().toISOString(),
    content_length: personaProfileMarkdown.length,
    styling_version: '3.2', // Bumped version for display fix
    features_enabled: [
      'responsive_design',
      'modern_typography',
      'accessible_colors',
      'professional_layout',
      'smooth_animations',
      'manual_edit_notice',
      'proper_path_wrapping' // NEW
    ]
  }
};

console.log('Enhanced User Profile processing completed');
console.log('File path included:', personaFilePath);

return output;