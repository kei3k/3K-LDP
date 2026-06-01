import { useState, useEffect, useCallback, useRef } from 'react';
import { Languages, Wand2, FileAudio, Download, AlertCircle, Mic } from 'lucide-react';
import DropZone from './DropZone.jsx';
import {
  GEMINI_VOICES, GEMINI_MODELS, ELEVENLABS_VOICES, ELEVENLABS_MODELS, OPENAI_VOICES,
  AZURE_VOICES_BY_LANG, AZURE_LANG_OPTIONS, PROVIDERS, ls, lsSet,
} from '../../lib/tts/ttsCatalog.js';
import {
  transcribeVideo, translateSegments, fitTranslationLength, estimateSpokenSeconds,
  synthesizeSegment, probeBlobDuration, assembleVideo,
} from '../../lib/cloneTranscript.js';

// Languages for source (transcript) + target (TTS script)
const LANGS = [
  { value: 'auto', label: '🔍 Tự nhận diện' },
  { value: 'ภาษาไทย', label: '🇹🇭 ภาษาไทย (Thái)' },
  { value: 'Tiếng Việt', label: '🇻🇳 Tiếng Việt' },
  { value: 'English', label: '🇺🇸 English' },
  { value: '中文', label: '🇨🇳 中文 (Trung)' },
  { value: '日本語', label: '🇯🇵 日本語 (Nhật)' },
  { value: '한국어', label: '🇰🇷 한국어 (Hàn)' },
  { value: 'Bahasa Indonesia', label: '🇮🇩 Bahasa Indonesia' },
];
const TARGET_LANGS = LANGS.filter((l) => l.value !== 'auto');

// Out-of-range stretch warning thresholds (playback ratio = ttsDur / segDur)
const RATIO_WARN_HIGH = 1.5;  // tts much longer → must speed up a lot
const RATIO_WARN_LOW = 0.66;  // tts much shorter → big silence padding

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1);
  return `${m}:${String(s).padStart(4, '0')}`;
}

export default function CloneTranscript() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const sidRef = useRef(null);

  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('Tiếng Việt');
  const [segments, setSegments] = useState([]); // {start,end,text,translated, ttsDur?, ratio?}

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState('');
  const [chunkBlobs, setChunkBlobs] = useState([]);
  const [ttsDone, setTtsDone] = useState(false);
  const [syncMode, setSyncMode] = useState('voice'); // 'segment' | 'voice' | 'video'
  const [outputUrl, setOutputUrl] = useState(null);
  const outputBlobRef = useRef(null);

  // ── TTS config (shares localStorage keys with the TTS tab) ─────────────────
  const [provider, setProvider] = useState(() => ls('tts_provider', 'gemini'));
  const [geminiVoice, setGeminiVoice] = useState(() => ls('tts_gemini_voice', 'Kore'));
  const [geminiModel, setGeminiModel] = useState(() => ls('tts_gemini_model', 'gemini-2.5-flash-tts'));
  const [elVoiceId, setElVoiceId] = useState(() => ls('tts_el_voice', ELEVENLABS_VOICES[0].id));
  const [elCustomVoice, setElCustomVoice] = useState(() => ls('tts_el_custom_voice', ''));
  const [elModel, setElModel] = useState(() => ls('tts_el_model', 'eleven_flash_v2_5'));
  const [elKey, setElKey] = useState(() => ls('tts_elevenlabs_key', ''));
  const [oaiVoice, setOaiVoice] = useState(() => ls('tts_oai_voice', 'alloy'));
  const [oaiKey, setOaiKey] = useState(() => ls('tts_openai_key', ''));
  const [azLang, setAzLang] = useState(() => ls('tts_azure_lang', 'vi-VN'));
  const [azVoice, setAzVoice] = useState(() => ls('tts_azure_voice', '') || AZURE_VOICES_BY_LANG['vi-VN'][0].value);
  const [azKey, setAzKey] = useState(() => ls('tts_azure_key', ''));
  const [azRegion, setAzRegion] = useState(() => ls('tts_azure_region', 'southeastasia'));

  function ttsConfig() {
    return { provider, geminiVoice, geminiModel, elVoiceId, elCustomVoice, elModel, elKey, oaiVoice, oaiKey, azVoice, azLang, azKey, azRegion };
  }

  // ── Video duration ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoFile) { setVideoDuration(0); return; }
    const url = URL.createObjectURL(videoFile);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { setVideoDuration(v.duration || 0); URL.revokeObjectURL(url); };
    v.src = url;
    // Reset downstream state on new video
    setSegments([]); setChunkBlobs([]); setTtsDone(false); setOutputUrl(null);
    sidRef.current = crypto.randomUUID();
  }, [videoFile]);

  // ── Step 1: transcribe ────────────────────────────────────────────────────
  const handleTranscribe = useCallback(async () => {
    if (!videoFile) return;
    setLoading(true); setStatus(''); setProgress('🎧 Đang tách audio + nhận dạng lời thoại...');
    try {
      const { segments: segs, duration } = await transcribeVideo(videoFile, sourceLang, sidRef.current);
      if (!segs.length) throw new Error('Không nhận được lời thoại nào từ video.');
      setSegments(segs.map((s) => ({ ...s, translated: '' })));
      if (duration) setVideoDuration((d) => d || duration);
      setStatus(`Đã trích ${segs.length} đoạn lời thoại.`);
    } catch (e) {
      setStatus(`Lỗi: ${e.message}`);
    } finally { setLoading(false); setProgress(''); }
  }, [videoFile, sourceLang]);

  // ── Step 2: translate ───────────────────────────────────────────────────────
  const handleTranslate = useCallback(async () => {
    if (!segments.length) return;
    setLoading(true); setStatus('');
    try {
      const translated = await translateSegments(segments, targetLang, setProgress);
      setSegments(translated.map((s) => ({ ...s, ttsDur: undefined, ratio: undefined })));
      setTtsDone(false); setChunkBlobs([]);
      setStatus(`Đã dịch ${translated.length} đoạn sang ${targetLang}.`);
    } catch (e) {
      setStatus(`Lỗi: ${e.message}`);
    } finally { setLoading(false); setProgress(''); }
  }, [segments, targetLang]);

  // ── Step 2b: fit translation length to slots (before TTS) ──────────────────
  const handleFitLength = useCallback(async () => {
    if (!segments.some((s) => s.translated)) return;
    setLoading(true); setStatus('');
    try {
      const fitted = await fitTranslationLength(segments, targetLang, setProgress);
      setSegments(fitted.map((s) => ({ ...s, ttsDur: undefined, ratio: undefined })));
      setTtsDone(false); setChunkBlobs([]);
      setStatus('Đã tối ưu độ dài bản dịch cho khớp thời lượng. Kiểm tra cột "Dự kiến" rồi tạo giọng.');
    } catch (e) {
      setStatus(`Lỗi: ${e.message}`);
    } finally { setLoading(false); setProgress(''); }
  }, [segments, targetLang]);

  // ── Step 3: TTS all segments ─────────────────────────────────────────────────
  const handleTTS = useCallback(async () => {
    if (!segments.length) return;
    setLoading(true); setStatus(''); setOutputUrl(null);
    const cfg = ttsConfig();
    const blobs = new Array(segments.length).fill(null);
    const next = segments.map((s) => ({ ...s }));
    try {
      for (let i = 0; i < segments.length; i++) {
        const txt = (segments[i].translated || segments[i].text).trim();
        if (!txt) continue;
        setProgress(`🔊 Tạo giọng đoạn ${i + 1}/${segments.length}...`);
        const blob = await synthesizeSegment(txt, cfg, (msg) => setProgress(`(${i + 1}/${segments.length}) ${msg}`));
        const dur = await probeBlobDuration(blob);
        const segDur = Math.max(0.3, segments[i].end - segments[i].start);
        blobs[i] = blob;
        next[i].ttsDur = dur;
        next[i].ratio = dur / segDur;
        // Gentle pacing for Gemini's low per-minute quota (other providers ~instant)
        if (cfg.provider === 'gemini' && i < segments.length - 1) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
      setChunkBlobs(blobs);
      setSegments(next);
      setTtsDone(true);
      const warns = next.filter((s) => s.ratio && (s.ratio > RATIO_WARN_HIGH || s.ratio < RATIO_WARN_LOW)).length;
      setStatus(warns
        ? `Đã tạo giọng. ⚠️ ${warns} đoạn lệch thời lượng nhiều — sẽ bị tăng/giảm tốc khi ghép.`
        : 'Đã tạo giọng cho tất cả đoạn. Thời lượng khớp tốt!');
    } catch (e) {
      setStatus(`Lỗi: ${e.message}`);
    } finally { setLoading(false); setProgress(''); }
  }, [segments, provider, geminiVoice, geminiModel, elVoiceId, elCustomVoice, elModel, elKey, oaiVoice, oaiKey, azVoice, azLang, azKey, azRegion]);

  // ── Step 4: assemble ─────────────────────────────────────────────────────────
  const handleAssemble = useCallback(async () => {
    if (!ttsDone || !chunkBlobs.some(Boolean)) return;
    setLoading(true); setStatus('');
    try {
      const blob = await assembleVideo(sidRef.current, segments, chunkBlobs, videoDuration, syncMode, setProgress);
      const url = URL.createObjectURL(blob);
      outputBlobRef.current = blob;
      setOutputUrl(url);
      setStatus('Hoàn thành! Video mới đã ghép giọng khớp thời lượng.');
    } catch (e) {
      setStatus(`Lỗi: ${e.message}`);
    } finally { setLoading(false); setProgress(''); }
  }, [ttsDone, chunkBlobs, segments, videoDuration, syncMode]);

  function handleDownload() {
    if (!outputBlobRef.current || !outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `clone_transcript_${Date.now()}.mp4`;
    a.click();
  }

  function updateTranslated(i, val) {
    setSegments((prev) => prev.map((s, k) => (k === i ? { ...s, translated: val } : s)));
  }

  const hasTranslation = segments.some((s) => s.translated);

  return (
    <div className="flex flex-col gap-4">
      {/* Step 1: video + source lang */}
      <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-3">
        <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">① Video gốc + ngôn ngữ nguồn</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DropZone
            accept="video/mp4,video/*"
            label="Kéo thả video vào đây"
            hint="mp4, mov, avi..."
            file={videoFile}
            onFile={setVideoFile}
          />
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Ngôn ngữ trong video</label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            {videoDuration > 0 && (
              <p className="text-xs text-cyan-400">Thời lượng: {fmt(videoDuration)}</p>
            )}
            <button
              onClick={handleTranscribe}
              disabled={!videoFile || loading}
              className="mt-auto py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
              <FileAudio size={14} /> Trích transcript
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: transcript table + translate */}
      {segments.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">② Transcript &amp; bản dịch</p>
            <div className="flex items-center gap-2">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {TARGET_LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <button
                onClick={handleTranslate}
                disabled={loading}
                className="py-1.5 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-all flex items-center gap-1.5"
              >
                <Languages size={13} /> Dịch sang {targetLang}
              </button>
              <button
                onClick={handleFitLength}
                disabled={loading || !hasTranslation}
                title="Rút gọn/nới bản dịch cho khớp thời lượng từng đoạn — làm TRƯỚC khi tạo giọng"
                className="py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                ✨ Tối ưu độ dài
              </button>
            </div>
          </div>
          {hasTranslation && !ttsDone && (
            <p className="text-[11px] text-amber-400/90 -mt-1">
              💡 Nên bấm <b>✨ Tối ưu độ dài</b> để bản dịch vừa thời lượng trước khi tạo giọng — giọng sẽ khớp tự nhiên, đỡ phải tăng/giảm tốc sau. Cột <b>Dự kiến</b> cho biết câu nào còn dài.
            </p>
          )}

          <div className="overflow-x-auto max-h-[340px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left text-muted-foreground">
                  <th className="px-2 py-1.5 w-8">#</th>
                  <th className="px-2 py-1.5 w-24">Thời gian</th>
                  <th className="px-2 py-1.5">Lời gốc</th>
                  <th className="px-2 py-1.5">Bản dịch (sửa được)</th>
                  {hasTranslation && !ttsDone && <th className="px-2 py-1.5 w-20">Dự kiến</th>}
                  {ttsDone && <th className="px-2 py-1.5 w-16">Khớp</th>}
                </tr>
              </thead>
              <tbody>
                {segments.map((s, i) => {
                  const segDur = s.end - s.start;
                  const bad = s.ratio && (s.ratio > RATIO_WARN_HIGH || s.ratio < RATIO_WARN_LOW);
                  return (
                    <tr key={i} className="border-t border-border/50 align-top">
                      <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1.5 text-cyan-400 whitespace-nowrap">
                        {fmt(s.start)}
                        <span className="text-muted-foreground"> ({segDur.toFixed(1)}s)</span>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{s.text}</td>
                      <td className="px-2 py-1.5">
                        <textarea
                          value={s.translated}
                          onChange={(e) => updateTranslated(i, e.target.value)}
                          rows={1}
                          placeholder="(chưa dịch)"
                          className="w-full min-w-[140px] rounded border border-border bg-background px-1.5 py-1 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                      </td>
                      {hasTranslation && !ttsDone && (() => {
                        const est = estimateSpokenSeconds(s.translated, targetLang);
                        const over = est > segDur * 1.15;
                        const under = est < segDur * 0.6;
                        return (
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <span className={over ? 'text-amber-400 font-semibold' : under ? 'text-muted-foreground' : 'text-cyan-400'}>
                              ≈{est.toFixed(1)}s {over ? '⚠️ dài' : under ? '↓' : '✓'}
                            </span>
                          </td>
                        );
                      })()}
                      {ttsDone && (
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {s.ratio ? (
                            <span className={bad ? 'text-amber-400 font-semibold' : 'text-cyan-400'}>
                              {s.ttsDur?.toFixed(1)}s {bad ? '⚠️' : '✓'}
                            </span>
                          ) : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3: TTS config + generate */}
      {hasTranslation && (
        <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-3">
          <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">③ Giọng đọc (TTS)</p>

          {/* Provider selector */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-border">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setProvider(p.id); lsSet('tts_provider', p.id); }}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                  provider === p.id ? 'bg-cyan-500 text-white shadow' : 'text-muted-foreground hover:bg-muted/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Per-provider config (compact) */}
          {provider === 'gemini' && (
            <div className="grid grid-cols-2 gap-2">
              <select value={geminiVoice} onChange={(e) => { setGeminiVoice(e.target.value); lsSet('tts_gemini_voice', e.target.value); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                {GEMINI_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={geminiModel} onChange={(e) => { setGeminiModel(e.target.value); lsSet('tts_gemini_model', e.target.value); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                {GEMINI_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <p className="col-span-2 text-xs text-cyan-400">Không cần API key — dùng Vertex service account.</p>
            </div>
          )}
          {provider === 'elevenlabs' && (
            <div className="flex flex-col gap-2">
              <select value={elModel} onChange={(e) => { setElModel(e.target.value); lsSet('tts_el_model', e.target.value); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                {ELEVENLABS_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <p className="text-[11px] text-amber-400">Thái → chọn <b>v3</b>. Việt → <b>v3</b> hoặc <b>Flash v2.5</b>.</p>
              <select value={elVoiceId} onChange={(e) => { setElVoiceId(e.target.value); lsSet('tts_el_voice', e.target.value); }}
                disabled={!!elCustomVoice.trim()}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50">
                {ELEVENLABS_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <input type="text" value={elCustomVoice} onChange={(e) => { setElCustomVoice(e.target.value); lsSet('tts_el_custom_voice', e.target.value); }}
                placeholder="Custom Voice ID (paste giọng Thái/Việt từ Voice Library)"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
              <input type="password" value={elKey} onChange={(e) => { setElKey(e.target.value); lsSet('tts_elevenlabs_key', e.target.value); }}
                placeholder="ElevenLabs API key * (bắt buộc — elevenlabs.io)"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
            </div>
          )}
          {provider === 'openai' && (
            <div className="grid grid-cols-2 gap-2">
              <select value={oaiVoice} onChange={(e) => { setOaiVoice(e.target.value); lsSet('tts_oai_voice', e.target.value); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                {OPENAI_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="password" value={oaiKey} onChange={(e) => { setOaiKey(e.target.value); lsSet('tts_openai_key', e.target.value); }}
                placeholder="OpenAI API key *"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
            </div>
          )}
          {provider === 'azure' && (
            <div className="grid grid-cols-2 gap-2">
              <select value={azLang} onChange={(e) => {
                  const lang = e.target.value; setAzLang(lang); lsSet('tts_azure_lang', lang);
                  const first = (AZURE_VOICES_BY_LANG[lang] || [])[0]?.value || '';
                  setAzVoice(first); lsSet('tts_azure_voice', first);
                }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                {AZURE_LANG_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <select value={azVoice} onChange={(e) => { setAzVoice(e.target.value); lsSet('tts_azure_voice', e.target.value); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                {(AZURE_VOICES_BY_LANG[azLang] || []).map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
              <input type="password" value={azKey} onChange={(e) => { setAzKey(e.target.value); lsSet('tts_azure_key', e.target.value); }}
                placeholder="Azure key *" className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
              <input type="text" value={azRegion} onChange={(e) => { setAzRegion(e.target.value); lsSet('tts_azure_region', e.target.value); }}
                placeholder="region" className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
            </div>
          )}

          <button
            onClick={handleTTS}
            disabled={loading}
            className="py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
          >
            <Mic size={14} /> Tạo giọng cho tất cả đoạn
          </button>
        </div>
      )}

      {/* Step 4: assemble */}
      {ttsDone && (
        <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-3">
          <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">④ Ghép giọng vào video</p>

          {/* Sync strategy */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Cách đồng bộ thời lượng</label>
            {[
              { id: 'voice', title: '🎚 Đổi tốc GIỌNG toàn bộ', desc: 'Cả track giọng cùng 1 hệ số tốc → giọng đều, mượt. Vài đoạn lệch nhẹ. (Khuyến nghị)' },
              { id: 'video', title: '🎞 Đổi tốc VIDEO toàn bộ', desc: 'Giữ giọng tự nhiên, làm nhanh/chậm khung hình cả video. Giọng tự nhiên nhất.' },
              { id: 'segment', title: '✂️ Khớp từng đoạn', desc: 'Mỗi đoạn co giãn riêng → khớp chính xác nhất nhưng giọng lúc nhanh lúc chậm.' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setSyncMode(m.id)}
                className={`text-left rounded-lg border p-2.5 transition-all ${
                  syncMode === m.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-border bg-muted/20 hover:border-cyan-500/40'
                }`}
              >
                <p className={`text-xs font-bold ${syncMode === m.id ? 'text-cyan-300' : 'text-foreground'}`}>{m.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>

          <button
            onClick={handleAssemble}
            disabled={loading}
            className="py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
          >
            <Wand2 size={14} /> Ghép video hoàn chỉnh
          </button>
        </div>
      )}

      {/* Status */}
      {(status || progress) && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${
          status.startsWith('Lỗi')
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : status.includes('Hoàn thành') || status.includes('Đã tạo giọng cho tất cả')
            ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
            : 'bg-muted/40 border-border text-muted-foreground'
        }`}>
          {status.startsWith('Lỗi') && <AlertCircle size={14} className="shrink-0 mt-0.5" />}
          <span>{loading ? (progress || 'Đang xử lý...') : status}</span>
        </div>
      )}

      {/* Output */}
      {outputUrl && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-cyan-400">Kết quả</p>
          <video controls src={outputUrl} className="w-full rounded-lg border border-border" />
          <button
            onClick={handleDownload}
            className="w-full py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Download size={14} /> Tải xuống video
          </button>
        </div>
      )}
    </div>
  );
}
