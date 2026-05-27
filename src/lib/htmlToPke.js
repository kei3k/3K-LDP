import { encode } from '@msgpack/msgpack';

/**
 * Generate a random 8-character alphanumeric string for Webcake IDs
 */
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Regex-based fallback: extract com-section divs from raw HTML string.
 * Used when DOMParser returns 0 sections (malformed attribute syntax in some browsers).
 * Returns array of { id, outerHTML, hasForm }.
 */
export function regexExtractComSections(html) {
  const results = [];
  // Match opening <div ...class="com-section"...> tags (attributes may be in any order,
  // and the class/data-section attributes may lack a separating space between them)
  const openTagRe = /<div\b[^>]*class="com-section"[^>]*>/gi;
  let match;
  while ((match = openTagRe.exec(html)) !== null) {
    const tagStart = match.index;
    const tagEnd = match.index + match[0].length;

    // Extract id from the opening tag
    const idMatch = match[0].match(/\bid="([^"]*)"/i);
    const id = idMatch ? idMatch[1] : '';

    // Walk forward tracking <div depth to find the matching </div>
    let depth = 1;
    let pos = tagEnd;
    while (pos < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);
      if (nextClose === -1) break; // malformed HTML — bail
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        pos = nextOpen + 4; // skip past '<div'
      } else {
        depth -= 1;
        pos = nextClose + 6; // skip past '</div>'
      }
    }
    const outerHTML = html.slice(tagStart, pos);
    const hasForm = /<form\b/i.test(outerHTML);
    results.push({ id, outerHTML, hasForm });
  }
  return results;
}

/**
 * Regex-based fallback for newer LadiPage builds that use
 * <div id="SECTION{N}" class='ladi-section'> instead of com-section.
 */
export function regexExtractLadiSections(html) {
  const results = [];
  // Match opening <div ... id="SECTION..." ... class='ladi-section'> tags
  // — id can come before or after class, class may use single or double quotes
  const openTagRe = /<div\b[^>]*\bid=["']SECTION[A-Za-z0-9_-]+["'][^>]*\bclass=["'][^"']*\bladi-section\b[^"']*["'][^>]*>|<div\b[^>]*\bclass=["'][^"']*\bladi-section\b[^"']*["'][^>]*\bid=["']SECTION[A-Za-z0-9_-]+["'][^>]*>/gi;
  let match;
  while ((match = openTagRe.exec(html)) !== null) {
    const tagStart = match.index;
    const tagEnd = match.index + match[0].length;
    const idMatch = match[0].match(/\bid=["'](SECTION[A-Za-z0-9_-]+)["']/);
    const id = idMatch ? idMatch[1] : '';

    let depth = 1;
    let pos = tagEnd;
    while (pos < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        pos = nextOpen + 4;
      } else {
        depth -= 1;
        pos = nextClose + 6;
      }
    }
    const outerHTML = html.slice(tagStart, pos);
    const hasForm = /<form\b/i.test(outerHTML);
    results.push({ id, outerHTML, hasForm });
  }
  return results;
}

/**
 * Extract per-section divs from the page. Supports 2 LadiPage variants:
 *   1) Older builds: <div class="com-section" data-section ...>
 *   2) Newer builds: <div id="SECTION{N}" class='ladi-section'>
 * Falls through to regex when DOMParser query returns nothing.
 */
function extractComSections(html, doc) {
  // Variant 1 — old com-section schema
  let nodes = Array.from(doc.querySelectorAll('div.com-section[data-section]'));
  if (nodes.length > 0) {
    return nodes.map(n => ({ id: n.id, outerHTML: n.outerHTML, hasForm: !!n.querySelector('form') }));
  }
  nodes = Array.from(doc.querySelectorAll('div.com-section'));
  if (nodes.length > 0) {
    return nodes.map(n => ({ id: n.id, outerHTML: n.outerHTML, hasForm: !!n.querySelector('form') }));
  }

  // Variant 2 — newer ladi-section schema, only match the top-level SECTION* ones
  // (skip nested .ladi-section inside groups by requiring id starts with SECTION)
  nodes = Array.from(doc.querySelectorAll('div.ladi-section[id^="SECTION"]'));
  if (nodes.length > 0) {
    return nodes.map(n => ({ id: n.id, outerHTML: n.outerHTML, hasForm: !!n.querySelector('form') }));
  }

  // Regex fallback for both variants
  const v1 = regexExtractComSections(html);
  if (v1.length > 0) return v1;
  return regexExtractLadiSections(html);
}

// Build a single PKE section object with a nested text-block
function buildSection({ html, name, sectionIndex, height, canvasDesktop = 1200 }) {
  const sectionId = generateId();
  const textBlockId = generateId();
  return {
    type: 'section',
    specials: {},
    runtime: { firstInit: false },
    responsive: {
      mobile: {
        styles: { position: 'relative', height },
        config: { notloaded: false }
      },
      desktop: {
        styles: { position: 'relative', height },
        config: { notloaded: false }
      }
    },
    properties: { sync: true, name, movable: false },
    id: sectionId,
    events: [],
    children: [
      {
        type: 'text-block',
        specials: { text: html, tag: 'div' },
        runtime: { firstInit: false },
        responsive: {
          mobile: {
            styles: { width: 420, top: 0, left: 0, height, zIndex: 1 },
            config: { notloaded: false }
          },
          desktop: {
            styles: { width: canvasDesktop, top: 0, left: 0, height, zIndex: 1 },
            config: { notloaded: false }
          }
        },
        properties: { sync: true, name: 'text_block_' + sectionIndex, movable: true },
        id: textBlockId,
        events: [],
        children: []
      }
    ]
  };
}

/**
 * isHiddenOrPopupSection — detect LadiPage popup / hidden sections that should
 * NOT be exported as visible sections in PKE. Heuristics:
 *   1) The section's CSS in the page <head> sets display:none / visibility:hidden
 *      / position:absolute with off-screen coords
 *   2) DOM content (after stripping LadiPage scaffolding) is essentially empty:
 *      no text, no <img src>, no <input>, no inline background-image
 */
function isHiddenOrPopupSection(sectionId, sectionHtml, headCss) {
  // CSS-based: look for #SECTION{id}{...display:none...}
  const escId = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cssBlockRe = new RegExp('#' + escId + '\\b[^{]*\\{([^}]*)\\}', 'gi');
  let m;
  while ((m = cssBlockRe.exec(headCss)) !== null) {
    const body = m[1].toLowerCase();
    if (/\bdisplay\s*:\s*none\b/.test(body)) return true;
    if (/\bvisibility\s*:\s*hidden\b/.test(body)) return true;
    if (/\btop\s*:\s*-\d{4,}px\b/.test(body)) return true; // off-screen
  }

  // DOM-based: strip LadiPage scaffolding (background wrappers + empty elements)
  // and check if anything substantive remains.
  let stripped = sectionHtml
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  // Extract text content
  const textOnly = stripped.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  // Detect populated images/inputs
  const hasImgSrc = /<img[^>]+\bsrc\s*=\s*['"][^'"]+['"]/i.test(stripped);
  const hasBgImage = /background-image\s*:\s*url\(['"]?[^'"\)]+/i.test(stripped);
  const hasInput = /<input\b|<button\b|<form\b|<a\b[^>]+href\s*=\s*['"]https?:/i.test(stripped);

  // Heuristic: if section is essentially empty scaffolding, treat as popup
  if (textOnly.length < 5 && !hasImgSrc && !hasBgImage && !hasInput) return true;
  return false;
}

/**
 * Extract and concatenate all <style>...</style> blocks from an HTML string.
 * Returns raw CSS text (without <style> tags).
 */
function extractStyles(html) {
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const chunks = [];
  let m;
  while ((m = styleRe.exec(html)) !== null) {
    chunks.push(m[1]);
  }
  return chunks.join('\n');
}

/**
 * Extract and concatenate all <script>...</script> blocks from an HTML string.
 * Returns raw JS text (without <script> tags). Skips external src-only scripts.
 */
function extractScripts(html) {
  const scriptRe = /<script\b(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  const chunks = [];
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    if (m[1].trim()) chunks.push(m[1]);
  }
  return chunks.join('\n');
}

/**
 * Remove the literal class "lazy" from every class="..." attribute.
 * LadiPage uses CSS rules like `.lazy { background:none!important }` to hide
 * elements until its runtime JS strips the class on load. Webcake's editor
 * canvas never executes that JS, so the backgrounds stay hidden. Pre-stripping
 * the class bakes in the post-load visible state.
 */
function stripLazyClasses(html) {
  return html.replace(
    /(\bclass="[^"]*?)\blazy\b\s?([^"]*")/gi,
    (full, before, after) => before + after
  );
}

export function generatePkeBuffer(html, productName = 'Landing Page') {
  const escapedHtml = stripLazyClasses(html.trim());

  // Extract <head> block for height parsing and CSS/JS extraction
  const headMatch = escapedHtml.match(/<head\b[^>]*>[\s\S]*?<\/head>/i);
  const head = headMatch ? headMatch[0] : '';

  // Extract CSS and JS from head to place in settings.extra_css / settings.extra_script
  const extraCss = extractStyles(head);
  const extraScript = extractScripts(head);

  // Detect LadiPage's design width (the .ladi-wraper width set in CSS).
  // Mobile-only landing pages typically declare `.ladi-wraper { width: 420px }` with
  // no desktop override — all element coordinates assume that width. If we leave
  // Webcake's canvas at the default 1200px desktop, the imported layout looks
  // squashed/spread because elements were positioned for 420px.
  //
  // Strategy: scan all `.ladi-wraper { width: Npx }` rules; take the LARGEST
  // numeric width found (covers both mobile-only 420 sites and desktop 1200 sites).
  let canvasDesktop = 1200;
  const wraperWidthRe = /\.ladi-wraper\s*\{[^}]*\bwidth\s*:\s*(\d+(?:\.\d+)?)px/gi;
  let wm;
  while ((wm = wraperWidthRe.exec(head)) !== null) {
    const w = Math.round(parseFloat(wm[1]));
    if (w > 100 && w < 2000) canvasDesktop = Math.max(canvasDesktop !== 1200 ? canvasDesktop : 0, w);
  }
  // For mobile-only LadiPages (420px wraper, no desktop @media), use 420 as canvas.
  // For desktop pages, the loop above already picks the largest width.
  // Also detect explicit mobile-only marker — only ONE wraper rule and it's small.
  {
    const allWraper = [...head.matchAll(/\.ladi-wraper\s*\{[^}]*\bwidth\s*:\s*(\d+(?:\.\d+)?)px/gi)];
    if (allWraper.length === 1) {
      const onlyWidth = Math.round(parseFloat(allWraper[0][1]));
      if (onlyWidth > 100 && onlyWidth < 1000) canvasDesktop = onlyWidth;
    }
  }
  console.info('[htmlToPke] LadiPage canvas width detected:', canvasDesktop, 'px');

  // Parse com-sections via DOMParser with regex fallback
  let pageSections;
  const doc = new DOMParser().parseFromString(escapedHtml, 'text/html');
  let comSections = extractComSections(escapedHtml, doc);

  // Filter out hidden/popup sections (LadiPage popups have empty DOM scaffolding +
  // display:none in page CSS — they appear as huge empty gaps when imported)
  const beforeCount = comSections.length;
  comSections = comSections.filter((sec) => {
    const hidden = isHiddenOrPopupSection(sec.id, sec.outerHTML, head);
    if (hidden) console.info('[htmlToPke] Skipping hidden/popup section:', sec.id);
    return !hidden;
  });
  console.info('[htmlToPke] sections detected:', beforeCount, '→ after filter:', comSections.length);

  if (comSections.length === 0) {
    // Fallback: non-LadiPage HTML — produce 1 section with full HTML
    pageSections = [buildSection({ html: escapedHtml, name: 'section_1', sectionIndex: 1, height: 10000, canvasDesktop })];
  } else {
    // LadiPage: one PKE section per com-section div.
    // Hybrid CSS strategy: extra_css carries the page-wide stylesheet (for
    // preview/published rendering), but each text-block ALSO embeds a <style>
    // block of the same CSS so the Webcake editor canvas — which renders each
    // text-block in isolation without the page-level extra_css — still shows
    // the correct layout while editing.
    const inlineStyleTag = extraCss ? '<style>' + extraCss + '</style>' : '';

    let formCounter = 0;
    pageSections = comSections.map((sec, idx) => {
      const sectionIndex = idx + 1;
      const sectionElementId = sec.id;

      let name;
      if (sec.hasForm) {
        formCounter += 1;
        name = 'form_offer_' + formCounter;
      } else {
        name = 'section_' + sectionIndex;
      }

      // Parse section height from head CSS. Two LadiPage quirks handled:
      //   1) Heights are often DECIMAL (e.g. "height: 607.078px") — capture (\d+(?:\.\d+)?)
      //   2) Need word boundary so #SECTION6 doesn't match #SECTION68 (regex
      //      [^{]* would otherwise happily eat the "8" before {)
      // Try strict (selector immediately followed by { ) first, then loose fallback.
      const escId = sectionElementId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let sectionHeight = 1500;
      // Strict: #SECTIONxxx { ... height: NNN.NNNpx }
      const strictRe = new RegExp('#' + escId + '\\s*\\{[^}]*height\\s*:\\s*(\\d+(?:\\.\\d+)?)px', 'i');
      const sm = head.match(strictRe);
      if (sm) {
        sectionHeight = Math.round(parseFloat(sm[1]));
      } else {
        // Loose: #SECTIONxxx<selector>{...height:Npx} but block prefix collision
        // by requiring next char after id be \W (non-id char)
        const looseRe = new RegExp('#' + escId + '(?![A-Za-z0-9_-])[^{]*\\{[^}]*height\\s*:\\s*(\\d+(?:\\.\\d+)?)px', 'i');
        const lm = head.match(looseRe);
        if (lm) sectionHeight = Math.round(parseFloat(lm[1]));
      }

      const wrappedHtml = inlineStyleTag + sec.outerHTML;
      return buildSection({ html: wrappedHtml, name, sectionIndex, height: sectionHeight, canvasDesktop });
    });
  }

  // PKE schema matching real Webcake-exported files (verified from hud-hien-thi-toc-do.pke)
  const pkeData = {
    source: {
      settings: {
        width_section: { mobile: 420, desktop: canvasDesktop },
        title: productName,
        tiktok_script: '',
        thumbnail: '',
        send_info_to_thank_page: false,
        keywords: '',
        global_track_ids: [],
        gg_tag_manager_id: '',
        fontGeneral: 'Muli',
        fb_tracking_code: '',
        favicon: '',
        extra_script: extraScript,
        extra_css: extraCss,
        description: '',
        country: '',
        bhet: '',
        bbet: '',
        auto_save_info_user: true,
        auto_save_draft: true,
        auto_complete_form_in_popup: true,
        analytic_heatmap: true,
      },
      popup: [],
      page: pageSections,
      options: { mobileOnly: false, currency: 'VND' },
      cartConfigs: {}
    },
    owner_id: '00000000-0000-0000-0000-000000000000',
    name: productName,
    engine: 2,
    email: {},
    data_set_id: []
  };

  // Convert to MessagePack format
  const buffer = encode(pkeData);

  // Convert to Base64 String (chunked to avoid browser stack overflow)
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK_SIZE = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk);
  }
  const base64String = btoa(binary);

  return base64String;
}
