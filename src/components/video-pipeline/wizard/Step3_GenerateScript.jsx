import { useState, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronUp, RefreshCw, CheckCircle } from 'lucide-react';
import { generateScript } from '../../../lib/geminiVideo.js';

function SceneCard({ scene, idx, onChange, onRegenerateScene }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold hover:bg-muted/40 transition-colors"
      >
        <span>Cảnh {idx + 1} — {scene.durationSec}s</span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onRegenerateScene(idx); }}
            className="text-xs text-muted-foreground hover:text-pink-400 flex items-center gap-1 px-2 py-0.5 rounded border border-border hover:border-pink-400 transition-colors"
          >
            <RefreshCw size={11} /> Regen
          </button>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Narration / Thoại</span>
            <textarea
              value={scene.narration || ''}
              onChange={e => onChange(idx, 'narration', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
            {scene.narration_vi != null && (
              <div className="flex items-start gap-1.5 mt-1">
                <span className="shrink-0 px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold leading-none mt-1">VI</span>
                <textarea
                  value={scene.narration_vi || ''}
                  onChange={e => onChange(idx, 'narration_vi', e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1 text-[11px] text-muted-foreground bg-muted/20 border border-border/60 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            )}
          </label>
          {[
            { field: 'imagePrompt', label: 'Image Prompt (Nano Banana 2)' },
            { field: 'videoPrompt', label: 'Video Prompt (Veo 3.1)' },
          ].map(({ field, label }) => (
            <label key={field} className="block">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{label}</span>
              <textarea
                value={scene[field] || ''}
                onChange={e => onChange(idx, field, e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-pink-500"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Step3_GenerateScript({ credentials, language = 'Tiếng Việt', assets, value, onChange, onApprove, onRegenerate }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [script, setScript] = useState(value || null);

  const handleGenerate = useCallback(async () => {
    if (!assets) { setError('Assets missing from Step 2'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await generateScript({
        template: assets.template,
        productImages: assets.productImages,
        characters: assets.characters,
        targetDuration: assets.targetDuration,
        language,
      }, setProgress);
      setScript(result);
      onChange?.(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress('');
    }
  }, [assets, onChange]);

  const handleSceneChange = useCallback((idx, field, val) => {
    setScript(s => {
      const scenes = [...s.scenes];
      scenes[idx] = { ...scenes[idx], [field]: val };
      const next = { ...s, scenes };
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const handleRegenerateScene = useCallback(async (idx) => {
    if (!script || !assets) return;
    setError('');
    try {
      const single = await generateScript({
        template: assets.template,
        productImages: assets.productImages,
        characters: assets.characters,
        targetDuration: 8,
        language,
      }, () => {});
      if (single.scenes?.[0]) {
        setScript(s => {
          const scenes = [...s.scenes];
          scenes[idx] = { ...single.scenes[0], idx, durationSec: 8 };
          const next = { ...s, scenes };
          onChange?.(next);
          return next;
        });
      }
    } catch (err) {
      setError(`Regen scene ${idx + 1} failed: ${err.message}`);
    }
  }, [script, assets, onChange]);

  const handleApprove = useCallback(() => {
    if (!script) return;
    onApprove(script);
  }, [script, onApprove]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {script ? 'Tạo lại toàn bộ' : 'Tạo kịch bản'}
        </button>
        {script && (
          <button onClick={() => { onRegenerate?.(); setScript(null); }}
            className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted flex items-center gap-1.5 transition-colors">
            <RefreshCw size={13} /> Reset
          </button>
        )}
      </div>

      {progress && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin shrink-0" />{progress}
        </div>
      )}

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

      {script && (
        <>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Full Script</label>
            <textarea
              value={script.fullScript || ''}
              onChange={e => { const next = { ...script, fullScript: e.target.value }; setScript(next); onChange?.(next); }}
              rows={4}
              className="w-full px-3 py-2 text-sm bg-muted/30 border border-border rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
            {script.fullScript_vi != null && (
              <div className="mt-1.5">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1 block">VI Gloss</span>
                <textarea
                  value={script.fullScript_vi || ''}
                  onChange={e => { const next = { ...script, fullScript_vi: e.target.value }; setScript(next); onChange?.(next); }}
                  rows={3}
                  className="w-full px-3 py-2 text-[11px] text-muted-foreground bg-muted/20 border border-border/60 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {(script.scenes || []).map((scene, idx) => (
              <SceneCard key={idx} scene={scene} idx={idx} onChange={handleSceneChange} onRegenerateScene={handleRegenerateScene} />
            ))}
          </div>

          <button onClick={handleApprove} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm rounded-lg flex items-center gap-2 self-start transition-colors">
            <CheckCircle size={14} /> Approve & Tiếp tục
          </button>
        </>
      )}
    </div>
  );
}
