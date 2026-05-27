import { useState, useRef, useCallback } from 'react';
import { generateGeminiTTS, generateElevenLabs, generateOpenAI, generateAzure } from '../lib/tts/ttsProviders.js';

// ─── Static data ─────────────────────────────────────────────────────────────

const GEMINI_VOICES = [
  'Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede',
  'Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba','Despina',
  'Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar',
  'Gacrux','Pulcherrima','Achird','Zubenelgenubi','Vindemiatrix','Sadachbia',
  'Sadaltager','Sulafat',
];

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash-tts', label: 'Flash (nhanh, tiết kiệm)' },
  { value: 'gemini-2.5-pro-tts',   label: 'Pro (chất lượng cao)' },
];

const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel (Nữ, Mỹ)' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (Nam, Mỹ)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella (Nữ, Mỹ)' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni (Nam, Mỹ)' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli (Nữ, Mỹ)' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh (Nam, Mỹ)' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold (Nam, Mỹ)' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', label: 'Sam (Nam, Mỹ)' },
];

const OPENAI_VOICES = ['alloy','echo','fable','onyx','nova','shimmer'];

const AZURE_VOICES_BY_LANG = {
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

const AZURE_LANG_OPTIONS = [
  { value: 'vi-VN', label: '🇻🇳 Tiếng Việt' },
  { value: 'th-TH', label: '🇹🇭 ภาษาไทย' },
  { value: 'en-US', label: '🇺🇸 English (US)' },
];

const PROVIDERS = [
  { id: 'gemini',      label: 'Gemini',      color: 'cyan' },
  { id: 'elevenlabs',  label: 'ElevenLabs',  color: 'purple' },
  { id: 'openai',      label: 'OpenAI',      color: 'green' },
  { id: 'azure',       label: 'Azure',       color: 'blue' },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function ls(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TTSTab() {
  // Provider selection
  const [provider, setProvider] = useState(() => ls('tts_provider', 'gemini'));

  // Shared
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlobType, setAudioBlobType] = useState('audio/wav');
  const audioBlobRef = useRef(null);

  // Gemini config
  const [geminiVoice, setGeminiVoice] = useState(() => ls('tts_gemini_voice', 'Kore'));
  const [geminiModel, setGeminiModel] = useState(() => ls('tts_gemini_model', 'gemini-2.5-flash-tts'));

  // ElevenLabs config
  const [elVoiceId, setElVoiceId] = useState(() => ls('tts_el_voice', ELEVENLABS_VOICES[0].id));
  const [elKey, setElKey] = useState(() => ls('tts_elevenlabs_key', ''));

  // OpenAI config
  const [oaiVoice, setOaiVoice] = useState(() => ls('tts_oai_voice', 'alloy'));
  const [oaiKey, setOaiKey] = useState(() => ls('tts_openai_key', ''));

  // Azure config
  const [azLang, setAzLang] = useState(() => ls('tts_azure_lang', 'vi-VN'));
  const [azVoice, setAzVoice] = useState(() => {
    const saved = ls('tts_azure_voice', '');
    return saved || AZURE_VOICES_BY_LANG['vi-VN'][0].value;
  });
  const [azKey, setAzKey] = useState(() => ls('tts_azure_key', ''));
  const [azRegion, setAzRegion] = useState(() => ls('tts_azure_region', 'southeastasia'));

  // ── Derived ──────────────────────────────────────────────────────────────────

  function providerReady(id) {
    if (id === 'gemini') return true;
    if (id === 'elevenlabs') return true; // guest mode available
    if (id === 'openai') return !!oaiKey;
    if (id === 'azure') return !!azKey;
    return false;
  }

  function badgeFor(id) {
    if (providerReady(id)) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-semibold ml-1">
          ✓ Sẵn sàng
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold ml-1">
        Cần API key
      </span>
    );
  }

  // ── Generate ─────────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) { setStatus('Vui lòng nhập văn bản trước.'); return; }
    setLoading(true);
    setStatus('Đang tạo giọng nói...');
    setAudioUrl(null);
    audioBlobRef.current = null;

    try {
      let blob;
      if (provider === 'gemini') {
        blob = await generateGeminiTTS({ text, voice: geminiVoice, model: geminiModel });
        setAudioBlobType('audio/wav');
      } else if (provider === 'elevenlabs') {
        blob = await generateElevenLabs({ text, voiceId: elVoiceId, apiKey: elKey });
        setAudioBlobType('audio/mpeg');
      } else if (provider === 'openai') {
        blob = await generateOpenAI({ text, voice: oaiVoice, apiKey: oaiKey });
        setAudioBlobType('audio/mpeg');
      } else if (provider === 'azure') {
        blob = await generateAzure({ text, voice: azVoice, lang: azLang, apiKey: azKey, region: azRegion });
        setAudioBlobType('audio/mpeg');
      }

      const url = URL.createObjectURL(blob);
      audioBlobRef.current = blob;
      setAudioUrl(url);
      setStatus('Tạo giọng nói thành công!');
    } catch (err) {
      setStatus(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [provider, text, geminiVoice, geminiModel, elVoiceId, elKey, oaiVoice, oaiKey, azVoice, azLang, azKey, azRegion]);

  function handleDownload() {
    if (!audioBlobRef.current || !audioUrl) return;
    const ext = audioBlobType === 'audio/wav' ? 'wav' : 'mp3';
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts_${provider}_${Date.now()}.${ext}`;
    a.click();
  }

  // ── Azure lang change ──────────────────────────────────────────────────────

  function handleAzLangChange(lang) {
    setAzLang(lang);
    lsSet('tts_azure_lang', lang);
    const voices = AZURE_VOICES_BY_LANG[lang] || [];
    const first = voices[0]?.value || '';
    setAzVoice(first);
    lsSet('tts_azure_voice', first);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 gap-4">
      {/* Provider selector */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setProvider(p.id); lsSet('tts_provider', p.id); setStatus(''); }}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
              provider === p.id
                ? 'bg-cyan-500 text-white shadow'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            {p.label}
            {provider !== p.id && badgeFor(p.id)}
          </button>
        ))}
      </div>

      {/* Text input */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">Văn bản cần đọc</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập văn bản tại đây... (tối đa ~1000 ký tự mỗi lần)"
          rows={5}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        />
        <p className="text-xs text-muted-foreground text-right">{text.length} ký tự</p>
      </div>

      {/* Provider config panel */}
      <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-3">
        <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
          Cài đặt {PROVIDERS.find(p => p.id === provider)?.label}
        </p>

        {/* Gemini */}
        {provider === 'gemini' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Giọng đọc</label>
              <select
                value={geminiVoice}
                onChange={(e) => { setGeminiVoice(e.target.value); lsSet('tts_gemini_voice', e.target.value); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {GEMINI_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Model</label>
              <select
                value={geminiModel}
                onChange={(e) => { setGeminiModel(e.target.value); lsSet('tts_gemini_model', e.target.value); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {GEMINI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <p className="col-span-2 text-xs text-cyan-400">
              Không cần API key — dùng xác thực service account (Vertex AI).
            </p>
          </div>
        )}

        {/* ElevenLabs */}
        {provider === 'elevenlabs' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Giọng đọc</label>
              <select
                value={elVoiceId}
                onChange={(e) => { setElVoiceId(e.target.value); lsSet('tts_el_voice', e.target.value); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {ELEVENLABS_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                API Key <span className="text-cyan-400">(không bắt buộc — guest mode)</span>
              </label>
              <input
                type="password"
                value={elKey}
                onChange={(e) => { setElKey(e.target.value); lsSet('tts_elevenlabs_key', e.target.value); }}
                placeholder="sk-... (để trống dùng chế độ guest)"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Guest mode giới hạn ~10.000 ký tự/tháng theo IP.
            </p>
          </div>
        )}

        {/* OpenAI */}
        {provider === 'openai' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Giọng đọc</label>
              <select
                value={oaiVoice}
                onChange={(e) => { setOaiVoice(e.target.value); lsSet('tts_oai_voice', e.target.value); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {OPENAI_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">OpenAI API Key <span className="text-red-400">*</span></label>
              <input
                type="password"
                value={oaiKey}
                onChange={(e) => { setOaiKey(e.target.value); lsSet('tts_openai_key', e.target.value); }}
                placeholder="sk-..."
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>
        )}

        {/* Azure */}
        {provider === 'azure' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Ngôn ngữ</label>
                <select
                  value={azLang}
                  onChange={(e) => handleAzLangChange(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {AZURE_LANG_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Giọng đọc</label>
                <select
                  value={azVoice}
                  onChange={(e) => { setAzVoice(e.target.value); lsSet('tts_azure_voice', e.target.value); }}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {(AZURE_VOICES_BY_LANG[azLang] || []).map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Azure API Key <span className="text-red-400">*</span></label>
                <input
                  type="password"
                  value={azKey}
                  onChange={(e) => { setAzKey(e.target.value); lsSet('tts_azure_key', e.target.value); }}
                  placeholder="Subscription key..."
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Region</label>
                <input
                  type="text"
                  value={azRegion}
                  onChange={(e) => { setAzRegion(e.target.value); lsSet('tts_azure_region', e.target.value); }}
                  placeholder="southeastasia"
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !text.trim()}
        className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-lg shadow-cyan-500/20"
      >
        {loading ? 'Đang tạo...' : '🔊 Tạo giọng nói'}
      </button>

      {/* Status */}
      {status && (
        <p className={`text-xs px-3 py-2 rounded-lg border ${
          status.startsWith('Lỗi')
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : status.includes('thành công')
            ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
            : 'bg-muted/40 border-border text-muted-foreground'
        }`}>
          {status}
        </p>
      )}

      {/* Audio player */}
      {audioUrl && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-cyan-400">Kết quả</p>
          <audio controls src={audioUrl} className="w-full" key={audioUrl} />
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-all"
            >
              Tải xuống
            </button>
            <button
              onClick={() => alert('Tính năng Clone Voice sắp ra')}
              className="flex-1 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-bold border border-border transition-all"
            >
              Gửi vào Clone Voice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
