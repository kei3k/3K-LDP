import { Handle, Position } from '@xyflow/react';
import { ImageIcon, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const statusBorder = {
  idle: 'border-border',
  running: 'border-blue-400 animate-pulse',
  done: 'border-green-500',
  error: 'border-red-500',
};

function SceneThumbnail({ item, generatingIdx, customRefs, skipProducts, onAddCustomRefs, onRemoveCustomRef, onToggleSkipProducts }) {
  const [url, setUrl] = useState(null);
  const urlRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (item?.blob) {
      const objectUrl = URL.createObjectURL(item.blob);
      urlRef.current = objectUrl;
      setUrl(objectUrl);
    }
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [item?.blob]);

  const isGenerating = generatingIdx === item.sceneIdx;
  const isDone = !!item.blob;

  const handleClick = () => {
    if (url) window.open(url, '_blank');
  };

  const handleFiles = async (files) => {
    const out = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      out.push({ id: crypto.randomUUID(), mimeType: f.type, data, preview: URL.createObjectURL(f) });
    }
    if (out.length && onAddCustomRefs) onAddCustomRefs(item.sceneIdx, out);
  };

  const refs = customRefs || [];

  return (
    <div className="flex flex-col gap-1">
      {/* Main scene thumbnail */}
      <div
        onClick={handleClick}
        title={`Scene ${item.sceneIdx + 1}`}
        className={`relative rounded overflow-hidden border ${isDone ? 'border-green-500 cursor-pointer hover:opacity-80' : isGenerating ? 'border-blue-400' : 'border-border'} bg-muted/30`}
        style={{ width: 60, aspectRatio: '9/16', flexShrink: 0 }}
      >
        {url ? (
          <img src={url} alt={`Scene ${item.sceneIdx + 1}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isGenerating ? (
              <span className="text-[8px] text-blue-400 animate-pulse">…</span>
            ) : (
              <span className="text-[8px] text-muted-foreground">{item.sceneIdx + 1}</span>
            )}
          </div>
        )}
        {/* Status dot */}
        <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${isDone ? 'bg-green-500' : isGenerating ? 'bg-blue-400 animate-ping' : 'bg-muted-foreground/40'}`} />
        {/* Scene index label */}
        <span className="absolute bottom-0 left-0 right-0 text-center text-[7px] bg-black/50 text-white leading-3 py-px">
          {item.sceneIdx + 1}
        </span>
        {/* Add custom ref button overlay */}
        {onAddCustomRefs && (
          <button
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            className="absolute bottom-4 right-0.5 w-4 h-4 bg-pink-500/80 hover:bg-pink-500 text-white rounded-full flex items-center justify-center"
            title="Thêm ref riêng cho cảnh này"
          >
            <Plus size={8} />
          </button>
        )}
        {/* Custom ref count chip */}
        {refs.length > 0 && (
          <span className="absolute top-0.5 left-0.5 bg-pink-500 text-white text-[7px] leading-none px-1 py-px rounded-full">
            +{refs.length}
          </span>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {/* Custom refs strip */}
      {refs.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {refs.map((r) => (
            <div key={r.id} className="relative group w-5 h-5">
              <img src={r.preview} alt="ref" className="w-5 h-5 object-cover rounded border border-pink-400/50" />
              {onRemoveCustomRef && (
                <button
                  onClick={() => onRemoveCustomRef(item.sceneIdx, r.id)}
                  className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <X size={7} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Skip products checkbox */}
      {refs.length > 0 && onToggleSkipProducts && (
        <label className="flex items-center gap-0.5 text-[8px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={!!skipProducts}
            onChange={(e) => onToggleSkipProducts(item.sceneIdx, e.target.checked)}
            className="w-2.5 h-2.5"
          />
          chỉ ref riêng
        </label>
      )}
    </div>
  );
}

export default function RefImageNode({ data, isConnectable }) {
  const status = data.status || 'idle';
  const progress = data.progress;

  // Portrait anchors — from done output or live progress
  const characterAnchors =
    (status === 'running' && progress?.phase === 'anchors' ? progress.characterAnchors : null) ??
    data.characterAnchors ??
    [];

  // During anchor phase show anchor progress; during scene phase and done show scenes
  const refImages =
    (status === 'running' && progress?.phase === 'scenes' ? progress.refImages : null) ??
    data.refImages ??
    [];

  const count = data.refImages?.length ?? refImages.length;
  const total = progress?.total ?? count;
  const generatingIdx = status === 'running' && progress?.phase === 'scenes' ? progress.done : -1;

  const gridItems = Array.from({ length: total }, (_, i) => {
    const found = refImages.find((r) => r.sceneIdx === i);
    return found ?? { sceneIdx: i, blob: null };
  });

  // sceneCustomRefs stored in node data, updated via onDataChange callback injected by FlowEditor
  const sceneCustomRefs = data.sceneCustomRefs || [];

  const addCustomRefs = (sceneIdx, newRefs) => {
    if (!data.onDataChange) return;
    const next = Array.from({ length: Math.max(sceneCustomRefs.length, sceneIdx + 1) }, (_, i) => sceneCustomRefs[i] || { refs: [], skipProducts: false });
    next[sceneIdx] = { ...next[sceneIdx], refs: [...(next[sceneIdx].refs || []), ...newRefs] };
    data.onDataChange({ sceneCustomRefs: next });
  };

  const removeCustomRef = (sceneIdx, refId) => {
    if (!data.onDataChange) return;
    const next = sceneCustomRefs.map((s, i) =>
      i === sceneIdx ? { ...s, refs: s.refs.filter((r) => r.id !== refId) } : s
    );
    data.onDataChange({ sceneCustomRefs: next });
  };

  const toggleSkipProducts = (sceneIdx, val) => {
    if (!data.onDataChange) return;
    const next = Array.from({ length: Math.max(sceneCustomRefs.length, sceneIdx + 1) }, (_, i) => sceneCustomRefs[i] || { refs: [], skipProducts: false });
    next[sceneIdx] = { ...next[sceneIdx], skipProducts: val };
    data.onDataChange({ sceneCustomRefs: next });
  };

  const isAnchorPhase = status === 'running' && progress?.phase === 'anchors';
  const anchorDone = isAnchorPhase ? progress.done : null;
  const anchorTotal = isAnchorPhase ? progress.total : null;

  return (
    <div className={`bg-background border-2 ${statusBorder[status]} rounded-xl shadow-md p-3`} style={{ minWidth: 220 }}>
      <Handle type="target" position={Position.Left} id="scenes" style={{ top: '30%' }}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background" isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="images" style={{ top: '55%' }}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="characters" style={{ top: '80%' }}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-background" isConnectable={isConnectable} />

      <div className="flex items-center gap-2 mb-1.5">
        <ImageIcon size={14} className="text-pink-500" />
        <span className="text-xs font-bold text-foreground">Ref Images</span>
        <span className="text-[10px] text-muted-foreground">(Nano Banana)</span>
        {(status === 'running' || status === 'done') && total > 0 && (
          <span className="ml-auto text-[9px] font-mono text-muted-foreground">
            {progress ? `${progress.done}/${total}` : `${count}`}
          </span>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground mb-1.5">
        {status === 'running' && isAnchorPhase && (
          <span className="text-amber-500">
            Portraits {anchorDone}/{anchorTotal}…
          </span>
        )}
        {status === 'running' && !isAnchorPhase && (
          <span className="text-blue-500">
            Generating {progress ? `${progress.done}/${total}` : '...'}
          </span>
        )}
        {status === 'done' && <span className="text-green-600">{count} ref image{count !== 1 ? 's' : ''} ready</span>}
        {status === 'error' && <span className="text-red-500">{data.error || 'Error'}</span>}
        {status === 'idle' && <span>Sequential generation for consistency</span>}
      </div>

      {/* Character portrait anchors row */}
      {characterAnchors.length > 0 && (
        <div className="mb-2">
          <p className="text-[9px] text-amber-400 font-bold uppercase tracking-wider mb-1">Portraits</p>
          <div className="flex gap-1 flex-wrap">
            {characterAnchors.map((anchor, ci) => (
              <div
                key={ci}
                className="rounded overflow-hidden border border-amber-400/40 bg-muted/30"
                style={{ width: 36, aspectRatio: '9/16', flexShrink: 0 }}
                title={`Character ${ci + 1} portrait`}
              >
                {anchor?.previewUrl ? (
                  <img src={anchor.previewUrl} alt={`Anchor ${ci + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[7px] text-amber-400 animate-pulse">…</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scene thumbnail grid */}
      {gridItems.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {gridItems.map((item) => (
            <SceneThumbnail
              key={item.sceneIdx}
              item={item}
              generatingIdx={generatingIdx}
              customRefs={sceneCustomRefs[item.sceneIdx]?.refs}
              skipProducts={sceneCustomRefs[item.sceneIdx]?.skipProducts}
              onAddCustomRefs={addCustomRefs}
              onRemoveCustomRef={removeCustomRef}
              onToggleSkipProducts={toggleSkipProducts}
            />
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} id="refImages"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />
    </div>
  );
}
