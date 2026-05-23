import { useState, useCallback, useRef } from 'react';
import { Upload, Loader2, Save, RefreshCw, CheckCircle } from 'lucide-react';
import { analyzeVideo } from '../../../lib/geminiVideo.js';
import { saveTemplate } from './TemplateLibrary.jsx';

export default function Step1_AnalyzeVideo({ credentials, language = 'Tiếng Việt', value, onApprove, onRegenerate }) {
  const [file, setFile] = useState(null);
  const [fbUrl, setFbUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(value || null);
  const [templateName, setTemplateName] = useState('');
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef();
  const dragRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragRef.current?.classList.remove('border-pink-500');
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'video/mp4') setFile(f);
    else setError('Please drop a valid .mp4 file');
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) { setError('Please select an mp4 file first'); return; }
    setLoading(true);
    setError('');
    setProgress('');
    setSaved(false);
    try {
      const res = await analyzeVideo(file, language, setProgress);
      setResult({ ...res, name: templateName || file.name, sourceUrl: fbUrl || undefined });
      setProgress('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [file, templateName, fbUrl]);

  const handleSaveLibrary = useCallback(() => {
    if (!result) return;
    saveTemplate({ ...result, name: templateName || result.name || 'Template' });
    setSaved(true);
  }, [result, templateName]);

  const handleApprove = useCallback(() => {
    if (!result) return;
    onApprove({ ...result, name: templateName || result.name || 'Template' });
  }, [result, templateName, onApprove]);

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={dragRef}
        onDragOver={(e) => { e.preventDefault(); dragRef.current?.classList.add('border-pink-500'); }}
        onDragLeave={() => dragRef.current?.classList.remove('border-pink-500')}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-pink-500/60 transition-colors"
      >
        <Upload size={32} className="mx-auto mb-2 text-muted-foreground" />
        {file ? (
          <p className="text-sm text-foreground font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
        ) : (
          <p className="text-sm text-muted-foreground">Kéo thả file .mp4 vào đây hoặc click để chọn</p>
        )}
        <input ref={fileInputRef} type="file" accept="video/mp4" className="hidden" onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">FB Reel URL (tuỳ chọn — chỉ lưu metadata)</label>
        <input
          type="url"
          value={fbUrl}
          onChange={e => setFbUrl(e.target.value)}
          placeholder="https://www.facebook.com/reel/..."
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-500"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Tên template</label>
        <input
          type="text"
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          placeholder="Ví dụ: Reel sản phẩm làm đẹp 30s"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-500"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {progress && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin shrink-0" />
          {progress}
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={loading || !file}
        className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center gap-2 self-start transition-colors"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        Phân tích video
      </button>

      {result && (
        <div className="flex flex-col gap-4 mt-2">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Transcript</label>
            <textarea
              value={result.transcript || ''}
              onChange={e => setResult(r => ({ ...r, transcript: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 text-sm bg-muted/30 border border-border rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
            {result.transcript_vi != null && (
              <div className="mt-1 flex items-start gap-1.5">
                <span className="shrink-0 px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold leading-none mt-1">VI</span>
                <textarea
                  value={result.transcript_vi || ''}
                  onChange={e => setResult(r => ({ ...r, transcript_vi: e.target.value }))}
                  rows={2}
                  className="w-full px-2 py-1 text-[11px] text-muted-foreground bg-muted/20 border border-border/60 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Cấu trúc cảnh ({result.totalDuration}s tổng)
            </label>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">#</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Duration (s)</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {result.structure?.hook && (
                    <tr className="border-t border-border">
                      <td className="px-3 py-2 text-pink-400 font-bold">Hook</td>
                      <td className="px-3 py-2">
                        <input type="number" value={result.structure.hook.duration || 0}
                          onChange={e => setResult(r => ({ ...r, structure: { ...r.structure, hook: { ...r.structure.hook, duration: +e.target.value } } }))}
                          className="w-16 px-1 py-0.5 bg-background border border-border rounded text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={result.structure.hook.description || ''}
                          onChange={e => setResult(r => ({ ...r, structure: { ...r.structure, hook: { ...r.structure.hook, description: e.target.value } } }))}
                          className="w-full px-1 py-0.5 bg-background border border-border rounded text-xs" />
                        {result.structure.hook.description_vi != null && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="shrink-0 px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold leading-none">VI</span>
                            <input type="text" value={result.structure.hook.description_vi || ''}
                              onChange={e => setResult(r => ({ ...r, structure: { ...r.structure, hook: { ...r.structure.hook, description_vi: e.target.value } } }))}
                              className="w-full px-1 py-0.5 bg-muted/20 border border-border/60 rounded text-[11px] text-muted-foreground" />
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  {(result.structure?.scenes || []).map((scene, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <input type="number" value={scene.duration || 8}
                          onChange={e => setResult(r => {
                            const scenes = [...r.structure.scenes];
                            scenes[idx] = { ...scenes[idx], duration: +e.target.value };
                            return { ...r, structure: { ...r.structure, scenes } };
                          })}
                          className="w-16 px-1 py-0.5 bg-background border border-border rounded text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={scene.action || ''}
                          onChange={e => setResult(r => {
                            const scenes = [...r.structure.scenes];
                            scenes[idx] = { ...scenes[idx], action: e.target.value };
                            return { ...r, structure: { ...r.structure, scenes } };
                          })}
                          className="w-full px-1 py-0.5 bg-background border border-border rounded text-xs" />
                        {scene.action_vi != null && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="shrink-0 px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold leading-none">VI</span>
                            <input type="text" value={scene.action_vi || ''}
                              onChange={e => setResult(r => {
                                const scenes = [...r.structure.scenes];
                                scenes[idx] = { ...scenes[idx], action_vi: e.target.value };
                                return { ...r, structure: { ...r.structure, scenes } };
                              })}
                              className="w-full px-1 py-0.5 bg-muted/20 border border-border/60 rounded text-[11px] text-muted-foreground" />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {result.structure?.cta && (
                    <tr className="border-t border-border">
                      <td className="px-3 py-2 text-pink-400 font-bold">CTA</td>
                      <td className="px-3 py-2">
                        <input type="number" value={result.structure.cta.duration || 0}
                          onChange={e => setResult(r => ({ ...r, structure: { ...r.structure, cta: { ...r.structure.cta, duration: +e.target.value } } }))}
                          className="w-16 px-1 py-0.5 bg-background border border-border rounded text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={result.structure.cta.description || ''}
                          onChange={e => setResult(r => ({ ...r, structure: { ...r.structure, cta: { ...r.structure.cta, description: e.target.value } } }))}
                          className="w-full px-1 py-0.5 bg-background border border-border rounded text-xs" />
                        {result.structure.cta.description_vi != null && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="shrink-0 px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold leading-none">VI</span>
                            <input type="text" value={result.structure.cta.description_vi || ''}
                              onChange={e => setResult(r => ({ ...r, structure: { ...r.structure, cta: { ...r.structure.cta, description_vi: e.target.value } } }))}
                              className="w-full px-1 py-0.5 bg-muted/20 border border-border/60 rounded text-[11px] text-muted-foreground" />
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleSaveLibrary} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted flex items-center gap-1.5 transition-colors">
              {saved ? <CheckCircle size={14} className="text-green-400" /> : <Save size={14} />}
              {saved ? 'Đã lưu' : 'Lưu vào thư viện'}
            </button>
            <button onClick={() => { setResult(null); onRegenerate?.(); }} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted flex items-center gap-1.5 transition-colors">
              <RefreshCw size={14} /> Phân tích lại
            </button>
            <button onClick={handleApprove} className="px-4 py-1.5 text-sm rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-bold flex items-center gap-1.5 transition-colors">
              <CheckCircle size={14} /> Approve & Tiếp tục
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
