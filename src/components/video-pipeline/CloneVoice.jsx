import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Mic, Download, AlertCircle } from 'lucide-react';

// ─── Drag-drop file zone ──────────────────────────────────────────────────────

function DropZone({ accept, label, hint, file, onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-5 cursor-pointer transition-all min-h-[120px] ${
        dragging
          ? 'border-cyan-400 bg-cyan-500/10'
          : file
          ? 'border-cyan-500/50 bg-cyan-500/5'
          : 'border-border hover:border-cyan-500/40 hover:bg-muted/30'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {file ? (
        <div className="text-center">
          <p className="text-xs font-semibold text-cyan-300 truncate max-w-[200px]">{file.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <p className="text-xs text-cyan-500 mt-1">Nhấn để đổi file</p>
        </div>
      ) : (
        <>
          <Upload size={24} className="text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground text-center">{label}</p>
          {hint && <p className="text-xs text-muted-foreground text-center">{hint}</p>}
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CloneVoice() {
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioTab, setAudioTab] = useState('upload'); // 'upload' | 'tts'
  const [videoDuration, setVideoDuration] = useState(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(''); // upload phase message
  const [loading, setLoading] = useState(false);
  const [outputUrl, setOutputUrl] = useState(null);
  const [outputBlob, setOutputBlob] = useState(null);
  const videoPreviewRef = useRef(null);

  // ── Load TTS audio injected from TTSTab ──────────────────────────────────

  useEffect(() => {
    function loadFromTTS() {
      const blob = window._cloneVoiceAudio;
      if (blob) {
        const ext = blob.type?.includes('wav') ? 'wav' : 'mp3';
        // Wrap Blob in a File-like object so DropZone shows name/size
        const f = new File([blob], `tts_audio.${ext}`, { type: blob.type });
        setAudioFile(f);
        setAudioTab('upload');
        window._cloneVoiceAudio = null;
        sessionStorage.removeItem('_pending_clone_audio');
        setStatus('Đã tải audio từ TTS.');
      }
    }

    // Check on mount
    loadFromTTS();

    // Listen for deferred dispatch from TTSTab
    window.addEventListener('clone-voice-loaded', loadFromTTS);
    return () => window.removeEventListener('clone-voice-loaded', loadFromTTS);
  }, []);

  // ── Load video duration once file is selected ─────────────────────────────

  useEffect(() => {
    if (!videoFile) { setVideoDuration(null); return; }
    const url = URL.createObjectURL(videoFile);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.onloadedmetadata = () => {
      setVideoDuration(vid.duration);
      URL.revokeObjectURL(url);
    };
    vid.src = url;
  }, [videoFile]);

  // ── Swap audio ────────────────────────────────────────────────────────────

  const handleSwap = useCallback(async () => {
    if (!videoFile || !audioFile) return;
    setLoading(true);
    setStatus('');
    setOutputUrl(null);
    setOutputBlob(null);

    const sid = crypto.randomUUID();

    try {
      // 1. Upload video
      setProgress('Đang tải video lên... (1/3)');
      const uploadVideo = await fetch(`/api/swap-audio/upload?slot=video&id=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': videoFile.type || 'video/mp4' },
        body: videoFile,
      });
      if (!uploadVideo.ok) throw new Error(`Upload video lỗi: ${await uploadVideo.text()}`);

      // 2. Upload audio
      setProgress('Đang tải audio lên... (2/3)');
      const uploadAudio = await fetch(`/api/swap-audio/upload?slot=audio&id=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': audioFile.type || 'audio/mpeg' },
        body: audioFile,
      });
      if (!uploadAudio.ok) throw new Error(`Upload audio lỗi: ${await uploadAudio.text()}`);

      // 3. Run swap
      setProgress('Đang xử lý ffmpeg... (3/3)');
      const runRes = await fetch(`/api/swap-audio/run?id=${sid}`, { method: 'POST' });
      if (!runRes.ok) {
        const errText = await runRes.text();
        throw new Error(`ffmpeg lỗi: ${errText}`);
      }

      const blob = await runRes.blob();
      const url = URL.createObjectURL(blob);
      setOutputBlob(blob);
      setOutputUrl(url);
      setStatus('Hoàn thành! Video đã được ghép âm mới.');
    } catch (err) {
      setStatus(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress('');
    }
  }, [videoFile, audioFile]);

  function handleDownload() {
    if (!outputBlob || !outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `clone_voice_${Date.now()}.mp4`;
    a.click();
  }

  const canSwap = !!videoFile && !!audioFile && !loading;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Mic size={18} className="text-cyan-400" />
        <h2 className="text-sm font-bold text-foreground">Clone Voice — Đổi giọng video</h2>
        <span className="text-xs text-muted-foreground">
          Giữ nguyên hình ảnh, thay thế toàn bộ âm thanh bằng giọng mới
        </span>
      </div>

      {/* 2-column grid on wider screens, stacked on narrow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Video gốc ── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Video gốc
          </p>
          <DropZone
            accept="video/mp4,video/*"
            label="Kéo thả file video vào đây"
            hint="Hỗ trợ mp4, mov, avi..."
            file={videoFile}
            onFile={setVideoFile}
          />
          {videoDuration !== null && (
            <p className="text-xs text-cyan-400">
              Thời lượng: {Math.floor(videoDuration / 60)}:{String(Math.floor(videoDuration % 60)).padStart(2, '0')}
            </p>
          )}
          {videoFile && (
            <video
              ref={videoPreviewRef}
              src={URL.createObjectURL(videoFile)}
              controls
              className="w-full rounded-lg border border-border"
              style={{ maxHeight: '160px' }}
            />
          )}
        </div>

        {/* ── Audio mới ── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Audio mới
          </p>

          {/* Sub-tabs */}
          <div className="flex gap-1 rounded-lg bg-muted/40 p-1 border border-border">
            <button
              onClick={() => setAudioTab('upload')}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                audioTab === 'upload' ? 'bg-cyan-500 text-white shadow' : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              Upload audio
            </button>
            <button
              onClick={() => setAudioTab('tts')}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                audioTab === 'tts' ? 'bg-cyan-500 text-white shadow' : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              Từ TTS
            </button>
          </div>

          {audioTab === 'upload' && (
            <DropZone
              accept="audio/mp3,audio/wav,audio/mpeg,audio/m4a,audio/*"
              label="Kéo thả file audio vào đây"
              hint="Hỗ trợ mp3, wav, m4a..."
              file={audioFile}
              onFile={setAudioFile}
            />
          )}

          {audioTab === 'tts' && (
            <div className="rounded-xl border border-dashed border-cyan-500/40 bg-cyan-500/5 p-5 flex flex-col items-center gap-3">
              <Mic size={28} className="text-cyan-400" />
              <p className="text-xs text-center text-foreground font-semibold">
                Dùng tab TTS để tạo giọng nói
              </p>
              <p className="text-xs text-center text-muted-foreground">
                Tạo audio ở tab <strong>TTS</strong>, sau đó nhấn nút{' '}
                <strong>"Gửi vào Clone Voice"</strong> — audio sẽ tự động load vào đây.
              </p>
              {audioFile && (
                <p className="text-xs text-cyan-400 font-semibold">
                  Đã nhận: {audioFile.name}
                </p>
              )}
            </div>
          )}

          {audioFile && audioTab === 'upload' && (
            <audio
              controls
              src={URL.createObjectURL(audioFile)}
              className="w-full"
            />
          )}
        </div>
      </div>

      {/* ── Action button ── */}
      <button
        onClick={handleSwap}
        disabled={!canSwap}
        className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-lg shadow-cyan-500/20"
      >
        {loading ? progress || 'Đang xử lý...' : '🎙 Swap audio'}
      </button>

      {/* ── Status ── */}
      {status && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${
          status.startsWith('Lỗi')
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : status.includes('Hoàn thành')
            ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
            : 'bg-muted/40 border-border text-muted-foreground'
        }`}>
          {status.startsWith('Lỗi') && <AlertCircle size={14} className="shrink-0 mt-0.5" />}
          <span>{status}</span>
        </div>
      )}

      {/* ── Output ── */}
      {outputUrl && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-cyan-400">Kết quả</p>
          <video controls src={outputUrl} className="w-full rounded-lg border border-border" />
          <button
            onClick={handleDownload}
            className="w-full py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Download size={14} />
            Tải xuống video
          </button>
        </div>
      )}
    </div>
  );
}
