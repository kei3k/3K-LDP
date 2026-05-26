/**
 * Strip contact info (phone numbers, Zalo links, custom strings, floating
 * chat-widget buttons) from landing page HTML. Used to clean old hotline/zalo
 * widgets from a cloned LadiPage before exporting to PKE.
 */

const PHONE_REGEX = /\b(?:\+?84|0)(?:\d[\s.\-]?){8,10}\b/g;

// Patterns identifying floating contact widgets — used to find + remove the
// outermost block element containing them (not just the text inside).
const WIDGET_TEXT_HINTS = /\b(zalo|hotline|call ?now|gọi ?ngay|nhắn ?tin|chat ?ngay|đường ?dây ?nóng|messenger)\b/i;
const WIDGET_SRC_HINTS = /(zalo|hotline|call|phone|messenger|fb-?msg|chat)[\-_]?(icon|btn|button|widget)?\.(svg|png|jpe?g|webp|gif)/i;
const WIDGET_CLASS_HINTS = /(zalo|hotline|phone|call|chat|messenger|fixed[\-_]?(?:btn|button)|float(?:ing)?[\-_]?(?:btn|button)|sticky[\-_]?(?:btn|button))/i;

/**
 * stripFloatingWidgets — DOM-aware removal of floating chat buttons.
 * Returns { html, removedCount, removedSnippets }
 */
function stripFloatingWidgets(html) {
  if (typeof DOMParser === 'undefined') return { html, removedCount: 0, removedSnippets: [] };

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const removed = [];
  const candidates = new Set();

  // 1) Find anchors pointing at zalo / tel
  doc.querySelectorAll('a[href*="zalo.me"], a[href^="tel:"], a[href*="zalo.com"], a[href^="sms:"]').forEach((a) => candidates.add(a));

  // 2) Find images / svgs with src or alt hinting at chat widgets
  doc.querySelectorAll('img').forEach((img) => {
    const src = (img.getAttribute('src') || '').toLowerCase();
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    if (WIDGET_SRC_HINTS.test(src) || WIDGET_TEXT_HINTS.test(alt)) candidates.add(img);
  });

  // 3) Elements whose class names match
  doc.querySelectorAll('[class]').forEach((el) => {
    const cls = el.getAttribute('class') || '';
    if (WIDGET_CLASS_HINTS.test(cls)) candidates.add(el);
  });

  // 4) Elements with inline position:fixed/sticky AND containing widget text
  doc.querySelectorAll('[style*="position:fixed"],[style*="position: fixed"],[style*="position:sticky"],[style*="position: sticky"]').forEach((el) => {
    const text = (el.textContent || '').toLowerCase();
    if (WIDGET_TEXT_HINTS.test(text)) candidates.add(el);
  });

  // For each candidate, walk up to find the "block container" — stop when:
  // - parent's textContent contains far MORE than this candidate (we'd over-remove)
  // - parent is body/html
  const findContainer = (el) => {
    let node = el;
    const initialText = (node.textContent || '').trim();
    while (
      node.parentElement &&
      node.parentElement.tagName !== 'BODY' &&
      node.parentElement.tagName !== 'HTML'
    ) {
      const parentText = (node.parentElement.textContent || '').trim();
      // If parent has much more content, stop — don't over-remove
      if (parentText.length > initialText.length * 3 && parentText.length > 200) break;
      // Common LadiPage / generic "card" containers — usually .ldp-element wrappers or .group-* divs
      const parentClass = node.parentElement.getAttribute('class') || '';
      if (/(ldp[-_]?element|popup|widget|float|fixed|sticky)/i.test(parentClass)) {
        node = node.parentElement;
        break;
      }
      node = node.parentElement;
    }
    return node;
  };

  // Deduplicate by walking up to containers
  const toRemove = new Set();
  for (const c of candidates) {
    if (!c.isConnected) continue;
    const container = findContainer(c);
    // Avoid removing if it's the body or contains way more than just contact info
    if (!container || container.tagName === 'BODY' || container.tagName === 'HTML') continue;
    toRemove.add(container);
  }

  // Now drop any container that's an ancestor of another to-remove element
  // (the outer one already covers it)
  for (const node of [...toRemove]) {
    for (const other of toRemove) {
      if (other !== node && node.contains(other)) {
        toRemove.delete(other);
      }
    }
  }

  for (const node of toRemove) {
    const snippet = (node.outerHTML || '').substring(0, 80).replace(/\s+/g, ' ');
    removed.push(snippet);
    node.remove();
  }

  return {
    html: '<!DOCTYPE html>' + doc.documentElement.outerHTML,
    removedCount: toRemove.size,
    removedSnippets: removed,
  };
}
const ZALO_PATTERNS = [
  /https?:\/\/(?:www\.)?zalo\.me\/[\w\-.\/?=&%]+/gi,
  /https?:\/\/(?:www\.)?zaloapp\.com\/[\w\-.\/?=&%]+/gi,
  /zalo\.me\/\d+/gi,
];
const TEL_LINK = /tel:[\+\d\-\s\.]+/gi;
// Hotline / Zalo label as standalone words (kept simple — full HTML text may include CSS-styled spans)
const LABELS = [/\bHotline\b\s*:?/gi, /\bZalo\b\s*:?/gi, /\bĐường dây nóng\b\s*:?/gi];

/**
 * stripContactInfo
 * @param {string} html
 * @param {object} opts
 * @param {boolean} [opts.removePhones=true]    - auto-detect 0xxxxx / +84 phone numbers
 * @param {boolean} [opts.removeZalo=true]      - auto-detect zalo.me / tel: links
 * @param {string[]} [opts.customStrings=[]]    - additional literal strings to remove
 * @param {(msg: string) => void} [opts.onProgress]
 * @returns {{ html: string, removedCount: number, samples: string[] }}
 */
export function stripContactInfo(html, opts = {}) {
  const { removePhones = true, removeZalo = true, removeWidgets = true, customStrings = [], onProgress } = opts;
  let out = html;
  let removedCount = 0;
  const samples = [];

  // 0) Remove floating widgets (full DOM blocks: Zalo button, phone icon, fb msg, etc.)
  if (removeWidgets) {
    onProgress?.('✂️ Tìm + xóa widget chat float (Zalo/Hotline button)...');
    const w = stripFloatingWidgets(out);
    out = w.html;
    removedCount += w.removedCount;
    for (const s of w.removedSnippets.slice(0, 6)) samples.push(`[widget] ${s}`);
  }

  const recordRemoved = (matches) => {
    if (!matches) return;
    removedCount += matches.length;
    for (const m of matches) {
      if (samples.length < 12) samples.push(m.trim().substring(0, 60));
    }
  };

  // 1) Custom strings — literal removal (longest first to avoid partial collisions)
  const customs = [...customStrings.map((s) => s.trim()).filter(Boolean)]
    .sort((a, b) => b.length - a.length);
  for (const s of customs) {
    let occurrences = 0;
    while (out.includes(s)) {
      out = out.replace(s, '');
      occurrences++;
      if (occurrences > 1000) break; // safety
    }
    if (occurrences > 0) {
      removedCount += occurrences;
      samples.push(`[custom] ${s.substring(0, 50)} ×${occurrences}`);
    }
  }

  // 2) Phone numbers
  if (removePhones) {
    const phones = out.match(PHONE_REGEX);
    recordRemoved(phones);
    out = out.replace(PHONE_REGEX, '');
  }

  // 3) Zalo / tel: links
  if (removeZalo) {
    for (const re of ZALO_PATTERNS) {
      const matches = out.match(re);
      recordRemoved(matches);
      out = out.replace(re, '#');
    }
    const telMatches = out.match(TEL_LINK);
    recordRemoved(telMatches);
    out = out.replace(TEL_LINK, '#');
  }

  // 4) Strip standalone "Hotline:" / "Zalo:" labels left dangling after removal above
  if (removePhones || removeZalo) {
    for (const re of LABELS) out = out.replace(re, '');
    // Clean up empty parentheses / pipe separators left behind
    out = out.replace(/\(\s*[-–|:.,]?\s*\)/g, '');
    out = out.replace(/\|\s*\|/g, '|');
  }

  onProgress?.(`✂️ Đã xóa ${removedCount} thông tin liên hệ cũ`);
  return { html: out, removedCount, samples };
}
