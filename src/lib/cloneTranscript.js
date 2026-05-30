/**
 * Clone-Transcript pipeline client helpers.
 *
 * Flow: video → STT (server Vertex) → translate segments → TTS per segment
 *       → assemble (server atempo-fit + mux). Each step is a thin async call;
 *       the heavy ffmpeg / Vertex work lives server-side in vite.config.js.
 */

import { generateGeminiTTS, generateElevenLabs, generateOpenAI, generateAzure } from './tts/ttsProviders.js';

const TRANSLATE_MODEL = 'gemini-3-flash-preview';

// ─── 1. Speech-to-text ───────────────────────────────────────────────────────

/**
 * @param {File} videoFile
 * @param {string} sourceLang  - human label e.g. 'ภาษาไทย', 'auto'
 * @param {string} sid         - shared session id (keeps server video for assemble)
 * @returns {Promise<{ segments: {start,end,text}[], duration: number }>}
 */
export async function transcribeVideo(videoFile, sourceLang, sid) {
  const resp = await fetch(`/api/clone-tx/stt?id=${sid}&lang=${encodeURIComponent(sourceLang)}`, {
    method: 'POST',
    headers: { 'Content-Type': videoFile.type || 'video/mp4' },
    body: videoFile,
  });
  if (!resp.ok) throw new Error(`STT lỗi: ${await resp.text()}`);
  const data = await resp.json();
  // Normalize + sort + clamp
  const segments = (data.segments || [])
    .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || '').trim() }))
    .filter((s) => s.text && s.end > s.start)
    .sort((a, b) => a.start - b.start);
  return { segments, duration: data.duration || 0 };
}

// ─── 2. Translate segments (batch) ───────────────────────────────────────────

/**
 * Translate the `text` of each segment to targetLang, preserving order.
 * Returns a new array with `.translated` filled. Identity-safe: if a line is
 * already in the target language Gemini returns it unchanged.
 *
 * @param {{start,end,text}[]} segments
 * @param {string} targetLang
 * @param {(msg:string)=>void} [onProgress]
 */
export async function translateSegments(segments, targetLang, onProgress) {
  if (!segments.length) return [];
  const CHUNK = 25;
  const out = segments.map((s) => ({ ...s, translated: '' }));

  for (let i = 0; i < segments.length; i += CHUNK) {
    const slice = segments.slice(i, i + CHUNK);
    onProgress?.(`🌐 Dịch đoạn ${i + 1}-${Math.min(i + CHUNK, segments.length)}/${segments.length}...`);
    const prompt = `Dịch ${slice.length} câu thoại sau sang ${targetLang}. Văn phong nói tự nhiên, đúng nghĩa, độ dài tương đương để khớp thời lượng video. Giữ số + đơn vị. Nếu câu đã đúng ${targetLang} thì giữ nguyên.

${slice.map((s, k) => `${k}: "${s.text.replace(/"/g, '\\"')}"`).join('\n')}

Trả về JSON array đúng ${slice.length} phần tử, theo thứ tự:
[{"i":0,"t":"<bản dịch>"}, ...]
CHỈ JSON ARRAY.`;

    const text = await callVertex(prompt);
    let arr = [];
    try {
      const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
      arr = JSON.parse(clean.match(/\[[\s\S]*\]/)?.[0] || clean);
    } catch {
      // Fallback: keep original text so pipeline still runs
      arr = slice.map((s, k) => ({ i: k, t: s.text }));
    }
    for (const item of arr) {
      const k = Number(item.i);
      if (Number.isInteger(k) && slice[k]) out[i + k].translated = String(item.t || slice[k].text).trim();
    }
  }
  // Any segment the model skipped → fall back to original
  for (const s of out) if (!s.translated) s.translated = s.text;
  return out;
}

async function callVertex(prompt) {
  const resp = await fetch(`/api/vertex/models/${TRANSLATE_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3, maxOutputTokens: 16384,
        responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!resp.ok) throw new Error(`Vertex dịch lỗi (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!txt) throw new Error(`Vertex dịch rỗng (finishReason=${data?.candidates?.[0]?.finishReason || '?'})`);
  return txt;
}

// ─── 3. TTS per segment ───────────────────────────────────────────────────────

/**
 * Synthesize one segment's text into an audio Blob using the chosen provider.
 * @param {string} text
 * @param {object} cfg  - { provider, geminiVoice, geminiModel, elVoiceId, elKey,
 *                          oaiVoice, oaiKey, azVoice, azLang, azKey, azRegion }
 * @returns {Promise<Blob>}
 */
export async function synthesizeSegment(text, cfg) {
  switch (cfg.provider) {
    case 'gemini':
      return generateGeminiTTS({ text, voice: cfg.geminiVoice, model: cfg.geminiModel });
    case 'elevenlabs':
      return generateElevenLabs({ text, voiceId: cfg.elVoiceId, apiKey: cfg.elKey });
    case 'openai':
      return generateOpenAI({ text, voice: cfg.oaiVoice, apiKey: cfg.oaiKey });
    case 'azure':
      return generateAzure({ text, voice: cfg.azVoice, lang: cfg.azLang, apiKey: cfg.azKey, region: cfg.azRegion });
    default:
      throw new Error(`Provider không hỗ trợ: ${cfg.provider}`);
  }
}

/** Measure a generated audio Blob's duration in seconds (decode via <audio>). */
export function probeBlobDuration(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      const d = a.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    a.src = url;
  });
}

// ─── 4. Assemble ───────────────────────────────────────────────────────────────

/**
 * Upload each chunk + timing to the server, which atempo-fits each clip to its
 * segment slot and muxes onto the original video. Video was already uploaded by
 * transcribeVideo (server kept it under the same sid).
 *
 * @param {string} sid
 * @param {{start,end}[]} segments
 * @param {Blob[]} chunkBlobs   - index-aligned with segments (null = skip)
 * @param {number} videoDuration
 * @param {(msg:string)=>void} [onProgress]
 * @returns {Promise<Blob>} output mp4
 */
export async function assembleVideo(sid, segments, chunkBlobs, videoDuration, onProgress) {
  const timing = [];
  for (let i = 0; i < segments.length; i++) {
    const blob = chunkBlobs[i];
    if (!blob) continue;
    onProgress?.(`⬆️ Tải audio đoạn ${i + 1}/${segments.length}...`);
    const up = await fetch(`/api/clone-tx/upload?id=${sid}&kind=chunk&idx=${i}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/wav' },
      body: blob,
    });
    if (!up.ok) throw new Error(`Tải chunk ${i} lỗi: ${await up.text()}`);
    timing.push({ idx: i, start: segments[i].start, end: segments[i].end });
  }
  if (!timing.length) throw new Error('Không có audio nào để ghép');

  onProgress?.('🎬 Đang ghép audio + video (ffmpeg)...');
  const resp = await fetch(`/api/clone-tx/assemble?id=${sid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments: timing, videoDuration }),
  });
  if (!resp.ok) throw new Error(`Ghép video lỗi: ${await resp.text()}`);
  return resp.blob();
}
