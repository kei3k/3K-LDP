import { useState } from 'react';
import { Copy, Download, Check, FileCode, Globe, FileArchive, Loader2 } from 'lucide-react';
import { toWebcakeFormat } from '@/lib/generator';
import { generatePkeBuffer } from '@/lib/htmlToPke';
import { rehostImages } from '@/lib/imageRehost';

/**
 * Export buttons: Copy for Webcake, Download HTML, Deploy
 */
export default function ExportButtons({ html, productName }) {
  const [copied, setCopied] = useState(false);
  const [pkeLoading, setPkeLoading] = useState(false);
  const [pkeStatus, setPkeStatus] = useState('');

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

  const downloadPke = async () => {
    setPkeLoading(true);
    setPkeStatus('Đang chuẩn bị...');

    try {
      let webcakeHtml = toWebcakeFormat(html);

      // Re-host external images (1688, alicdn, etc.) to ImgBB
      setPkeStatus('🖼️ Đang re-host ảnh...');
      webcakeHtml = await rehostImages(webcakeHtml, (msg) => setPkeStatus(msg));

      // Generate PKE buffer (MessagePack + Base64)
      setPkeStatus('📦 Đang tạo file PKE...');
      const base64Pke = generatePkeBuffer(webcakeHtml, productName);

      // Webcake expects .pke files to be base64-encoded text, NOT raw binary
      const blob = new Blob([base64Pke], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${productName || 'landing'}-page.pke`;
      a.click();
      URL.revokeObjectURL(url);

      setPkeStatus('✅ Đã tải xong!');
      setTimeout(() => setPkeStatus(''), 3000);
    } catch (err) {
      console.error('[PKE] Error:', err);
      setPkeStatus('❌ Lỗi: ' + err.message);
      setTimeout(() => setPkeStatus(''), 5000);
    } finally {
      setPkeLoading(false);
    }
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
        onClick={downloadPke}
        disabled={pkeLoading}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-all ${
          pkeLoading
            ? 'bg-muted text-muted-foreground border-border cursor-wait'
            : 'bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary'
        }`}
      >
        {pkeLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang xử lý...
          </>
        ) : (
          <>
            <FileArchive className="w-4 h-4" />
            Tải file .PKE (Webcake)
          </>
        )}
      </button>

      {pkeStatus && (
        <p className="text-xs text-center text-muted-foreground animate-pulse">
          {pkeStatus}
        </p>
      )}

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
