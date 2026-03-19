import { useState, useRef } from 'react';
import { Package, Plus, Upload } from 'lucide-react';

/**
 * Step 1: Review extracted product data + select images + add custom images
 */
export default function StepExtract({ productData, onChange, onNext, isLoading }) {
  const fileInputRef = useRef(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Đang bóc tách dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!productData) return null;

  const handleField = (field, value) => {
    onChange({ ...productData, [field]: value });
  };

  const handleToggleImage = (idx) => {
    const newImages = [...(productData.images || [])];
    if (newImages[idx].startsWith('__EXCLUDED__')) {
      newImages[idx] = newImages[idx].replace('__EXCLUDED__', '');
    } else {
      newImages[idx] = '__EXCLUDED__' + newImages[idx];
    }
    onChange({ ...productData, images: newImages });
  };

  const handleRemoveImage = (idx) => {
    const newImages = [...(productData.images || [])];
    newImages.splice(idx, 1);
    onChange({ ...productData, images: newImages });
  };

  // Add images from file input (convert to base64 data URL)
  const handleAddImages = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        onChange(prev => ({
          ...prev,
          images: [...(prev.images || []), reader.result],
        }));
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add image from URL
  const handleAddImageUrl = () => {
    const url = prompt('Nhập URL ảnh:');
    if (url && url.trim()) {
      onChange({ ...productData, images: [...(productData.images || []), url.trim()] });
    }
  };

  const activeImages = (productData.images || []).filter(u => !u.startsWith('__EXCLUDED__'));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-primary mb-2">
        <Package className="w-5 h-5" />
        <h2 className="text-lg font-bold">Bước 1: Kiểm tra dữ liệu sản phẩm</h2>
      </div>
      
      {/* Product info fields */}
      <div className="grid gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tên sản phẩm</label>
          <input
            value={productData.name || ''}
            onChange={e => handleField('name', e.target.value)}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Mô tả</label>
          <textarea
            rows={3}
            value={productData.description || ''}
            onChange={e => handleField('description', e.target.value)}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Lợi ích</label>
          <textarea
            rows={3}
            value={productData.benefits || ''}
            onChange={e => handleField('benefits', e.target.value)}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Giá</label>
            <input
              value={productData.price || ''}
              onChange={e => handleField('price', e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Giá gốc</label>
            <input
              value={productData.originalPrice || ''}
              onChange={e => handleField('originalPrice', e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        </div>
      </div>

      {/* Image grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground">
            Ảnh sản phẩm ({activeImages.length} đã chọn)
          </label>
          <div className="flex gap-1.5">
            <button
              onClick={handleAddImageUrl}
              className="px-2 py-1 text-[10px] bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Thêm URL
            </button>
            <label className="px-2 py-1 text-[10px] bg-primary/10 text-primary hover:bg-primary/20 rounded-lg flex items-center gap-1 cursor-pointer transition-colors">
              <Upload className="w-3 h-3" /> Tải ảnh lên
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleAddImages}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {(productData.images || []).map((url, i) => {
            const excluded = url.startsWith('__EXCLUDED__');
            const cleanUrl = url.replace('__EXCLUDED__', '');
            const isCustom = cleanUrl.startsWith('data:');
            return (
              <div
                key={i}
                className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                  excluded 
                    ? 'border-red-500/50 opacity-40 grayscale' 
                    : 'border-green-500 ring-1 ring-green-500/30'
                }`}
              >
                <img 
                  src={cleanUrl} 
                  alt="" 
                  className="w-full h-full object-cover cursor-pointer" 
                  onClick={() => handleToggleImage(i)}
                />
                {/* Toggle badge */}
                <div 
                  onClick={() => handleToggleImage(i)}
                  className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer ${
                    excluded ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                  }`}
                >
                  {excluded ? '✕' : '✓'}
                </div>
                {/* Custom badge */}
                {isCustom && (
                  <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-blue-500 text-white text-[8px] rounded">
                    Thủ công
                  </div>
                )}
                {/* Delete button for custom images */}
                {isCustom && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveImage(i); }}
                    className="absolute top-1 left-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] hover:bg-red-700"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next button */}
      <button
        onClick={onNext}
        disabled={!productData.name}
        className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        Tiếp tục: Xem Layout →
      </button>
    </div>
  );
}
