import { useState, useEffect } from 'react';
import { Wand2, GitBranch, Mic, CheckCircle2, AlertCircle } from 'lucide-react';
import VideoPipelineWizard from './wizard/VideoPipelineWizard';
import FlowEditor from './flow/FlowEditor';
import CloneVoice from './CloneVoice';

const LANGUAGES = [
  { value: 'Tiếng Việt', label: '🇻🇳 Tiếng Việt' },
  { value: 'English', label: '🇺🇸 English' },
  { value: 'ภาษาไทย', label: '🇹🇭 ภาษาไทย' },
  { value: '中文', label: '🇨🇳 中文' },
  { value: '日本語', label: '🇯🇵 日本語' },
  { value: '한국어', label: '🇰🇷 한국어' },
  { value: 'Bahasa Indonesia', label: '🇮🇩 Bahasa Indonesia' },
];

/**
 * AI Video Pipeline tab — top container.
 * Vertex AI auth is handled server-side by Vite middleware reading service-account JSON.
 * The frontend only checks /api/vertex-status to know whether config is in place.
 */
export default function VideoPipelineTab({ apiKey }) {
  const [mode, setMode] = useState('wizard');
  const [vertexStatus, setVertexStatus] = useState({ ready: null, projectId: null, region: null });
  const [language, setLanguage] = useState(
    () => localStorage.getItem('video_pipeline_language') || 'Tiếng Việt'
  );

  useEffect(() => {
    fetch('/api/vertex-status')
      .then(r => r.json())
      .then(setVertexStatus)
      .catch(() => setVertexStatus({ ready: false, projectId: null, region: null }));
  }, []);

  const handleLanguageChange = (e) => {
    const val = e.target.value;
    setLanguage(val);
    localStorage.setItem('video_pipeline_language', val);
  };

  const credentials = { geminiApiKey: apiKey };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setMode('wizard')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                mode === 'wizard' ? 'bg-pink-500 text-white shadow' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Wand2 size={14} /> Wizard
            </button>
            <button
              onClick={() => setMode('flow')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                mode === 'flow' ? 'bg-pink-500 text-white shadow' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <GitBranch size={14} /> Flow
            </button>
            <button
              onClick={() => setMode('clone')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                mode === 'clone' ? 'bg-cyan-500 text-white shadow' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Mic size={14} /> Clone Voice
            </button>
          </div>
          <select
            value={language}
            onChange={handleLanguageChange}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-pink-500"
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        <VertexBadge status={vertexStatus} />
      </div>

      {vertexStatus.ready === false && <NotConfiguredBanner />}

      <div className="flex-1 min-h-0 overflow-auto">
        {mode === 'wizard' && <VideoPipelineWizard credentials={credentials} language={language} />}
        {mode === 'flow'   && <FlowEditor credentials={credentials} language={language} />}
        {mode === 'clone'  && <CloneVoice />}
      </div>
    </div>
  );
}

function VertexBadge({ status }) {
  if (status.ready === null) {
    return <span className="text-xs text-muted-foreground">Checking Vertex...</span>;
  }
  if (status.ready) {
    return (
      <span className="text-xs text-green-600 flex items-center gap-1.5">
        <CheckCircle2 size={14} />
        Vertex AI: <code className="bg-muted px-1.5 py-0.5 rounded">{status.projectId}</code>
        <span className="text-muted-foreground">({status.region})</span>
      </span>
    );
  }
  return (
    <span className="text-xs text-amber-600 flex items-center gap-1.5">
      <AlertCircle size={14} />
      Vertex AI chưa cấu hình
    </span>
  );
}

function NotConfiguredBanner() {
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs flex-shrink-0">
      <strong className="text-amber-700">Vertex AI chưa sẵn sàng.</strong>
      <span className="text-muted-foreground"> Mở </span>
      <code className="bg-muted px-1.5 py-0.5 rounded">GCP_SETUP.md</code>
      <span className="text-muted-foreground"> ở thư mục gốc dự án để xem hướng dẫn (tạo service account, download key, đặt vào </span>
      <code className="bg-muted px-1.5 py-0.5 rounded">vertex-key.json</code>
      <span className="text-muted-foreground"> + cập nhật </span>
      <code className="bg-muted px-1.5 py-0.5 rounded">.env</code>
      <span className="text-muted-foreground">). Restart dev server sau khi xong.</span>
    </div>
  );
}
