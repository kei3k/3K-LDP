import { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Film } from 'lucide-react';

const statusBorder = {
  idle: 'border-border',
  running: 'border-blue-400 animate-pulse',
  done: 'border-green-500',
  error: 'border-red-500',
};

export default function VideoInputNode({ data, isConnectable }) {
  const status = data.status || 'idle';

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) data.onDataChange?.({ file });
  }, [data]);

  return (
    <div className={`bg-background border-2 ${statusBorder[status]} rounded-xl shadow-md min-w-[220px] p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <Film size={14} className="text-pink-500" />
        <span className="text-xs font-bold text-foreground">Video Input</span>
      </div>
      <label className="block cursor-pointer">
        <div className="border border-dashed border-border rounded-lg p-2 text-center hover:border-pink-500 transition-colors">
          {data.file ? (
            <span className="text-[11px] text-green-600 font-medium truncate block max-w-[180px]">{data.file.name}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Click to upload MP4</span>
          )}
        </div>
        <input type="file" accept="video/mp4,video/*" className="hidden" onChange={handleFile} />
      </label>
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
}
