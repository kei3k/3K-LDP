import { Handle, Position } from '@xyflow/react';
import { FileText } from 'lucide-react';

const statusBorder = {
  idle: 'border-border',
  running: 'border-blue-400 animate-pulse',
  done: 'border-green-500',
  error: 'border-red-500',
};

export default function ScriptNode({ data, isConnectable }) {
  const status = data.status || 'idle';
  const sceneCount = data.scenes?.length ?? 0;

  return (
    <div className={`bg-background border-2 ${statusBorder[status]} rounded-xl shadow-md min-w-[220px] p-3`}>
      <Handle type="target" position={Position.Left} id="template" style={{ top: '25%' }}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="images" style={{ top: '45%' }}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="characters" style={{ top: '65%' }}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-background" isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="duration" style={{ top: '85%' }}
        className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-background" isConnectable={isConnectable} />

      <div className="flex items-center gap-2 mb-2">
        <FileText size={14} className="text-pink-500" />
        <span className="text-xs font-bold text-foreground">Generate Script</span>
        {status === 'done' && sceneCount > 0 && (
          <span className="ml-auto text-[9px] font-mono bg-purple-500/15 text-purple-600 rounded px-1 py-px whitespace-nowrap">
            {sceneCount} scenes × 8s
          </span>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground">
        {status === 'running' && <span className="text-blue-500">Generating script...</span>}
        {status === 'done' && <span className="text-green-600">{sceneCount} scene{sceneCount !== 1 ? 's' : ''} generated</span>}
        {status === 'error' && <span className="text-red-500">{data.error || 'Error'}</span>}
        {status === 'idle' && <span>Awaiting inputs</span>}
      </div>

      <Handle type="source" position={Position.Right} id="script" style={{ top: '35%' }}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="scenes" style={{ top: '65%' }}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background" isConnectable={isConnectable} />
    </div>
  );
}
