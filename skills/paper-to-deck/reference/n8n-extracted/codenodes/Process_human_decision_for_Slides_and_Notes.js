// NODE NAME: Process human decision for Slides and Notes

// Process Human Review Decision - COMPLETE
const formInput = $input.first().json;
const decision = formInput['Section Review Decision'];

const prepareFormNode = 'Prepare Slides and Notes Human Review Form';
const preparedData = $(prepareFormNode).first().json;

if (!preparedData || !preparedData.section_metadata) {
    throw new Error(`Missing section_metadata from "${prepareFormNode}"`);
}

const metadata = preparedData.section_metadata;
const parsedContent = preparedData.parsed_content;
const editorReview = preparedData.editor_review;

console.log('=== Human Decision ===');
console.log('Section:', metadata.subtopic_title);
console.log('AI Iteration:', metadata.current_iteration);
console.log('Decision:', decision);

if (!decision) {
    throw new Error('No decision provided. Available fields: ' + Object.keys(formInput).join(', '));
}

// APPROVE
if (decision === 'Approve') {
    console.log('✓ HUMAN APPROVED - Section complete');
    
    const approvedContent = {
        slides: parsedContent.slides,
        notes: parsedContent.notes,
        references: parsedContent.references || '',
        source: 'ai_generated',
        human_approved: true,
        ai_score: editorReview.score,
        iterations_used: metadata.current_iteration,
        human_revisions: metadata.human_revision_count || 0
    };
    
    return {
        section_index: metadata.section_index,
        section_id: metadata.section_id,
        subtopic_title: metadata.subtopic_title,
        slide_count: metadata.slide_count,
        approved_content: approvedContent,
        generation_metadata: {
            ai_iterations_required: metadata.current_iteration,
            human_revisions_required: metadata.human_revision_count || 0,
            ai_final_score: editorReview.score,
            human_approved: true,
            manually_edited: false,
            source: 'ai_generated',
            completed_at: new Date().toISOString()
        },
        section_complete: true,
        section_status: 'approved',
        next_action: 'approved',
        timestamp: new Date().toISOString()
    };
}

// REQUEST REVISION
else if (decision === 'Request AI Revision - Provide feedback') {
    const humanFeedback = formInput['AI_Revision_Feedback'];
    const humanRevCount = (metadata.human_revision_count || 0) + 1;
    
    console.log('→ HUMAN REVISION REQUEST #', humanRevCount);
    console.log('  AI iteration stays at:', metadata.current_iteration);
    
    const revisionContext = `
${'='.repeat(80)}
## 🔴 HUMAN FEEDBACK - REQUIRED CHANGES (Revision #${humanRevCount})
${'='.repeat(80)}

**Reviewer**: ${metadata.instructorName || 'Instructor'}
**Section**: ${metadata.subtopic_title}
**AI Iterations Used**: ${metadata.current_iteration}/${metadata.max_iterations}
**Human Revision**: #${humanRevCount}
**Previous AI Score**: ${editorReview.score}/100

### REQUIREMENTS:

${humanFeedback}

${'='.repeat(80)}
`;

    const updatedMetadata = {
        ...metadata,
        human_revision_count: humanRevCount,
        has_human_feedback: true,
        human_feedback: humanFeedback,
        revision_context: revisionContext
    };
    
    const collectNode = 'Collect Necessary Information and Initialize Session';
    const collectData = $(collectNode).first().json;
    
    if (!collectData) {
        throw new Error(`Could not get data from "${collectNode}"`);
    }
    
    const originalSection = collectData.sections.find(s => s.section_index === metadata.section_index);
    const originalSlides = originalSection ? originalSection.slides : [];
    
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
        
        section_metadata: updatedMetadata,
        slides: originalSlides,
        
        is_revision: true,
        human_requested_revision: true,
        next_action: 'revise_with_human_feedback',
        section_complete: false,
        timestamp: new Date().toISOString()
    };
}

// EDIT MANUALLY
else if (decision === 'Edit Manually') {
    console.log('✓ MANUAL EDIT - Section complete');
    
    const editedSlides = formInput['Edited_Slides_Content'];
    const editedNotes = formInput['Edited_Notes_Content'];
    
    const approvedContent = {
        slides: editedSlides,
        notes: editedNotes,
        references: parsedContent.references || '',
        source: 'human_edited',
        human_approved: true,
        manually_edited: true,
        original_ai_score: editorReview.score,
        iterations_used: metadata.current_iteration,
        human_revisions: metadata.human_revision_count || 0
    };
    
    return {
        section_index: metadata.section_index,
        section_id: metadata.section_id,
        subtopic_title: metadata.subtopic_title,
        slide_count: metadata.slide_count,
        approved_content: approvedContent,
        generation_metadata: {
            ai_iterations_required: metadata.current_iteration,
            human_revisions_required: metadata.human_revision_count || 0,
            ai_final_score: editorReview.score,
            human_approved: true,
            manually_edited: true,
            source: 'human_edited',
            completed_at: new Date().toISOString()
        },
        section_complete: true,
        section_status: 'approved',
        next_action: 'approved',
        timestamp: new Date().toISOString()
    };
}

// Unknown decision
else {
    throw new Error(`Unknown decision: ${decision}`);
}