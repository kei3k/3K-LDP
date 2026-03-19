/**
 * Template 1: Landing Page Bán 1 Sản Phẩm (Style Túi Mỹ Phẩm)
 * 
 * Uses the REAL HTML from dealworldnow.click/tuimypham.
 * - Replaces ONLY gallery/product images (not icons/SVGs/GIFs)
 * - Injects product data, custom form fields, tracking
 * - Text translation is handled separately by generator.js via Gemini
 */
import rawHtml from './template1_raw.html?raw';

export function generateTemplate1(productInfo, colors, config = {}) {
  const {
    name = 'Sản phẩm mới',
    description = '',
    benefits = '',
    price = '299.000đ',
    originalPrice = '500.000đ',
    images = [],
    rating = { score: 4.9, count: 1205 },
    reviews = []
  } = productInfo;

  let html = rawHtml;

  // ============================================
  // 1. REPLACE ONLY GALLERY IMAGES (carousel product photos)
  // ============================================
  if (images && images.length > 0) {
    // Extract gallery image URLs from CSS rules
    const galleryRegex = /gallery-(?:view|controls)-item\[data-index="(\d+)"\]\{[^}]*background-image:url\(([^)]+)\)/g;
    const galleryUrls = new Map();
    let match;
    while ((match = galleryRegex.exec(html)) !== null) {
      const idx = parseInt(match[1]);
      const url = match[2].replace(/["']/g, '');
      if (!galleryUrls.has(idx)) galleryUrls.set(idx, new Set());
      galleryUrls.get(idx).add(url);
    }

    console.log(`[Template1] Gallery indices: ${[...galleryUrls.keys()].join(',')}, images: ${images.length}`);

    // Replace gallery images by index (round-robin)
    let replacementCount = 0;
    for (const [idx, urls] of galleryUrls) {
      const newUrl = images[idx % images.length];
      for (const oldUrl of urls) {
        const occ = html.split(oldUrl).length - 1;
        if (occ > 0) { html = html.split(oldUrl).join(newUrl); replacementCount += occ; }
      }
    }
    console.log(`[Template1] Total gallery replacements: ${replacementCount}`);
  } else {
    console.warn('[Template1] ⚠️ NO IMAGES PROVIDED! images array is empty.');
  }

  // ============================================
  // 2. REPLACE META TAGS
  // ============================================
  html = html.replace(/<title>.*?<\/title>/, `<title>${esc(name)}</title>`);
  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, `$1${esc(name)}$2`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/i, `$1${esc(description)}$2`);
  if (images[0]) {
    html = html.replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/i, `$1${images[0]}$2`);
  }

  // ============================================
  // 3. BUILD CUSTOM FORM FIELDS HTML
  // ============================================
  const customFields = config.customFormFields || [];
  let customFieldsHtml = buildCustomFieldsHtml(customFields);

  // ============================================
  // 4. TRACKING SCRIPTS
  // ============================================
  const { trackingHead, trackingBody } = buildTrackingScripts(config);
  if (trackingHead) html = html.replace('</head>', trackingHead + '\n</head>');
  if (trackingBody) html = html.replace(/<body[^>]*>/, '$&\n' + trackingBody);

  // ============================================
  // 4b. CSS FIX: Only word-wrap for translated text (DO NOT change position/height!)
  // ============================================
  const cssOverrides = `<style>
  /* Minimal fix: only word-wrap for translated text that may be longer */
  .text-block, .text-block-css, h1, h2, h3, h4, h5, h6, p, span, label, a {
    overflow-wrap: break-word !important; word-wrap: break-word !important;
  }
  </style>`;
  html = html.replace('</head>', cssOverrides + '\n</head>');

  // ============================================
  // 5. HYDRATION SCRIPT (form fields + price/title injection)
  // ============================================
  const hydrationScript = buildHydrationScript({ name, description, benefits, price, originalPrice, reviews }, customFieldsHtml);
  html = html.replace('</body>', hydrationScript + '\n</body>');

  return html;
}

// ---- Helpers ----

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCustomFieldsHtml(fields) {
  let html = '';
  (fields || []).forEach(field => {
    if (field.type === 'radio' && field.options) {
      const opts = field.options.split('\n').filter(o => o.trim());
      html += `<div style="margin-bottom:8px;"><label style="font-weight:bold;font-size:14px;display:block;margin-bottom:4px;">${field.label || 'Lựa chọn'}</label>`;
      opts.forEach((opt, idx) => {
        html += `<label style="display:block;padding:8px 12px;margin:4px 0;background:#fff;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:13px;">
          <input type="radio" name="${field.name || 'combo'}" value="${opt.trim()}" ${idx === 0 ? 'checked' : ''} style="margin-right:8px;"> ${opt.trim()}
        </label>`;
      });
      html += '</div>';
    } else if (field.type === 'select' && field.options) {
      const opts = field.options.split('\n').filter(o => o.trim());
      html += `<div style="margin-bottom:8px;">
        <select name="${field.name || 'select'}" style="width:100%;padding:10px;border:1px solid #000;border-radius:6px;font-size:13px;background:#fff;">
          <option value="">${field.label || 'Chọn...'}</option>
          ${opts.map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join('')}
        </select></div>`;
    } else if (field.type === 'textarea') {
      html += `<div style="margin-bottom:8px;">
        <textarea name="${field.name || 'note'}" placeholder="${field.label || 'Ghi chú'}" style="width:100%;padding:10px;border:1px solid #000;border-radius:6px;font-size:13px;min-height:60px;box-sizing:border-box;"></textarea></div>`;
    } else {
      html += `<div style="margin-bottom:8px;">
        <input type="${field.type || 'text'}" name="${field.name || 'field'}" placeholder="${field.label || ''}" style="width:100%;padding:10px;border:1px solid #000;border-radius:6px;font-size:13px;box-sizing:border-box;background:#fff;"></div>`;
    }
  });
  return html;
}

function buildTrackingScripts(config) {
  let trackingHead = '', trackingBody = '';
  if (config.gtmId) {
    trackingHead += `<!-- GTM --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.gtmId}');</script>`;
    trackingBody += `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${config.gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
  }
  if (config.facebookPixelId) {
    trackingHead += `\n<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${config.facebookPixelId}');fbq('track','PageView');</script>`;
  }
  if (config.tiktokPixelId) {
    trackingHead += `\n<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;d.getElementsByTagName("head")[0].appendChild(o)};ttq.load('${config.tiktokPixelId}');ttq.page();}(window,document,'ttq');</script>`;
  }
  return { trackingHead, trackingBody };
}

function buildHydrationScript(productData, customFieldsHtml) {
  return `
<script>
(function() {
  var pd = ${JSON.stringify(productData)};
  var cfHtml = ${JSON.stringify(customFieldsHtml)};

  document.addEventListener('DOMContentLoaded', function() {
    if (pd.name) document.title = pd.name;

    // =============================================
    // 1. GALLERY/CAROUSEL JAVASCRIPT
    // =============================================
    (function initGallery() {
      var galleries = document.querySelectorAll('.com-gallery');
      galleries.forEach(function(gallery) {
        var viewItems = gallery.querySelectorAll('.gallery-view-item');
        var ctrlItems = gallery.querySelectorAll('.gallery-controls-item');
        var nextBtn = gallery.querySelector('.gallery-view-icon-next');
        var prevBtn = gallery.querySelector('.gallery-view-icon-prev');
        var ctrlNext = gallery.querySelector('.gallery-controls-icon-next');
        var ctrlPrev = gallery.querySelector('.gallery-controls-icon-prev');
        var currentIdx = 0;
        var total = viewItems.length;
        if (total === 0) return;

        function showSlide(idx) {
          if (idx < 0) idx = total - 1;
          if (idx >= total) idx = 0;
          currentIdx = idx;
          viewItems.forEach(function(el, i) {
            el.classList.toggle('active', i === idx);
            el.style.opacity = i === idx ? '1' : '0';
            el.style.zIndex = i === idx ? '2' : '1';
          });
          ctrlItems.forEach(function(el, i) {
            el.classList.toggle('active', i === idx);
          });
        }

        if (nextBtn) nextBtn.addEventListener('click', function() { showSlide(currentIdx + 1); });
        if (prevBtn) prevBtn.addEventListener('click', function() { showSlide(currentIdx - 1); });
        if (ctrlNext) ctrlNext.addEventListener('click', function() { showSlide(currentIdx + 1); });
        if (ctrlPrev) ctrlPrev.addEventListener('click', function() { showSlide(currentIdx - 1); });
        ctrlItems.forEach(function(el) {
          el.addEventListener('click', function() {
            showSlide(parseInt(el.getAttribute('data-index')) || 0);
          });
        });

        // Auto-slide every 4 seconds
        var autoSlide = setInterval(function() { showSlide(currentIdx + 1); }, 4000);
        gallery.addEventListener('mouseenter', function() { clearInterval(autoSlide); });
        gallery.addEventListener('mouseleave', function() {
          autoSlide = setInterval(function() { showSlide(currentIdx + 1); }, 4000);
        });

        // Touch/swipe support
        var touchStartX = 0;
        var viewEl = gallery.querySelector('.gallery-view');
        if (viewEl) {
          viewEl.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; }, {passive:true});
          viewEl.addEventListener('touchend', function(e) {
            var dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 50) showSlide(dx < 0 ? currentIdx + 1 : currentIdx - 1);
          });
        }

        // Apply transitions for smooth sliding
        viewItems.forEach(function(el) {
          el.style.transition = 'opacity 0.4s ease';
        });
        showSlide(0);
      });
    })();

    // =============================================
    // 2. INJECT CUSTOM FORM FIELDS
    // =============================================
    if (cfHtml) {
      document.querySelectorAll('form').forEach(function(form) {
        var submitBtn = null;
        form.querySelectorAll('[class*="button-css"]').forEach(function(b) {
          var txt = (b.innerText || '').toLowerCase();
          if (txt.length > 1) submitBtn = b.closest('[id^="w-"]');
        });
        if (submitBtn && submitBtn.parentNode) {
          var c = document.createElement('div');
          c.style.cssText = 'position:relative;width:100%;padding:0 0 8px 0;';
          c.innerHTML = cfHtml;
          submitBtn.parentNode.insertBefore(c, submitBtn);
        }
      });
    }
  });
})();
</script>`;
}
