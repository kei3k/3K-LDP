import { useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Package, X } from 'lucide-react';

const statusBorder = {
  idle: 'border-border',
  running: 'border-blue-400 animate-pulse',
  done: 'border-green-500',
  error: 'border-red-500',
};

const DURATION_PRESETS = [16, 24, 32, 48, 60];

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function AssetsInputNode({ data, isConnectable }) {
  const status = data.status || 'idle';
  const update = useCallback((patch) => data.onDataChange?.(patch), [data]);
  const fileRef = useRef();

  // Characters is array of {gender, nationality, ageRange, description}
  const characters = Array.isArray(data.characters) && data.characters.length
    ? data.characters
    : [{ gender: 'F', nationality: '', ageRange: '25-30', description: '' }];

  const updateChar = (idx, field, val) => {
    const next = characters.map((c, i) => (i === idx ? { ...c, [field]: val } : c));
    update({ characters: next });
  };

  const addChar = () => {
    update({ characters: [...characters, { gender: 'F', nationality: '', ageRange: '', description: '' }] });
  };

  const removeChar = (idx) => {
    if (characters.length <= 1) return;
    update({ characters: characters.filter((_, i) => i !== idx) });
  };

  const handleFiles = async (files) => {
    const arr = Array.from(files || []);
    const out = [];
    for (const f of arr) {
      if (!f.type.startsWith('image/')) continue;
      const data64 = await blobToBase64(f);
      out.push({
        id: crypto.randomUUID(),
        name: f.name,
        mimeType: f.type,
        data: data64,
        preview: URL.createObjectURL(f),
      });
    }
    update({ images: [...(data.images || []), ...out] });
  };

  const removeImage = (id) => {
    update({ images: (data.images || []).filter((img) => img.id !== id) });
  };

  const duration = data.duration || 24;

  return (
    <div className={`bg-background border-2 ${statusBorder[status]} rounded-xl shadow-md w-[280px] p-3 space-y-2.5`}>
      <div className="flex items-center gap-2">
        <Package size={14} className="text-pink-500" />
        <span className="text-xs font-bold text-foreground">Assets Input</span>
      </div>

      {/* Product images */}
      <div>
        <span className="text-[10px] text-muted-foreground block mb-1">Ảnh sản phẩm</span>
        <div
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-border/70 bg-card rounded-lg px-2 py-1.5 text-center hover:border-pink-500 hover:bg-muted cursor-pointer transition-colors"
        >
          <span className="text-[11px] text-foreground/80">
            {data.images?.length ? `${data.images.length} ảnh — click để thêm` : '+ Upload ảnh sản phẩm'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        {data.images?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {data.images.map((img) => (
              <div key={img.id} className="relative group w-10 h-10">
                <img src={img.preview} alt={img.name} className="w-10 h-10 object-cover rounded-md border border-border" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Characters */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Nhân vật ({characters.length})</span>
          <button
            onClick={addChar}
            className="text-[10px] text-pink-500 hover:text-pink-400"
          >
            + Thêm
          </button>
        </div>
        <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
          {characters.map((ch, idx) => (
            <div key={idx} className="bg-muted/40 rounded-md p-1.5 border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground">NV {idx + 1}</span>
                {characters.length > 1 && (
                  <button onClick={() => removeChar(idx)} className="text-muted-foreground hover:text-red-400">
                    <X size={10} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1">
                <select
                  value={ch.gender}
                  onChange={(e) => updateChar(idx, 'gender', e.target.value)}
                  className="px-1 py-0.5 text-[10px] bg-card text-foreground border border-border/70 rounded focus:outline-none focus:border-pink-500"
                >
                  <option value="F">Nữ</option>
                  <option value="M">Nam</option>
                </select>
                <input
                  type="text"
                  placeholder="VN, Thai..."
                  value={ch.nationality}
                  onChange={(e) => updateChar(idx, 'nationality', e.target.value)}
                  className="px-1 py-0.5 text-[10px] bg-card text-foreground placeholder:text-muted-foreground/60 border border-border/70 rounded focus:outline-none focus:border-pink-500"
                />
                <input
                  type="text"
                  placeholder="25-30"
                  value={ch.ageRange}
                  onChange={(e) => updateChar(idx, 'ageRange', e.target.value)}
                  className="px-1 py-0.5 text-[10px] bg-card text-foreground placeholder:text-muted-foreground/60 border border-border/70 rounded focus:outline-none focus:border-pink-500"
                />
              </div>
              <input
                type="text"
                placeholder="Mô tả thêm (phong cách, đặc điểm...)"
                value={ch.description}
                onChange={(e) => updateChar(idx, 'description', e.target.value)}
                className="w-full px-1.5 py-1 text-[10px] bg-card text-foreground placeholder:text-muted-foreground/60 border border-border/70 rounded focus:outline-none focus:border-pink-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <span className="text-[10px] text-muted-foreground block mb-1">
          Thời lượng — <span className="text-foreground font-bold">{Math.ceil(duration / 8)} cảnh × 8s = {duration}s</span>
        </span>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d}
              onClick={() => update({ duration: d })}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-colors ${
                duration === d
                  ? 'bg-pink-500 border-pink-500 text-white shadow shadow-pink-500/30'
                  : 'border-border/70 bg-card text-foreground hover:border-pink-500/60 hover:bg-muted'
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
        <input
          type="number"
          min="8"
          step="8"
          placeholder="Custom (giây)"
          value={duration}
          onChange={(e) => update({ duration: Math.max(8, Number(e.target.value) || 8) })}
          className="w-full px-2 py-1 text-[11px] bg-card text-foreground placeholder:text-muted-foreground/60 border border-border/70 rounded-md focus:outline-none focus:border-pink-500"
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="images"
        style={{ top: '30%' }}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="characters"
        style={{ top: '55%' }}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-background"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="duration"
        style={{ top: '80%' }}
        className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
}
