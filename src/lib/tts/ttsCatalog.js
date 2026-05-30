/**
 * Shared TTS catalog — voices, models, providers, localStorage helpers.
 * Imported by both TTSTab and CloneTranscript so voice lists stay in sync.
 */

export const GEMINI_VOICES = [
  'Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede',
  'Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba','Despina',
  'Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar',
  'Gacrux','Pulcherrima','Achird','Zubenelgenubi','Vindemiatrix','Sadachbia',
  'Sadaltager','Sulafat',
];

export const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash-tts', label: 'Flash (nhanh, tiết kiệm)' },
  { value: 'gemini-2.5-pro-tts',   label: 'Pro (chất lượng cao)' },
];

export const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel (Nữ, Mỹ)' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (Nam, Mỹ)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella (Nữ, Mỹ)' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni (Nam, Mỹ)' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli (Nữ, Mỹ)' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh (Nam, Mỹ)' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold (Nam, Mỹ)' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', label: 'Sam (Nam, Mỹ)' },
];

export const OPENAI_VOICES = ['alloy','echo','fable','onyx','nova','shimmer'];

export const AZURE_VOICES_BY_LANG = {
  'vi-VN': [
    { value: 'vi-VN-HoaiMyNeural',  label: 'HoaiMy (Nữ)' },
    { value: 'vi-VN-NamMinhNeural', label: 'NamMinh (Nam)' },
  ],
  'th-TH': [
    { value: 'th-TH-AcharaNeural',    label: 'Achara (Nữ)' },
    { value: 'th-TH-PremwadeeNeural', label: 'Premwadee (Nữ)' },
    { value: 'th-TH-NiwatNeural',     label: 'Niwat (Nam)' },
  ],
  'en-US': [
    { value: 'en-US-JennyNeural', label: 'Jenny (Nữ)' },
    { value: 'en-US-AriaNeural',  label: 'Aria (Nữ)' },
    { value: 'en-US-GuyNeural',   label: 'Guy (Nam)' },
  ],
};

export const AZURE_LANG_OPTIONS = [
  { value: 'vi-VN', label: '🇻🇳 Tiếng Việt' },
  { value: 'th-TH', label: '🇹🇭 ภาษาไทย' },
  { value: 'en-US', label: '🇺🇸 English (US)' },
];

export const PROVIDERS = [
  { id: 'gemini',      label: 'Gemini',      color: 'cyan' },
  { id: 'elevenlabs',  label: 'ElevenLabs',  color: 'purple' },
  { id: 'openai',      label: 'OpenAI',      color: 'green' },
  { id: 'azure',       label: 'Azure',       color: 'blue' },
];

// ─── localStorage helpers (shared keys with TTSTab) ─────────────────────────

export function ls(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* ignore quota */ }
}
