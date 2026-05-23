/**
 * Gemini Video Analysis + Script Generation — Vertex AI only.
 * Large videos are compressed via native ffmpeg server-side (/api/compress-video),
 * keeping audio so gemini-2.5-pro can transcribe + analyze.
 */

const TEXT_MODEL = 'gemini-2.5-pro';
const INLINE_MAX_BYTES = 18 * 1024 * 1024;

function parseGeminiJson(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  let repaired = text.trim();
  if (repaired.startsWith('{')) {
    repaired = repaired.replace(/,\s*$/, '');
    let openBraces = 0, openBrackets = 0;
    let inString = false, escaped = false;
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }
    if (inString) repaired += '"';
    repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
    repaired = repaired.replace(/,\s*\{[^}]*$/, '');
    repaired = repaired.replace(/,\s*$/, '');
    for (let i = 0; i < openBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces; i++) repaired += '}';
    try { return JSON.parse(repaired); } catch {}
  }
  throw new Error('Cannot parse JSON from Gemini response');
}

async function callGeminiPro(body) {
  const response = await fetch(`/api/vertex/models/${TEXT_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vertex Gemini error (${response.status}): ${errText.substring(0, 400)}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Vertex Gemini returned no content');
  return text;
}

async function fileToBase64(file) {
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function blobToBase64(blob) {
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * compressViaServer — POST raw mp4 to Vite middleware that runs native ffmpeg
 * and streams back compressed mp4 (preserves audio).
 */
async function compressViaServer(file, onProgress) {
  onProgress?.(`Uploading ${(file.size / 1024 / 1024).toFixed(1)} MB to local server for compression...`);
  const resp = await fetch('/api/compress-video', {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'video/mp4' },
    body: file,
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Compression failed (${resp.status}): ${err.substring(0, 300)}`);
  }
  const blob = await resp.blob();
  onProgress?.(`Compressed to ${(blob.size / 1024 / 1024).toFixed(1)} MB.`);
  return blob;
}

/**
 * analyzeVideo — Vertex gemini-2.5-pro. Server-side native ffmpeg compresses
 * large videos so they fit inline. Audio preserved → full transcript possible.
 */
export async function analyzeVideo(file, language, onProgress) {
  let payload, mimeType;
  if (file.size <= INLINE_MAX_BYTES) {
    onProgress?.(`Encoding ${(file.size / 1024 / 1024).toFixed(1)} MB as base64...`);
    payload = await fileToBase64(file);
    mimeType = file.type || 'video/mp4';
  } else {
    const compressed = await compressViaServer(file, onProgress);
    if (compressed.size > INLINE_MAX_BYTES) {
      throw new Error(`Compressed still too large (${(compressed.size / 1024 / 1024).toFixed(1)} MB). Try shorter video.`);
    }
    onProgress?.('Encoding compressed video as base64...');
    payload = await blobToBase64(compressed);
    mimeType = 'video/mp4';
  }
  const videoPart = { inlineData: { mimeType, data: payload } };

  const targetLanguage = language && language !== 'Tiếng Việt' ? language : 'Tiếng Việt';
  const isBilingual = targetLanguage !== 'Tiếng Việt';
  const langInstruction = `IMPORTANT: All output text (transcript, descriptions, narrations, action/mood/visual_style fields) MUST be written in ${targetLanguage}. Use native script (Thai script for Thai, Han characters for Chinese/Japanese, Hangul for Korean, etc.).`;

  const bilingualInstruction = isBilingual ? `
BILINGUAL OUTPUT: For every user-facing text field (transcript, hook.description, scenes[].action, scenes[].visual_style, scenes[].camera, scenes[].mood, cta.description), ALSO include a sibling field with the same name + "_vi" suffix containing the SAME content in Vietnamese (natural translation, native Vietnamese phrasing).
Example JSON shape when target=${targetLanguage}:
"transcript": "<${targetLanguage} text>", "transcript_vi": "<Bản dịch tiếng Việt>",
"structure": { "hook": { "description": "<${targetLanguage}>", "description_vi": "<Việt>" }, ... }` : '';

  const prompt = `You are a professional video analyst. Analyze this video advertisement thoroughly (visual + audio).
${langInstruction}${bilingualInstruction}
Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "transcript": "Full spoken narration/dialogue transcript",${isBilingual ? '\n  "transcript_vi": "Bản dịch tiếng Việt của transcript",' : ''}
  "totalDuration": <number in seconds>,
  "structure": {
    "hook": { "duration": <seconds>, "description": "What happens in the hook/intro"${isBilingual ? ', "description_vi": "Bản dịch tiếng Việt"' : ''} },
    "scenes": [
      {
        "idx": 0,
        "duration": <seconds>,
        "action": "What happens"${isBilingual ? ', "action_vi": "Bản dịch tiếng Việt"' : ''},
        "visual_style": "Camera angle, lighting, colors"${isBilingual ? ', "visual_style_vi": "Bản dịch tiếng Việt"' : ''},
        "camera": "Shot type e.g. close-up, wide"${isBilingual ? ', "camera_vi": "Bản dịch tiếng Việt"' : ''},
        "mood": "Emotional tone"${isBilingual ? ', "mood_vi": "Bản dịch tiếng Việt"' : ''}
      }
    ],
    "cta": { "duration": <seconds>, "description": "Call to action content"${isBilingual ? ', "description_vi": "Bản dịch tiếng Việt"' : ''} }
  }
}
Sum of durations (hook + scenes + cta) must equal totalDuration.`;

  onProgress?.(`Analyzing with ${TEXT_MODEL}...`);

  const text = await callGeminiPro({
    contents: [{
      role: 'user',
      parts: [videoPart, { text: prompt }],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 8192,
    }
  });

  onProgress?.('Analysis complete.');
  return parseGeminiJson(text);
}

/**
 * generateScript — Vertex gemini-3.1-pro with product images inline.
 */
export async function generateScript({ template, productImages, characters, targetDuration, language }, onProgress) {
  onProgress?.('Building script generation prompt...');

  const numScenes = Math.ceil(targetDuration / 8);
  const charDesc = characters.map((c, i) =>
    `Character ${i + 1}: ${c.gender}, ${c.nationality}, age ${c.ageRange}. ${c.description}`
  ).join('\n');

  const imageParts = (productImages || []).slice(0, 5).map(img => ({
    inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.data }
  }));

  const templateJson = JSON.stringify(template?.structure || {});

  const targetLanguage = language && language !== 'Tiếng Việt' ? language : 'Tiếng Việt';
  const isBilingual = targetLanguage !== 'Tiếng Việt';
  const scriptLangInstruction = `LANGUAGE RULE: fullScript and all narration fields MUST be written in ${targetLanguage} using native script. imagePrompt and videoPrompt fields MUST stay in English (image/video generation models require English).`;

  const scriptBilingualInstruction = isBilingual ? `
BILINGUAL OUTPUT: For fullScript and each scene's narration field, ALSO include a sibling field with "_vi" suffix containing the SAME content in Vietnamese (natural translation, native Vietnamese phrasing). Do NOT add _vi for imagePrompt or videoPrompt (those stay English-only).
Example: "fullScript": "<${targetLanguage} text>", "fullScript_vi": "<Bản dịch tiếng Việt>",
"scenes": [{ "narration": "<${targetLanguage}>", "narration_vi": "<Việt>", "imagePrompt": "<English>", "videoPrompt": "<English>" }]` : '';

  const prompt = `You are a professional video ad scriptwriter.
Create a ${targetDuration}-second video ad script divided into exactly ${numScenes} scenes of 8 seconds each.

${scriptLangInstruction}${scriptBilingualInstruction}

VIDEO TEMPLATE STRUCTURE (reference style/pacing):
${templateJson}

CHARACTERS:
${charDesc}

TASK: Return ONLY valid JSON with this structure:
{
  "fullScript": "Complete narration script for the full video",${isBilingual ? '\n  "fullScript_vi": "Bản dịch tiếng Việt của toàn bộ kịch bản",' : ''}
  "scenes": [
    {
      "idx": 0,
      "durationSec": 8,
      "narration": "Voiceover/dialogue for this scene",${isBilingual ? '\n      "narration_vi": "Bản dịch tiếng Việt của narration",' : ''}
      "imagePrompt": "Detailed prompt for Nano Banana 2 image generation: character appearance, product placement, setting, lighting, camera angle, style",
      "videoPrompt": "Detailed prompt for Veo 3.1: motion description, camera movement, action within 8 seconds"
    }
  ]
}

Generate exactly ${numScenes} scenes. Make narration flow naturally. imagePrompt must be photorealistic, specific about the character holding or using the product.`;

  onProgress?.('Generating script with gemini-3.1-pro...');

  const text = await callGeminiPro({
    contents: [{
      role: 'user',
      parts: [...imageParts, { text: prompt }],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
      maxOutputTokens: 16384,
    }
  });

  onProgress?.('Script generated.');
  return parseGeminiJson(text);
}
