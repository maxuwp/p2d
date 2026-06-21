// NODE NAME: Initialize Session and Create Manifest

// ============================================================================
// Node: Initialize Session and Create Manifest
// Purpose: Create session folder and initial manifest with ALL form data
// ============================================================================

// --- 1. Get incoming data from the Form Trigger ---
const triggerData = $('Collect Initial Data').item.json;

// --- 2. Extract instructor surname (ORIGINAL METHOD RESTORED) ---
const instructorFullName = triggerData['Instructor Name'];
const nameParts = instructorFullName.trim().split(/\s+/);
const surname = nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z]/g, '');

// --- 3. Generate date component (MMDD) (ORIGINAL METHOD) ---
const now = new Date();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const dateComponent = month + day;

// --- 4. Generate 4-digit random number (ORIGINAL METHOD) ---
const randomDigits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

// --- 5. Construct meaningful session ID (ORIGINAL METHOD) ---
const sessionId = `${surname}${dateComponent}${randomDigits}`;
const sessionStartTimestamp = now.toISOString();

// --- 6. Define session paths ---
const sessionFolderPath = `/files/posed_sessions/${sessionId}/`;
const manifestPath = `${sessionFolderPath}session_manifest.json`;

console.log('=== Session Initialization ===');
console.log('Session ID:', sessionId);
console.log('Session Folder:', sessionFolderPath);

// --- 7. Define the manifest template ---
let manifest = {
  "sessionInfo": {
    "sessionId": sessionId,
    "sessionStartTimestamp": sessionStartTimestamp,
    "sessionFolderPath": sessionFolderPath,
    "formSubmittedAt": triggerData['submittedAt'] || sessionStartTimestamp,
    "formMode": triggerData['formMode'] || 'production'
  },
  "instructorInfo": {
    "name": triggerData['Instructor Name'],
    "institution": triggerData['Institution'] || ''
  },
  "initialRequest": {
    "mainTopic": triggerData['Main topic'],
    "audienceLevel": triggerData['Audience Level'],
    "eventDuration": triggerData['Event Duration (minutes)'] || null,
    "minutesPerSlide": triggerData['How many minutes do you plan to spend on each slide?'] || null,
    "prerequisites": triggerData['Prerequisites'] || '',
    "modulePurpose": triggerData['Module Purpose'],
    "otherContext": triggerData['other context AI should know'] || '',
    "specialGuidelines": triggerData['Special Presentation Guideline (You may find it from the conference/event requirements)'] || ''
  },
  "userPreferences": {
    "learningAssistance": triggerData['Need Assistance to Learn the Paper First?'] || 'No - I\'m already familiar with the paper content',
    "reviewLogging": triggerData['Record Review Logs for AI Training?'] || 'No - Keep my feedback private',
    "visualStylePreference": triggerData['Visual Style Preference'] || 'Balanced',
    "specificVisualRequirements": triggerData['Specific Visual Requirements'] || ''
  },
  "generatedArtifacts": {
    "originalPaper": {
      "status": "pending",
      "filePath": null,
      "uploadedAt": null,
      "textLength": null,
      "wordCount": null,
      "lineCount": null
    },
    "paperAnalysis": {
      "status": "pending",
      "filePath": null,
      "version": 1,
      "startedAt": null,
      "completedAt": null,
      "iterationCount": 0,
      "lastError": null
    },
    "paperLearningGuide": {
      "status": "pending",
      "filePath": null,
      "requested": (triggerData['Need Assistance to Learn the Paper First?'] || '').includes('Yes'),
      "createdAt": null,
      "wordCount": null,
      "verificationWarnings": 0
    },
    "professorPersona": {
      "status": "pending",
      "filePath": null,
      "format": null,
      "version": 1,
      "startedAt": null,
      "completedAt": null,
      "iterationCount": 0,
      "wordCount": null,
      "characterCount": null,
      "lineCount": null,
      "lastError": null
    },
    "detailedOutline": {
      "status": "pending",
      "filePath": null,
      "format": null,
      "structure": null,
      "version": 1,
      "startedAt": null,
      "completedAt": null,
      "iterationCount": 0,
      "presentationTitle": null,
      "targetDuration": null,
      "totalSections": null,
      "contentSections": null,
      "totalSlides": null,
      "contentSlides": null,
      "wordCount": null,
      "characterCount": null,
      "lastError": null
    },
    "sourcingManifest": {
      "status": "pending",
      "filePath": null,
      "queriesUsed": [],
      "vectorCollectionName": null
    },
    "draftSlides": {
      "status": "pending",
      "filePath": null,
      "version": 1,
      "completedAt": null
    },
    "draftNotes": {
      "status": "pending",
      "filePath": null,
      "version": 1,
      "completedAt": null
    },
    "finalPresentation": {
      "status": "pending",
      "folderPath": null,
      "compilerManifestPath": null,
      "powerPointPath": null,
      "pdfPath": null
    },
    "commonPersonaProfile": {
      "status": "pending",
      "filePath": null,
      "content": ""
    }
  },
  "reviewLogs": {
    "enabled": (triggerData['Record Review Logs for AI Training?'] || '').includes('Yes'),
    "paperAnalysisReview": {
      "filePath": null,
      "totalRounds": 0,
      "finalStatus": null,
      "lastUpdated": null,
      "learningAssistUsed": false
    },
    "personaReview": {
      "filePath": null,
      "totalRounds": 0,
      "finalStatus": null,
      "lastUpdated": null
    },
    "outlineReview": {
      "filePath": null,
      "totalRounds": 0,
      "finalStatus": null,
      "lastUpdated": null
    },
    "contentReview": {
      "filePath": null,
      "totalRounds": 0,
      "finalStatus": null,
      "lastUpdated": null
    },
    "htmlReview": {
      "filePath": null,
      "totalRounds": 0,
      "finalStatus": null,
      "lastUpdated": null
    }
  },
  "processState": {
    "currentStep": "Initialization Complete",
    "isComplete": false,
    "hasError": false,
    "errorDetails": null,
    "lastUpdated": sessionStartTimestamp
  },
  "workflow_status": {
    "slides_and_notes_generation": "pending",
    "ready_for_html_assembly": false
  },
  "last_updated": sessionStartTimestamp
};

// --- 8. Generate shell command with proper escaping ---
const manifestJson = JSON.stringify(manifest, null, 2);
const shellCommand = `mkdir -p "${sessionFolderPath}" && cat > "${manifestPath}" << 'EOF_MANIFEST'
${manifestJson}
EOF_MANIFEST`;

console.log('✓ Manifest created successfully');

// --- 9. Return data for subsequent nodes ---
return {
  json: {
    sessionId: sessionId,
    sessionFolderPath: sessionFolderPath,
    manifestPath: manifestPath,
    manifestContent: manifest,
    shellCommand: shellCommand
  }
};