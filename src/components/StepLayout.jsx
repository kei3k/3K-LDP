import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Layout, Image, X, Eye, EyeOff, RefreshCw } from 'lucide-react';

/**
 * Extract all image URLs from HTML:
 * - <img src="URL">
 * - url(URL) anywhere (inline styles, <style> blocks, CSS background shorthand)
 * - data-src, data-original (lazy loading)
 */
function extractImagesFromHtml(html) {
  if (!html) return [];
  const images = [];
  const seen = new Set();
  
  // 1. All url(...) patterns — catches background-image, background shorthand, etc.
  const urlRegex = /url\s*\(\s*["']?([^"')]+?)["']?\s*\)/gi;
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].trim();
    if (url && !seen.has(url) && !url.startsWith('data:') && /^https?:\/\//i.test(url)) {
      seen.add(url);
      images.push({ url, type: 'bg' });
    }
  }
  
  // 2. <img src="URL">
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((m = imgRegex.exec(html)) !== null) {
    const url = m[1].trim();
    if (url && !seen.has(url) && !url.startsWith('data:')) {
      seen.add(url);
      images.push({ url, type: 'img' });
    }
  }
  
  // 3. data-src, data-original (lazy loading)
  const dataSrcRegex = /data-(?:src|original|lazy-src)\s*=\s*["']([^"']+)["']/gi;
  while ((m = dataSrcRegex.exec(html)) !== null) {
    const url = m[1].trim();
    if (url && !seen.has(url) && !url.startsWith('data:') && /^https?:\/\//i.test(url)) {
      seen.add(url);
      images.push({ url, type: 'img' });
    }
  }
  
  return images;
}

/**
 * Build CSS-only hide rules (no HTML mutation)
 */
function buildHideCss(hiddenUrls) {
  if (!hiddenUrls || hiddenUrls.length === 0) return '';
  const rules = hiddenUrls.map(url => {
    const esc = CSS.escape ? CSS.escape(url) : url.replace(/[\\/:.*+?^${}()|[\]]/g, '\\$&');
    return [
      `img[src*="${esc}"] { visibility: hidden !important; max-height: 0 !important; overflow: hidden !important; }`,
      `[data-ldp-hide-${hiddenUrls.indexOf(url)}] { visibility: hidden !important; max-height: 0 !important; overflow: hidden !important; }`,
    ].join('\n');
  });
  return `<style id="ldp-hide">\n${rules.join('\n')}\n</style>`;
}

/**
 * Replace image URLs in HTML string (for replacements — targeted, not global)
 */
function applyReplacements(html, replacements) {
  if (!html || !replacements) return html;
  let result = html;
  for (const [original, replacement] of Object.entries(replacements)) {
    // Use targeted replacement — only in src, url(), data-src contexts
    const escaped = escapeRegex(original);
    // src="URL"
    const srcRe = new RegExp('(src\\s*=\\s*["\'])' + escaped + '(["\'])', 'gi');
    result = result.replace(srcRe, '$1' + replacement + '$2');
    // url(URL)
    const bgRe = new RegExp('(url\\s*\\(\\s*["\']?)' + escaped + '(["\']?\\s*\\))', 'gi');
    result = result.replace(bgRe, '$1' + replacement + '$2');
    // data-src, data-original, etc
    const dataRe = new RegExp('(data-(?:src|original|lazy-src|bg-src)\\s*=\\s*["\'])' + escaped + '(["\'])', 'gi');
    result = result.replace(dataRe, '$1' + replacement + '$2');
  }
  return result;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Targeted image URL replacement — only replaces URLs in image-specific contexts:
 * 1. <img ... src="URL" ...> 
 * 2. background-image: url(URL)
 * 3. background: ... url(URL) ...
 * Does NOT touch URLs inside <script>, <style> rules, data attributes, etc.
 */
function replaceImageUrls(html, urlsToReplace, replacement) {
  if (!html || !urlsToReplace || urlsToReplace.length === 0) return html;
  let result = html;
  
  for (const url of urlsToReplace) {
    const escaped = escapeRegex(url);
    
    // 1. Replace in <img src="URL"> and <img src='URL'> - match the URL inside src attribute
    const imgSrcRegex = new RegExp('(src\\s*=\\s*["\'])' + escaped + '(["\'])', 'gi');
    result = result.replace(imgSrcRegex, '$1' + replacement + '$2');
    
    // 2. Replace in background-image: url(URL) and background: url(URL)
    const bgRegex = new RegExp('(url\\s*\\(\\s*["\']?)' + escaped + '(["\']?\\s*\\))', 'gi');
    result = result.replace(bgRegex, '$1' + replacement + '$2');
    
    // 3. Replace in data-src, data-original, data-lazy-src (common lazy loading attributes)
    const dataSrcRegex = new RegExp('(data-(?:src|original|lazy-src|bg-src)\\s*=\\s*["\'])' + escaped + '(["\'])', 'gi');
    result = result.replace(dataSrcRegex, '$1' + replacement + '$2');
  }
  
  return result;
}

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Build final processed HTML: apply replacements + replace hidden image URLs with transparent pixel
 */
function buildFinalHtml(srcHtml, replacements, hiddenUrls) {
  if (!srcHtml) return '';
  // 1. Apply image replacements (swap URLs)
  let result = applyReplacements(srcHtml, replacements);
  
  // 2. For hidden images: use DOMParser to REMOVE elements (not just replace URL)
  if (hiddenUrls && hiddenUrls.length > 0) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(result, 'text/html');
      
      for (const url of hiddenUrls) {
        // Remove <img> elements with this URL
        doc.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src') || '';
          const dataSrc = img.getAttribute('data-src') || '';
          if (src.includes(url) || dataSrc.includes(url)) {
            const par = img.parentElement;
            img.remove();
            // Collapse empty parent
            if (par && !par.textContent.trim() && par.querySelectorAll('img, video, iframe, canvas, input, select, button').length === 0) {
              par.style.display = 'none';
            }
          }
        });
        
        // Remove background-image containers with this URL (inline style)
        doc.querySelectorAll('[style]').forEach(el => {
          const style = el.getAttribute('style') || '';
          if (style.includes(url)) {
            if (!el.textContent.trim() && el.querySelectorAll('img, video, iframe, input, select, button').length === 0) {
              el.style.display = 'none';
            } else {
              el.style.backgroundImage = 'none';
            }
          }
        });
        
        // Also handle url() references in <style> blocks
        doc.querySelectorAll('style').forEach(styleEl => {
          if (styleEl.textContent.includes(url)) {
            const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            styleEl.textContent = styleEl.textContent.replace(
              new RegExp(`url\\(['"]*${escaped}['"]*\\)`, 'g'),
              `url(${TRANSPARENT_PIXEL})`
            );
          }
        });
      }
      
      let newHtml = '';
      if (doc.doctype) {
        newHtml = new XMLSerializer().serializeToString(doc.doctype) + '\n';
      }
      newHtml += doc.documentElement.outerHTML;
      result = newHtml;
    } catch (err) {
      console.warn('[LDP] DOMParser hidden image removal failed, falling back to regex:', err);
      result = replaceImageUrls(result, hiddenUrls, TRANSPARENT_PIXEL);
    }
  }
  
  return result;
}

/**
 * Step 2: Preview template layout with image management panel
 */
export default function StepLayout({ html, onProceed, productImages, onPrev, isBuilding }) {
  const iframeRef = useRef(null);
  const [showPanel, setShowPanel] = useState(true);
  const [selectedProductImg, setSelectedProductImg] = useState(null);
  const [hiddenImages, setHiddenImages] = useState({}); // { url: true }
  const [replacements, setReplacements] = useState({});
  const [iframeKey, setIframeKey] = useState(0);

  const templateImages = useMemo(() => extractImagesFromHtml(html), [html]);
  
  const hiddenUrls = useMemo(
    () => Object.keys(hiddenImages).filter(k => hiddenImages[k]),
    [hiddenImages]
  );

  // Preview: targeted replacement of hidden image URLs with transparent pixel
  const previewHtml = useMemo(() => {
    if (!html) return '';
    let result = applyReplacements(html, replacements);
    result = replaceImageUrls(result, hiddenUrls, TRANSPARENT_PIXEL);
    return result;
  }, [html, replacements, hiddenUrls]);

  // Use blob URL for preview iframe (more reliable than doc.write for complex HTML)
  const previewBlobUrl = useMemo(() => {
    if (!previewHtml) return null;
    const blob = new Blob([previewHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [previewHtml]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); };
  }, [previewBlobUrl]);

  const reloadIframe = () => setIframeKey(k => k + 1);

  // When moving to next step: build FINAL html with actual removal (not just CSS hide)
  const getProcessedHtml = useCallback(() => {
    return buildFinalHtml(html, replacements, hiddenUrls);
  }, [html, replacements, hiddenUrls]);

  const handleNext = (skipTranslation) => {
    const processed = getProcessedHtml();
    onProceed?.(processed, skipTranslation);
  };

  const handleReplace = (originalUrl) => {
    if (selectedProductImg) {
      setReplacements(prev => ({ ...prev, [originalUrl]: selectedProductImg }));
      setSelectedProductImg(null);
    }
  };

  const handleToggleHide = (url) => {
    setHiddenImages(prev => {
      const next = { ...prev };
      if (next[url]) { delete next[url]; } else { next[url] = true; }
      return next;
    });
  };

  const handleResetImage = (url) => {
    setReplacements(prev => { const n = { ...prev }; delete n[url]; return n; });
    setHiddenImages(prev => { const n = { ...prev }; delete n[url]; return n; });
  };

  if (isBuilding) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Đang dựng layout...</p>
        </div>
      </div>
    );
  }

  const modifiedCount = Object.keys(replacements).length + hiddenUrls.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPanel(!showPanel)}
            className={`px-2 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1 ${
              showPanel ? 'border-primary text-primary bg-primary/10' : 'border-border hover:bg-muted'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            Ảnh ({templateImages.length})
            {modifiedCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-500 text-white text-[9px]">{modifiedCount}</span>}
          </button>
          <button
            onClick={reloadIframe}
            className="px-2 py-1 text-xs rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Reload
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onPrev} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
            ← Quay lại
          </button>
          <button onClick={() => handleNext(true)} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            ⚡ Hoàn thành (không dịch)
          </button>
          <button onClick={() => handleNext(false)} className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
            Dịch text →
          </button>
        </div>
      </div>

      {/* Content: panel + preview */}
      <div className="flex-1 flex min-h-0">
        {/* Image management panel */}
        {showPanel && (
          <div className="w-[280px] flex-shrink-0 border-r border-border bg-card overflow-y-auto">
            {/* Product images */}
            {productImages && productImages.length > 0 && (
              <div className="p-3 border-b border-border">
                <h3 className="text-[11px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                  Ảnh sản phẩm (chọn để thay)
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {productImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedProductImg(selectedProductImg === url ? null : url)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedProductImg === url
                          ? 'border-blue-500 ring-2 ring-blue-500/30 scale-95'
                          : 'border-border hover:border-primary'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                {selectedProductImg && (
                  <p className="text-[10px] text-blue-400 mt-1.5 animate-pulse">
                    👆 Click ảnh template bên dưới để thay thế
                  </p>
                )}
              </div>
            )}

            {/* Template images */}
            <div className="p-3">
              <h3 className="text-[11px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                Ảnh trong template ({templateImages.length})
              </h3>
              <div className="space-y-2">
                {templateImages.map((img, i) => {
                  const isHidden = !!hiddenImages[img.url];
                  const isReplaced = replacements[img.url];
                  const displayUrl = isReplaced || img.url;
                  
                  return (
                    <div key={i} className={`rounded-lg border overflow-hidden transition-all ${
                      isHidden ? 'border-red-500/50 opacity-50' : 
                      isReplaced ? 'border-green-500' : 
                      selectedProductImg ? 'border-blue-500/50 cursor-pointer hover:border-blue-500' :
                      'border-border'
                    }`}>
                      <div 
                        className="relative aspect-video bg-black/10"
                        onClick={() => selectedProductImg && handleReplace(img.url)}
                      >
                        {!isHidden && (
                          <img src={displayUrl} alt="" className="w-full h-full object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                        {isHidden && (
                          <div className="w-full h-full flex items-center justify-center text-red-400 text-xs">Đã ẩn</div>
                        )}
                        {isReplaced && (
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-green-600 text-white text-[9px] rounded">Đã thay</div>
                        )}
                        <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-[9px] rounded">
                          {img.type === 'bg' ? 'BG' : 'IMG'} #{i + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 p-1.5 bg-muted/50">
                        <button
                          onClick={() => handleToggleHide(img.url)}
                          className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors flex items-center justify-center gap-1 ${
                            isHidden ? 'bg-red-500/20 text-red-400' : 'hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          {isHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {isHidden ? 'Hiện' : 'Ẩn'}
                        </button>
                        <button
                          onClick={() => {
                            const url = window.prompt('Nhập URL ảnh thay thế:', selectedProductImg || '');
                            if (url && url.trim()) {
                              setReplacements(prev => ({ ...prev, [img.url]: url.trim() }));
                              setSelectedProductImg(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-[10px] rounded hover:bg-blue-500/20 text-blue-400 flex items-center justify-center gap-1"
                        >
                          🔗 Thay URL
                        </button>
                        {(isReplaced || isHidden) && (
                          <button onClick={() => handleResetImage(img.url)}
                            className="flex-1 px-2 py-1 text-[10px] rounded hover:bg-muted text-muted-foreground flex items-center justify-center gap-1">
                            <X className="w-3 h-3" /> Reset
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Preview iframe */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-900">
          {previewBlobUrl ? (
            <iframe
              key={`${iframeKey}-${previewBlobUrl}`}
              src={previewBlobUrl}
              title="Layout Preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Chưa có layout
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
