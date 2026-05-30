import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

/** Drag-drop file zone (shared by Clone Voice + Clone Transcript). */
export default function DropZone({ accept, label, hint, file, onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-5 cursor-pointer transition-all min-h-[120px] ${
        dragging
          ? 'border-cyan-400 bg-cyan-500/10'
          : file
          ? 'border-cyan-500/50 bg-cyan-500/5'
          : 'border-border hover:border-cyan-500/40 hover:bg-muted/30'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {file ? (
        <div className="text-center">
          <p className="text-xs font-semibold text-cyan-300 truncate max-w-[200px]">{file.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <p className="text-xs text-cyan-500 mt-1">Nhấn để đổi file</p>
        </div>
      ) : (
        <>
          <Upload size={24} className="text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground text-center">{label}</p>
          {hint && <p className="text-xs text-muted-foreground text-center">{hint}</p>}
        </>
      )}
    </div>
  );
}
