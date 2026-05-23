import { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Download, MonitorPlay } from 'lucide-react';

const statusBorder = {
  idle: 'border-border',
  running: 'border-blue-400 animate-pulse',
  done: 'border-green-500',
  error: 'border-red-500',
};

export default function OutputNode({ data, isConnectable }) {
  const status = data.status || 'idle';

  const downloadVideo = useCallback(() => {
    if (!data.finalVideo) return;
    const url = URL.createObjectURL(data.finalVideo);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.mp4';
    a.click();
    URL.revokeObjectURL(url);
  }, [data.finalVideo]);

  const videoUrl = data.finalVideo ? URL.createObjectURL(data.finalVideo) : null;

  return (
    <div className={`bg-background border-2 ${statusBorder[status]} rounded-xl shadow-md min-w-[220px] p-3 space-y-2`}>
      <Handle type="target" position={Position.Left} id="finalVideo" style={{ top: '35%' }}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="clips" style={{ top: '65%' }}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background" isConnectable={isConnectable} />

      <div className="flex items-center gap-2">
        <MonitorPlay size={14} className="text-pink-500" />
        <span className="text-xs font-bold text-foreground">Output</span>
      </div>

      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          className="w-full rounded-lg max-h-[120px] object-contain bg-black"
        />
      ) : (
        <div className="text-[11px] text-muted-foreground">
          {status === 'idle' ? 'Connect finalVideo or clips' : status}
        </div>
      )}

      {data.finalVideo && (
        <button
          onClick={downloadVideo}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-bold bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
        >
          <Download size={12} /> Download MP4
        </button>
      )}

      {data.clips?.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          {data.clips.length} clip{data.clips.length !== 1 ? 's' : ''} available
        </div>
      )}
    </div>
  );
}
