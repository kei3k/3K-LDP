import { useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Upload, CheckCircle, Download, Loader2, Link as LinkIcon } from 'lucide-react';
import { useTemplates } from './TemplateLibrary.jsx';
import TemplateLibraryList from './TemplateLibrary.jsx';
import { importFromShopee } from '../../../lib/shopeeImport.js';

const DURATION_PRESETS = [16, 24, 32, 48, 60];

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Step2_InputAssets({ step1Template, value, onApprove }) {
  const { templates, deleteTemplate } = useTemplates();

  const [productImages, setProductImages] = useState(value?.productImages || []);
  const [characters, setCharacters] = useState(value?.characters || [{ gender: 'F', nationality: '', ageRange: '25-30', description: '' }]);
  const [selectedTemplate, setSelectedTemplate] = useState(value?.template || step1Template || null);
  const [duration, setDuration] = useState(value?.targetDuration || 24);
  const [customDuration, setCustomDuration] = useState('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [error, setError] = useState('');
  const [shopeeUrl, setShopeeUrl] = useState('');
  const [shopeeImporting, setShopeeImporting] = useState(false);
  const [shopeeProgress, setShopeeProgress] = useState('');
  const [shopeeProductName, setShopeeProductName] = useState('');
  const imgInputRef = useRef();

  const handleShopeeImport = useCallback(async () => {
    if (!shopeeUrl.trim()) { setError('Paste URL sản phẩm Shopee'); return; }
    setError('');
    setShopeeImporting(true);
    setShopeeProgress('');
    try {
      const { name, productImages: imgs } = await importFromShopee(shopeeUrl.trim(), {
        maxImages: 6,
        onProgress: setShopeeProgress,
      });
      setProductImages(prev => [...prev, ...imgs]);
      setShopeeProductName(name);
      setShopeeProgress(`✓ Đã import ${imgs.length} ảnh từ Shopee`);
    } catch (e) {
      setError(`Import Shopee thất bại: ${e.message}`);
      setShopeeProgress('');
    } finally {
      setShopeeImporting(false);
    }
  }, [shopeeUrl]);

  const handleImageFiles = useCallback(async (files) => {
    const newImgs = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const data = await blobToBase64(f);
      newImgs.push({ id: crypto.randomUUID(), name: f.name, mimeType: f.type, data, preview: URL.createObjectURL(f) });
    }
    setProductImages(prev => [...prev, ...newImgs]);
  }, []);

  const addCharacter = useCallback(() => {
    setCharacters(prev => [...prev, { gender: 'F', nationality: '', ageRange: '', description: '' }]);
  }, []);

  const updateCharacter = useCallback((idx, field, val) => {
    setCharacters(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  }, []);

  const removeCharacter = useCallback((idx) => {
    setCharacters(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleApprove = useCallback(() => {
    if (!productImages.length) { setError('Cần ít nhất 1 ảnh sản phẩm'); return; }
    if (!characters.length) { setError('Cần ít nhất 1 nhân vật'); return; }
    if (!selectedTemplate) { setError('Cần chọn template'); return; }
    const effectiveDuration = useCustomDuration ? (parseInt(customDuration) || 24) : duration;
    if (effectiveDuration <= 0) { setError('Duration phải > 0'); return; }
    setError('');
    onApprove({ productImages, characters, template: selectedTemplate, targetDuration: effectiveDuration });
  }, [productImages, characters, selectedTemplate, duration, useCustomDuration, customDuration, onApprove]);

  const allTemplates = step1Template
    ? [step1Template, ...templates.filter(t => t.id !== step1Template.id)]
    : templates;

  return (
    <div className="flex flex-col gap-5">
      {/* Template selection — top so user picks first */}
      <section className="rounded-xl border-2 border-pink-500/40 bg-pink-500/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            📋 Chọn template <span className="text-[10px] font-normal text-muted-foreground">({allTemplates.length} có sẵn)</span>
          </h3>
          {selectedTemplate && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-500 text-white font-bold">
              ✓ Đã chọn: {selectedTemplate.name}
            </span>
          )}
        </div>

        {allTemplates.length === 0 ? (
          <div className="text-xs text-muted-foreground italic px-2 py-3 text-center bg-muted/20 rounded-lg">
            Chưa có template. Quay lại <strong>Bước 1</strong> phân tích 1 video mẫu + bấm <strong>"Lưu vào thư viện"</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
            {allTemplates.map(t => {
              const isStep1 = step1Template?.id === t.id;
              const selected = selectedTemplate?.id === t.id;
              const sceneCount = t.structure?.scenes?.length || 0;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className={`group relative rounded-lg p-2.5 cursor-pointer text-xs transition-all border-2 ${
                    selected
                      ? 'bg-pink-500/20 border-pink-500 shadow-md shadow-pink-500/20'
                      : 'bg-muted/30 border-border hover:border-pink-500/50 hover:bg-muted/50'
                  }`}
                  title={t.transcript ? t.transcript.substring(0, 200) : ''}
                >
                  {isStep1 && (
                    <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-bold">
                      MỚI
                    </span>
                  )}
                  <div className="font-bold text-foreground truncate pr-5">{t.name || 'Không tên'}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    {t.totalDuration && <span>⏱ {t.totalDuration}s</span>}
                    {sceneCount > 0 && <span>🎬 {sceneCount} cảnh</span>}
                  </div>
                  {t.transcript && (
                    <div className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                      {t.transcript.substring(0, 80)}{t.transcript.length > 80 ? '…' : ''}
                    </div>
                  )}
                  {!isStep1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Xoá template "${t.name}"?`)) {
                          deleteTemplate(t.id);
                          if (selected) setSelectedTemplate(null);
                        }
                      }}
                      className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Product images */}
      <section>
        <h3 className="text-sm font-bold mb-2">Ảnh sản phẩm</h3>

        {/* Shopee URL import */}
        <div className="mb-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/30">
          <label className="text-[11px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <LinkIcon size={12} /> Import từ Shopee
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={shopeeUrl}
              onChange={e => setShopeeUrl(e.target.value)}
              placeholder="https://shopee.vn/...-i.SHOPID.ITEMID"
              disabled={shopeeImporting}
              className="flex-1 px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              onClick={handleShopeeImport}
              disabled={shopeeImporting || !shopeeUrl.trim()}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors"
            >
              {shopeeImporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Lấy ảnh + info
            </button>
          </div>
          {shopeeProgress && (
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
              {shopeeImporting && <Loader2 size={11} className="animate-spin" />}
              {shopeeProgress}
            </div>
          )}
          {shopeeProductName && (
            <div className="mt-2 text-[11px] text-orange-300">
              <span className="text-muted-foreground">Sản phẩm: </span>
              <span className="font-medium">{shopeeProductName}</span>
            </div>
          )}
        </div>

        <div
          onClick={() => imgInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleImageFiles(e.dataTransfer.files); }}
          className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-pink-500/60 transition-colors mb-3"
        >
          <Upload size={20} className="mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Kéo thả hoặc click để upload ảnh sản phẩm</p>
          <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageFiles(e.target.files)} />
        </div>
        {productImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {productImages.map(img => (
              <div key={img.id} className="relative group">
                <img src={img.preview} alt={img.name} className="w-16 h-16 object-cover rounded-lg border border-border" />
                <button
                  onClick={() => setProductImages(prev => prev.filter(x => x.id !== img.id))}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Characters */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold">Nhân vật</h3>
          <button onClick={addCharacter} className="text-xs flex items-center gap-1 text-pink-500 hover:text-pink-400">
            <Plus size={13} /> Thêm nhân vật
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {characters.map((ch, idx) => (
            <div key={idx} className="bg-muted/30 rounded-xl p-3 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground">Nhân vật {idx + 1}</span>
                {characters.length > 1 && (
                  <button onClick={() => removeCharacter(idx)} className="text-muted-foreground hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Giới tính</span>
                  <select value={ch.gender} onChange={e => updateCharacter(idx, 'gender', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg mt-1">
                    <option value="F">Nữ</option>
                    <option value="M">Nam</option>
                    <option value="Other">Khác</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Quốc tịch</span>
                  <input type="text" value={ch.nationality} onChange={e => updateCharacter(idx, 'nationality', e.target.value)}
                    placeholder="VN, Korean..." className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg mt-1 focus:outline-none focus:ring-1 focus:ring-pink-500" />
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Độ tuổi</span>
                  <input type="text" value={ch.ageRange} onChange={e => updateCharacter(idx, 'ageRange', e.target.value)}
                    placeholder="25-30" className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg mt-1 focus:outline-none focus:ring-1 focus:ring-pink-500" />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Mô tả thêm</span>
                <textarea value={ch.description} onChange={e => updateCharacter(idx, 'description', e.target.value)}
                  rows={2} placeholder="Phong cách, đặc điểm nổi bật..."
                  className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg mt-1 resize-none focus:outline-none focus:ring-1 focus:ring-pink-500" />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Duration */}
      <section>
        <h3 className="text-sm font-bold mb-2">Thời lượng video</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {DURATION_PRESETS.map(d => (
            <button key={d}
              onClick={() => { setDuration(d); setUseCustomDuration(false); }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${!useCustomDuration && duration === d ? 'bg-pink-500 border-pink-500 text-white' : 'border-border hover:bg-muted'}`}
            >
              {d}s
            </button>
          ))}
          <button
            onClick={() => setUseCustomDuration(true)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${useCustomDuration ? 'bg-pink-500 border-pink-500 text-white' : 'border-border hover:bg-muted'}`}
          >
            Tùy chỉnh
          </button>
        </div>
        {useCustomDuration && (
          <input type="number" value={customDuration} onChange={e => setCustomDuration(e.target.value)}
            min="8" max="300" placeholder="Nhập số giây..."
            className="w-32 px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-500" />
        )}
      </section>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

      <button onClick={handleApprove} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm rounded-lg flex items-center gap-2 self-start transition-colors">
        <CheckCircle size={14} /> Approve & Tiếp tục
      </button>
    </div>
  );
}
