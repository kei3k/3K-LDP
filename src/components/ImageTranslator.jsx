/**
 * ImageTranslator — Translate text in product images using Gemini
 * 
 * Flow:
 * 1. Upload/add images (drag & drop or paste URLs)
 * 2. Select target language
 * 3. Click translate → Gemini edits each image with translated text
 * 4. Preview & download translated images
 */
import { useState, useCallback, useRef } from 'react';
import { Upload, Globe, Loader2, Download, Trash2, Plus, Languages, ImageIcon, RotateCcw } from 'lucide-react';

export default function ImageTranslator({ apiKey, model }) {
  const [images, setImages] = useState([]); // [{id, file, preview, status, result}]
  const [targetLang, setTargetLang] = useState('ภาษาไทย');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-image-preview');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');

  const imageModels = [
    { value: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Preview Image (Nano Banana)' },
    { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image (Nano Banana 2)' },
    { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (Nano Banana Pro)' },
  ];
  const fileInputRef = useRef(null);

  const languages = [
    { value: 'ภาษาไทย', label: '🇹🇭 ภาษาไทย (Thai)' },
    { value: 'Tiếng Việt', label: '🇻🇳 Tiếng Việt' },
    { value: 'English', label: '🇺🇸 English' },
    { value: '中文', label: '🇨🇳 中文 (Chinese)' },
    { value: '日本語', label: '🇯🇵 日本語 (Japanese)' },
    { value: '한국어', label: '🇰🇷 한국어 (Korean)' },
    { value: 'Bahasa Indonesia', label: '🇮🇩 Bahasa Indonesia' },
    { value: 'Bahasa Melayu', label: '🇲🇾 Bahasa Melayu' },
  ];

  // Add images from file input
  const handleFileAdd = useCallback((files) => {
    const newImages = Array.from(files).map(file => ({
      id: Date.now() + Math.random(),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending', // pending, processing, done, error
      result: null,
      error: null,
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  // Add image from URL
  const [urlInput, setUrlInput] = useState('');
  const handleUrlAdd = useCallback(async () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    setUrlInput('');
    
    // For alicdn URLs, use proxy
    const needsProxy = url.includes('alicdn.com') || url.includes('1688.com') || url.includes('cbu0');
    const fetchUrl = needsProxy ? `/api/fetch-url?url=${encodeURIComponent(url)}` : url;
    
    try {
      const resp = await fetch(fetchUrl);
      const blob = await resp.blob();
      const file = new File([blob], `image-${Date.now()}.jpg`, { type: blob.type });
      handleFileAdd([file]);
    } catch (err) {
      alert('Không tải được ảnh: ' + err.message);
    }
  }, [urlInput, handleFileAdd]);

  // Remove image
  const removeImage = useCallback((id) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  // Convert File to base64
  const fileToBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });

  // Call Gemini image editing API
  const translateImage = async (base64, mimeType, modelId) => {
    const geminiModel = modelId;
    
    const prompt = `You are an expert image editor. Translate ALL text visible in this image to ${targetLang}. 

RULES:
1. KEEP the exact same design, layout, colors, fonts style, and visual elements
2. ONLY change the text — translate every piece of text to ${targetLang}
3. Maintain text positioning, size, and alignment
4. If there are product names, translate them naturally
5. Keep numbers, measurements, and model numbers as-is
6. Make the translated text look natural and professional
7. Preserve all non-text elements (images, icons, decorations, product photos)

Output the edited image with all text translated to ${targetLang}.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } }
            ]
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 0.4,
          }
        })
      }
    );

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(`Gemini API error ${resp.status}: ${errData.error?.message || resp.statusText}`);
    }

    const data = await resp.json();
    
    // Extract image from response
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error('No response from Gemini');
    
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
        };
      }
    }
    
    throw new Error('No image in Gemini response');
  };

  // Process all images
  const handleTranslateAll = useCallback(async () => {
    if (!apiKey) {
      alert('Vui lòng nhập Gemini API Key trong phần Cài đặt API!');
      return;
    }
    const pending = images.filter(img => img.status === 'pending' || img.status === 'error');
    if (pending.length === 0) return;

    setIsProcessing(true);

    for (let i = 0; i < pending.length; i++) {
      const img = pending[i];
      setProgress(`🌐 Đang dịch ảnh ${i + 1}/${pending.length}...`);
      
      // Update status
      setImages(prev => prev.map(im => 
        im.id === img.id ? { ...im, status: 'processing' } : im
      ));

      try {
        const base64 = await fileToBase64(img.file);
        const mimeType = img.file.type || 'image/jpeg';
        const result = await translateImage(base64, mimeType, selectedModel);
        
        // Create blob URL for preview
        const binaryStr = atob(result.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
        const blob = new Blob([bytes], { type: result.mimeType });
        const resultUrl = URL.createObjectURL(blob);

        setImages(prev => prev.map(im => 
          im.id === img.id ? { ...im, status: 'done', result: resultUrl, resultBase64: result.base64, resultMime: result.mimeType } : im
        ));
      } catch (err) {
        console.error('[ImageTranslator] Error:', err);
        setImages(prev => prev.map(im => 
          im.id === img.id ? { ...im, status: 'error', error: err.message } : im
        ));
        
        // Rate limit: wait before next image
        if (err.message.includes('429') || err.message.includes('Resource')) {
          setProgress(`⏳ Rate limit, đợi 15s...`);
          await new Promise(r => setTimeout(r, 15000));
        }
      }

      // Delay between images to avoid rate limit
      if (i < pending.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setIsProcessing(false);
    setProgress('');
  }, [images, apiKey, targetLang]);

  // Download single image
  const downloadImage = (img) => {
    const a = document.createElement('a');
    a.href = img.result;
    const origName = img.file?.name?.replace(/\.[^.]+$/, '') || 'image';
    a.download = `${origName}_${targetLang}.png`;
    a.click();
  };

  // Download all translated images
  const downloadAll = () => {
    images.filter(img => img.status === 'done').forEach(downloadImage);
  };

  // Re-host to ImgBB and copy URL
  const rehostAndCopy = async (img) => {
    if (!img.resultBase64) return;
    const IMGBB_KEYS = [
      '02f64b3be9d269a7a8a41f3778dadc00',
      'b69da15baaeef837d4a3a389d9d93057',
      '99c7dcfd7b3f726700a39ae75032c773',
    ];
    const key = IMGBB_KEYS[Math.floor(Math.random() * IMGBB_KEYS.length)];
    const fd = new FormData();
    fd.append('key', key);
    fd.append('image', img.resultBase64);
    try {
      const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        await navigator.clipboard.writeText(data.data.url);
        alert(`✅ Đã upload & copy URL:\n${data.data.url}`);
      } else {
        alert('❌ Upload thất bại: ' + JSON.stringify(data.error));
      }
    } catch (err) {
      alert('❌ Lỗi upload: ' + err.message);
    }
  };

  // Drag & drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files?.length) handleFileAdd(files);
  }, [handleFileAdd]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const doneCount = images.filter(i => i.status === 'done').length;
  const pendingCount = images.filter(i => i.status === 'pending' || i.status === 'error').length;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Languages className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Dịch ảnh sản phẩm</h2>
          <p className="text-xs text-muted-foreground">Dịch text trên ảnh sang ngôn ngữ khác bằng Gemini AI</p>
        </div>
      </div>

      {/* Language + Model selector */}
      <div className="mb-4 p-3 rounded-xl bg-card border border-border space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            <Globe className="w-3.5 h-3.5 inline mr-1" />
            Ngôn ngữ đích
          </label>
          <select
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
            className="form-input text-sm"
          >
            {languages.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            🤖 Model
          </label>
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="form-input text-sm"
          >
            {imageModels.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">Model khác nhau cho kết quả khác nhau — thử để so sánh</p>
        </div>
      </div>

      {/* Upload area */}
      <div
        className="mb-4 border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-violet-500/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFileAdd(e.target.files)}
        />
        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Kéo thả hoặc bấm để chọn ảnh</p>
        <p className="text-[10px] text-muted-foreground mt-1">Hỗ trợ JPG, PNG, WebP — nhiều ảnh cùng lúc</p>
      </div>

      {/* URL input */}
      <div className="mb-4 flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          placeholder="Hoặc dán URL ảnh (alicdn, 1688...)"
          className="form-input flex-1 text-xs"
          onKeyDown={e => e.key === 'Enter' && handleUrlAdd()}
        />
        <button
          onClick={handleUrlAdd}
          disabled={!urlInput.trim()}
          className="px-3 py-2 bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded-lg text-xs font-medium hover:bg-violet-500/20 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              📷 {images.length} ảnh {doneCount > 0 && `(${doneCount} đã dịch)`}
            </h3>
            {doneCount > 0 && (
              <button
                onClick={downloadAll}
                className="px-3 py-1.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-colors flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Tải tất cả
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {images.map(img => (
              <div key={img.id} className="rounded-xl bg-card border border-border overflow-hidden">
                {/* Original vs Translated */}
                <div className="flex">
                  {/* Original */}
                  <div className="flex-1 relative">
                    <img
                      src={img.preview}
                      alt="Original"
                      className="w-full h-40 object-contain bg-muted/30"
                    />
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[9px] rounded">Gốc</span>
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex items-center px-1 text-muted-foreground text-sm">→</div>
                  
                  {/* Translated */}
                  <div className="flex-1 relative">
                    {img.status === 'done' && img.result ? (
                      <>
                        <img
                          src={img.result}
                          alt="Translated"
                          className="w-full h-40 object-contain bg-muted/30"
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-green-500/80 text-white text-[9px] rounded">✅ Đã dịch</span>
                      </>
                    ) : img.status === 'processing' ? (
                      <div className="w-full h-40 flex items-center justify-center bg-muted/30">
                        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                      </div>
                    ) : img.status === 'error' ? (
                      <div className="w-full h-40 flex flex-col items-center justify-center bg-red-500/5 p-2">
                        <span className="text-red-400 text-xs text-center">❌ {img.error?.substring(0, 60)}</span>
                      </div>
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center bg-muted/10">
                        <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 p-2 border-t border-border/50">
                  <span className="flex-1 text-[10px] text-muted-foreground truncate self-center">
                    {img.file?.name || 'image'}
                  </span>
                  {img.status === 'done' && (
                    <>
                      <button
                        onClick={() => downloadImage(img)}
                        className="px-2 py-1 bg-green-500/10 text-green-500 rounded text-[10px] hover:bg-green-500/20"
                        title="Tải về"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => rehostAndCopy(img)}
                        className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-[10px] hover:bg-blue-500/20"
                        title="Upload ImgBB & copy URL"
                      >
                        🔗
                      </button>
                    </>
                  )}
                  {img.status === 'error' && (
                    <button
                      onClick={() => setImages(prev => prev.map(im => im.id === img.id ? { ...im, status: 'pending', error: null } : im))}
                      className="px-2 py-1 bg-orange-500/10 text-orange-500 rounded text-[10px] hover:bg-orange-500/20"
                      title="Thử lại"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => removeImage(img.id)}
                    className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-[10px] hover:bg-red-500/20"
                    title="Xóa"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      {isProcessing && progress && (
        <div className="mb-4 p-3 rounded-xl bg-card border border-border">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
            <div className="h-full bg-violet-500 animate-pulse rounded-full" style={{ width: '70%' }} />
          </div>
          <p className="text-sm text-violet-500">{progress}</p>
        </div>
      )}

      {/* Translate button */}
      {pendingCount > 0 && (
        <button
          onClick={handleTranslateAll}
          disabled={isProcessing || !apiKey}
          className={`w-full py-3.5 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
            !isProcessing && apiKey
              ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Đang dịch...
            </>
          ) : (
            <>
              <Languages className="w-5 h-5" />
              🌐 Dịch {pendingCount} ảnh sang {targetLang}
            </>
          )}
        </button>
      )}

      {/* No API key warning */}
      {!apiKey && (
        <div className="mt-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400">
          ⚠️ Cần Gemini API Key. Nhập ở phần <b>Cài đặt API</b> bên sidebar.
        </div>
      )}
    </div>
  );
}
