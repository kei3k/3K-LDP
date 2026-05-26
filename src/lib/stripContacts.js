/**
 * Strip contact info (phone numbers, Zalo links, custom strings) from landing page HTML.
 * Used to clean old hotline/zalo from cloned LadiPage before exporting to PKE.
 */

const PHONE_REGEX = /\b(?:\+?84|0)(?:\d[\s.\-]?){8,10}\b/g;
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
  const { removePhones = true, removeZalo = true, customStrings = [], onProgress } = opts;
  let out = html;
  let removedCount = 0;
  const samples = [];

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
