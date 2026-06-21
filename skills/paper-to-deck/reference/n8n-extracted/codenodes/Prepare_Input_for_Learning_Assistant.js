// NODE NAME: Prepare Input for Learning Assistant

// ============================================================================
// Node: Prepare Input for Learning Assistant
// Purpose: Prepare comprehensive prompt for fact-checking AI agent
// ============================================================================

const aiOutput = $input.first().json;

console.log('=== Preparing Input for Learning Assistant (Fact Checker) ===');

// Get the paper analyzer output
let analysisData = aiOutput.output || aiOutput.text || aiOutput;
if (typeof analysisData === 'string') {
  analysisData = analysisData.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  analysisData = JSON.parse(analysisData);
}

// Get thematic analysis
const thematicNode = $('Process Thematic Analysis').first().json;
const thematicData = thematicNode.thematic_analysis_json;

// Get original paper text
const paperText = $('Combine Paper Contents').first().json.fullText;

// Get session info
const manifestContext = $('Obtain Manifest Information for Paper Analysis').first().json;
const sessionFolder = manifestContext.sessionFolder;

console.log('Analysis data retrieved:', {
  has_thematic: !!thematicData,
  has_structure: !!analysisData,
  paper_length: paperText.length
});

// Build comprehensive prompt for Learning Assistant
const prompt = `You are an expert Research Assistant and Fact Checker. Your job is to help an instructor review an AI-generated analysis of an academic paper by:

1. **Adding Supporting Evidence** - Find quotes and references from the paper that support each claim
2. **Fact Checking** - Verify that every claim can be backed up by the paper
3. **Flagging Issues** - Mark any claims that cannot be verified

## ORIGINAL PAPER TEXT
Here is the complete paper you must reference:

---
${paperText}
---

## AI-GENERATED ANALYSIS TO VERIFY

### Thematic Analysis:
${JSON.stringify(thematicData, null, 2)}

### Paper Structure Analysis:
${JSON.stringify(analysisData, null, 2)}

## YOUR TASK

For EACH claim in both analyses, you must:

1. **Find Supporting Evidence**: Locate the exact text in the paper that supports the claim
2. **Add Context**: Explain WHY this evidence supports the claim
3. **Include Location**: Provide section name, page number (if visible), or paragraph identifier
4. **Flag if Not Found**: If you cannot find support for a claim, mark it with ⚠️ WARNING

## OUTPUT FORMAT

Generate a detailed markdown report with this structure:

# Learning Guide: Paper Analysis with Evidence

## 📋 Overview
- **Paper Type**: ${thematicData.paper_type}
- **Main Thesis**: ${thematicData.main_thesis}

---

## 🎯 Thematic Analysis (WITH EVIDENCE)

### Main Thesis
**Claim**: ${thematicData.main_thesis}

**Supporting Evidence**:
- **Quote**: "[exact quote from paper]"
- **Location**: Section X, Paragraph Y
- **Context**: This supports the thesis because...
- **Verification**: ✓ VERIFIED / ⚠️ WARNING: Could not verify

### Key Themes
For each theme in ${JSON.stringify(thematicData.key_themes)}:

**Theme**: [theme name]

**Supporting Evidence**:
1. **Quote 1**: "[quote]" (Section X)
2. **Quote 2**: "[quote]" (Section Y)
- **Verification**: ✓ VERIFIED / ⚠️ WARNING

### Key Comparisons
For each comparison in ${JSON.stringify(thematicData.key_comparisons)}:

**Comparison**: [comparison description]

**Supporting Evidence**:
- **Quote**: "[exact text showing this comparison]"
- **Location**: [section]
- **Verification**: ✓ VERIFIED / ⚠️ WARNING

### Implicit Structures
For each structure in ${JSON.stringify(thematicData.implicit_structures)}:

**Structure**: [structure description]

**Supporting Evidence**:
- **Quote**: "[text showing this organizational pattern]"
- **Location**: [section]
- **Verification**: ✓ VERIFIED / ⚠️ WARNING

---

## 📊 Paper Structure Analysis (WITH EVIDENCE)

### Main Contributions
For each contribution in ${JSON.stringify(analysisData.main_contribution)}:

**Contribution**: [contribution text]

**Supporting Evidence**:
- **Quote**: "[exact text from paper]"
- **Location**: [section]
- **Significance**: Why this is a contribution...
- **Verification**: ✓ VERIFIED / ⚠️ WARNING

### Main Objectives (Key Takeaways)
For each objective in ${JSON.stringify(analysisData.main_objective)}:

**Objective**: [objective text]

**Supporting Evidence**:
- **Quote**: "[supporting text]"
- **Location**: [section]
- **Why Important**: [explanation]
- **Verification**: ✓ VERIFIED / ⚠️ WARNING

---

## ⚠️ VERIFICATION SUMMARY

- **Total Claims Analyzed**: [number]
- **Verified Claims**: [number] ✓
- **Unverified Claims**: [number] ⚠️
- **Verification Rate**: [percentage]%

### Issues Found:
[List any claims that could not be verified with explanations]

---

## 💡 RECOMMENDATIONS FOR INSTRUCTOR

[Brief paragraph on:]
- How confident should the instructor be in this analysis?
- What areas need manual verification?
- Any suggestions for improvement?

## CRITICAL RULES

- Be thorough but concise
- ALWAYS include exact quotes (in quotation marks)
- ALWAYS specify location in paper
- If you cannot find evidence, SAY SO clearly with ⚠️
- Do NOT invent quotes or evidence
- Focus on helping the instructor make an informed decision
- Output ONLY markdown, no code blocks or extra formatting`;

console.log('✓ Prompt prepared for Learning Assistant');
console.log('Prompt length:', prompt.length);

return {
  prompt: prompt,
  sessionFolder: sessionFolder,
  thematicData: thematicData,
  analysisData: analysisData,
  paperLength: paperText.length
};