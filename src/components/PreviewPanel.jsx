import { useState, useMemo, useRef } from 'react';
import { Monitor, Smartphone, Tablet, Edit3, ChevronDown, Scissors } from 'lucide-react';
import HtmlEditor from './HtmlEditor';

const DEVICES = [
  { id: 'iphone-se', label: 'iPhone SE', w: 375, h: 667, cat: 'mobile' },
  { id: 'iphone-14', label: 'iPhone 14', w: 390, h: 844, cat: 'mobile' },
  { id: 'iphone-15-pro', label: 'iPhone 15 Pro', w: 393, h: 852, cat: 'mobile' },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', w: 430, h: 932, cat: 'mobile' },
  { id: 'galaxy-s24', label: 'Galaxy S24', w: 360, h: 780, cat: 'mobile' },
  { id: 'galaxy-s24-ultra', label: 'Galaxy S24 Ultra', w: 412, h: 915, cat: 'mobile' },
  { id: 'pixel-8', label: 'Pixel 8', w: 412, h: 915, cat: 'mobile' },
  { id: 'ipad-mini', label: 'iPad Mini', w: 744, h: 1133, cat: 'tablet' },
  { id: 'ipad-air', label: 'iPad Air', w: 820, h: 1180, cat: 'tablet' },
  { id: 'ipad-pro', label: 'iPad Pro 12.9"', w: 1024, h: 1366, cat: 'tablet' },
  { id: 'desktop-hd', label: 'Desktop HD', w: 1280, h: 800, cat: 'desktop' },
  { id: 'desktop-fhd', label: 'Desktop FHD', w: 1920, h: 1080, cat: 'desktop' },
  { id: 'responsive', label: '100% Chiều rộng', w: 0, h: 0, cat: 'responsive' },
];

/**
 * Section picker script — visual only, no postMessage
 * User clicks sections to delete them visually from iframe DOM
 * Parent reads iframe contentDocument to capture final state
 */
function buildSectionPickerScript() {
  var lines = [
    '<script>',
    '(function(){',
    '  var hl=document.createElement("div");',
    '  hl.setAttribute("data-ldp-ui","1");',
    '  hl.style.cssText="position:fixed;pointer-events:none;border:3px dashed red;z-index:99998;display:none;transition:all 0.15s;";',
    '  document.body.appendChild(hl);',
    '  var ov=document.createElement("div");',
    '  ov.setAttribute("data-ldp-ui","1");',
    '  ov.style.cssText="position:fixed;top:0;left:0;right:0;padding:12px;background:rgba(239,68,68,0.95);color:white;font:bold 14px sans-serif;text-align:center;z-index:99999;pointer-events:none;";',
    '  ov.textContent="Click vao section muon XOA";',
    '  document.body.appendChild(ov);',
    '  function realKids(par){',
    '    var arr=[];',
    '    for(var i=0;i<par.children.length;i++){',
    '      var c=par.children[i];',
    '      if(!c.hasAttribute("data-ldp-ui")&&c.tagName!=="SCRIPT")arr.push(c);',
    '    }',
    '    return arr;',
    '  }',
    '  function findSec(el){',
    '    if(!el||el===document.body)return null;',
    '    var p=el;',
    '    while(p&&p.parentElement){',
    '      var par=p.parentElement;',
    '      var kids=realKids(par);',
    '      if(par===document.body||kids.length>=2){',
    '        if(p.offsetHeight>20){',
    '          return p;',
    '        }',
    '      }',
    '      p=par;',
    '    }',
    '    return null;',
    '  }',
    '  var cur=null;',
    '  document.addEventListener("mouseover",function(e){',
    '    if(e.target.hasAttribute&&e.target.hasAttribute("data-ldp-ui"))return;',
    '    var s=findSec(e.target);',
    '    if(s&&s!==cur){',
    '      cur=s;var r=s.getBoundingClientRect();',
    '      hl.style.display="block";hl.style.top=r.top+"px";hl.style.left=r.left+"px";hl.style.width=r.width+"px";hl.style.height=r.height+"px";',
    '    }',
    '  });',
    '  document.addEventListener("click",function(e){',
    '    e.preventDefault();e.stopPropagation();',
    '    if(e.target.hasAttribute&&e.target.hasAttribute("data-ldp-ui"))return;',
    '    var s=findSec(e.target);',
    '    if(s){',
    '      hl.style.display="none";',
    '      s.remove();cur=null;',
    '      ov.textContent="Da xoa! Click tiep de xoa them, hoac nhan Luu xoa.";',
    '    }',
    '  },true);',
    '})();',
    '</script>',
  ];
  return lines.join('\n');
}

export default function PreviewPanel({ html, onUpdateHtml }) {
  const [device, setDevice] = useState('iphone-15-pro');
  const [editing, setEditing] = useState(false);
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [sectionMode, setSectionMode] = useState(false);
  const iframeRef = useRef(null);

  // Inject section picker script when sectionMode is on
  const displayHtml = useMemo(() => {
    if (!html) return null;
    if (!sectionMode) return html;
    var script = buildSectionPickerScript();
    if (html.includes('</body>')) {
      return html.replace('</body>', script + '\n</body>');
    }
    return html + script;
  }, [html, sectionMode]);

  const selectedDevice = DEVICES.find(d => d.id === device) || DEVICES[2];
  const isResponsive = selectedDevice.cat === 'responsive';

  const blobUrl = useMemo(() => {
    if (!displayHtml) return null;
    const blob = new Blob([displayHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [displayHtml]);

  /**
   * Save section changes by reading iframe contentDocument DIRECTLY
   * No postMessage needed — blob URL + allow-same-origin = accessible
   */
  const saveSectionChanges = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) { console.warn('[LDP] No iframe ref'); return; }
      
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { console.warn('[LDP] Cannot access iframe document'); return; }
      
      // Remove injected UI elements
      doc.querySelectorAll('[data-ldp-ui]').forEach(el => el.remove());
      // Remove section picker script
      doc.querySelectorAll('script').forEach(s => {
        if (s.textContent && s.textContent.includes('data-ldp-ui')) s.remove();
      });
      
      // Capture clean HTML
      let newHtml = '';
      if (doc.doctype) {
        newHtml = new XMLSerializer().serializeToString(doc.doctype) + '\n';
      }
      newHtml += doc.documentElement.outerHTML;
      
      onUpdateHtml?.(newHtml);
      setSectionMode(false);
      console.log('[LDP] Section changes saved! Length:', newHtml.length);
    } catch (err) {
      console.error('[LDP] Failed to save section changes:', err);
      alert('Không lưu được. Lỗi: ' + err.message);
    }
  };

  /**
   * Get visible text from an element — recursively walks DOM but SKIPS
   * children that are display:none or visibility:hidden.
   * This is the key difference from el.textContent (which includes hidden text).
   */
  const getVisibleText = (el, win) => {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        // Text node — always visible if parent is visible
        text += node.textContent;
      } else if (node.nodeType === 1) {
        // Element node — check if visible before recursing
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue;
        try {
          const cs = win.getComputedStyle(node);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          text += getVisibleText(node, win);
        } catch(e) {}
      }
    }
    return text;
  };

  /**
   * Check if element is a "gap" — visually empty, safe to collapse.
   * Returns true ONLY if the element has:
   * - No visible text (per getVisibleText)
   * - No visible media (img, video, iframe, canvas, svg — excluding transparent pixels)
   * - No visible form elements (input, select, textarea, button)
   * - No meaningful background color (non-white, non-transparent)
   * - Not sticky/fixed positioned
   */
  const isGapElement = (el, win, tp) => {
    try {
      const cs = win.getComputedStyle(el);
      // Never collapse sticky/fixed (navigation bars, headers)
      if (cs.position === 'sticky' || cs.position === 'fixed') return false;
      // Already hidden
      if (cs.display === 'none') return false;
      // Must take up space to be a "gap"
      if (el.offsetHeight < 10) return false;

      // 1. Has visible text? → not a gap
      if (getVisibleText(el, win).trim()) return false;

      // 2. Has visible media? (excluding transparent pixel imgs)
      const media = el.querySelectorAll('img, video, iframe, canvas, svg');
      for (const m of media) {
        try {
          const mcs = win.getComputedStyle(m);
          if (mcs.display === 'none' || mcs.visibility === 'hidden') continue;
          if (m.tagName === 'IMG' && m.src && m.src.indexOf(tp) !== -1) continue;
          return false; // Real visible media
        } catch(e) { return false; }
      }

      // 3. Has visible form elements?
      const forms = el.querySelectorAll('input, select, textarea, button, a');
      for (const f of forms) {
        try {
          const fcs = win.getComputedStyle(f);
          if (fcs.display === 'none' || fcs.visibility === 'hidden') continue;
          return false; // Visible interactive element
        } catch(e) { return false; }
      }

      // 4. Has meaningful background? (colored backgrounds are visual content)
      const bgColor = cs.backgroundColor;
      if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
        // White/near-white backgrounds are NOT visual content
        if (bgColor !== 'rgb(255, 255, 255)' && bgColor !== 'rgba(255, 255, 255, 1)') {
          return false; // Colored background = visual content, don't collapse
        }
      }
      const bgImg = cs.backgroundImage;
      if (bgImg && bgImg !== 'none' && bgImg.indexOf(tp) === -1 && bgImg.indexOf('data:image/gif') === -1) {
        return false; // Real background image
      }

      return true; // Truly a gap — safe to collapse
    } catch(e) { return false; }
  };

  /**
   * Layout cleanup: remove transparent-pixel gaps + collapse empty containers.
   * Uses getVisibleText() to accurately detect text in visible DOM branches.
   * Only sets display:none — never modifies padding/margin/colors.
   */
  const cleanupLayout = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) { alert('Không tìm thấy iframe'); return; }
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { alert('Không truy cập được iframe document. Thử reload lại.'); return; }
      
      const win = doc.defaultView || iframe.contentWindow;
      const tp = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP';
      let removed = 0;
      
      // 1. Remove transparent pixel <img> elements
      doc.querySelectorAll('img').forEach(img => {
        if (img.src && img.src.indexOf(tp) !== -1) {
          img.remove();
          removed++;
        }
      });
      
      // 2. Clear transparent pixel inline backgrounds
      doc.querySelectorAll('[style]').forEach(el => {
        const style = el.getAttribute('style') || '';
        if (style.includes(tp)) {
          el.style.backgroundImage = 'none';
        }
      });
      
      // 3. Fix <style> blocks with transparent pixel URLs
      doc.querySelectorAll('style').forEach(styleEl => {
        if (styleEl.textContent && styleEl.textContent.includes(tp)) {
          const escaped = tp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          styleEl.textContent = styleEl.textContent.replace(
            new RegExp(`url\\(['\"]?${escaped}[^)]*['\"]?\\)`, 'g'),
            'none'
          );
        }
      });
      
      // 4. Collapse gap containers (bottom-up: deepest first)
      //    Uses getVisibleText + isGapElement for accurate detection
      const containers = Array.from(
        doc.querySelectorAll('div, section, article, main, aside, figure, header, footer')
      );
      // Sort by depth (deepest first) for proper cascading
      containers.sort((a, b) => {
        let dA = 0, dB = 0, n = a;
        while (n) { dA++; n = n.parentElement; }
        n = b;
        while (n) { dB++; n = n.parentElement; }
        return dB - dA;
      });
      for (const el of containers) {
        if (!el.parentElement) continue;
        if (el === doc.body || el === doc.documentElement) continue;
        if (isGapElement(el, win, tp)) {
          el.style.display = 'none';
          removed++;
        }
      }
      
      // 5. Remove LDP injected scripts and UI
      doc.querySelectorAll('[data-ldp-ui]').forEach(el => el.remove());
      doc.querySelectorAll('script').forEach(s => {
        if (s.textContent && (s.textContent.includes('data-ldp-ui') || s.id === 'ldp-layout-cleanup')) s.remove();
      });
      
      // 6. Capture cleaned HTML
      let newHtml = '';
      if (doc.doctype) {
        newHtml = new XMLSerializer().serializeToString(doc.doctype) + '\n';
      }
      newHtml += doc.documentElement.outerHTML;
      onUpdateHtml?.(newHtml);
      console.log(`[LDP] Layout cleanup done: removed/hidden ${removed} elements`);
      alert(`Đã sắp xếp lại! Đã xử lý ${removed} phần tử.`);
    } catch (err) {
      console.error('[LDP] Layout cleanup failed:', err);
      alert('Lỗi: ' + err.message);
    }
  };

  if (!html) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="text-6xl">🚀</div>
          <h2 className="text-xl font-bold">Sẵn sàng tạo Landing Page</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nhập thông tin sản phẩm ở sidebar để bắt đầu
          </p>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <HtmlEditor
        html={html}
        onSave={(newHtml) => { onUpdateHtml?.(newHtml); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const getPreviewStyle = () => {
    if (isResponsive) return { width: '100%', height: '100%' };
    return { width: `${selectedDevice.w}px`, maxWidth: '100%', height: '100%' };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 flex-shrink-0">
        {/* Device selector */}
        <div className="relative">
          <button
            onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-all"
          >
            {selectedDevice.cat === 'mobile' && <Smartphone className="w-4 h-4" />}
            {selectedDevice.cat === 'tablet' && <Tablet className="w-4 h-4" />}
            {(selectedDevice.cat === 'desktop' || selectedDevice.cat === 'responsive') && <Monitor className="w-4 h-4" />}
            <span>{selectedDevice.label}</span>
            {!isResponsive && <span className="text-xs text-muted-foreground">{selectedDevice.w}x{selectedDevice.h}</span>}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {showDeviceDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDeviceDropdown(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden w-64 max-h-[400px] overflow-y-auto">
                {['mobile', 'tablet', 'desktop', 'responsive'].map(cat => {
                  const items = DEVICES.filter(d => d.cat === cat);
                  const catLabels = { mobile: 'Dien thoai', tablet: 'Tablet', desktop: 'May tinh', responsive: 'Tuy chinh' };
                  return (
                    <div key={cat}>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">
                        {catLabels[cat]}
                      </div>
                      {items.map(d => (
                        <button
                          key={d.id}
                          onClick={() => { setDevice(d.id); setShowDeviceDropdown(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                            device === d.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                          }`}
                        >
                          <span>{d.label}</span>
                          {d.w > 0 && <span className="text-xs text-muted-foreground">{d.w}x{d.h}</span>}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Quick device shortcuts */}
        <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
          {[
            { id: 'iphone-15-pro', icon: Smartphone, tip: 'iPhone 15 Pro' },
            { id: 'ipad-air', icon: Tablet, tip: 'iPad Air' },
            { id: 'desktop-fhd', icon: Monitor, tip: 'Desktop FHD' },
          ].map(({ id, icon: Icon, tip }) => (
            <button
              key={id}
              onClick={() => setDevice(id)}
              title={tip}
              className={`p-1.5 rounded-md transition-all ${
                device === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Edit & Section & Cleanup buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { if (sectionMode) { setSectionMode(false); } else { setSectionMode(true); } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sectionMode 
                ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' 
                : 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            {sectionMode ? 'Huy' : 'Xoa section'}
          </button>
          {sectionMode && (
            <button
              onClick={saveSectionChanges}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-all animate-pulse"
            >
              💾 Luu xoa
            </button>
          )}
          <button
            onClick={cleanupLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 rounded-lg text-xs font-medium transition-all"
            title="Sắp xếp lại layout, xóa khoảng trống"
          >
            🔄 Sap xep lai
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 text-accent hover:bg-accent/25 rounded-lg text-xs font-medium transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Chinh sua
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-start justify-center p-3 bg-muted/10 overflow-auto min-h-0">
        <div
          className="bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 border border-border/30 flex-shrink-0"
          style={{
            ...getPreviewStyle(),
            minHeight: isResponsive ? '100%' : `${Math.min(selectedDevice.h, 900)}px`,
          }}
        >
          {blobUrl && (
            <iframe
              ref={iframeRef}
              key={blobUrl}
              src={blobUrl}
              className="w-full h-full border-0"
              style={isResponsive ? {} : { 
                width: `${selectedDevice.w}px`,
                height: `${selectedDevice.h}px`,
                transformOrigin: 'top left',
                border: 'none',
              }}
              title="Preview"
              sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
            />
          )}
        </div>
      </div>
    </div>
  );
}
