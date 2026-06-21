// NODE NAME: Add New Info of Slides and Notes to Manifest File

// Add Slides and Notes Info to Manifest
// Updates session manifest with Subflow 4 outputs
// Mirroring structure of working "Add Outline Info" node

console.log('=== Updating manifest with slides and notes generation results ===');

try {
  // 1. Get the original manifest object AND PATH
  // The 'Obtain Manifest Information for Slides and Notes' node outputs an ARRAY
  const manifestContextNode = $('Obtain Manifest Information and Select Next Step');
  if (!manifestContextNode || !manifestContextNode.first()) {
    throw new Error("Could not find context node 'Obtain Manifest Information for Slides and Notes'");
  }

  // IMPORTANT: The node outputs an array, so we need to access the first item
  const manifestNodeData = manifestContextNode.first().json;
  
  // Check if manifestNodeData is an array and get first item, or use it directly
  const manifestInfo = Array.isArray(manifestNodeData) ? manifestNodeData[0] : manifestNodeData;
  
  const manifestContent = manifestInfo.manifestContent;
  const manifestPath = manifestInfo.manifestPath || 
                       `/files/posed_sessions/${manifestInfo.sessionId}/session_manifest.json`;

  if (typeof manifestContent !== 'object' || manifestContent === null) {
    console.error("Manifest content from context node is not an object:", manifestContent);
    throw new Error(`Manifest content from context node is type ${typeof manifestContent}, expected object.`);
  }
  
  if (typeof manifestPath !== 'string' || !manifestPath) {
    console.error("Manifest path from context node is invalid:", manifestPath);
    throw new Error("Could not determine manifest path from context node.");
  }

  console.log('✓ Found manifest path:', manifestPath);
  console.log('✓ Found manifest data content (type: object).');

  // 2. Get statistics (completion timestamp)
  const assemblyNodeName = 'Collect and Assemble Approved Slides and Notes from All Sections';
  const assemblyData = $(assemblyNodeName).first();
  if (!assemblyData) throw new Error(`Could not find node '${assemblyNodeName}'`);
  const completed_at = assemblyData.json.timestamp;

  // 3. Get file write results from input
  const allItems = $input.all();
  if (allItems.length < 2) throw new Error(`Expected 2 items input, received ${allItems.length}`);

  const slidesWriteInfo = allItems.find(item => item.json.fileName?.includes('slides_final.md'));
  const notesWriteInfo = allItems.find(item => item.json.fileName?.includes('notes_final.md'));

  if (!slidesWriteInfo) throw new Error("Could not find 'slides_final.md' info in input items.");
  if (!notesWriteInfo) throw new Error("Could not find 'notes_final.md' info in input items.");

  console.log('Slides file info:', slidesWriteInfo.json.fileName, 'Size:', slidesWriteInfo.json.size);
  console.log('Notes file info:', notesWriteInfo.json.fileName, 'Size:', notesWriteInfo.json.size);

  // 4. *** MODIFY the manifestContent OBJECT directly ***
  if (!manifestContent.generatedArtifacts) manifestContent.generatedArtifacts = {};

  if (!manifestContent.generatedArtifacts.draftSlides) manifestContent.generatedArtifacts.draftSlides = { version: 1 };
  manifestContent.generatedArtifacts.draftSlides.status = 'complete';
  manifestContent.generatedArtifacts.draftSlides.filePath = slidesWriteInfo.json.fileName;
  manifestContent.generatedArtifacts.draftSlides.fileSize = slidesWriteInfo.json.size;
  manifestContent.generatedArtifacts.draftSlides.completedAt = completed_at;

  if (!manifestContent.generatedArtifacts.draftNotes) manifestContent.generatedArtifacts.draftNotes = { version: 1 };
  manifestContent.generatedArtifacts.draftNotes.status = 'complete';
  manifestContent.generatedArtifacts.draftNotes.filePath = notesWriteInfo.json.fileName;
  manifestContent.generatedArtifacts.draftNotes.fileSize = notesWriteInfo.json.size;
  manifestContent.generatedArtifacts.draftNotes.completedAt = completed_at;

  // Update overall workflow status and timestamp
  manifestContent.workflow_status = manifestContent.workflow_status || {};
  manifestContent.workflow_status.slides_and_notes_generation = 'complete';
  manifestContent.workflow_status.ready_for_html_assembly = true;
  manifestContent.last_updated = new Date().toISOString();

  console.log('✓ Manifest object updated directly in memory.');
  console.log('✓ Returning manifestPath:', manifestPath);

  // Return structure similar to working example
  return {
    manifestPath: manifestPath,
    manifestContent: manifestContent,
    data: JSON.stringify(manifestContent, null, 2)
  };

} catch (error) {
  console.error('❌ Error in Add New Info node:', error.message);
  console.error('Stack:', error.stack);
  throw new Error(`Failed to update manifest: ${error.message}`);
}