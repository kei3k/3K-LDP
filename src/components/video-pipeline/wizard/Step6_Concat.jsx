import { useState, useCallback, useRef } from 'react';
import { Download, Loader2, RefreshCw, Film, Package, Upload } from 'lucide-react';
import { concatClips, downloadBlob } from '../../../lib/videoConcat.js';

export default function Step6_Concat({ clips: clipsProp }) {
  // Allow direct upload as fallback so user can test concat without re-running Veo
  const [uploadedClips, setUploadedClips] = useState(null);
  const uploadRef = useRef();

  const clips = uploadedClips || clipsProp;
  const handleUploadClips = useCallback((e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('video/'));
    if (!files.length) return;
    const next = files.map((f, i) => ({ sceneIdx: i, status: 'ok', blob: f }));
    setUploadedClips(next);
  }, []);
  const [concatting, setConcatting] = useState(false);
  const [progress, setProgress] = useState('');
  const [finalBlob, setFinalBlob] = useState(null);
  const [finalUrl, setFinalUrl] = useState(null);
  const [error, setError] = useState('');
  const [zipping, setZipping] = useState(false);
  const videoRef = useRef();

  const validClips = (clips || []).filter(c => c.status === 'ok' && c.blob);

  const handleConcat = useCallback(async () => {
    if (!validClips.length) { setError('Không có clip nào để ghép'); return; }
    setConcatting(true);
    setError('');
    setProgress('');
    try {
      const blobs = validClips.map(c => c.blob);
      const out = await concatClips(blobs, setProgress);
      if (finalUrl) URL.revokeObjectURL(finalUrl);
      const url = URL.createObjectURL(out);
      setFinalBlob(out);
      setFinalUrl(url);
      setProgress('');
    } catch (err) {
      const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      setError(`Concat failed: ${msg}`);
    } finally {
      setConcatting(false);
    }
  }, [validClips, finalUrl]);

  const handleDownloadAll = useCallback(async () => {
    if (!validClips.length) return;
    setZipping(true);
    setError('');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      validClips.forEach((c, i) => zip.file(`clip_${i + 1}.mp4`, c.blob));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, 'video_clips.zip');
    } catch (err) {
      setError(`Zip failed: ${err.message}`);
    } finally {
      setZipping(false);
    }
  }, [validClips]);

  return (
    <div className="flex flex-col gap-6">
      {/* Section 0: Manual upload fallback (test concat without re-running Veo) */}
      <section className="rounded-lg border border-dashed border-border bg-muted/10 p-3">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Test concat từ file local
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {uploadedClips
                ? `Đang dùng ${uploadedClips.length} clip upload (override clips từ Step 5)`
                : 'Upload các .mp4 đã download để test ghép, không phải gen lại Veo ($$$).'}
            </p>
          </div>
          <input
            ref={uploadRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={handleUploadClips}
          />
          <button
            onClick={() => uploadRef.current?.click()}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-border bg-card text-foreground hover:bg-muted hover:border-pink-500/40 transition-colors flex items-center gap-1.5"
          >
            <Upload size={12} /> Upload clips
          </button>
          {uploadedClips && (
            <button
              onClick={() => setUploadedClips(null)}
              className="px-2.5 py-1.5 text-[11px] rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Dùng clips Step 5
            </button>
          )}
        </div>
      </section>

      {/* Section A: Individual clips */}
      <section>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Film size={15} /> Clip rời ({validClips.length} clips)
        </h3>
        <div className="flex flex-col gap-2">
          {validClips.map((c, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border">
              <span className="text-sm">Clip {i + 1}</span>
              <button
                onClick={() => downloadBlob(c.blob, `clip_${i + 1}.mp4`)}
                className="text-xs flex items-center gap-1.5 text-muted-foreground hover:text-pink-400 transition-colors"
              >
                <Download size={13} /> Download
              </button>
            </div>
          ))}
        </div>
        {validClips.length > 1 && (
          <button
            onClick={handleDownloadAll}
            disabled={zipping}
            className="mt-3 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {zipping ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
            Download all (ZIP)
          </button>
        )}
      </section>

      {/* Section B: Auto concat */}
      <section>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Film size={15} /> Video hoàn chỉnh
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Ghép {validClips.length} clip thành 1 file mp4 duy nhất. Dùng ffmpeg.wasm — chạy trên trình duyệt.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleConcat}
            disabled={concatting || !validClips.length}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center gap-2 transition-colors"
          >
            {concatting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {finalBlob ? 'Ghép lại' : 'Auto concat'}
          </button>
          {finalBlob && (
            <button
              onClick={() => downloadBlob(finalBlob, 'final_video.mp4')}
              className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted flex items-center gap-1.5 transition-colors"
            >
              <Download size={13} /> Download final.mp4
            </button>
          )}
        </div>

        {progress && (
          <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 size={13} className="animate-spin shrink-0" />
            {progress}
          </div>
        )}
        {error && <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm break-words">{error}</div>}

        {finalUrl && (
          <div className="mt-4">
            <video ref={videoRef} src={finalUrl} controls className="w-full max-w-sm rounded-xl border border-border" />
            <p className="text-xs text-muted-foreground mt-1">
              {finalBlob ? `${(finalBlob.size / 1024 / 1024).toFixed(1)} MB` : ''}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
