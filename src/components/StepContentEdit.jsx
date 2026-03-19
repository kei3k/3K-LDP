import { useState, useRef, useMemo } from 'react';
import { FileText, Search, CheckCircle2, Eye, RefreshCw } from 'lucide-react';

/**
 * Step 2: Content Adjustment — replace old product content with new product info in Vietnamese
 * Shows editable table: Original text | New Vietnamese content
 */
export default function StepContentEdit({
  contentItems,
  onUpdateItem,
  onApply,
  onPrev,
  onRetry,
  previewHtml,
  isProcessing,
  progress,
  error,
  currentModel,
  onModelChange,
  targetLang,
}) {
  const hasViRef = targetLang && !targetLang.toLowerCase().includes('việt');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef(null);

  const MODELS = [
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];

  // Preview HTML with current content applied
  const previewBlobUrl = useMemo(() => {
    if (!showPreview || !previewHtml) return null;
    const blob = new Blob([previewHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [showPreview, previewHtml]);

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{progress || 'Đang xử lý nội dung...'}</p>
        </div>
      </div>
    );
  }

  if (error || (!contentItems || contentItems.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md space-y-3">
          <div className="text-3xl">⚠️</div>
          <p className="text-sm text-destructive font-medium">
            {error || 'Không tìm thấy nội dung để điều chỉnh'}
          </p>
          <div className="flex items-center gap-2 justify-center">
            <select
              value={currentModel || ''}
              onChange={e => onModelChange?.(e.target.value)}
              className="px-3 py-2 text-xs bg-card border border-border rounded-lg outline-none"
            >
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button
              onClick={onRetry}
              className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              🔄 Thử lại
            </button>
          </div>
          <button
            onClick={onPrev}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            ← Quay lại Layout
          </button>
        </div>
      </div>
    );
  }

  const filtered = contentItems.filter(t => {
    if (filter === 'changed' && !t.isChanged) return false;
    if (filter === 'unchanged' && t.isChanged) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.clean.toLowerCase().includes(s) || t.newContent.toLowerCase().includes(s);
    }
    return true;
  });

  const changedCount = contentItems.filter(t => t.isChanged).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="w-5 h-5" />
            <h2 className="text-sm font-bold">Bước 2: Điều chỉnh nội dung</h2>
            <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
              {targetLang || 'Tiếng Việt'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onPrev}
              className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
            >
              ← Quay lại
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                showPreview ? 'border-primary text-primary bg-primary/10' : 'border-border hover:bg-muted'
              }`}
            >
              <Eye className="w-3 h-3 inline mr-1" /> Preview
            </button>
            <button
              onClick={onApply}
              className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              ✅ Áp dụng & Hoàn thành
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="mb-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11px] text-blue-300">
          💡 Gemini đã thay nội dung sản phẩm cũ bằng sản phẩm mới ({targetLang || 'Tiếng Việt'}).
          {hasViRef && ' Cột Tiếng Việt là bản tham khảo cho nhân viên.'}
          {' '}Nhân viên có thể sửa trực tiếp bên dưới.
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm nội dung..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex text-xs gap-1">
            {[
              { key: 'all', label: `Tất cả (${contentItems.length})` },
              { key: 'changed', label: `Đã thay (${changedCount})` },
              { key: 'unchanged', label: `Giữ nguyên (${contentItems.length - changedCount})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2 py-1 rounded transition-colors ${
                  filter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex min-h-0">
        {/* Content table */}
        <div className={`${showPreview ? 'w-1/2 border-r border-border' : 'w-full'} overflow-auto`}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8">#</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nội dung gốc</th>
                <th className="text-left px-3 py-2 font-medium text-green-400">Nội dung mới ({targetLang || 'Tiếng Việt'})</th>
                {hasViRef && <th className="text-left px-3 py-2 font-medium text-blue-400">🇻🇳 Tham khảo (Việt)</th>}
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-12">✓</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr
                  key={i}
                  className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                    t.isChanged ? '' : 'opacity-60'
                  }`}
                >
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 break-all text-muted-foreground">
                    <span className="text-[11px]">{t.clean}</span>
                  </td>
                  <td className="px-3 py-1">
                    <input
                      value={t.newContent}
                      onChange={e => {
                        onUpdateItem(contentItems.indexOf(t), e.target.value);
                      }}
                      className={`w-full px-2 py-1.5 rounded border text-[11px] outline-none transition-colors ${
                        t.isChanged
                          ? 'border-green-500/30 bg-green-500/5 focus:ring-1 focus:ring-green-500'
                          : 'border-border bg-card focus:ring-1 focus:ring-primary'
                      }`}
                    />
                  </td>
                  {hasViRef && (
                    <td className="px-3 py-2 text-[11px] text-blue-300/80">
                      {t.vietnamese || <span className="text-muted-foreground/50">—</span>}
                    </td>
                  )}
                  <td className="px-3 py-2 text-center">
                    {t.isChanged && <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Preview panel */}
        {showPreview && (
          <div className="w-1/2 bg-gray-100 dark:bg-gray-900">
            {previewBlobUrl ? (
              <iframe
                key={previewBlobUrl}
                src={previewBlobUrl}
                title="Content Preview"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Nhấn "Preview" để xem
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
