import { Handle, Position } from '@xyflow/react';
import { Layers } from 'lucide-react';

const statusBorder = {
  idle: 'border-border',
  running: 'border-blue-400 animate-pulse',
  done: 'border-green-500',
  error: 'border-red-500',
};

export default function ConcatNode({ data, isConnectable }) {
  const status = data.status || 'idle';

  return (
    <div className={`bg-background border-2 ${statusBorder[status]} rounded-xl shadow-md min-w-[220px] p-3`}>
      <Handle type="target" position={Position.Left} id="clips"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />

      <div className="flex items-center gap-2 mb-2">
        <Layers size={14} className="text-pink-500" />
        <span className="text-xs font-bold text-foreground">Concat Video</span>
        <span className="text-[10px] text-muted-foreground">(ffmpeg.wasm)</span>
      </div>

      <div className="text-[11px] text-muted-foreground">
        {status === 'running' && <span className="text-blue-500">Concatenating clips...</span>}
        {status === 'done' && <span className="text-green-600">Final video ready</span>}
        {status === 'error' && <span className="text-red-500">{data.error || 'Error'}</span>}
        {status === 'idle' && <span>Awaiting clips</span>}
      </div>

      <Handle type="source" position={Position.Right} id="finalVideo"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />
    </div>
  );
}
