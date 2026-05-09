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
 * Extract com-section divs from the page, trying DOMParser first then regex fallback.
 * Returns array of { id, outerHTML, hasForm } plain objects.
 */
function extractComSections(html, doc) {
  // Attempt 1: DOM query with data-section attribute filter
  let nodes = Array.from(doc.querySelectorAll('div.com-section[data-section]'));
  if (nodes.length > 0) {
    return nodes.map(n => ({ id: n.id, outerHTML: n.outerHTML, hasForm: !!n.querySelector('form') }));
  }

  // Attempt 2: DOM query without attribute filter (handles browsers that reject boolean attr)
  nodes = Array.from(doc.querySelectorAll('div.com-section'));
  if (nodes.length > 0) {
    return nodes.map(n => ({ id: n.id, outerHTML: n.outerHTML, hasForm: !!n.querySelector('form') }));
  }

  // Attempt 3: Regex fallback for browsers that mis-parse malformed attribute syntax
  return regexExtractComSections(html);
}

// Build a single PKE section object with a nested text-block
function buildSection({ html, name, sectionIndex, height }) {
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
            styles: { width: 1200, top: 0, left: 0, height, zIndex: 1 },
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

export function generatePkeBuffer(html, productName = 'Landing Page') {
  const escapedHtml = html.trim();

  // Extract <head> block for height parsing and CSS/JS extraction
  const headMatch = escapedHtml.match(/<head\b[^>]*>[\s\S]*?<\/head>/i);
  const head = headMatch ? headMatch[0] : '';

  // Extract CSS and JS from head to place in settings.extra_css / settings.extra_script
  const extraCss = extractStyles(head);
  const extraScript = extractScripts(head);

  // Parse com-sections via DOMParser with regex fallback
  let pageSections;
  const doc = new DOMParser().parseFromString(escapedHtml, 'text/html');
  const comSections = extractComSections(escapedHtml, doc);

  console.info('[htmlToPke] sections detected:', comSections.length);

  if (comSections.length === 0) {
    // Fallback: non-LadiPage HTML — produce 1 section with full HTML
    pageSections = [buildSection({ html: escapedHtml, name: 'section_1', sectionIndex: 1, height: 10000 })];
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

      // Parse section height from head CSS (e.g. #w-xyw6kism { height: 564px })
      const heightRe = new RegExp('#' + sectionElementId + '[^{]*\\{[^}]*height\\s*:\\s*(\\d+)px', 'i');
      const m = head.match(heightRe);
      const sectionHeight = m ? parseInt(m[1], 10) : 1500;

      const wrappedHtml = inlineStyleTag + sec.outerHTML;
      return buildSection({ html: wrappedHtml, name, sectionIndex, height: sectionHeight });
    });
  }

  // PKE schema matching real Webcake-exported files (verified from hud-hien-thi-toc-do.pke)
  const pkeData = {
    source: {
      settings: {
        width_section: { mobile: 420, desktop: 1200 },
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
