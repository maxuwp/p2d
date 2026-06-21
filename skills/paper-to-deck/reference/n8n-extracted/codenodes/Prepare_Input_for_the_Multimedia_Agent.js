// NODE NAME: Prepare Input for the Multimedia Agent

// Prepare Input for the Multimedia Agent
// Creates detailed prompts for AI to suggest images, charts, and other multimedia

const input = $input.first().json;

console.log('=== Preparing Multimedia Agent Input ===');
console.log('Input keys:', Object.keys(input));

// CORRECTED: Access structure properly
// After Split Out, we have { slides: {...}, context: {...} }
// where "slides" is actually a single slide object (confusing naming from Split Out)
const slide = input.slides;        // This is ONE slide (despite plural name)
const context = input.context;
const designSystem = context.designSystem;
const sessionInfo = context.sessionInfo;
const persona = context.persona;

console.log('Slide:', slide.id, '-', slide.title);
console.log('Design system primary color:', designSystem.colors.primary);

// Build comprehensive multimedia suggestion prompt
const multimediaPrompt = `You are an expert instructional designer specializing in multimedia educational content. Your task is to suggest appropriate visual enhancements for an academic presentation slide.

## PRESENTATION CONTEXT

**Title:** ${sessionInfo.presentationTitle}
**Presenter:** ${sessionInfo.instructorName}
**Slide ID:** ${slide.id}
**Section:** ${slide.section}
**Slide Title:** ${slide.title}

## DESIGN SYSTEM (for color context)

Primary Color: ${designSystem.colors.primary}
Secondary Color: ${designSystem.colors.secondary}
Accent Color: ${designSystem.colors.accent}

## SLIDE CONTENT

${slide.content.join('\n')}

## EXISTING VISUAL SUGGESTIONS

${slide.visualSuggestions.length > 0 ? slide.visualSuggestions.join('\n') : 'None provided'}

## PRESENTER NOTES (for context)

${slide.notes.substring(0, 500)}${slide.notes.length > 500 ? '...' : ''}

## YOUR TASK

Analyze this slide and suggest ONE of the following multimedia enhancements:

1. **Image** - A specific image that would illustrate the concept
   - Provide a detailed search query or generation prompt
   - Describe what the image should show
   
2. **Chart/Graph** - Data visualization if applicable
   - Specify chart type (bar, pie, line, scatter)
   - Provide data labels and values
   - Explain what the chart demonstrates

3. **Diagram** - A conceptual diagram or flowchart
   - Describe the diagram structure
   - List key elements and their relationships

4. **None** - If the slide is better with text only

## IMPORTANT GUIDELINES

- Only suggest multimedia if it genuinely enhances understanding
- Consider the academic context and presenter persona

- **FOR CHARTS:** - Provide REAL data if possible (search for it).
  - You SHOULD use the literal hex codes for the 'backgroundColor' array within the 'chart_json' object, as that is structured data.

- **FOR IMAGE PROMPTS (CRITICAL):**
  - **1. NO HEX CODES:** Do NOT include hex codes (e.g., '#2C3E50') in the 'generation_prompt' field. This contaminates the image with artifacts. Instead, use descriptive color names (e.g., 'dark corporate blue', 'vibrant orange') based on the Design System colors provided.
  - **2. FOR INTENTIONAL TEXT:** To render text (like a label or title), you MUST enclose the desired text in **double quotation marks** in the 'generation_prompt'. For example: '...an abstract visualization of integration, with the text \"Critical Integration\" written at the top in a clean, modern font.'
  - **3. NEGATIVE PROMPTS:** You should still include negative prompts for artifacts, e.g., 'no random letters, no numbers, no code, clean image'.
  - **4. BE SPECIFIC:** Be specific about what to show.

## OUTPUT FORMAT

Respond with ONLY a valid JSON object (no markdown formatting, no code blocks):

{
  "visualType": "image|chart|diagram|none",
  "visualTypeIndex": 0|1|2|3|4|5,
  "asset": {
    "type": "image|bar_chart|pie_chart|line_chart|generated_image|none",
    "description": "What this visual shows and why it's useful",
    "search_query": "Specific search terms for finding the asset" (if type is image),
    "generation_prompt": "Detailed prompt for AI image generation. Must use descriptive color names, NOT hex codes. Any intentional text MUST be in double quotes." (if type is generated_image),
    "chart_json": {
      "data": {
        "labels": ["Label1", "Label2", ...],
        "datasets": [{
          "data": [value1, value2, ...],
          "backgroundColor": ["${designSystem.colors.primary}", "${designSystem.colors.secondary}", "${designSystem.colors.accent}"]
        }]
      }
    } (if type is chart),
    "placement": "center|left|right|full",
    "size": "small|medium|large"
  },
  "rationale": "Brief explanation of why this multimedia choice enhances the slide"
}

Visual Type Index Mapping:
- 0: Downloaded image from web
- 1: Bar chart
- 2: Pie chart
- 3: Line chart
- 4: AI-generated image (with in-image text)
- 5: No visual needed

If no multimedia is appropriate, use:
{
  "visualType": "none",
  "visualTypeIndex": 5,
  "asset": { "type": "none" },
  "rationale": "Text-only presentation is most effective for this content"
}`;

return {
  prompt: multimediaPrompt,
  slides: slide,        // Pass through the slide
  designSystem: designSystem,
  sessionInfo: sessionInfo
};