import { useState, useCallback } from 'react';
import { Upload, X, Palette, Plus, Image as ImageIcon } from 'lucide-react';
import { extractColorsFromImage } from '@/lib/generator';

/**
 * Multi-image uploader with drag-drop and color extraction
 * Supports uploading multiple product/reference images
 */
export default function ImageUploader({ onImagesChange, onColorsExtracted }) {
  const [images, setImages] = useState([]);
  const [colors, setColors] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const handleFiles = useCallback(async (files) => {
    const newImages = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await readFile(file);
      newImages.push(dataUrl);
    }

    const updated = [...images, ...newImages];
    setImages(updated);
    onImagesChange(updated);

    // Extract colors from first image
    if (updated.length > 0 && !colors) {
      setExtracting(true);
      try {
        const extracted = await extractColorsFromImage(updated[0]);
        setColors(extracted);
        onColorsExtracted(extracted);
      } catch (err) {
        console.error('Color extraction failed:', err);
      }
      setExtracting(false);
    }
  }, [images, colors, onImagesChange, onColorsExtracted]);

  const readFile = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }, [handleFiles]);

  const handleInputChange = (e) => {
    handleFiles(Array.from(e.target.files));
  };

  const removeImage = (index) => {
    const updated = images.filter((_, i) => i !== index);
    setImages(updated);
    onImagesChange(updated);
    if (updated.length === 0) {
      setColors(null);
      onColorsExtracted(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Image grid preview */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-border aspect-square">
              <img src={img} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-1 left-1 text-[9px] bg-primary/80 text-white px-1.5 py-0.5 rounded">
                  Chính
                </span>
              )}
            </div>
          ))}
          {/* Add more button */}
          <button
            onClick={() => document.getElementById('imageInput').click()}
            className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Thêm</span>
          </button>
        </div>
      )}

      {/* Upload area (when no images) */}
      {images.length === 0 && (
        <div
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('imageInput').click()}
        >
          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Kéo thả hoặc <span className="text-primary font-medium">chọn nhiều ảnh</span>
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, WebP · Chọn nhiều ảnh cùng lúc</p>
        </div>
      )}

      <input
        id="imageInput"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Color palette */}
      {extracting && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Đang trích xuất màu...
        </div>
      )}
      {colors && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Palette className="w-3.5 h-3.5" />
            Bảng màu
          </div>
          <div className="flex gap-1.5">
            {colors.swatches.map((color, i) => (
              <button
                key={i}
                className="w-7 h-7 rounded-lg border-2 border-transparent hover:border-foreground/30 transition-all hover:scale-110 shadow-sm"
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => navigator.clipboard.writeText(color)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
