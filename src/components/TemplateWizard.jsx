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
  imageReplacements,  // [{blockName, oldSrc, newSrc, width, height}]
  textReplacements,   // [{index, type, oldText, newText}]
  isLoading,
  progress,
  error,
  onUpdateProduct,    // edit product data
  onProceedImages,    // start image replacement
  onProceedText,      // start text replacement
  onUpdateTextItem,   // edit individual text
  onExport,           // encode + download PKE
}) {
  const steps = [
    { label: '📦 Trích xuất', desc: 'Đọc template + lấy data 1688' },
    { label: '🖼️ Ảnh', desc: 'Re-host và thay ảnh sản phẩm' },
    { label: '📝 Text', desc: 'Dịch và thay nội dung' },
    { label: '💾 Xuất', desc: 'Tạo file PKE mới' },
  ];

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
        />
      )}

      {/* Step 2: Text */}
      {step === 2 && (
        <Step2Text
          textReplacements={textReplacements}
          isLoading={isLoading}
          onUpdateItem={onUpdateTextItem}
          onProceed={onExport}
        />
      )}

      {/* Step 3: Export */}
      {step === 3 && (
        <Step3Export />
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

function Step1Images({ imageReplacements, isLoading, onProceed }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-card border border-border">
        <h3 className="font-bold text-sm mb-3 text-primary">🖼️ Thay thế ảnh ({imageReplacements?.length || 0} ảnh)</h3>
        
        {imageReplacements?.length > 0 ? (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {imageReplacements.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <div className="flex-shrink-0 text-center">
                  <img
                    src={item.oldSrc}
                    className="w-12 h-12 object-cover rounded border border-border"
                    onError={(e) => e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="16" font-size="12">❌</text></svg>'}
                  />
                  <div className="text-[9px] text-muted-foreground mt-0.5">{item.width}x{item.height}</div>
                </div>
                <div className="text-lg">→</div>
                <div className="flex-shrink-0 text-center">
                  <img
                    src={item.newSrc}
                    className="w-12 h-12 object-cover rounded border-2 border-primary"
                    onError={(e) => e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="16" font-size="12">⏳</text></svg>'}
                  />
                  <div className="text-[9px] text-primary mt-0.5">New</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{item.blockName}</p>
                </div>
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
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-green-500 to-emerald-400 text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          💾 Xuất file PKE mới →
        </button>
      )}
    </div>
  );
}

function Step3Export() {
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
