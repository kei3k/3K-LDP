import { Handle, Position } from '@xyflow/react';
import { ScanSearch } from 'lucide-react';

const statusBorder = {
  idle: 'border-border',
  running: 'border-blue-400 animate-pulse',
  done: 'border-green-500',
  error: 'border-red-500',
};

export default function AnalyzeNode({ data, isConnectable }) {
  const status = data.status || 'idle';

  return (
    <div className={`bg-background border-2 ${statusBorder[status]} rounded-xl shadow-md min-w-[220px] p-3`}>
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-background"
        isConnectable={isConnectable}
      />
      <div className="flex items-center gap-2 mb-2">
        <ScanSearch size={14} className="text-pink-500" />
        <span className="text-xs font-bold text-foreground">Analyze Video</span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {status === 'running' && <span className="text-blue-500">Analyzing...</span>}
        {status === 'done' && (
          <span className="text-green-600">
            Template extracted{data.template ? ` · ${data.transcript?.slice(0, 40)}…` : ''}
          </span>
        )}
        {status === 'error' && <span className="text-red-500">{data.error || 'Error'}</span>}
        {status === 'idle' && <span>Awaiting video input</span>}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="template"
        style={{ top: '35%' }}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="transcript"
        style={{ top: '65%' }}
        className="!w-3 !h-3 !bg-orange-400 !border-2 !border-background"
        isConnectable={isConnectable}
      />
      <div className="flex flex-col items-end gap-3 absolute right-[-52px] top-[22px]">
        <span className="text-[9px] text-muted-foreground">template</span>
        <span className="text-[9px] text-muted-foreground">transcript</span>
      </div>
    </div>
  );
}
