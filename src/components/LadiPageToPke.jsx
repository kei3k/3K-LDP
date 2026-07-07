import { useState, useCallback } from 'react';
import { Download, Globe, Link as LinkIcon, Loader2, FileDown, Scissors, Image, X, CheckSquare, Square } from 'lucide-react';
import { generatePkeBuffer } from '../lib/htmlToPke';
import { translateLandingHtml } from '../lib/vertexTranslate';
import { reflowTranslatedPage } from '../lib/reflowLayout';
import { stripContactInfo } from '../lib/stripContacts';
import { extractImageUrls } from '../lib/imagesInHtml';
import { translateImageWithNanoBanana } from '../lib/translateImage';
import { APP_VERSION, BUILD_COMMIT, BUILD_DATE } from '../version';

const LANGUAGES = [
  { value: 'Tiếng Việt', label: '🇻🇳 Tiếng Việt' },
  { value: 'English', label: '🇺🇸 English' },
  { value: 'ภาษาไทย', label: '🇹🇭 ภาษาไทย' },
  { value: '中文', label: '🇨🇳 中文' },
  { value: '日本語', label: '🇯🇵 日本語' },
  { value: '한국어', label: '🇰🇷 한국어' },
  { value: 'Bahasa Indonesia', label: '🇮🇩 Bahasa Indonesia' },
];

const COST_PER_IMAGE = 0.04;

// Upload a translated image Blob to ImgBB and return its URL
async function uploadBlobToImgBB(blob) {
  const IMGBB_API_KEY = 'c82284897280ed2e46a1f3e5be11238b';
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const formData = new FormData();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', base64);

  const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
  const data = await res.json();
  if (data.success) return data.data.url;
  throw new Error(`ImgBB upload failed: ${JSON.stringify(data.error)}`);
}

// Apply a URL replacement map to HTML (handles both attr values and CSS url())
function applyUrlReplacements(html, urlMap) {
  let result = html;
  for (const [oldUrl, newUrl] of urlMap) {
    result = result.split(oldUrl).join(newUrl);
  }
  return result;
}

// ─── Image Selection Modal ────────────────────────────────────────────────────
function ImageSelectionModal({ images, onConfirm, onSkip }) {
  const [selected, setSelected] = useState(() => new Set(images.map((img) => img.url)));

  const toggle = (url) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === images.length) setSelected(new Set());
    else setSelected(new Set(images.map((img) => img.url)));
  };

  const selectedCount = selected.size;
  const estimatedCost = (selectedCount * COST_PER_IMAGE).toFixed(2);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onSkip(); }}
    >
      {/* Panel */}
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-bold text-base">Chọn ảnh cần dịch text</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Đã chọn{' '}
              <span className="font-bold text-sky-500">{selectedCount}/{images.length}</span> ảnh
              {' '}—{' '}ước tính cost:{' '}
              <span className="font-bold text-amber-500">${estimatedCost}</span>
            </p>
          </div>
          <button
            onClick={onSkip}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Select all toggle */}
        <div className="px-5 py-2 border-b border-border shrink-0">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {selected.size === images.length
              ? <CheckSquare className="w-4 h-4 text-sky-500" />
              : <Square className="w-4 h-4" />}
            {selected.size === images.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
        </div>

        {/* Image grid */}
        <div className="overflow-y-auto flex-1 p-4">
          <div className="grid grid-cols-3 gap-3">
            {images.map((img) => {
              const isChecked = selected.has(img.url);
              const filename = img.url.split('/').pop().split('?')[0].substring(0, 28) || img.url.substring(0, 28);
              return (
                <button
                  key={img.url}
                  onClick={() => toggle(img.url)}
                  className={`relative rounded-lg border-2 overflow-hidden text-left transition-all ${
                    isChecked
                      ? 'border-sky-500 ring-1 ring-sky-500/30'
                      : 'border-border opacity-60'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    <img
                      src={`/api/fetch-url?url=${encodeURIComponent(img.url)}`}
                      alt={filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="hidden w-full h-full items-center justify-center">
                      <Image className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  </div>

                  {/* Info bar */}
                  <div className="px-2 py-1.5 bg-card">
                    <p className="text-[10px] text-muted-foreground truncate" title={img.url}>
                      {filename}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] bg-muted px-1 rounded">{img.source}</span>
                      {img.sizeHint && (
                        <span className="text-[9px] text-muted-foreground">~{img.sizeHint}KB</span>
                      )}
                    </div>
                  </div>

                  {/* Checkmark overlay */}
                  <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center ${
                    isChecked ? 'bg-sky-500 text-white' : 'bg-black/40 text-white/60'
                  }`}>
                    {isChecked ? '✓' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={onSkip}
            className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Bỏ qua dịch ảnh
          </button>
          <button
            onClick={() => onConfirm([...selected])}
            disabled={selectedCount === 0}
            className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Dịch {selectedCount} ảnh được chọn
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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
  const [translateImages, setTranslateImages] = useState(
    () => localStorage.getItem('ladipage_translate_images') === 'true'
  );

  // Modal state
  const [modalImages, setModalImages] = useState(null); // null = closed, array = open
  const [modalResolve, setModalResolve] = useState(null); // resolve fn for the promise

  const updateRemovePhones = (v) => { setRemovePhones(v); localStorage.setItem('ladipage_remove_phones', String(v)); };
  const updateRemoveZalo = (v) => { setRemoveZalo(v); localStorage.setItem('ladipage_remove_zalo', String(v)); };
  const updateCustomRemove = (v) => { setCustomRemove(v); localStorage.setItem('ladipage_remove_custom', v); };

  const updateTranslateImages = (v) => {
    setTranslateImages(v);
    localStorage.setItem('ladipage_translate_images', String(v));
  };

  const handleLanguageChange = (e) => {
    const val = e.target.value;
    setLanguage(val);
    localStorage.setItem('ladipage_language', val);
  };

  // Opens the modal and returns a Promise<string[]> — resolves with selected URLs or [] if skipped
  const openImageModal = useCallback((images) => {
    return new Promise((resolve) => {
      setModalImages(images);
      setModalResolve(() => resolve);
    });
  }, []);

  const handleModalConfirm = (selectedUrls) => {
    setModalImages(null);
    modalResolve?.(selectedUrls);
    setModalResolve(null);
  };

  const handleModalSkip = () => {
    setModalImages(null);
    modalResolve?.([]);
    setModalResolve(null);
  };

  const handleConvert = async () => {
    if (!url.trim()) {
      setError('Vui lòng nhập URL LadiPage');
      return;
    }

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
      const proxyUrl = `/api/fetch-url?url=${encodeURIComponent(url)}`;
      // Retry up to 3 times: some hosts (Webcake CDN, Shopee) intermittently
      // time out or block. Backoff 1.5s → 3s → final attempt.
      // Exception: a BLOCKED_TARGET response is a deliberate security
      // decision (private/reserved IP), not a flake — retrying it can only
      // ever produce the same block, so we stop immediately instead of
      // burning 4.5s of backoff on a foregone conclusion.
      const maxAttempts = 3;
      let res = null;
      let lastErr = null;
      let lastBody = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        setProgress(
          attempt === 1
            ? '🌐 Đang tải HTML từ URL...'
            : `🔄 Đang thử lại lần ${attempt}/${maxAttempts}...`,
        );
        try {
          res = await fetch(proxyUrl);
          if (res.ok) break;
          lastBody = await res.json().catch(() => null);
          lastErr = new Error(lastBody?.error || `HTTP ${res.status}`);
          if (lastBody?.code === 'BLOCKED_TARGET') break;
        } catch (netErr) {
          lastErr = netErr;
          lastBody = null;
          res = null;
        }
        if (attempt < maxAttempts && lastBody?.code !== 'BLOCKED_TARGET') {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
      if (!res || !res.ok) {
        const code = lastBody?.code;
        let msg;
        if (code === 'BLOCKED_TARGET') {
          msg = 'Địa chỉ này không được phép tải (chặn bảo mật).';
        } else if (code === 'TARGET_HTTP_ERROR') {
          msg = `Trang đích trả lỗi HTTP ${lastBody?.targetStatus ?? ''}, thử lại sau.`.replace('  ', ' ');
        } else if (code === 'TARGET_UNREACHABLE' || !res) {
          msg = 'Không kết nối được trang đích (mạng hoặc site sập).';
        } else {
          msg = `Không thể tải trang sau ${maxAttempts} lần thử. ${lastErr?.message || ''}`;
        }
        throw new Error(msg);
      }

      let html = await res.text();

      if (!html || html.length < 100) {
        throw new Error('Nội dung HTML quá ngắn hoặc trống.');
      }

      // Extract title for filename
      let title = 'LadiPage';
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }

      // Strip contact info BEFORE translation
      setStripStats(null);
      if (removePhones || removeZalo || customRemove.trim()) {
        setProgress('✂️ Đang xóa hotline / Zalo cũ...');
        const customStrings = customRemove.split('\n').map((s) => s.trim()).filter(Boolean);
        const stripped = stripContactInfo(html, {
          removePhones,
          removeZalo,
          customStrings,
          onProgress: setProgress,
        });
        html = stripped.html;
        setStripStats({ count: stripped.removedCount, samples: stripped.samples });
      }

      // ── Image translation step ────────────────────────────────────────────
      // Works for ANY target language including Vietnamese (source might be Thai/Chinese)
      if (translateImages) {
        setProgress('🔍 Đang scan ảnh trong trang...');

        const allImages = extractImageUrls(html, url);

        if (allImages.length > 0) {
          // Suspend loading indicator — show modal (user interaction needed)
          setProgress('');
          setIsLoading(false);

          const selectedUrls = await openImageModal(allImages);

          setIsLoading(true);

          if (selectedUrls.length > 0) {
            const urlMap = new Map();

            for (let i = 0; i < selectedUrls.length; i++) {
              const imgUrl = selectedUrls[i];
              const filename = imgUrl.split('/').pop().split('?')[0] || `ảnh ${i + 1}`;
              setProgress(`🖼 Dịch ảnh ${i + 1}/${selectedUrls.length}: ${filename}`);

              try {
                // Download via proxy to avoid CORS issues
                const imgRes = await fetch(`/api/fetch-url?url=${encodeURIComponent(imgUrl)}`);
                if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
                const originalBlob = await imgRes.blob();

                // Translate via Nano Banana 2
                const translatedBlob = await translateImageWithNanoBanana(
                  originalBlob,
                  language,
                  (msg) => setProgress(`🖼 Ảnh ${i + 1}/${selectedUrls.length} — ${msg}`)
                );

                // Rehost translated image on ImgBB
                setProgress(`☁️ Đang upload ảnh ${i + 1}/${selectedUrls.length} lên ImgBB...`);
                const newUrl = await uploadBlobToImgBB(translatedBlob);
                urlMap.set(imgUrl, newUrl);
              } catch (err) {
                console.warn(`[ImageTranslate] Bỏ qua ảnh ${imgUrl}:`, err.message);
                setProgress(`⚠️ Bỏ qua ảnh ${i + 1} (${err.message})`);
                // Continue with remaining images
                await new Promise((r) => setTimeout(r, 800));
              }
            }

            if (urlMap.size > 0) {
              setProgress(`🔗 Đang thay thế ${urlMap.size} URL ảnh trong HTML...`);
              html = applyUrlReplacements(html, urlMap);
            }
          }
        } else {
          setProgress('ℹ️ Không tìm thấy ảnh phù hợp để dịch.');
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      // ── End image translation ─────────────────────────────────────────────

      // Always translate when a target language is picked — source may be Thai
      // (dealmobi.click), Chinese, English… and customer wants VN output.
      // translateLandingHtml itself handles identity (source==target) cheaply.
      if (language) {
        const htmlBeforeTranslate = html;
        html = await translateLandingHtml(html, language, setProgress);

        // Measure-and-shift reflow: a REAL translation (e.g. Chinese→Vietnamese)
        // can make text wrap onto more lines than the fixed-height box copied
        // from LadiPage's CSS, overlapping whatever sits below it. Grow the box
        // + shift siblings down to compensate. No-op (and zero risk) when
        // translateLandingHtml took the same-language skip path, since then
        // htmlBeforeTranslate === html and reflowTranslatedPage short-circuits.
        if (html !== htmlBeforeTranslate) {
          setProgress('📐 Đang kiểm tra & giãn layout theo bản dịch...');
          try {
            html = reflowTranslatedPage(htmlBeforeTranslate, html);
          } catch (err) {
            console.warn('[LadiPageToPke] reflow failed, continuing with unshifted layout:', err?.message);
          }
        }
      }

      setProgress('📦 Đang đóng gói PKE...');
      const pkeBase64 = generatePkeBuffer(html, title);

      const blob = new Blob([pkeBase64], { type: 'application/octet-stream' });

      let domain = 'export';
      try {
        domain = new URL(url).hostname.replace('www.', '');
      } catch (e) {}

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

  const isVietnamese = language === 'Tiếng Việt';

  return (
    <>
      {/* Image selection modal */}
      {modalImages && (
        <ImageSelectionModal
          images={modalImages}
          onConfirm={handleModalConfirm}
          onSkip={handleModalSkip}
        />
      )}

      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-background">
        <div className="max-w-2xl mx-auto w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-sky-500/10 text-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Globe className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2 flex-wrap">
              LadiPage → Webcake (.pke)
              <span
                className="text-xs bg-sky-500/15 text-sky-500 dark:bg-sky-500/20 dark:text-sky-300 px-2 py-1 rounded-full font-mono font-medium"
                title={`Build commit ${BUILD_COMMIT} · ${BUILD_DATE}`}
              >
                v{APP_VERSION} · {BUILD_COMMIT}
              </span>
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
              {LANGUAGES.map((l) => (
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

            {/* Image translation toggle — always available
                (e.g. cloning Thai landing → Vietnamese needs image translation too) */}
            <div className="border border-violet-200 dark:border-violet-800/40 rounded-lg p-3 bg-violet-50/50 dark:bg-violet-900/10">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={translateImages}
                  onChange={(e) => updateTranslateImages(e.target.checked)}
                  className="rounded border-border accent-violet-500 w-4 h-4"
                />
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Image className="w-4 h-4 text-violet-500" />
                  Dịch cả text trong ảnh sang <span className="text-violet-500">{language}</span> (Nano Banana 2)
                </span>
              </label>
              {translateImages && (
                <p className="text-[11px] text-muted-foreground mt-1.5 ml-6">
                  Sẽ hiện bảng chọn ảnh sau khi tải xong HTML. Mỗi ảnh ~$0.04.
                </p>
              )}
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
                    onChange={(e) => updateRemovePhones(e.target.checked)}
                    className="rounded border-border accent-sky-500"
                  />
                  <span>Tự xóa số điện thoại (0xxxxx, +84…)</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeZalo}
                    onChange={(e) => updateRemoveZalo(e.target.checked)}
                    className="rounded border-border accent-sky-500"
                  />
                  <span>Tự xóa link Zalo (zalo.me / tel:)</span>
                </label>
              </div>
              <textarea
                value={customRemove}
                onChange={(e) => updateCustomRemove(e.target.value)}
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
    </>
  );
}
