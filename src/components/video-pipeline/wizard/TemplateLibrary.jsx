/**
 * TemplateLibrary — localStorage-backed video template management
 * Exports hooks and a small UI list component.
 */
import { useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

const STORAGE_KEY = 'video_templates';

function loadTemplates() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function useTemplates() {
  const [templates, setTemplates] = useState(() => loadTemplates());

  const save = useCallback((template) => {
    const t = { ...template, id: template.id || crypto.randomUUID(), createdAt: template.createdAt || new Date().toISOString() };
    setTemplates(prev => {
      const next = [...prev.filter(x => x.id !== t.id), t];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return t;
  }, []);

  const remove = useCallback((id) => {
    setTemplates(prev => {
      const next = prev.filter(x => x.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { templates, saveTemplate: save, deleteTemplate: remove };
}

export function saveTemplate(template) {
  const all = loadTemplates();
  const t = { ...template, id: template.id || crypto.randomUUID(), createdAt: template.createdAt || new Date().toISOString() };
  const next = [...all.filter(x => x.id !== t.id), t];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return t;
}

export function deleteTemplate(id) {
  const next = loadTemplates().filter(x => x.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/**
 * TemplateLibraryList — small dropdown-style list of saved templates
 * Props: templates, onSelect(template), onDelete(id), selectedId
 */
export default function TemplateLibraryList({ templates, onSelect, onDelete, selectedId }) {
  if (!templates.length) {
    return <p className="text-xs text-muted-foreground italic">Chưa có template nào. Phân tích video ở Bước 1 để lưu template.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {templates.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
            selectedId === t.id ? 'bg-pink-500/20 border border-pink-500/40 text-foreground' : 'bg-muted/40 hover:bg-muted border border-transparent'
          }`}
          onClick={() => onSelect(t)}
        >
          <span className="flex-1 truncate">{t.name || 'Template không tên'}</span>
          <span className="text-xs text-muted-foreground shrink-0">{t.totalDuration ? `${t.totalDuration}s` : ''}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
            className="text-muted-foreground hover:text-red-400 p-0.5 rounded"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
