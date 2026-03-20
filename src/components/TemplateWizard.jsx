/**
 * TemplateWizard — 4-step wizard for template PKE replacement
 * 
 * Step 0: Extract → Decode PKE + fetch 1688 data
 * Step 1: Images → Re-host images, preview replacements
 * Step 2: Text → AI text replacement, editable
 * Step 3: Export → Download final PKE
 */
import { useState, useCallback } from 'react';

export default function TemplateWizard({
  step,
  productData,        // extracted product data from 1688
  templateInfo,       // decoded PKE info
  pkeData,            // full decoded PKE data for preview rendering
  imageReplacements,  // [{blockName, oldSrc, newSrc, width, height}]
  textReplacements,   // [{index, type, oldText, newText}]
  isLoading,
  progress,
  error,
  onUpdateProduct,    // edit product data
  onProceedImages,    // start image replacement
  onProceedText,      // start text replacement
  onUpdateTextItem,   // edit individual text
  onUpdateImage,      // update individual image replacement
  onExport,           // encode + download PKE
}) {
  const steps = [
    { label: '📦 Trích xuất', desc: 'Đọc template + lấy data 1688' },
    { label: '🖼️ Ảnh', desc: 'Re-host và thay ảnh sản phẩm' },
    { label: '📝 Text', desc: 'Dịch và thay nội dung' },
    { label: '👁️ Preview', desc: 'Xem lại toàn bộ thay đổi' },
    { label: '💾 Xuất', desc: 'Tải file PKE mới' },
  ];

  const [previewReady, setPreviewReady] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
      {/* Step indicator */}
      <div className="flex gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={i} className={`flex-1 rounded-xl p-3 text-center text-xs transition-all ${
            i === step
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
              : i < step
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}>
            <div className="font-bold">{s.label}</div>
            <div className="opacity-70 text-[10px] mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {(isLoading || progress) && (
        <div className="mb-4 p-3 rounded-xl bg-card border border-border">
          {isLoading && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
              <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: '70%' }} />
            </div>
          )}
          {progress && <p className="text-sm text-primary">{progress}</p>}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Step 0: Extract */}
      {step === 0 && (
        <Step0Extract
          templateInfo={templateInfo}
          productData={productData}
          onUpdateProduct={onUpdateProduct}
          onProceed={onProceedImages}
          isLoading={isLoading}
        />
      )}

      {/* Step 1: Images */}
      {step === 1 && (
        <Step1Images
          imageReplacements={imageReplacements}
          isLoading={isLoading}
          onProceed={onProceedText}
          onUpdateImage={onUpdateImage}
        />
      )}

      {/* Step 2: Text */}
      {step === 2 && (
        <Step2Text
          textReplacements={textReplacements}
          isLoading={isLoading}
          onUpdateItem={onUpdateTextItem}
          onProceed={() => setPreviewReady(true)}
        />
      )}

      {/* Step 3: Preview — full page render */}
      {(step === 2 && previewReady) || step === 3 ? (
        <Step3Preview
          pkeData={pkeData}
          onExport={onExport}
        />
      ) : null}

      {/* Step 4: Export */}
      {step === 4 && (
        <Step4Export />
      )}
    </div>
  );
}

function Step0Extract({ templateInfo, productData, onUpdateProduct, onProceed, isLoading }) {
  return (
    <div className="space-y-4">
      {/* Template info */}
      {templateInfo && (
        <div className="p-4 rounded-xl bg-card border border-border">
          <h3 className="font-bold text-sm mb-2 text-primary">📦 Template đã đọc</h3>
          <p className="text-xs text-muted-foreground">Tên: <span className="text-foreground">{templateInfo.name}</span></p>
          <p className="text-xs text-muted-foreground">Blocks: <span className="text-foreground">{templateInfo.totalBlocks}</span></p>
          <p className="text-xs text-muted-foreground">Ảnh lớn: <span className="text-foreground">{templateInfo.largeImages}</span></p>
          <p className="text-xs text-muted-foreground">Text blocks: <span className="text-foreground">{templateInfo.textBlocks}</span></p>
        </div>
      )}

      {/* Product data */}
      {productData && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <h3 className="font-bold text-sm mb-2 text-primary">🏷️ Sản phẩm mới (chỉnh sửa nếu cần)</h3>
          
          <div>
            <label className="text-xs text-muted-foreground">Tên sản phẩm</label>
            <input
              type="text"
              value={productData.name || ''}
              onChange={(e) => onUpdateProduct({ ...productData, name: e.target.value })}
              className="form-input mt-1 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Mô tả</label>
            <textarea
              value={productData.description || ''}
              onChange={(e) => onUpdateProduct({ ...productData, description: e.target.value })}
              rows={3}
              className="form-input mt-1 text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Giá mới</label>
              <input
                type="text"
                value={productData.price || ''}
                onChange={(e) => onUpdateProduct({ ...productData, price: e.target.value })}
                className="form-input mt-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Giá gốc</label>
              <input
                type="text"
                value={productData.originalPrice || ''}
                onChange={(e) => onUpdateProduct({ ...productData, originalPrice: e.target.value })}
                className="form-input mt-1 text-sm"
              />
            </div>
          </div>

          {productData.images?.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">Ảnh sản phẩm ({productData.images.length})</label>
              <div className="flex gap-2 mt-1 overflow-x-auto pb-2">
                {productData.images.slice(0, 5).map((img, i) => (
                  <img
                    key={i}
                    src={img.includes('alicdn.com') ? `/api/fetch-url?url=${encodeURIComponent(img)}` : img}
                    className="w-16 h-16 object-cover rounded-lg border border-border flex-shrink-0"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proceed button */}
      {productData && !isLoading && (
        <button
          onClick={onProceed}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          🖼️ Bước tiếp: Thay ảnh sản phẩm →
        </button>
      )}
    </div>
  );
}

function Step1Images({ imageReplacements, isLoading, onProceed, onUpdateImage }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useCallback((node) => { if (node) node._ref = node; }, []);

  const handleFileSelect = (idx, file) => {
    const url = URL.createObjectURL(file);
    // Also upload to ImgBB in background
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const KEYS = ['02f64b3be9d269a7a8a41f3778dadc00','b69da15baaeef837d4a3a389d9d93057','99c7dcfd7b3f726700a39ae75032c773'];
      const fd = new FormData();
      fd.append('key', KEYS[Math.floor(Math.random() * KEYS.length)]);
      fd.append('image', base64);
      try {
        const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
          onUpdateImage?.(idx, data.data.url);
          return;
        }
      } catch {}
      // Fallback to blob URL
      onUpdateImage?.(idx, url);
    };
    reader.readAsDataURL(file);
    setEditingIdx(null);
  };

  const handleUrlSubmit = (idx) => {
    if (!urlInput.trim()) return;
    onUpdateImage?.(idx, urlInput.trim());
    setUrlInput('');
    setEditingIdx(null);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-card border border-border">
        <h3 className="font-bold text-sm mb-1 text-primary">🖼️ Thay thế ảnh ({imageReplacements?.length || 0} ảnh)</h3>
        <p className="text-[10px] text-muted-foreground mb-3">💡 Bấm vào ảnh mới (ảnh xanh) để thay bằng ảnh đã dịch hoặc ảnh khác</p>
        
        {imageReplacements?.length > 0 ? (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {imageReplacements.map((item, i) => (
              <div key={i} className="rounded-lg bg-muted/30 overflow-hidden">
                <div className="flex items-center gap-2 p-2">
                  {/* Old image */}
                  <div className="flex-shrink-0 text-center">
                    <img
                      src={item.oldSrc}
                      className="w-14 h-14 object-cover rounded border border-border opacity-50"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                    <div className="text-[8px] text-muted-foreground mt-0.5">Cũ</div>
                  </div>
                  <div className="text-sm text-muted-foreground">→</div>
                  {/* New image — clickable */}
                  <div className="flex-shrink-0 text-center cursor-pointer group" onClick={() => setEditingIdx(editingIdx === i ? null : i)}>
                    <img
                      src={item.newSrc}
                      className="w-14 h-14 object-cover rounded border-2 border-primary group-hover:border-violet-400 transition-colors"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                    <div className="text-[8px] text-primary mt-0.5">📷 Bấm đổi</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">{item.blockName}</p>
                    <p className="text-[9px] text-muted-foreground">{item.blockType} • {item.width}x{item.height}</p>
                  </div>
                </div>
                {/* Inline editor */}
                {editingIdx === i && (
                  <div className="p-2 pt-0 space-y-1.5 border-t border-border/30">
                    <div className="flex gap-1">
                      <input
                        type="url"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder="Dán URL ảnh (ảnh đã dịch từ ImgBB...)"
                        className="form-input flex-1 text-[10px] py-1"
                        onKeyDown={e => e.key === 'Enter' && handleUrlSubmit(i)}
                      />
                      <button onClick={() => handleUrlSubmit(i)} disabled={!urlInput.trim()}
                        className="px-2 py-1 bg-primary/10 text-primary rounded text-[10px] hover:bg-primary/20 disabled:opacity-30">
                        ✔️
                      </button>
                    </div>
                    <label className="flex items-center gap-1 px-2 py-1 bg-violet-500/10 text-violet-400 rounded text-[10px] cursor-pointer hover:bg-violet-500/20 justify-center">
                      📁 Hoặc chọn file ảnh
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files[0] && handleFileSelect(i, e.target.files[0])} />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Đang xử lý...</p>
        )}
      </div>

      {!isLoading && imageReplacements?.length > 0 && (
        <button
          onClick={onProceed}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          📝 Bước tiếp: Dịch và thay text →
        </button>
      )}
    </div>
  );
}

function Step2Text({ textReplacements, isLoading, onUpdateItem, onProceed }) {
  const [filter, setFilter] = useState('all');
  
  const filtered = textReplacements?.filter(t => {
    if (filter === 'all') return true;
    return t.type === filter;
  }) || [];

  // Check if we have any dual translations (viRef differs from newText)
  const hasDualTranslation = textReplacements?.some(t => t.viRef && t.viRef !== t.newText);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-card border border-border">
        <h3 className="font-bold text-sm mb-3 text-primary">📝 Thay thế text ({textReplacements?.length || 0} đoạn)</h3>
        
        {hasDualTranslation && (
          <div className="mb-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            💡 <b>Tiếng Việt (đối chiếu)</b> hiện bên dưới mỗi đoạn để anh đọc hiểu nội dung. Chỉnh sửa ô <b>ngôn ngữ đích</b> nếu cần, đây là text sẽ xuất ra PKE.
          </div>
        )}
        
        {/* Filter tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {['all', 'text', 'button', 'placeholder'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-xs ${
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {f === 'all' ? `Tất cả (${textReplacements?.length || 0})` : f}
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {filtered.map((item, i) => (
              <div key={item.index} className="p-2 rounded-lg bg-muted/30 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    item.type === 'text' ? 'bg-blue-500/20 text-blue-400' :
                    item.type === 'button' ? 'bg-green-500/20 text-green-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>{item.type}</span>
                  <span className="text-[10px] text-muted-foreground">#{item.index}</span>
                </div>
                
                {/* Old text */}
                <div className="text-xs text-muted-foreground line-through">{item.oldText?.substring(0, 80)}</div>
                
                {/* Vietnamese reference (only when different from target) */}
                {item.viRef && item.viRef !== item.newText && (
                  <div className="text-xs text-emerald-400/80 bg-emerald-500/5 px-2 py-1 rounded border-l-2 border-emerald-500/30">
                    🇻🇳 {item.viRef}
                  </div>
                )}
                
                {/* Editable target language text */}
                <textarea
                  value={item.newText || ''}
                  onChange={(e) => onUpdateItem(item.index, e.target.value)}
                  rows={2}
                  className="form-input text-xs resize-none w-full"
                  placeholder="Text xuất ra PKE"
                />
              </div>
            ))}
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">⏳ Đang gọi Gemini dịch text...</p>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có text replacement</p>
        )}
      </div>

      {!isLoading && textReplacements?.length > 0 && (
        <button
          onClick={onProceed}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          👁️ Preview trước khi xuất →
        </button>
      )}
    </div>
  );
}

function buildPreviewHtml(pkeData) {
  if (!pkeData?.source?.page) return '<p>No data</p>';
  const sections = pkeData.source.page;
  const W = 420; // mobile width
  let html = '';

  // Get mobile style (fallback to desktop)
  function ms(block, prop) {
    return block.responsive?.mobile?.styles?.[prop] ?? block.responsive?.desktop?.styles?.[prop];
  }

  function renderBlock(block, isChild) {
    const type = block.type || '';
    const top = ms(block, 'top');
    const left = ms(block, 'left');
    const w = ms(block, 'width');
    const h = ms(block, 'height');
    const bg = ms(block, 'background') || '';
    const borderRadius = ms(block, 'borderRadius') || 0;
    const opacity = ms(block, 'opacity') ?? 1;
    
    // Position style for absolutely positioned blocks
    let posStyle = 'position:absolute;';
    if (typeof top === 'number') posStyle += `top:${top}px;`;
    if (typeof left === 'number') posStyle += `left:${left}px;`;
    if (typeof w === 'number') posStyle += `width:${w}px;`;
    if (typeof h === 'number') posStyle += `height:${h}px;`;
    if (borderRadius) posStyle += `border-radius:${borderRadius}px;`;
    if (opacity < 1) posStyle += `opacity:${opacity};`;
    if (bg && !bg.includes('url(')) posStyle += `background:${bg};`;

    // IMAGE BLOCK
    if (type === 'image-block' && block.specials?.src) {
      const imgW = typeof w === 'number' ? w : 420;
      return `<img src="${block.specials.src}" style="${posStyle}object-fit:cover;max-width:100%;" />`;
    }
    
    // RECTANGLE with image
    if (type === 'rectangle' && block.specials?.src) {
      return `<img src="${block.specials.src}" style="${posStyle}object-fit:cover;" />`;
    }
    
    // RECTANGLE without image (just bg shape)
    if (type === 'rectangle' && !block.specials?.src) {
      if (bg) return `<div style="${posStyle}"></div>`;
      return '';
    }

    // GALLERY / CAROUSEL
    if (type === 'gallery' && block.specials?.media) {
      const slides = block.specials.media.filter(m => m.type === 'image');
      if (slides.length === 0) return '';
      const id = 'g' + Math.random().toString(36).substr(2, 6);
      const gW = typeof w === 'number' ? w : W;
      const gH = typeof h === 'number' ? h : gW;
      let g = `<div style="${posStyle}overflow:hidden;">`;
      // Main slide area
      slides.forEach((s, si) => {
        const src = s.originLink || s.link || '';
        g += `<img class="${id}-s" src="${src}" style="width:100%;height:${gH - 60}px;object-fit:cover;display:${si === 0 ? 'block' : 'none'};" />`;
      });
      // Thumbnail strip
      g += `<div style="display:flex;gap:3px;padding:4px;height:56px;align-items:center;background:rgba(255,255,255,0.9);">`;
      slides.forEach((s, si) => {
        const src = s.originLink || s.link || '';
        g += `<img onclick="document.querySelectorAll('.${id}-s').forEach((e,j)=>e.style.display=j===${si}?'block':'none');this.parentNode.querySelectorAll('img').forEach((e,j)=>e.style.border=j===${si}?'2px solid #f60':'1px solid #ddd')" src="${src}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;cursor:pointer;border:${si === 0 ? '2px solid #f60' : '1px solid #ddd'};flex-shrink:0;" />`;
      });
      g += `</div></div>`;
      return g;
    }

    // TEXT BLOCK
    if (type === 'text-block' && block.specials?.text) {
      const fontSize = ms(block, 'fontSize') || 13;
      const color = ms(block, 'color') || '#333';
      const fontWeight = ms(block, 'fontWeight') || 'normal';
      const textAlign = ms(block, 'textAlign') || 'left';
      return `<div style="${posStyle}font-size:${fontSize}px;line-height:1.4;color:${color};font-weight:${fontWeight};text-align:${textAlign};overflow:hidden;">${block.specials.text}</div>`;
    }

    // BUTTON
    if (type === 'button' && block.specials?.text) {
      const btnBg = bg || '#e65100';
      const color = ms(block, 'color') || '#fff';
      return `<div style="${posStyle}background:${btnBg};color:${color};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;cursor:pointer;">${block.specials.text}</div>`;
    }

    // COUNTDOWN (placeholder)
    if (type === 'countdown') {
      return `<div style="${posStyle}background:#222;color:#ff0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border-radius:4px;">00:00:00</div>`;
    }

    // GROUP — positioned container with children
    if (type === 'group' && block.children?.length > 0) {
      let inner = block.children.map(c => renderBlock(c, true)).join('');
      return `<div style="${posStyle}overflow:hidden;">${inner}</div>`;
    }

    // SECTION — skip (handled at top level)
    // LINE — decorative
    if (type === 'line') {
      return `<div style="${posStyle}border-top:1px solid #ddd;"></div>`;
    }

    return '';
  }

  sections.forEach(sec => {
    const pos = ms(sec, 'position') || '';
    if (pos === 'sticky' || pos === 'fixed') return; // skip footer/sticky bars in preview
    
    const secH = sec.responsive?.mobile?.styles?.height || sec.responsive?.desktop?.styles?.height || 400;
    const secBg = ms(sec, 'background') || '#fff';
    
    let content = (sec.children || []).map(b => renderBlock(b, false)).join('');
    html += `<div style="position:relative;width:${W}px;height:${secH}px;background:${secBg};overflow:hidden;">${content}</div>`;
  });

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f0f0;width:${W}px;margin:0 auto;}img{display:block;}</style></head><body>${html}</body></html>`;
}

function Step3Preview({ pkeData, onExport }) {
  const [showPreview, setShowPreview] = useState(false);
  const previewHtml = pkeData ? buildPreviewHtml(pkeData) : '';

  return (
    <div className="space-y-4 mt-4">
      {/* Open preview button */}
      <button
        onClick={() => setShowPreview(true)}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
      >
        👁️ Mở Preview toàn trang
      </button>

      {/* Full-screen overlay preview */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border flex-shrink-0">
            <h3 className="font-bold text-sm text-primary">👁️ Preview Landing Page (Mobile 420px)</h3>
            <button onClick={() => setShowPreview(false)}
              className="px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/20">
              ✖ Đóng
            </button>
          </div>
          {/* Preview iframe - centered */}
          <div className="flex-1 flex justify-center overflow-auto p-4">
            <div style={{ width: 420, flexShrink: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 48px rgba(0,0,0,0.5)', border: '2px solid #444', background: '#f5f5f5' }}>
              <iframe
                srcDoc={previewHtml}
                title="Preview"
                style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        </div>
      )}

      {/* Export button */}
      <button
        onClick={onExport}
        className="w-full py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-green-500 to-emerald-400 text-white shadow-lg shadow-green-500/25 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
      >
        💾 Xuất file PKE mới
      </button>
    </div>
  );
}

function Step4Export() {
  return (
    <div className="p-6 rounded-xl bg-card border border-border text-center">
      <div className="text-4xl mb-4">✅</div>
      <h3 className="font-bold text-lg text-primary mb-2">Hoàn tất!</h3>
      <p className="text-sm text-muted-foreground">
        File PKE mới đã được tải về. Import vào Webcake để xem kết quả.
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        Tất cả element vẫn editable trong Webcake.
      </p>
    </div>
  );
}
