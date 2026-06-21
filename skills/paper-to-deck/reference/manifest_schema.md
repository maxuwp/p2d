# Paper-to-Deck `manifest.json` schema

Adapted from the n8n `Initialize Session and Create Manifest` Code node. Richer than the POSED manifest because the paper workflow tracks more user preferences and review logs.

## Path
Always `<session>/manifest.json`.

## Schema

```json
{
  "sessionInfo": {
    "sessionId": "ma05281234",
    "sessionStartTimestamp": "2026-05-28T14:30:00-05:00",
    "sessionFolderPath": "./p2d-sessions/ai-hardware-paper-2026-05-28/",
    "formMode": "production"
  },
  "instructorInfo": {
    "name": "Xiaoguang Ma",
    "institution": "UW-Platteville"
  },
  "initialRequest": {
    "paperPath": "./papers/ai-hardware.pdf",
    "paperTitle": "Auto-extracted from analysis or user-supplied",
    "mainTopic": "AI Hardware: NPUs and On-Device Inference",
    "audienceLevel": "Sophomore CE",
    "audienceMode": "undergrad-intro",
    "eventDuration": 15,
    "minutesPerSlide": 1.5,
    "prerequisites": "Basic CPU architecture",
    "modulePurpose": "Class introduction to recent NPU research",
    "otherContext": "",
    "specialGuidelines": "Conference template requires 16:9, sans-serif"
  },
  "userPreferences": {
    "learningAssistance": "Yes - I'd like the AI to help me understand the paper first",
    "reviewLogging": "Yes - Use my feedback for AI improvement",
    "visualStylePreference": "Balanced",
    "specificVisualRequirements": ""
  },
  "generatedArtifacts": {
    "originalPaper":    { "status": "pending|complete", "filePath": null, "uploadedAt": null, "textLength": null, "wordCount": null },
    "paperAnalysis":    { "status": "pending|complete", "filePath": null, "version": 1, "iterationCount": 0, "lastError": null },
    "paperLearningGuide": { "status": "pending|skipped|complete", "filePath": null, "requested": false, "verificationWarnings": 0 },
    "professorPersona": { "status": "pending|complete", "filePath": null, "version": 1, "iterationCount": 0, "wordCount": null },
    "detailedOutline":  { "status": "pending|complete", "filePath": null, "version": 1, "presentationTitle": null, "targetDuration": null, "totalSlides": null },
    "draftSlides":      { "status": "pending|complete", "filePath": null, "version": 1 },
    "draftNotes":       { "status": "pending|complete", "filePath": null, "version": 1 },
    "styleTokens":      { "status": "pending|complete", "filePath": null, "version": 1 },
    "finalPresentation":{ "status": "pending|complete", "folderPath": null, "htmlPath": null, "pdfPath": null }
  },
  "reviewLogs": {
    "enabled": true,
    "paperAnalysisReview": { "filePath": null, "totalRounds": 0, "finalStatus": null, "learningAssistUsed": false },
    "personaReview":       { "filePath": null, "totalRounds": 0, "finalStatus": null },
    "outlineReview":       { "filePath": null, "totalRounds": 0, "finalStatus": null },
    "contentReview":       { "filePath": null, "totalRounds": 0, "finalStatus": null },
    "htmlReview":          { "filePath": null, "totalRounds": 0, "finalStatus": null }
  },
  "processState": {
    "currentStep": "Initialization Complete",
    "isComplete": false,
    "hasError": false,
    "lastUpdated": "2026-05-28T14:30:00-05:00"
  },
  "completedSteps": ["step1"]
}
```

## Session ID format

`<surname><MMDD><4-digit-random>` — e.g. `ma05281234`. Verbatim from the n8n Initialize node. Lets the same instructor have multiple parallel sessions without collisions.

## Re-entry routing

When resuming, the orchestrator reads `completedSteps` and walks the 5-step pipeline:

1. step1 = Paper Analysis (always required first)
2. step2 = Persona
3. step3 = Outline
4. step4 = Content (slides + notes)
5. step5 = HTML Assembly

Find the first step *not* in `completedSteps` and resume there.

## Pre-flight validation (from `Obtain Manifest Information and Select Next Step`)

Before resuming any step, verify required upstream files exist on disk:
- All steps need `paperAnalysis.filePath`.
- step3+ needs `professorPersona.filePath`.
- step4+ needs `detailedOutline.filePath`.
- step5 needs both `draftSlides.filePath` and `draftNotes.filePath`.

If a required file is missing despite the step being marked complete, that's a corrupted session — surface the error and ask the user whether to fall back to the prior step.

## Rules

1. Sub-skills read `manifest.json` first.
2. Sub-skills write their artifact path + status back; **only the orchestrator sets `approved: true`** (implicitly by appending to `completedSteps`).
3. All paths relative to the session folder.
4. `iterationCount` increments on every revision/regeneration so review logs are auditable.
