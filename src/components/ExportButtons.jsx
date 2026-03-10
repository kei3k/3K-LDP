import { useState } from 'react';
import { Copy, Download, Check, FileCode, Globe } from 'lucide-react';
import { toWebcakeFormat } from '@/lib/generator';

/**
 * Export buttons: Copy for Webcake, Download HTML, Deploy
 */
export default function ExportButtons({ html, productName }) {
  const [copied, setCopied] = useState(false);

  if (!html) return null;

  const copyForWebcake = async () => {
    const webcakeHtml = toWebcakeFormat(html);
    await navigator.clipboard.writeText(webcakeHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadHtml = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${productName || 'landing'}-page.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <FileCode className="w-4 h-4 text-primary" />
        Xuất Landing Page
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={copyForWebcake}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-medium transition-all hover:scale-[1.02]"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Đã copy!' : 'Copy Webcake'}
        </button>
        <button
          onClick={downloadHtml}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-medium transition-all hover:scale-[1.02]"
        >
          <Download className="w-3.5 h-3.5" />
          Tải HTML
        </button>
      </div>

      <button
        onClick={() => window.open('https://vercel.com/new', '_blank')}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground/5 hover:bg-foreground/10 border border-border rounded-lg text-sm font-medium transition-all"
      >
        <Globe className="w-4 h-4" />
        Deploy lên Vercel
      </button>
    </div>
  );
}
