/**
 * Extract image URLs from HTML for deep image translation.
 * Handles <img src>, <img srcset>, <source srcset>, CSS background-image, <link rel=preload>.
 */

const TRACKING_DOMAINS = new Set([
  'google-analytics.com',
  'www.google-analytics.com',
  'googletagmanager.com',
  'www.googletagmanager.com',
  'facebook.com',
  'connect.facebook.net',
  'analytics.twitter.com',
  'static.ads-twitter.com',
  'bat.bing.com',
  'px.ads.linkedin.com',
  'snap.licdn.com',
]);

const SKIP_EXTENSIONS = new Set(['.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot']);

function isTrackingDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return TRACKING_DOMAINS.has(host);
  } catch {
    return false;
  }
}

function isSkippedExtension(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return SKIP_EXTENSIONS.some((ext) => path.endsWith(ext));
  } catch {
    return false;
  }
}

function isTrackingPixel(url, el) {
  // 1x1 tracking pixel heuristic from element attributes
  if (el) {
    const w = el.getAttribute('width');
    const h = el.getAttribute('height');
    if ((w === '1' || w === '0') && (h === '1' || h === '0')) return true;
  }
  // Also check URL patterns
  return /\/(pixel|beacon|track|trk|1x1)\b/i.test(url);
}

function resolveUrl(href, base) {
  if (!href || href.startsWith('data:') || href.startsWith('blob:')) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function sizeHintFromEl(el) {
  const w = parseInt(el?.getAttribute('width') || '0', 10);
  const h = parseInt(el?.getAttribute('height') || '0', 10);
  if (w > 0 && h > 0) {
    // Very rough estimate: assume 24-bit color, moderate JPEG compression ~10:1
    return Math.round((w * h * 3) / 10 / 1024); // approx KB
  }
  return null;
}

/**
 * extractImageUrls
 * @param {string} html  - full HTML string
 * @param {string} baseUrl - page URL for resolving relative hrefs
 * @returns {Array<{url: string, sizeHint: number|null, source: string}>}
 */
export function extractImageUrls(html, baseUrl = '') {
  if (typeof DOMParser === 'undefined') return [];

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Determine effective base URL (honour <base href> in document)
  const baseEl = doc.querySelector('base[href]');
  const base = baseEl?.getAttribute('href') || baseUrl;

  const seen = new Map(); // url -> {url, sizeHint, source}

  const add = (rawUrl, source, el = null) => {
    if (!rawUrl) return;
    const url = resolveUrl(rawUrl.trim(), base);
    if (!url) return;
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (isTrackingDomain(url)) return;
    if (isSkippedExtension(url)) return;
    if (isTrackingPixel(url, el)) return;
    if (!seen.has(url)) {
      seen.set(url, { url, sizeHint: sizeHintFromEl(el), source });
    }
  };

  // <img src>
  doc.querySelectorAll('img[src]').forEach((img) => {
    add(img.getAttribute('src'), 'img[src]', img);
  });

  // <img srcset> — each variant
  doc.querySelectorAll('img[srcset]').forEach((img) => {
    const srcset = img.getAttribute('srcset') || '';
    srcset.split(',').forEach((part) => {
      const token = part.trim().split(/\s+/)[0];
      if (token) add(token, 'img[srcset]', img);
    });
  });

  // <source srcset> (inside <picture>)
  doc.querySelectorAll('source[srcset]').forEach((src) => {
    const srcset = src.getAttribute('srcset') || '';
    srcset.split(',').forEach((part) => {
      const token = part.trim().split(/\s+/)[0];
      if (token) add(token, 'source[srcset]', null);
    });
  });

  // <link rel="preload" as="image">
  doc.querySelectorAll('link[rel="preload"][as="image"][href]').forEach((link) => {
    add(link.getAttribute('href'), 'link[preload]', null);
  });

  // Inline style background-image: url(...)
  const cssUrlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;

  // Style attributes
  doc.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    let m;
    while ((m = cssUrlRe.exec(style)) !== null) {
      add(m[1], 'style[bg]', null);
    }
    cssUrlRe.lastIndex = 0;
  });

  // <style> blocks
  doc.querySelectorAll('style').forEach((styleEl) => {
    const css = styleEl.textContent || '';
    let m;
    while ((m = cssUrlRe.exec(css)) !== null) {
      add(m[1], '<style>', null);
    }
    cssUrlRe.lastIndex = 0;
  });

  return [...seen.values()];
}
