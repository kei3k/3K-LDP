import { Handle, Position } from '@xyflow/react';
import { Video, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const statusBorder = {
  idle: 'border-border',
  running: 'border-blue-400 animate-pulse',
  done: 'border-green-500',
  error: 'border-red-500',
};

function ClipThumbnail({ item, generatingIdx }) {
  const [url, setUrl] = useState(null);
  const urlRef = useRef(null);

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

  const handleOpen = () => {
    if (url) window.open(url, '_blank');
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `scene-${item.sceneIdx + 1}.mp4`;
    a.click();
  };

  return (
    <div
      onClick={handleOpen}
      title={`Scene ${item.sceneIdx + 1}${isDone ? ' — click to open' : ''}`}
      className={`relative rounded overflow-hidden border ${isDone ? 'border-green-500 cursor-pointer hover:opacity-80 group' : isGenerating ? 'border-blue-400' : 'border-border'} bg-muted/30`}
      style={{ width: 60, aspectRatio: '9/16', flexShrink: 0 }}
    >
      {url ? (
        <video
          src={url}
          muted
          preload="metadata"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {isGenerating ? (
            <span className="text-[8px] text-blue-400 animate-pulse">…</span>
          ) : (
            <Video size={10} className="text-muted-foreground/40" />
          )}
        </div>
      )}

      {/* Status dot */}
      <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${isDone ? 'bg-green-500' : isGenerating ? 'bg-blue-400 animate-ping' : 'bg-muted-foreground/40'}`} />

      {/* Download button (visible on hover when done) */}
      {isDone && (
        <button
          onClick={handleDownload}
          className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-px"
          title="Download"
        >
          <Download size={7} className="text-white" />
        </button>
      )}

      {/* Scene index label */}
      <span className="absolute bottom-0 left-0 right-0 text-center text-[7px] bg-black/50 text-white leading-3 py-px">
        {item.sceneIdx + 1}
      </span>
    </div>
  );
}

export default function VeoNode({ data, isConnectable }) {
  const status = data.status || 'idle';
  const progress = data.progress;
  // During run, partial snapshots arrive in progress.clips; on done they land in data.clips
  const clips = (status === 'running' ? progress?.clips : null) ?? data.clips ?? [];
  const count = data.clips?.length ?? clips.length;

  const total = progress?.total ?? count;
  const generatingIdx = status === 'running' && progress ? progress.done : -1;

  const gridItems = Array.from({ length: total }, (_, i) => {
    const found = clips.find((c) => c.sceneIdx === i);
    return found ?? { sceneIdx: i, blob: null };
  });

  return (
    <div className={`bg-background border-2 ${statusBorder[status]} rounded-xl shadow-md p-3`} style={{ minWidth: 220 }}>
      <Handle type="target" position={Position.Left} id="scenes" style={{ top: '35%' }}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background" isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="refImages" style={{ top: '65%' }}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />

      <div className="flex items-center gap-2 mb-1.5">
        <Video size={14} className="text-pink-500" />
        <span className="text-xs font-bold text-foreground">Generate Clips</span>
        <span className="text-[10px] text-muted-foreground">(Veo 3.1)</span>
        {(status === 'running' || status === 'done') && total > 0 && (
          <span className="ml-auto text-[9px] font-mono text-muted-foreground">
            {progress ? `${progress.done}/${total}` : `${count}`}
          </span>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground mb-1.5">
        {status === 'running' && (
          <span className="text-blue-500">
            Generating clips {progress ? `${progress.done}/${total}` : '...'} (3 concurrent)
          </span>
        )}
        {status === 'done' && <span className="text-green-600">{count} clip{count !== 1 ? 's' : ''} ready (8s each)</span>}
        {status === 'error' && <span className="text-red-500">{data.error || 'Error'}</span>}
        {status === 'idle' && <span>3 concurrent · 8s clips</span>}
      </div>

      {/* Thumbnail grid */}
      {gridItems.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {gridItems.map((item) => (
            <ClipThumbnail key={item.sceneIdx} item={item} generatingIdx={generatingIdx} />
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} id="clips"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />
    </div>
  );
}
