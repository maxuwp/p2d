// NODE NAME: Process AI Editor Review Results

// Process AI Editor Review Results - FIXED (Correct Data Retrieval Strategy)
const input = $input.first().json;
const editorOutput = input.output || '';

// ============================================================================
// FIX: Get metadata from the Prepare editor review prompt node
// BUT use .first() without (0, 0) to get the CURRENT execution
// ============================================================================
const preparePromptNodeName = 'Prepare editor review prompt';
const prepareNodeInputData = $(preparePromptNodeName).first().json;  // CHANGED: Removed (0, 0)

if (!prepareNodeInputData || !prepareNodeInputData.section_metadata) {
    console.error('ERROR: Cannot find section_metadata');
    console.error('Available nodes:', Object.keys($));
    throw new Error(`Missing section_metadata from "${preparePromptNodeName}"`);
}

const metadata = prepareNodeInputData.section_metadata;
// ============================================================================

const currentIteration = metadata.current_iteration;
const maxIterations = metadata.max_iterations || 3;

console.log('=== AI Editor Review (Iteration #' + currentIteration + ') ===');
console.log('Section:', metadata.subtopic_title);
console.log('Section Index:', metadata.section_index, 'Section ID:', metadata.section_id);

// Parse JSON
let reviewData = {};
let parseError = null;
try {
    let cleanedOutput = '';
    if (typeof editorOutput === 'object' && editorOutput !== null) {
        reviewData = editorOutput;
    } else if (typeof editorOutput === 'string') {
        cleanedOutput = editorOutput.trim().replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '');
        reviewData = JSON.parse(cleanedOutput);
    } else {
        throw new Error('Invalid editor output');
    }
    console.log('✓ Score:', reviewData.score, 'Rec:', reviewData.recommendation);
} catch (error) {
    parseError = `Parse error: ${error.message}`;
    console.error('✗', parseError);
    
    const str = (typeof editorOutput === 'string') ? editorOutput : JSON.stringify(editorOutput);
    const scoreMatch = str.match(/"score"\s*:\s*(\d+)/);
    const recMatch = str.match(/"recommendation"\s*:\s*"(approve|revise|reject)"/i);
    
    if (scoreMatch && recMatch) {
        reviewData = {
            score: parseInt(scoreMatch[1]),
            recommendation: recMatch[1].toLowerCase(),
            feedback: ['Parse error - partial recovery'],
            improvements: ['Check JSON format'],
            word_count_assessment: 'unknown',
            critical_issues: ['JSON parse error']
        };
    } else {
        reviewData = {
            score: 50,
            recommendation: 'revise',
            feedback: ['Parse failure'],
            improvements: ['Fix output format'],
            word_count_assessment: 'unknown',
            critical_issues: ['Complete parse failure']
        };
    }
}

const validRecs = ['approve', 'revise', 'reject'];
if (!reviewData.recommendation || !validRecs.includes(reviewData.recommendation)) {
    reviewData.recommendation = (reviewData.score >= 85) ? 'approve' : 'revise';
}

const score = reviewData.score || 0;
const recommendation = reviewData.recommendation;

// Decision Logic
let proceedToHuman = false;

console.log('=== Decision ===');
console.log('Score:', score);
console.log('Iteration:', currentIteration, '/', maxIterations);

if (score >= 85) {
    proceedToHuman = true;
    console.log('✓✓ AUTO-APPROVED (score >=85)');
} else if (currentIteration >= maxIterations) {
    proceedToHuman = true;
    console.log('⚠ MAX ITERATIONS REACHED');
} else if (recommendation === 'approve') {
    proceedToHuman = true;
    console.log('✓ AI APPROVED (score <85)');
} else {
    proceedToHuman = false;
    console.log('→ REVISION NEEDED - Next iteration will be:', currentIteration + 1);
}

const decisionData = {
    proceed_to_human: proceedToHuman,
    ai_approved: recommendation === 'approve',
    auto_approved: score >= 85,
    max_iterations_reached: currentIteration >= maxIterations,
    needs_revision: !proceedToHuman,
    score: score,
    recommendation: recommendation,
    parse_error: parseError
};

// FALSE BRANCH - Loop back for revision
if (!proceedToHuman) {
    const collectNode = 'Collect Necessary Information and Initialize Session';
    const collectData = $(collectNode).first().json;
    
    if (!collectData) {
        throw new Error(`Could not get data from "${collectNode}"`);
    }

    const originalSection = collectData.sections.find(s => s.section_index === metadata.section_index);
    const originalSlides = originalSection ? originalSection.slides : [];

    // KEY: Increment the iteration counter here
    const nextIteration = currentIteration + 1;
    console.log('LOOP BACK: Incrementing iteration from', currentIteration, 'to', nextIteration);
    console.log('LOOP BACK: Section', metadata.section_id, '(Index:', metadata.section_index, ')');

    return {
        presentationTitle: collectData.presentationTitle,
        instructorName: collectData.instructorName,
        sessionFolder: collectData.sessionFolder,
        sessionId: collectData.sessionId,
        context: collectData.context,
        paperAnalysis: collectData.paperAnalysis,
        persona: collectData.persona,
        originalPaper: collectData.originalPaper,
        manifestPath: collectData.manifestPath,
        filePaths: collectData.filePaths,
        
        editor_review: reviewData,
        decision: decisionData,
        section_metadata: {
            section_index: metadata.section_index,
            section_id: metadata.section_id,
            subtopic_title: metadata.subtopic_title,
            slide_count: metadata.slide_count,
            target_word_count: metadata.target_word_count,
            duration_minutes: metadata.duration_minutes,
            current_iteration: nextIteration,
            max_iterations: maxIterations,
            instructorName: metadata.instructorName
        },
        slides: originalSlides,
        is_revision: true,
        proceed_to_human: false,
        timestamp: new Date().toISOString()
    };
}

// TRUE BRANCH - Proceed to human or complete
else {
    console.log('EXIT LOOP: Proceeding to human review or completion');
    
    // Get the parsed content from the Parse Generated Content node
    const parseNode = $('Parse Generated Content').first().json;
    
    if (!parseNode) {
        throw new Error('Could not get Parse Generated Content data');
    }

    return {
        ...parseNode,
        editor_review: reviewData,
        decision: decisionData,
        section_status: (score >= 85) ? 'auto_approved' : 'needs_human_review',
        is_revision: false,
        proceed_to_human: true,
        timestamp: new Date().toISOString()
    };
}