import { useState } from 'react';
import { Download, Globe, Link as LinkIcon, Loader2, FileDown, Scissors } from 'lucide-react';
import { generatePkeBuffer } from '../lib/htmlToPke';
import { translateLandingHtml } from '../lib/vertexTranslate';
import { stripContactInfo } from '../lib/stripContacts';

const LANGUAGES = [
  { value: 'Tiếng Việt', label: '🇻🇳 Tiếng Việt' },
  { value: 'English', label: '🇺🇸 English' },
  { value: 'ภาษาไทย', label: '🇹🇭 ภาษาไทย' },
  { value: '中文', label: '🇨🇳 中文' },
  { value: '日本語', label: '🇯🇵 日本語' },
  { value: '한국어', label: '🇰🇷 한국어' },
  { value: 'Bahasa Indonesia', label: '🇮🇩 Bahasa Indonesia' },
];

export default function LadiPageToPke() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [language, setLanguage] = useState(
    () => localStorage.getItem('ladipage_language') || 'Tiếng Việt'
  );
  const [removePhones, setRemovePhones] = useState(
    () => localStorage.getItem('ladipage_remove_phones') !== 'false'
  );
  const [removeZalo, setRemoveZalo] = useState(
    () => localStorage.getItem('ladipage_remove_zalo') !== 'false'
  );
  const [customRemove, setCustomRemove] = useState(
    () => localStorage.getItem('ladipage_remove_custom') || ''
  );
  const [stripStats, setStripStats] = useState(null);

  const updateRemovePhones = (v) => { setRemovePhones(v); localStorage.setItem('ladipage_remove_phones', String(v)); };
  const updateRemoveZalo = (v) => { setRemoveZalo(v); localStorage.setItem('ladipage_remove_zalo', String(v)); };
  const updateCustomRemove = (v) => { setCustomRemove(v); localStorage.setItem('ladipage_remove_custom', v); };

  const handleLanguageChange = (e) => {
    const val = e.target.value;
    setLanguage(val);
    localStorage.setItem('ladipage_language', val);
  };

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
    setProgress('');

    try {
      setProgress('🌐 Đang tải HTML từ URL...');
      const proxyUrl = `/api/fetch-url?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      
      if (!res.ok) {
        throw new Error(`Không thể tải trang (${res.status})`);
      }
      
      let html = await res.text();
      
      if (!html || html.length < 100) {
         throw new Error('Nội dung HTML quá ngắn hoặc trống.');
      }
      
      // Extract title from HTML for filename
      let title = 'LadiPage';
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }

      // Strip contact info BEFORE translation (saves translation tokens too)
      setStripStats(null);
      if (removePhones || removeZalo || customRemove.trim()) {
        setProgress('✂️ Đang xóa hotline / Zalo cũ...');
        const customStrings = customRemove.split('\n').map(s => s.trim()).filter(Boolean);
        const stripped = stripContactInfo(html, {
          removePhones,
          removeZalo,
          customStrings,
          onProgress: setProgress,
        });
        html = stripped.html;
        setStripStats({ count: stripped.removedCount, samples: stripped.samples });
      }

      // Translate if target language != Vietnamese (uses Vertex gemini-3-flash-preview)
      if (language && language !== 'Tiếng Việt') {
        html = await translateLandingHtml(html, language, setProgress);
      }

      setProgress('📦 Đang đóng gói PKE...');
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
      
      setSuccessMsg(
        language === 'Tiếng Việt'
          ? 'Chuyển đổi và tải xuống thành công!'
          : `Đã dịch sang ${language} + tải PKE thành công!`
      );
      setProgress('');
    } catch (err) {
      console.error('LadiPage to PKE Error:', err);
      setError(err.message || 'Có lỗi xảy ra khi chuyển đổi');
      setProgress('');
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
            <span className="text-xs bg-sky-100 text-sky-600 px-2 py-1 rounded-full font-medium">v2.0 (split)</span>
          </h2>
          <p className="text-muted-foreground text-sm">
            Nhập URL của trang LadiPage để tải mã nguồn HTML và chuyển đổi tự động thành file PKE (phiên bản không bóc tách CSS/JS, 100% giống gốc).
          </p>
        </div>

        <div className="flex justify-end mb-1">
          <select
            value={language}
            onChange={handleLanguageChange}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
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

          {/* Strip contact info section */}
          <div className="border border-border rounded-lg p-3 bg-muted/20 space-y-2">
            <label className="text-sm font-bold flex items-center gap-1.5">
              <Scissors className="w-4 h-4" /> Xóa thông tin liên hệ cũ
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={removePhones}
                  onChange={e => updateRemovePhones(e.target.checked)}
                  className="rounded border-border accent-sky-500"
                />
                <span>Tự xóa số điện thoại (0xxxxx, +84…)</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeZalo}
                  onChange={e => updateRemoveZalo(e.target.checked)}
                  className="rounded border-border accent-sky-500"
                />
                <span>Tự xóa link Zalo (zalo.me / tel:)</span>
              </label>
            </div>
            <textarea
              value={customRemove}
              onChange={e => updateCustomRemove(e.target.value)}
              rows={3}
              placeholder="Mỗi dòng = 1 chuỗi muốn xóa (vd: tên fanpage, hotline cố định, slogan cũ...)"
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-y font-mono"
            />
            {stripStats && (
              <div className="text-[11px] text-muted-foreground">
                ✂️ Đã xóa <span className="font-bold text-sky-400">{stripStats.count}</span> mục.
                {stripStats.samples.length > 0 && (
                  <span> Mẫu: <code className="text-[10px]">{stripStats.samples.slice(0, 5).join(' · ')}</code></span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg">
              {error}
            </div>
          )}

          {progress && (
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 text-sky-500 text-sm rounded-lg flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" /> {progress}
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
