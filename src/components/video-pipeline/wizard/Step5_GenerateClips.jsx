import { useState, useCallback, useRef } from 'react';
import { Loader2, RefreshCw, CheckCircle, Download, Video } from 'lucide-react';
import { generateClip } from '../../../lib/veoClient.js';
import { downloadBlob } from '../../../lib/videoConcat.js';

const MAX_CONCURRENT = 3;

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function ClipCard({ scene, idx, clip, onRetry, onDownload }) {
  const status = clip?.status || 'idle';
  const previewUrl = clip?.previewUrl;

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold">Clip {idx + 1} — {scene.durationSec}s</span>
        <div className="flex items-center gap-1.5">
          {status === 'generating' && <Loader2 size={12} className="animate-spin text-pink-400" />}
          {status === 'ok' && <CheckCircle size={12} className="text-green-400" />}
          {status === 'error' && <span className="text-[10px] text-red-400">Lỗi</span>}
          {status === 'ok' && (
            <button onClick={() => onDownload(idx)} className="text-muted-foreground hover:text-pink-400 p-0.5">
              <Download size={12} />
            </button>
          )}
          <button
            onClick={() => onRetry(idx)}
            disabled={status === 'generating'}
            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-pink-400 px-2 py-0.5 rounded border border-border hover:border-pink-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      </div>

      {previewUrl ? (
        <video src={previewUrl} controls className="w-full aspect-[9/16] object-cover rounded-lg border border-border" />
      ) : (
        <div className="w-full aspect-[9/16] rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/20">
          {status === 'generating' ? (
            <Loader2 size={24} className="text-pink-400 animate-spin" />
          ) : (
            <Video size={24} className="text-muted-foreground" />
          )}
        </div>
      )}

      {clip?.error && <p className="text-[11px] text-red-400 mt-1 break-words">{clip.error}</p>}
      <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{scene.videoPrompt}</p>
    </div>
  );
}

export default function Step5_GenerateClips({ credentials, script, refImages, value, onApprove }) {
  const [clips, setClips] = useState(() => {
    if (value?.length) return value;
    return (script?.scenes || []).map(() => ({ status: 'idle', blob: null, previewUrl: null, error: null }));
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const semaphoreRef = useRef(0);

  const generateOne = useCallback(async (idx) => {
    const scene = script.scenes[idx];
    const refImg = refImages[idx];

    if (!refImg?.blob) {
      throw new Error('No reference image for this scene');
    }

    const refData = await blobToBase64(refImg.blob);
    const blob = await generateClip({
      videoPrompt: scene.videoPrompt,
      refImage: { mimeType: refImg.blob.type || 'image/png', data: refData },
      durationSec: scene.durationSec || 8,
    });
    return blob;
  }, [script, refImages, credentials]);

  const handleGenerateAll = useCallback(async () => {
    setRunning(true);
    setError('');
    const scenes = script?.scenes || [];
    const pending = scenes.map((_, i) => i);

    const updateClip = (idx, patch) => {
      setClips(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      });
    };

    const worker = async () => {
      while (pending.length > 0) {
        if (semaphoreRef.current >= MAX_CONCURRENT) {
          await new Promise(r => setTimeout(r, 200));
          continue;
        }
        const idx = pending.shift();
        if (idx === undefined) break;
        semaphoreRef.current++;
        updateClip(idx, { status: 'generating', error: null });
        generateOne(idx)
          .then(blob => {
            const previewUrl = URL.createObjectURL(blob);
            updateClip(idx, { status: 'ok', blob, previewUrl, error: null });
          })
          .catch(err => {
            updateClip(idx, { status: 'error', error: err.message });
            setError(`Clip ${idx + 1} failed: ${err.message}`);
          })
          .finally(() => { semaphoreRef.current--; });
      }
    };

    const workers = Array.from({ length: MAX_CONCURRENT }, () => worker());
    await Promise.all(workers);
    setRunning(false);
  }, [script, generateOne]);

  const handleRetry = useCallback(async (idx) => {
    setError('');
    setClips(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: 'generating', error: null };
      return next;
    });
    try {
      const blob = await generateOne(idx);
      const previewUrl = URL.createObjectURL(blob);
      setClips(prev => {
        const next = [...prev];
        next[idx] = { status: 'ok', blob, previewUrl, error: null };
        return next;
      });
    } catch (err) {
      setClips(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'error', error: err.message };
        return next;
      });
      setError(`Retry clip ${idx + 1} failed: ${err.message}`);
    }
  }, [generateOne]);

  const handleDownload = useCallback((idx) => {
    const clip = clips[idx];
    if (clip?.blob) downloadBlob(clip.blob, `clip_${idx + 1}.mp4`);
  }, [clips]);

  const allDone = clips.length > 0 && clips.every(c => c.status === 'ok');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleGenerateAll}
          disabled={running}
          className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center gap-2 transition-colors"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : null}
          Generate all clips
        </button>
        <span className="text-xs text-muted-foreground">
          {clips.filter(c => c.status === 'ok').length}/{clips.length} hoàn thành · max {MAX_CONCURRENT} concurrent
        </span>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {(script?.scenes || []).map((scene, idx) => (
          <ClipCard key={idx} scene={scene} idx={idx} clip={clips[idx]} onRetry={handleRetry} onDownload={handleDownload} />
        ))}
      </div>

      {allDone && (
        <button onClick={() => onApprove(clips)} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm rounded-lg flex items-center gap-2 self-start transition-colors">
          <CheckCircle size={14} /> Approve & Tiếp tục
        </button>
      )}
    </div>
  );
}
