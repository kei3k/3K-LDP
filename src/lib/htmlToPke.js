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

// Build a single PKE section object with a nested text-block.
// `extraChildren` — additional NATIVE Webcake widget objects (e.g. a
// resolved `type: 'countdown'`, see resolveCountdowns below) to render as
// siblings of the text-block, positioned in the same section-relative
// coordinate space (top:0,left:0 == section's own top-left corner).
function buildSection({ html, name, sectionIndex, height, canvasDesktop = 1200, extraChildren = [] }) {
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
      },
      ...extraChildren
    ]
  };
}

/**
 * isHiddenOrPopupSection — detect LadiPage sections that are GENUINELY hidden
 * popups (display:none in page CSS or off-screen positioned).
 *
 * IMPORTANT: We do NOT filter "empty-looking" sections by DOM heuristic —
 * LadiPage stores image URLs in PAGE CSS (#IMAGE99 { background-image: url(...) })
 * rather than inline style. So a section can have substantial content even
 * though its raw HTML looks like empty scaffolding divs. False-positive
 * filtering caused product image sections to disappear in webcake clone.
 *
 * Only filter when CSS explicitly hides the section.
 */
function isHiddenOrPopupSection(sectionId, sectionHtml, headCss) {
  // CSS-based ONLY: look for #SECTION{id}{...display:none...}
  const escId = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cssBlockRe = new RegExp('#' + escId + '\\b[^{]*\\{([^}]*)\\}', 'gi');
  let m;
  while ((m = cssBlockRe.exec(headCss)) !== null) {
    const body = m[1].toLowerCase();
    if (/\bdisplay\s*:\s*none\b/.test(body)) return true;
    if (/\bvisibility\s*:\s*hidden\b/.test(body)) return true;
    if (/\btop\s*:\s*-\d{4,}px\b/.test(body)) return true; // off-screen
  }
  return false;
}

/**
 * computeContentBoundHeight — cross-check/fallback for a section's declared
 * CSS height. Some LadiPage exports carry a broken `height:undefinedpx` (or
 * no numeric height at all) on the mobile-media-query override of a section's
 * direct content widgets; when the SECTION's own #id{height:...} rule is
 * itself missing/undefined the regex extraction above silently falls back to
 * a hardcoded 1500px default — wrong either way (too short clips content,
 * too tall leaves a gap) and breaks Webcake's fixed-height absolute
 * section-stacking render.
 *
 * This computes the REAL content bound: the max bottom edge (top+height) of
 * the section's direct content children, read from their own #id{top;height}
 * CSS rules (same "first non-media rule wins" strategy as the section-height
 * regex, so it agrees with desktop-canvas layout). Returns 0 when nothing is
 * resolvable (e.g. background-only spacer sections with no widget children)
 * so the caller can safely keep using the declared height in that case.
 */
function computeContentBoundHeight(outerHTML, head) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(outerHTML, 'text/html');
  } catch {
    return 0;
  }
  const root = doc.body && doc.body.firstElementChild;
  if (!root) return 0;
  // LadiPage nests real content under .section-container; fall back to the
  // section root's own direct children for other builders / regex-fallback HTML.
  const container = root.querySelector(':scope > .section-wrapper > .section-container') || root;
  const children = Array.from(container.children).filter((c) => c.id);

  let maxBottom = 0;
  for (const child of children) {
    const escId = child.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('#' + escId + '\\s*\\{([^}]*)\\}', 'i');
    const m = head.match(re);
    if (!m) continue;
    const topM = m[1].match(/\btop\s*:\s*(-?\d+(?:\.\d+)?)px/i);
    const heightM = m[1].match(/\bheight\s*:\s*(-?\d+(?:\.\d+)?)px/i);
    if (!topM || !heightM) continue; // covers "height:undefinedpx" / missing rule
    maxBottom = Math.max(maxBottom, parseFloat(topM[1]) + parseFloat(heightM[1]));
  }
  return Math.round(maxBottom);
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
 * Strip non-visual blocks (script/noscript/template/style + JSON-typed elements)
 * before raw HTML is dumped into a fallback text-block. Without this, Pancake
 * pages (no com-section markup) fall through to the "wrap whole HTML as text"
 * path and their embedded page-config JSON (<script type="application/json">,
 * analytics, etc.) renders as literal visible text in the cloned page.
 */
function stripNonVisual(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<template[\s\S]*?<\/template>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

/**
 * Remove lazy-load markers from every class="..." attribute.
 * LadiPage uses two variants:
 *   - `class="lazy"` (older builds): CSS hides until JS strips it
 *   - `class="ladi-lazyload"` (newer builds): JS sets background-image on
 *     IntersectionObserver hit. In Webcake's preview/editor that JS doesn't
 *     run, so backgrounds stay invisible.
 * Pre-strip both so all backgrounds bake-in the post-load visible state.
 */
function stripLazyClasses(html) {
  return html
    .replace(/(\bclass="[^"]*?)\bladi-lazyload\b\s?([^"]*")/gi, (_, b, a) => b + a)
    .replace(/(\bclass='[^']*?)\bladi-lazyload\b\s?([^']*')/gi, (_, b, a) => b + a)
    .replace(/(\bclass="[^"]*?)\blazy\b\s?([^"]*")/gi, (_, b, a) => b + a);
}

/**
 * Neutralize LadiPage's "scroll-triggered entrance animation" initial-hidden
 * CSS. LadiPage renders badges/CTA buttons/price tags with an entrance
 * animation (fade-in, slide-up, flash, ...) and bakes their PRE-animation
 * state directly into page CSS with `!important` so there's no flash of
 * unstyled content:
 *   .ladi-animation-hidden { visibility: hidden !important; opacity: 0 !important; }
 *   #BADGE1, #BUTTON3, #HEADLINE22, #BUTTON7 { opacity: 0 !important; pointer-events: none !important; }
 * (the 2nd form is a page-specific ID-list rule, one per page, listing every
 * entrance-animated widget — the class alone does NOT drive visibility here).
 * A real browser only reveals these once its own scroll/IntersectionObserver
 * JS fires and removes the class / flips the inline style. Webcake's static
 * clone never runs that JS, so badges, CTA buttons and price tags baked this
 * way stay permanently invisible — that's the reported "dropped" bug for
 * BEST SELLER badge / ĐẶT HÀNG NGAY CTA / 199.000đ price. Since both rules
 * use !important, simply not touching the class isn't enough — the CSS
 * itself must stop hiding the element. We bake the "already animated in"
 * (final visible) state instead, matching the stripLazyClasses strategy.
 *
 * FOLLOW-UP FIX (flash-then-vanish): the above only defuses the STATIC
 * pre-animation hide rule. It does NOT touch the animation itself — LadiPage
 * also ships per-widget compound-selector rules pairing the (still-present,
 * see stripAnimationClasses) `.ladi-animation` trigger class with a
 * `@keyframes` name, e.g.:
 *   #GROUP8.ladi-animation > .ladi-group, #BUTTON7.ladi-animation > .ladi-button
 *     { animation-name: flash; animation-delay: 1s; animation-duration: 1s;
 *       animation-iteration-count: infinite; }
 * This is plain CSS — no JS trigger needed. Once `.ladi-animation` is on the
 * element, the browser runs it unconditionally: for the first `animation-
 * delay` (here 1s) the element sits at its normal (now-visible, thanks to
 * the fix above) state, then the keyframe kicks in — "flash" (and similar
 * bounce/pulse attention loops) cycles back through opacity:0 — so the
 * element shows fully for ~1s, then vanishes, forever, on a loop. That is
 * EXACTLY the reported bug. Fix: for any rule whose selector references the
 * bare `.ladi-animation` trigger class, strip its animation declarations and
 * delete the @keyframes blocks it drove (so nothing is left to replay the
 * hide/reveal cycle even if the class ever ends up on an element again).
 */
function stripEntranceAnimationHiding(css) {
  let out = css.replace(/\.ladi-animation-hidden\s*\{[^}]*\}/gi, '.ladi-animation-hidden{}');
  // Signature: a rule body containing BOTH opacity:0!important and
  // pointer-events:none!important (order-agnostic) — LadiPage's per-page
  // entrance-animation initial-state rule. Strip just those two
  // declarations so any other properties on the same rule survive.
  out = out.replace(/\{([^}]*)\}/g, (block, body) => {
    const hasOpacityZero = /opacity\s*:\s*0\s*!important/i.test(body);
    const hasNoPointerEvents = /pointer-events\s*:\s*none\s*!important/i.test(body);
    if (!hasOpacityZero || !hasNoPointerEvents) return block;
    const cleaned = body
      .replace(/opacity\s*:\s*0\s*!important;?/gi, '')
      .replace(/pointer-events\s*:\s*none\s*!important;?/gi, '');
    return '{' + cleaned + '}';
  });

  // Defuse the animation wiring itself: any rule selecting the bare
  // `.ladi-animation` class (word-boundary aware so it does NOT match the
  // already-neutralized `.ladi-animation-hidden` variant) loses its
  // animation-* declarations, and any @keyframes name it referenced gets
  // deleted outright.
  const keyframeNames = new Set();
  out = out.replace(/([^{}]+)\{([^}]*)\}/g, (block, selector, body) => {
    if (!/\.ladi-animation(?![\w-])/.test(selector)) return block;
    for (const nm of body.matchAll(/animation(?:-name)?\s*:\s*([^;]+);?/gi)) {
      const firstToken = nm[1].trim().split(/\s+/)[0];
      if (firstToken && firstToken.toLowerCase() !== 'none') keyframeNames.add(firstToken);
    }
    const cleanedBody = body.replace(/(?:-webkit-)?animation(?:-[a-z-]+)?\s*:[^;]+;?/gi, '');
    return selector + '{' + cleanedBody + '}';
  });
  for (const name of keyframeNames) {
    const escName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kfRe = new RegExp('@(?:-webkit-)?keyframes\\s+' + escName + '\\s*\\{(?:[^{}]*\\{[^{}]*\\})*[^{}]*\\}', 'gi');
    out = out.replace(kfRe, '');
  }

  // Final safety net: force any surviving entrance-animation marker to its
  // permanent final-visible state, in case a class slips through (defensive
  // — the actual removal happens in stripAnimationClasses on the HTML side).
  out +=
    '\n[class*="ladi-animation"]{opacity:1 !important;visibility:visible !important;' +
    'transform:none !important;animation:none !important;-webkit-animation:none !important;' +
    'transition:none !important;}';

  return out;
}

/**
 * Remove the leftover LadiPage entrance-animation MARKERS from every
 * class="..." attribute: `ladi-animation-hidden` (pre-reveal state) and the
 * bare `ladi-animation` trigger class (pairs with the per-widget
 * animation-name rules defused in stripEntranceAnimationHiding above). Also
 * strips `data-animation*` attributes some builds use as an alternate
 * trigger marker. Order matters: strip the longer `-hidden` token first, or
 * the bare-token regex would partially consume it and leave a dangling
 * `-hidden` fragment (same reasoning as stripLazyClasses below).
 */
function stripAnimationClasses(html) {
  return html
    .replace(/(\bclass="[^"]*?)\bladi-animation-hidden\b\s?([^"]*")/gi, (_, b, a) => b + a)
    .replace(/(\bclass='[^']*?)\bladi-animation-hidden\b\s?([^']*')/gi, (_, b, a) => b + a)
    .replace(/(\bclass="[^"]*?)\bladi-animation\b\s?([^"]*")/gi, (_, b, a) => b + a)
    .replace(/(\bclass='[^']*?)\bladi-animation\b\s?([^']*')/gi, (_, b, a) => b + a)
    .replace(/\sdata-animation[a-zA-Z0-9_-]*="[^"]*"/gi, '')
    .replace(/\sdata-animation[a-zA-Z0-9_-]*='[^']*'/gi, '');
}

/**
 * Resolve LadiPage's "video" widget. The `.ladi-video-background` div a
 * video widget renders is ALWAYS empty scaffolding — LadiPage injects the
 * actual <video>/poster at runtime by reading a per-widget config keyed by
 * widget id from `<script id="script_event_data" type="application/json">`
 * (entries shaped like `{"a":"video","ci":"<direct src url>","ch":"direct"}`).
 * Without running that JS, Webcake's clone shows only the empty box + the
 * static play-icon SVG overlay — the reported "peach box, no video" bug.
 * Mutates `doc` in place so the resolved <video> survives into each
 * section's captured outerHTML.
 */
export function resolveVideoWidgets(doc) {
  const configEl = doc.getElementById('script_event_data');
  if (!configEl) return;
  let config;
  try {
    config = JSON.parse(configEl.textContent);
  } catch {
    return; // malformed/unexpected config shape — leave video widgets as-is
  }
  for (const [widgetId, meta] of Object.entries(config)) {
    if (!meta || meta.a !== 'video' || !meta.ci) continue;
    // `ci` is only a directly-playable <video src> when `ch` is "direct"
    // (verified shape: `{"a":"video","ci":"<direct src url>","ch":"direct"}`,
    // see module comment above). Other channel values (YouTube/Vimeo embeds,
    // or any future/unrecognized `ch`) store an embed ID or non-video-file
    // URL in `ci`, not something a <video> tag can play. Regression fix:
    // this used to be assumed unconditionally, so a non-"direct" widget got
    // its static poster+play-icon wiped (below) in favor of a <video> that
    // silently failed to load — box goes visibly empty ("video disappeared"
    // bug report), which is strictly worse than the old stuck-play-button
    // overlay it replaced. Bail out here for anything we can't confidently
    // resolve so the widget is left byte-for-byte as LadiPage rendered it.
    if (meta.ch !== 'direct' || !/^https?:\/\//i.test(meta.ci)) continue;
    const widget = doc.getElementById(widgetId);
    if (!widget) continue;
    const bg = widget.querySelector('.ladi-video-background');
    if (!bg || bg.querySelector('video')) continue; // already resolved / no target
    const video = doc.createElement('video');
    video.setAttribute('src', meta.ci);
    video.setAttribute('controls', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('style', 'width:100%;height:100%;object-fit:cover;pointer-events:auto;');
    // Only now — with a real <video> built and confirmed pointed at a
    // direct URL — do we touch the widget's existing markup. Clear any
    // pre-existing static content inside the background box (e.g. a poster
    // <img> or play-icon <svg> LadiPage baked in) and insert the real
    // video; any bail-out above skips this entirely, leaving the original
    // poster + play icon visible exactly like the pre-regression build.
    bg.innerHTML = '';
    bg.appendChild(video);
    // LadiPage renders a static play-button overlay (e.g. a `SHAPE...` div)
    // stacked on top of this widget with no click handler AND no "hide on
    // play" behaviour in the static clone — it occludes the native <video
    // controls> underneath (fixed below via pointer-events) but also stays
    // stuck on top of the video WHILE IT PLAYS, since nothing ever toggles
    // its visibility (LadiPage does that at runtime via its own JS, which
    // this static clone doesn't have — and Webcake strips any <script> we
    // could inject to listen for the video's 'play' event, see
    // stripBodyScripts below). Native <video controls> already supplies its
    // own play affordance that the browser shows/hides correctly on its
    // own, so the overlay is pure redundant chrome once we have a real
    // video — remove every other sibling in the widget instead of trying to
    // sync its visibility.
    //
    // BUG FIX (T-23, verified against real nhanong.top/htxtaybac markup):
    // `bg` is NOT a direct child of `widget` — the real nesting is
    // `widget(#VIDEO6) > .ladi-video > .ladi-video-background(=bg)`, with the
    // play-button overlay (`#SHAPE6`) as bg's SIBLING under `.ladi-video`,
    // not widget's sibling. Iterating `widget.children` and removing
    // "everything that isn't bg" therefore removed the `.ladi-video`
    // wrapper itself — which IS bg's parent — deleting bg (and the <video>
    // just appended into it) a line after inserting it. Net effect: the
    // widget ended up completely empty, not even the original poster/play
    // button — the reported "video lost entirely" bug. Fix: remove bg's
    // own siblings (scoped to bg's actual parent), not widget's children.
    const bgParent = bg.parentElement || widget;
    Array.from(bgParent.children).forEach((child) => {
      if (child !== bg) child.remove();
    });
    // Make every other layer in the widget click-through so hit-testing
    // falls to the video regardless of DOM/z-index order, then re-enable
    // the video explicitly. pointer-events doesn't affect box size, so
    // section height/layout is untouched.
    widget.style.setProperty('pointer-events', 'none');
  }
}

/**
 * Extract a direct, playable video URL for a Pancake/Webcake video widget,
 * scoped to one widget id. Checked in order, first hit wins:
 *   1) data-video-url / data-video-src / data-src / data-video attribute
 *      on the wrapper itself or any descendant (covers exports that DO bake
 *      the src in statically).
 *   2) A JSON <script> element sibling/descendant of the wrapper whose
 *      parsed content carries a src/url/video_url/videoUrl/ci string field.
 *   3) The page-wide `window.event_data` config (`<script id="event_data">`)
 *      — parsed once by the caller and passed in — indexed by this widget's
 *      DOM id, in case Pancake nests per-widget media config there.
 * Returns `{ url, kind }` where kind is 'direct' (mp4/webm — safe to render
 * in a static <video> tag) or 'hls' (m3u8 — NOT safe, no hls.js polyfill is
 * injected into the static clone) or `null` when nothing was found.
 */
function extractPancakeVideoUrl(wrapper, eventData) {
  const DIRECT_RE = /^https:\/\/[^\s"']+\.(?:mp4|webm)(?:\?[^\s"']*)?$/i;
  const HLS_RE = /^https:\/\/[^\s"']+\.m3u8(?:\?[^\s"']*)?$/i;
  const classify = (val) => {
    if (typeof val !== 'string') return null;
    if (DIRECT_RE.test(val)) return { url: val, kind: 'direct' };
    if (HLS_RE.test(val)) return { url: val, kind: 'hls' };
    return null;
  };

  // 1) data-* attributes on the wrapper or any descendant.
  const attrNames = ['data-video-url', 'data-video-src', 'data-src', 'data-video'];
  const nodes = [wrapper, ...Array.from(wrapper.querySelectorAll('*'))];
  for (const el of nodes) {
    for (const attr of attrNames) {
      const hit = classify(el.getAttribute && el.getAttribute(attr));
      if (hit) return hit;
    }
  }

  // 2) JSON <script> element living inside the wrapper (mirrors how
  // LadiPage's review widget ships its own config as a sibling script,
  // see resolveReviewSummaries above).
  const jsonKeys = ['src', 'url', 'video_url', 'videoUrl', 'ci'];
  for (const scriptEl of Array.from(wrapper.querySelectorAll('script'))) {
    let parsed;
    try {
      parsed = JSON.parse(scriptEl.textContent);
    } catch {
      continue;
    }
    for (const key of jsonKeys) {
      const hit = classify(parsed && parsed[key]);
      if (hit) return hit;
    }
  }

  // 3) Page-wide event_data config, indexed by this widget's DOM id.
  if (eventData && wrapper.id && eventData[wrapper.id]) {
    const node = eventData[wrapper.id];
    for (const key of jsonKeys) {
      const hit = classify(node && node[key]);
      if (hit) return hit;
    }
  }

  return null;
}

/**
 * Resolve Pancake/Webcake's "video" widget — the sibling case to
 * resolveVideoWidgets above, for pages built with Pancake's Webcake editor
 * instead of LadiPage. Confirmed markup shape (bdsnguyennam.com/0709test2,
 * customer Nam, T-23): `<div id="VIDEO{N}" class="ladi-element"
 * style="pointer-events: none;"></div>` — completely empty, no
 * `.ladi-video`/`.ladi-video-background` scaffolding at all (unlike
 * LadiPage, which at least statically renders the poster box). Pancake
 * mounts the real player entirely via its own runtime bundle
 * (`/webcake/v4/{buildId}`), which Webcake's static clone never executes.
 *
 * VERIFIED GAP: for the real customer page above, NEITHER a data-video-url
 * attribute NOR a matching entry in `window.event_data` exist anywhere in
 * the captured HTML — the video src is fetched by Pancake's runtime via an
 * API call keyed by page id + widget id, not carried in the static export
 * at all (checked: 0 occurrences of .mp4/.m3u8/"type":"video" in the full
 * 2.4MB clone). That specific page is therefore genuinely unresolvable by
 * static analysis; this function still runs the extraction below in case a
 * different Pancake/Webcake export DOES bake a data-attribute or event_data
 * entry in (some builder versions may), and honors the same hard safety
 * rule as resolveVideoWidgets: only mutate a container when a directly
 * playable https mp4/webm URL was actually found. HLS (.m3u8)-only configs
 * and "nothing found" both leave the widget byte-for-byte untouched.
 */
export function resolvePancakeVideos(doc) {
  const wrappers = Array.from(doc.querySelectorAll('.ladi-element[id^="VIDEO"]')).filter((el) =>
    /^VIDEO\d+$/i.test(el.id)
  );
  if (wrappers.length === 0) return;

  let eventData = null;
  const eventDataEl = doc.getElementById('event_data');
  if (eventDataEl) {
    const m = (eventDataEl.textContent || '').match(/window\.event_data\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (m) {
      try {
        eventData = JSON.parse(m[1]);
      } catch {
        eventData = null; // malformed — extraction step 3 simply won't fire
      }
    }
  }

  for (const wrapper of wrappers) {
    if (wrapper.querySelector('video')) continue; // already resolved

    const found = extractPancakeVideoUrl(wrapper, eventData);
    if (!found) continue; // nothing recoverable — leave untouched (SAFETY)
    if (found.kind !== 'direct') {
      console.info('[htmlToPke] Pancake video widget', wrapper.id, 'is HLS-only (m3u8) — skipping, static <video> cannot play it reliably.');
      continue; // SAFETY: HLS-only, no hls.js in the static clone — do not mutate
    }

    const video = doc.createElement('video');
    video.setAttribute('src', found.url);
    video.setAttribute('controls', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('style', 'width:100%;height:100%;object-fit:cover;pointer-events:auto;');

    // Target the .ladi-video-background box if this export happens to have
    // one (LadiPage-style partial scaffolding); otherwise the wrapper itself
    // is the only container (confirmed real-world shape — see module note).
    const bg = wrapper.querySelector('.ladi-video-background') || wrapper;
    bg.innerHTML = '';
    bg.appendChild(video);
    wrapper.style.setProperty('pointer-events', 'none');
  }
}

/**
 * Resolve LadiPage's "review" widget — PARTIAL fix only. The widget is an
 * `<iframe class="ladi-review-iframe">` whose content (per-review cards:
 * avatar photos, names, comments) is populated by an authenticated AJAX
 * call to LadiPage's own backend on page load (`LadiPageApp.review_onload`)
 * — that data never exists in the static HTML at all, so it cannot be
 * recovered client-side without hitting LadiPage's private API (out of
 * scope: CORS-blocked from the browser, undocumented endpoint/auth).
 *
 * What IS available statically is the widget's own aggregate rating summary,
 * baked as `<script class="ladi-review-script" type="application/json">`
 * next to the iframe: `{ ea: [{eb: starValue, ec: count}, ...] }` (star-count
 * distribution — field names are LadiPage's own minified export, verified
 * against nhanong.top/htxtaybac: ea=[{eb:5,ec:56},{eb:4,ec:4},{eb:3,ec:3},
 * {eb:2,ec:2},{eb:1,ec:1}]). We reconstruct a real rating-summary widget
 * (big average + star row + per-star distribution bars) from this data and
 * place it where the iframe was — the individual review cards remain
 * genuinely unrecoverable and are NOT rendered.
 *
 * The reconstructed widget needs its own explicit pixel box to actually
 * occupy space in Webcake's absolute-position layout: the plain text this
 * used to inject had no width/height, and the wrapping `#<reviewId>` element
 * (e.g. `#REVIEW1`) only carries `position:absolute;top:0;left:0` in some
 * per-section CSS extracts (its own `width/height` rule can be missing from
 * that section's copy) — with no intrinsic size, the summary would collapse
 * to near-zero and sit hidden under sibling absolutely-positioned elements
 * anchored at the same origin. We recover the widget's real declared pixel
 * box from the page's own `#<reviewId>{width:...px;height:...px}` head CSS
 * rule (same one that originally sized the iframe) and set it inline on our
 * replacement div directly, so it renders at the correct size regardless of
 * whether the wrapper's own rule survived into this section's CSS extract.
 */
function resolveReviewSummaries(doc) {
  const scripts = Array.from(doc.querySelectorAll('script.ladi-review-script'));
  for (const scriptEl of scripts) {
    let stats;
    try {
      stats = JSON.parse(scriptEl.textContent);
    } catch {
      continue;
    }
    const dist = Array.isArray(stats.ea) ? stats.ea : [];
    if (dist.length === 0) continue;
    const total = dist.reduce((sum, d) => sum + (d.ec || 0), 0);
    if (total <= 0) continue;
    const weighted = dist.reduce((sum, d) => sum + (d.eb || 0) * (d.ec || 0), 0);
    // LadiPage's own widget truncates (not rounds) the average to 1 decimal —
    // verified against nhanong.top/htxtaybac: 310/66=4.6969... displays "4.6",
    // not the "4.7" a naive toFixed(1) round would produce.
    const avg = (Math.floor((weighted / total) * 10) / 10).toFixed(1);
    const avgNum = parseFloat(avg);

    const wrapper = scriptEl.parentElement;
    const iframe = wrapper && wrapper.querySelector('.ladi-review-iframe');
    if (!iframe) continue;

    // Best-effort real box size from the page's own CSS; falls back to a
    // sane default so the widget still renders (just not pixel-perfect) if
    // the wrapper has no id or the rule can't be found.
    let boxW = 400;
    let boxH = 260;
    if (wrapper.id) {
      const cssText = Array.from(doc.querySelectorAll('style'))
        .map((s) => s.textContent || '')
        .join('\n');
      const escId = wrapper.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ruleRe = new RegExp('#' + escId + '\\b[^{]*\\{([^}]*)\\}', 'g');
      let rm;
      while ((rm = ruleRe.exec(cssText)) !== null) {
        const wMatch = rm[1].match(/width\s*:\s*(\d+(?:\.\d+)?)px/);
        const hMatch = rm[1].match(/height\s*:\s*(\d+(?:\.\d+)?)px/);
        if (wMatch) boxW = Math.round(parseFloat(wMatch[1]));
        if (hMatch) boxH = Math.round(parseFloat(hMatch[1]));
      }
    }

    // Map star-count distribution by rating value — don't assume array order.
    const byStar = {};
    for (const d of dist) byStar[d.eb] = d.ec || 0;

    const gold = '#f5a623';
    const filledStars = Math.floor(avgNum); // e.g. 4.6 -> 4 filled, 1 grey
    const starIcons = [1, 2, 3, 4, 5]
      .map((n) => '<span style="color:' + (n <= filledStars ? gold : '#ddd') + ';font-size:18px;">★</span>')
      .join('');

    const distRows = [5, 4, 3, 2, 1]
      .map((star) => {
        const count = byStar[star] || 0;
        const pct = Math.round((count / total) * 100);
        return (
          '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#666;line-height:1;">' +
          '<span style="width:22px;flex-shrink:0;">' + star + '★</span>' +
          '<div style="flex:1;background:#eee;border-radius:4px;height:8px;overflow:hidden;">' +
          '<div style="width:' + pct + '%;height:100%;background:' + gold + ';"></div>' +
          '</div>' +
          '<span style="width:26px;text-align:right;flex-shrink:0;">' + count + '</span>' +
          '</div>'
        );
      })
      .join('');

    const summary = doc.createElement('div');
    summary.setAttribute(
      'style',
      'position:relative;width:' + boxW + 'px;max-width:100%;height:' + boxH + 'px;' +
        'box-sizing:border-box;padding:16px;font-family:Arial,Helvetica,sans-serif;' +
        'background:#fff;display:flex;flex-direction:column;justify-content:center;gap:10px;overflow:hidden;'
    );
    summary.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;">' +
      '<span style="font-size:36px;font-weight:700;color:#222;line-height:1;">' + avg + '</span>' +
      '<div style="display:flex;flex-direction:column;gap:4px;">' +
      '<div style="letter-spacing:2px;">' + starIcons + '</div>' +
      '<div style="color:#666;font-size:13px;">' + total + ' đánh giá</div>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;">' + distRows + '</div>';

    iframe.replaceWith(summary);
  }
}

/**
 * Read a numeric `prop:Npx` declaration out of a CSS rule body. Returns
 * NaN when the rule/property isn't present (caller checks Number.isFinite).
 */
function readPx(body, prop) {
  const m = body.match(new RegExp('\\b' + prop + '\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px', 'i'));
  return m ? parseFloat(m[1]) : NaN;
}

/**
 * Sum the top/left of every ancestor between `el` and `sectionEl` that
 * carries its own `#id{top:...;left:...}` CSS rule. LadiPage/Pancake nest
 * absolutely-positioned "group" wrappers inside a section (verified:
 * hangnhapkhau.pro.vn/urea — the countdown's own `#w-ft2twjuz{top:22px;
 * left:17.5px}` is relative to its immediate `#w-y5hbyu1p{top:6px;
 * left:55px}` group wrapper, NOT the section root directly). Structural-only
 * wrappers (`.section-wrapper`, `.section-container`, `.group-container`)
 * carry no `id` attribute and therefore no CSS rule of their own — they
 * don't contribute an offset, only real positioned group wrappers do.
 */
function cumulativeGroupOffset(el, sectionEl, head) {
  let top = 0;
  let left = 0;
  let node = el.parentElement;
  while (node && node !== sectionEl) {
    if (node.id) {
      const escId = node.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = head.match(new RegExp('#' + escId + '\\s*\\{([^}]*)\\}', 'i'));
      if (m) {
        const t = readPx(m[1], 'top');
        const l = readPx(m[1], 'left');
        if (Number.isFinite(t)) top += t;
        if (Number.isFinite(l)) left += l;
      }
    }
    node = node.parentElement;
  }
  return { top, left };
}

/**
 * Resolve Pancake's "countdown" widget (`<div class="com-countdown">`) into
 * Webcake's OWN NATIVE `type: 'countdown'` PKE widget — verified against a
 * real Webcake export (dong-ho-tron-fb.pke, 3 confirmed instances) to be a
 * genuinely Webcake-engine-rendered, LIVE-TICKING widget. Unlike every other
 * widget resolved in this file (baked as raw HTML inside a text-block's
 * specials.text — dead the moment Webcake strips our injected JS), Webcake's
 * OWN runtime owns this widget's tick logic, so this is the one case where a
 * real ticking countdown survives the clone. Confirmed schema (fields seen
 * on all 3 real instances):
 *   specials: { type:'minute', startTime:<ISO no-Z>, duration:<minutes>,
 *               showDay, showHour, showSecond, showText,
 *               customize:'customize', animateMode }
 * `duration` is always expressed in MINUTES regardless of which unit boxes
 * are shown; showDay/showHour/showSecond just toggle which unit boxes render
 * out of that total — the minute box itself is implicitly always shown.
 *
 * BUG THIS FIXES (T-23 reopened, customer report on
 * hangnhapkhau.pro.vn/urea): Pancake's countdown widget carries NO real
 * deadline anywhere in the static HTML export — same unresolvable-at-clone-
 * time gap already documented in resolvePancakeVideos above (Pancake
 * resolves it via its own backend, keyed by page+widget id, never baked into
 * the page). Left as static markup, the digit boxes freeze at whatever
 * value existed at crawl time; on a Pancake export that instead uses the
 * widget's flip-clock rendering variant (page's own CSS ships dead
 * `.countdown-wrapper .timer-number`/`.show`/`.next` rules for this even
 * when unused, confirmed present on this very page) a static clone would
 * render every stacked digit-slice simultaneously — the reported "garbled
 * digit boxes". We don't try to guess the seller's original deadline (same
 * reasoning as the video gap: it's not recoverable, and the clone is a new
 * campaign anyway) — instead we start a FRESH countdown at clone time
 * (startTime = now) with a duration inferred from which unit boxes the
 * source widget itself shows, matching its visual granularity.
 *
 * Positioning: the widget's own `#id{top;left;width;height}` CSS rule is
 * relative to its nearest positioned ancestor GROUP wrapper, not always the
 * section root directly (see cumulativeGroupOffset above) — resolved so the
 * native widget lands exactly where the static box used to be.
 *
 * SAFETY: only mutates when the widget's own box CSS *and* every ancestor
 * group offset needed to place it are cleanly resolvable. Otherwise the
 * widget is left completely untouched (same "don't guess" rule as every
 * other resolver in this file) — no partial/best-effort placement that could
 * land it somewhere worse than the original static freeze.
 *
 * Returns a Map of sectionId -> [countdown widget PKE object]. Removes the
 * resolved widget from `doc` so it isn't ALSO dumped as dead static markup
 * inside that section's text-block HTML.
 */
export function resolveCountdowns(doc, head) {
  const bySection = new Map();
  const widgets = Array.from(doc.querySelectorAll('.com-countdown'));
  for (const el of widgets) {
    if (!el.id) continue;
    const wrapper = el.querySelector('.countdown-wrapper') || el;
    const sectionEl = el.closest('.com-section');
    if (!sectionEl || !sectionEl.id) continue; // no section to anchor it in — leave untouched

    const escId = el.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boxM = head.match(new RegExp('#' + escId + '\\s*\\{([^}]*)\\}', 'i'));
    if (!boxM) continue; // no positioning info — unsafe to place natively

    const ownTop = readPx(boxM[1], 'top');
    const ownLeft = readPx(boxM[1], 'left');
    const width = readPx(boxM[1], 'width');
    const height = readPx(boxM[1], 'height');
    if (![ownTop, ownLeft, width, height].every(Number.isFinite)) continue;

    const offset = cumulativeGroupOffset(el, sectionEl, head);
    const top = offset.top + ownTop;
    const left = offset.left + ownLeft;

    // Per-item styling from `#id .countdown-item{...}` — best-effort, missing
    // properties simply aren't set (Webcake widget still renders with its
    // own defaults).
    const itemM = head.match(new RegExp('#' + escId + '\\s+\\.countdown-item\\s*\\{([^}]*)\\}', 'i'));
    const itemBody = itemM ? itemM[1] : '';
    const grabDecl = (prop) => {
      const m = itemBody.match(new RegExp('\\b' + prop + '\\s*:\\s*([^;]+);'));
      return m ? m[1].trim() : undefined;
    };
    const fontSize = readPx(itemBody, 'font-size');
    const borderWidth = readPx(itemBody, 'border-width');

    // Which unit boxes the source shows — Pancake bakes the author's
    // show/hide choice as inline `style="display:none"` on each
    // `.countdown-item-*` node (absence of the attribute, or an explicit
    // empty style="", both mean "visible").
    const isHidden = (cls) => {
      const item = wrapper.querySelector('.' + cls);
      return !!item && /display\s*:\s*none/i.test(item.getAttribute('style') || '');
    };
    const showDay = !isHidden('countdown-item-day');
    const showHour = !isHidden('countdown-item-hour');
    const showSecond = !isHidden('countdown-item-second');
    const minuteText = wrapper.querySelector('.countdown-item-minute .text');
    const showText = !!minuteText && !/display\s*:\s*none/i.test(minuteText.getAttribute('style') || '');

    // Deadline is unrecoverable (see module comment) — start fresh at clone
    // time, duration sized to match the widest unit box actually shown.
    const duration = showDay ? 3 * 24 * 60 : showHour ? 12 * 60 : 60;

    const buildStyles = () => {
      const styles = { zIndex: '', width, top, left, height, textAlign: 'center' };
      const fontWeight = grabDecl('font-weight');
      const color = grabDecl('color');
      const borderStyle = grabDecl('border-style');
      const borderColor = grabDecl('border-color');
      const background = grabDecl('background');
      if (fontWeight) styles.fontWeight = fontWeight;
      if (Number.isFinite(fontSize)) styles.fontSize = fontSize;
      if (color) styles.color = color;
      if (Number.isFinite(borderWidth)) styles.borderWidth = borderWidth;
      if (borderStyle) styles.borderStyle = borderStyle;
      if (borderColor) styles.borderColor = borderColor;
      if (background) styles.background = background;
      return styles;
    };

    const countdownWidget = {
      type: 'countdown',
      specials: {
        type: 'minute',
        startTime: new Date().toISOString().slice(0, 19),
        showText,
        showSecond,
        showHour,
        showDay,
        duration,
        customize: 'customize',
        animateMode: wrapper.getAttribute('data-mode') || 'none'
      },
      // BUGFIX (T-23 re-reopened, countdown disappears entirely on publish):
      // `firstInit`/`changeSection` are Webcake EDITOR *session state*, not
      // widget schema — the real dong-ho-tron-fb.pke export we verified
      // against had already been opened in the editor once, which stamps
      // firstInit to the breakpoint that triggered the widget's lazy mount
      // and changeSection:true once that mount handler has run. Copying
      // that already-initialized state onto a freshly synthesized widget
      // means Webcake's publish-time renderer (which never runs the
      // editor's lazy-mount trigger) thinks the countdown was already
      // mounted and skips mounting it — the widget's DOM/ticking-interval
      // never gets created, so it doesn't render at all. Every other widget
      // this file synthesizes (section, text-block) uses the fresh/never-
      // initialized state `firstInit: false` and those DO render correctly
      // after clone+publish; match that same convention here.
      runtime: { firstInit: false },
      responsive: {
        mobile: { styles: buildStyles(), config: { notloaded: false, borderColorHidden: {}, bgHidden: {} } },
        desktop: { styles: buildStyles(), config: { notloaded: false, borderColorHidden: {}, bgHidden: {} } }
      },
      properties: { sync: true, name: 'countdown_' + generateId(), movable: true },
      id: generateId(),
      events: []
    };

    if (!bySection.has(sectionEl.id)) bySection.set(sectionEl.id, []);
    bySection.get(sectionEl.id).push(countdownWidget);

    el.remove(); // drop the dead static markup — the native widget replaces it
  }
  return bySection;
}

/**
 * Remove leftover <script>/<noscript>/<template> tags sitting directly in
 * the page BODY before each section's outerHTML is captured (regression
 * fix — malformed duplicate elements on publish).
 *
 * LadiPage widgets embed their runtime config/CSS as inline <script> tags
 * living right inside the widget's own markup, e.g. a review widget ships
 * `<script class="ladi-review-style">...css...</script><script
 * class="ladi-review-script" type="application/json">{...}</script>` as
 * direct siblings. resolveVideoWidgets/resolveReviewSummaries above already
 * read whatever they need out of these BEFORE this runs — none of them ever
 * execute in the static clone. Left in place, though, they survive verbatim
 * into that section's outerHTML → specials.text raw-HTML string. Webcake's
 * own published-page bootstrap embeds that same string inside ITS OWN
 * wrapping <script type="application/json"> tag; the browser's HTML
 * tokenizer scans for the literal byte sequence `</script>` with zero
 * awareness of JSON string-escaping, so a leftover inner `</script>` closes
 * Webcake's OUTER script tag early. Everything after that point — including
 * the JSON-escaped (backslash-quoted) remainder of Webcake's own page-data —
 * spills out as literal body markup and the parser turns it into real,
 * malformed DOM elements (`id="\"IMAGE11\""`-style garbage, full-width,
 * breaking layout). The non-LadiPage fallback path already strips exactly
 * this (see stripNonVisual above, added for the same "JSON leaks as visible
 * text" reason) — this brings the main LadiPage per-section path in line.
 */
function stripBodyScripts(doc) {
  if (!doc.body) return;
  doc.body.querySelectorAll('script, noscript, template').forEach((el) => el.remove());
}

export function generatePkeBuffer(html, productName = 'Landing Page') {
  const escapedHtml = stripAnimationClasses(stripLazyClasses(html.trim()));

  // Extract <head> block for height parsing and CSS/JS extraction
  const headMatch = escapedHtml.match(/<head\b[^>]*>[\s\S]*?<\/head>/i);
  const head = headMatch ? headMatch[0] : '';

  // Extract CSS and JS from head to place in settings.extra_css / settings.extra_script
  const extraCss = stripEntranceAnimationHiding(extractStyles(head));
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

  // Resolve widgets whose real content only exists in a runtime JS config
  // (video src, review rating summary, countdown deadline) — must run
  // BEFORE extractComSections captures each section's outerHTML, so the
  // resolved markup is included. resolveCountdowns removes the widget from
  // `doc` and returns per-section native widgets to splice in below instead.
  resolveVideoWidgets(doc);
  resolvePancakeVideos(doc);
  resolveReviewSummaries(doc);
  const countdownsBySection = resolveCountdowns(doc, head);
  stripBodyScripts(doc);

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
    // Fix Pancake JSON leak: nhánh fallback nhồi HTML thô, phải lọc script/json kẻo hiện ra text
    pageSections = [buildSection({ html: stripNonVisual(escapedHtml), name: 'section_1', sectionIndex: 1, height: 10000, canvasDesktop })];
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
      // null = "not resolved yet", distinct from a genuinely-parsed value —
      // needed below to tell "declared height missing" (untrustworthy 1500
      // placeholder) apart from "declared height found but too small".
      let sectionHeight = null;
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

      // Robustness fix (Webcake gap/overlap bug): the CSS regex above can fail
      // to resolve a numeric height at all (e.g. LadiPage's known
      // `height:undefinedpx` export bug), and previously fell back to a blind
      // 1500px placeholder — almost always too TALL for the real content,
      // leaving a visible gap when Webcake stacks sections as fixed-height
      // absolute boxes. Cross-check against the section's actual content
      // bound (max child bottom) instead:
      //   - height not resolved at all  → trust the computed content bound
      //     (falls back to 1500 only if that's ALSO unresolvable, e.g. an
      //     empty background-only spacer section);
      //   - height resolved but smaller than real content → bump up to the
      //     content bound so nothing clips.
      // Never shrink a validly-declared height — only grow it.
      const contentBoundHeight = computeContentBoundHeight(sec.outerHTML, head);
      if (sectionHeight === null || !Number.isFinite(sectionHeight) || sectionHeight <= 0) {
        sectionHeight = contentBoundHeight > 0 ? contentBoundHeight : 1500;
      } else if (contentBoundHeight > sectionHeight) {
        sectionHeight = contentBoundHeight;
      }

      const wrappedHtml = inlineStyleTag + sec.outerHTML;
      const extraChildren = countdownsBySection.get(sectionElementId) || [];
      return buildSection({ html: wrappedHtml, name, sectionIndex, height: sectionHeight, canvasDesktop, extraChildren });
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
