/**
 * TTS provider functions — no external deps, native fetch + Blob only.
 *
 * Each function returns Promise<Blob> (audio file).
 * Each throws with a descriptive message on failure.
 */

import { pcmToWav } from './pcmToWav.js';

// ─── Gemini TTS (via /api/vertex proxy) ─────────────────────────────────────

/**
 * @param {{ text: string, voice: string, model: string }} opts
 * model: 'gemini-2.5-flash-tts' | 'gemini-2.5-pro-tts'
 * @returns {Promise<Blob>}  WAV blob (24kHz mono 16-bit)
 */
export async function generateGeminiTTS({ text, voice = 'Kore', model = 'gemini-2.5-flash-tts' }) {
  const resp = await fetch(`/api/vertex/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini TTS lỗi (${resp.status}): ${errText.substring(0, 200)}`);
  }

  const data = await resp.json();
  const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) {
    const reason = data?.candidates?.[0]?.finishReason || 'unknown';
    throw new Error(`Gemini TTS không trả về audio (finishReason=${reason})`);
  }

  // Decode base64 → raw PCM bytes → WAV Blob
  const binaryStr = atob(b64);
  const pcmBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    pcmBytes[i] = binaryStr.charCodeAt(i);
  }
  return pcmToWav(pcmBytes, 24000, 1, 16);
}

// ─── ElevenLabs ──────────────────────────────────────────────────────────────

/**
 * @param {{ text: string, voiceId: string, apiKey?: string, model?: string }} opts
 * apiKey is optional — omit for guest (IP-limited) mode.
 * model selects language coverage: eleven_v3 (Thai+Viet), eleven_flash_v2_5
 * (Viet), eleven_multilingual_v2 (neither). Default flash_v2_5 = Viet + fast.
 * @returns {Promise<Blob>}  MP3 blob
 */
export async function generateElevenLabs({ text, voiceId, apiKey = '', model = 'eleven_flash_v2_5' }) {
  const url = `https://api.us.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['xi-api-key'] = apiKey;

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, model_id: model }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ElevenLabs lỗi (${resp.status}): ${errText.substring(0, 200)}`);
  }

  return resp.blob();
}

// ─── OpenAI TTS ──────────────────────────────────────────────────────────────

/**
 * @param {{ text: string, voice: string, apiKey: string, model?: string }} opts
 * @returns {Promise<Blob>}  MP3 blob
 */
export async function generateOpenAI({ text, voice = 'alloy', apiKey, model = 'tts-1' }) {
  if (!apiKey) throw new Error('OpenAI TTS yêu cầu API key');

  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text, voice, response_format: 'mp3' }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI TTS lỗi (${resp.status}): ${errText.substring(0, 200)}`);
  }

  return resp.blob();
}

// ─── Azure TTS ───────────────────────────────────────────────────────────────

/**
 * @param {{ text: string, voice: string, lang: string, apiKey: string, region?: string }} opts
 * @returns {Promise<Blob>}  MP3 blob
 */
export async function generateAzure({ text, voice, lang = 'vi-VN', apiKey, region = 'southeastasia' }) {
  if (!apiKey) throw new Error('Azure TTS yêu cầu API key');

  const ssml = `<speak version='1.0' xml:lang='${lang}'><voice name='${voice}'>${escapeXml(text)}</voice></speak>`;
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'X-Microsoft-OutputFormat': 'audio-24khz-160kbitrate-mono-mp3',
      'Content-Type': 'application/ssml+xml',
    },
    body: ssml,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Azure TTS lỗi (${resp.status}): ${errText.substring(0, 200)}`);
  }

  return resp.blob();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
