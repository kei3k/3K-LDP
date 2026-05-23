import { useState, useCallback, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import Step1_AnalyzeVideo from './Step1_AnalyzeVideo.jsx';
import Step2_InputAssets from './Step2_InputAssets.jsx';
import Step3_GenerateScript from './Step3_GenerateScript.jsx';
import Step4_GenerateRefImages from './Step4_GenerateRefImages.jsx';
import Step5_GenerateClips from './Step5_GenerateClips.jsx';
import Step6_Concat from './Step6_Concat.jsx';
import { saveSession, loadSession, clearSession } from '../../../lib/sessionStorage.js';

const STEPS = [
  { label: 'Phân tích', desc: 'Upload & analyze video' },
  { label: 'Assets', desc: 'Ảnh SP + nhân vật' },
  { label: 'Kịch bản', desc: 'Generate script' },
  { label: 'Ref Images', desc: 'Nano Banana 2' },
  { label: 'Clips', desc: 'Veo 3.1' },
  { label: 'Ghép', desc: 'Concat + download' },
];

export default function VideoPipelineWizard({ credentials, language = 'Tiếng Việt' }) {
  const [activeStep, setActiveStep] = useState(0);
  const [session, setSession] = useState({
    template: null,
    assets: null,
    script: null,
    refImages: null,
    clips: null,
    finalVideo: null,
  });
  const [loaded, setLoaded] = useState(false);
  const [restoredBanner, setRestoredBanner] = useState(false);

  // Load on mount
  useEffect(() => {
    loadSession().then((stored) => {
      if (stored && (stored.template || stored.assets || stored.script || stored.refImages || stored.clips)) {
        setSession((s) => ({ ...s, ...stored }));
        // Jump to the latest completed step so user lands where they left off
        const latest = stored.clips ? 5 : stored.refImages ? 4 : stored.script ? 3 : stored.assets ? 2 : stored.template ? 1 : 0;
        setActiveStep(latest);
        setRestoredBanner(true);
      }
      setLoaded(true);
    });
  }, []);

  // Auto-save whenever session changes (skip the initial empty state before load completes)
  const saveTimer = useRef();
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSession(session), 400);
    return () => clearTimeout(saveTimer.current);
  }, [session, loaded]);

  const goTo = useCallback((step) => {
    if (step >= 0 && step < STEPS.length) setActiveStep(step);
  }, []);

  const handleClearSession = useCallback(async () => {
    if (!window.confirm('Xoá toàn bộ session đã lưu (template, ảnh, clips...)? Không thể khôi phục.')) return;
    await clearSession();
    setSession({ template: null, assets: null, script: null, refImages: null, clips: null, finalVideo: null });
    setActiveStep(0);
    setRestoredBanner(false);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Restored banner */}
      {restoredBanner && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between flex-shrink-0">
          <span>♻️ Session đã restore từ IndexedDB — anh tiếp tục từ bước anh dừng lại.</span>
          <button onClick={() => setRestoredBanner(false)} className="text-blue-400 hover:text-blue-300 underline">Đóng</button>
        </div>
      )}

      {/* Step bar */}
      <div className="flex gap-1 px-4 pt-4 pb-3 border-b border-border bg-muted/10 flex-shrink-0 overflow-x-auto items-center">
        {STEPS.map((s, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`flex-1 min-w-[80px] rounded-xl px-2 py-2 text-center text-[11px] cursor-pointer transition-all ${
                active ? 'bg-pink-500 text-white shadow' :
                done ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30' :
                'bg-muted/40 text-muted-foreground hover:bg-muted'
              }`}
              title={done ? 'Đã hoàn thành — click để xem lại' : active ? 'Đang ở bước này' : 'Nhảy tới bước này (skip)'}
            >
              <div className="font-bold">{i + 1}. {s.label}</div>
              <div className="opacity-70 text-[10px]">{s.desc}</div>
            </button>
          );
        })}
        <button
          onClick={handleClearSession}
          className="ml-1 px-2 py-2 text-[11px] rounded-xl border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors flex items-center gap-1 shrink-0"
          title="Xoá session đã lưu"
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="max-w-3xl mx-auto">
          {activeStep === 0 && (
            <Step1_AnalyzeVideo
              credentials={credentials}
              language={language}
              value={session.template}
              onApprove={(template) => { setSession(s => ({ ...s, template })); setActiveStep(1); }}
              onRegenerate={() => setSession(s => ({ ...s, template: null }))}
            />
          )}

          {activeStep === 1 && (
            <Step2_InputAssets
              step1Template={session.template}
              value={session.assets}
              onApprove={(assets) => { setSession(s => ({ ...s, assets })); setActiveStep(2); }}
            />
          )}

          {activeStep === 2 && (
            <Step3_GenerateScript
              credentials={credentials}
              language={language}
              assets={session.assets}
              value={session.script}
              onChange={(script) => setSession(s => ({ ...s, script }))}
              onApprove={(script) => { setSession(s => ({ ...s, script })); setActiveStep(3); }}
              onRegenerate={() => setSession(s => ({ ...s, script: null }))}
            />
          )}

          {activeStep === 3 && (
            <Step4_GenerateRefImages
              credentials={credentials}
              script={session.script}
              assets={session.assets}
              value={session.refImages}
              onApprove={(refImages) => { setSession(s => ({ ...s, refImages })); setActiveStep(4); }}
              onRegenerate={() => setSession(s => ({ ...s, refImages: null }))}
            />
          )}

          {activeStep === 4 && (
            <Step5_GenerateClips
              credentials={credentials}
              script={session.script}
              refImages={session.refImages}
              value={session.clips}
              onApprove={(clips) => { setSession(s => ({ ...s, clips })); setActiveStep(5); }}
            />
          )}

          {activeStep === 5 && (
            <Step6_Concat
              clips={session.clips}
            />
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10 flex-shrink-0">
        <button
          onClick={() => goTo(activeStep - 1)}
          disabled={activeStep === 0}
          className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
        >
          ← Back
        </button>
        <span className="text-xs text-muted-foreground">Bước {activeStep + 1} / {STEPS.length}</span>
        <button
          onClick={() => goTo(activeStep + 1)}
          disabled={activeStep === STEPS.length - 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
        >
          Skip →
        </button>
      </div>
    </div>
  );
}
