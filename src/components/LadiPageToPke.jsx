import { useState } from 'react';
import { Download, Globe, Link as LinkIcon, Loader2, FileDown } from 'lucide-react';
import { generatePkeBuffer } from '../lib/htmlToPke';

export default function LadiPageToPke() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const handleConvert = async () => {
    if (!url.trim()) {
      setError('Vui lòng nhập URL LadiPage');
      return;
    }
    
    // Quick validation
    try {
      new URL(url);
    } catch {
      setError('URL không hợp lệ. Vui lòng nhập đầy đủ (VD: https://domain.com)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg('');

    try {
      // Use the Vite proxy to bypass CORS
      const proxyUrl = `/api/fetch-url?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      
      if (!res.ok) {
        throw new Error(`Không thể tải trang (${res.status})`);
      }
      
      const html = await res.text();
      
      if (!html || html.length < 100) {
         throw new Error('Nội dung HTML quá ngắn hoặc trống.');
      }
      
      // Extract title from HTML for filename
      let title = 'LadiPage';
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }

      // Generate PKE (base64 string)
      const pkeBase64 = generatePkeBuffer(html, title);
      
      // Download
      // Webcake expects the .pke file to contain the Base64 string directly
      const blob = new Blob([pkeBase64], { type: 'application/octet-stream' });
      
      // Build filename from domain + simple timestamp
      let domain = 'export';
      try {
        domain = new URL(url).hostname.replace('www.', '');
      } catch(e){}
      
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${domain}.pke`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      
      setSuccessMsg('Chuyển đổi và tải xuống thành công!');
    } catch (err) {
      console.error('LadiPage to PKE Error:', err);
      setError(err.message || 'Có lỗi xảy ra khi chuyển đổi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-sky-500/10 text-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Globe className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            LadiPage → Webcake (.pke)
            <span className="text-xs bg-sky-100 text-sky-600 px-2 py-1 rounded-full font-medium">v1.0.1</span>
          </h2>
          <p className="text-muted-foreground text-sm">
            Nhập URL của trang LadiPage để tải mã nguồn HTML và chuyển đổi tự động thành file PKE (phiên bản không bóc tách CSS/JS, 100% giống gốc).
          </p>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold flex items-center gap-1.5">
              <LinkIcon className="w-4 h-4" /> URL LadiPage (hoặc bất kỳ landing page HTML nào)
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.ladi-page-domain.com/"
              className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm rounded-lg flex items-center gap-2">
              <FileDown className="w-4 h-4" /> {successMsg}
            </div>
          )}

          <button
            onClick={handleConvert}
            disabled={isLoading}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hidden-outline font-medium"
            style={{ fontWeight: 600 }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tải & xử lý...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Chuyển đổi sang PKE
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
