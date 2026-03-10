import { useState, useRef, useEffect, useCallback } from 'react';
import { Edit3, Image as ImageIcon, Type, Check, X, RotateCcw } from 'lucide-react';

/**
 * Inline HTML editor — edit text and swap images in generated landing pages
 * Works by manipulating the iframe document directly
 */
export default function HtmlEditor({ html, onSave, onCancel }) {
  const iframeRef = useRef(null);
  const [editMode, setEditMode] = useState(null); // 'text' | 'image' | null
  const [selectedElement, setSelectedElement] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [history, setHistory] = useState([html]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const currentHtml = history[historyIndex];

  // Load HTML into iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !currentHtml) return;

    const blob = new Blob([currentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

    return () => URL.revokeObjectURL(url);
  }, [currentHtml]);

  // Add click listeners to iframe for editing
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !editMode) return;

    const onLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Add edit overlay styles
      const style = doc.createElement('style');
      style.textContent = `
        .ldp-editable-hover { outline: 2px dashed #22c55e !important; outline-offset: 2px; cursor: pointer !important; }
        .ldp-editable-selected { outline: 2px solid #3b82f6 !important; outline-offset: 2px; }
      `;
      doc.head.appendChild(style);

      const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const target = e.target;
        if (editMode === 'text' && target.textContent?.trim()) {
          setSelectedElement(target);
          setEditValue(target.textContent);
        } else if (editMode === 'image' && target.tagName === 'IMG') {
          setSelectedElement(target);
          // Trigger file upload
          document.getElementById('editorImageInput')?.click();
        }
      };

      const handleMouseOver = (e) => {
        if (editMode === 'text') {
          if (e.target.textContent?.trim() && !['BODY','HTML','SECTION','DIV','STYLE','SCRIPT'].includes(e.target.tagName)) {
            e.target.classList.add('ldp-editable-hover');
          }
        } else if (editMode === 'image' && e.target.tagName === 'IMG') {
          e.target.classList.add('ldp-editable-hover');
        }
      };

      const handleMouseOut = (e) => {
        e.target.classList?.remove('ldp-editable-hover');
      };

      doc.addEventListener('click', handleClick, true);
      doc.addEventListener('mouseover', handleMouseOver, true);
      doc.addEventListener('mouseout', handleMouseOut, true);
    };

    iframe.addEventListener('load', onLoad);
    // Also call if already loaded
    if (iframe.contentDocument?.body) onLoad();

    return () => iframe.removeEventListener('load', onLoad);
  }, [editMode]);

  // Apply text edit
  const applyTextEdit = useCallback(() => {
    if (!selectedElement || !iframeRef.current) return;
    
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument;
    selectedElement.textContent = editValue;
    selectedElement.classList.remove('ldp-editable-selected');
    
    // Save new HTML state
    const newHtml = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
    // Clean edit styles
    const cleaned = newHtml
      .replace(/class="ldp-editable-hover"/g, '')
      .replace(/class="ldp-editable-selected"/g, '')
      .replace(/<style>[\s\S]*?ldp-editable[\s\S]*?<\/style>/g, '');
    
    const newHistory = [...history.slice(0, historyIndex + 1), cleaned];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSelectedElement(null);
    setEditValue('');
  }, [selectedElement, editValue, history, historyIndex]);

  // Handle image replacement
  const handleImageReplace = (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedElement) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      selectedElement.src = ev.target.result;
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const newHtml = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
        const newHistory = [...history.slice(0, historyIndex + 1), newHtml];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
      setSelectedElement(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
        <span className="text-xs font-semibold text-muted-foreground mr-2">CHỈNH SỬA:</span>
        
        <button
          onClick={() => { setEditMode(editMode === 'text' ? null : 'text'); setSelectedElement(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            editMode === 'text' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          Sửa text
        </button>

        <button
          onClick={() => { setEditMode(editMode === 'image' ? null : 'image'); setSelectedElement(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            editMode === 'image' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Đổi ảnh
        </button>

        <button onClick={undo} disabled={historyIndex === 0}
          className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
          title="Hoàn tác"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1" />

        <button onClick={() => onSave(currentHtml)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90"
        >
          <Check className="w-3.5 h-3.5" />
          Lưu
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-medium hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
          Hủy
        </button>
      </div>

      {/* Text edit popup */}
      {selectedElement && editMode === 'text' && (
        <div className="px-4 py-2 bg-secondary/20 border-b border-border flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 form-input text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') applyTextEdit(); if (e.key === 'Escape') { setSelectedElement(null); setEditValue(''); } }}
          />
          <button onClick={applyTextEdit} className="px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium">
            Áp dụng
          </button>
        </div>
      )}

      {/* Edit mode hint */}
      {editMode && !selectedElement && (
        <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 text-xs text-primary text-center">
          {editMode === 'text' ? '👆 Click vào text bất kỳ trong preview để chỉnh sửa' : '👆 Click vào ảnh bất kỳ để thay thế'}
        </div>
      )}

      {/* Preview iframe */}
      <div className="flex-1 flex justify-center p-4 bg-muted/20 overflow-auto">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-border/50" style={{ width: '420px', height: '700px' }}>
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            title="Editor preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>

      {/* Hidden image input */}
      <input
        id="editorImageInput"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageReplace}
      />
    </div>
  );
}
