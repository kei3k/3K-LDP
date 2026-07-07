/**
 * reflowLayout.js — "measure-and-shift" layout reflow for translated LadiPage HTML.
 *
 * Problem: LadiPage stores each element's box as a fixed absolute `top/left/width/height`
 * in page CSS (`#w-<id>{top:Npx;left:Npx;width:Npx;height:Npx;}`). A real translation
 * (e.g. Chinese → Vietnamese) can make a text string wrap onto more lines than the
 * original, so the fixed-height text box no longer contains the translated text —
 * it overlaps whatever element sits below it in the same section.
 *
 * Fix, in two parts:
 *   1. `computeShifts` — PURE function (no DOM). Given a list of elements
 *      { id, top, height } for one section plus a map id → grownBy (px the
 *      element's content grew by after translation, 0/absent = no growth),
 *      returns which elements must shift down and by how much, plus the total
 *      section height growth. Unit-testable in plain Node.
 *   2. `reflowSection` — DOM-dependent orchestration. Runs in the browser only
 *      (after translation, before PKE packing). For every text-bearing element
 *      in a section, measures rendered height of original vs translated text
 *      using a hidden offscreen div (canvas measureText cannot do wrapping),
 *      derives the grow map, calls computeShifts, and rewrites the section's
 *      CSS (`top` for shifted elements, `height` for the section) in place.
 *
 * Conservative by design: we only ever grow/shift DOWN, never shrink or move
 * upward — a description of layout that's "a bit taller" beats one that clips
 * or overlaps.
 */

/**
 * Pure delta-computation core — no DOM, testable in Node.
 *
 * @param {Array<{id: string, top: number, height: number}>} elements
 *        All elements in ONE section, unsorted order OK.
 * @param {Map<string, number>|Object<string, number>} growthById
 *        id -> px the element's rendered content height grew by (translated - original).
 *        Entries <= 0 or absent are treated as "did not grow" and ignored.
 * @returns {{
 *   shifts: Map<string, number>,   // id -> total px to add to its `top`
 *   sectionDelta: number,          // total px to add to the section's fixed height
 *   log: Array<{ growElementId: string, grow: number, shiftedCount: number }>
 * }}
 */
export function computeShifts(elements, growthById) {
  const growth = growthById instanceof Map ? growthById : new Map(Object.entries(growthById || {}));
  const shifts = new Map(elements.map((el) => [el.id, 0]));
  const log = [];

  // Elements that actually grew, processed in top-down order so accumulated
  // shifts compose correctly when multiple elements in the same section grow.
  const growers = elements
    .filter((el) => (growth.get(el.id) || 0) > 0)
    .sort((a, b) => a.top - b.top);

  let sectionDelta = 0;

  for (const grower of growers) {
    const grow = growth.get(grower.id) || 0;
    if (grow <= 0) continue;

    // Use the grower's CURRENT (already-shifted) bottom edge as the threshold —
    // accumulated shifts from earlier growers must be reflected first.
    const growerBottom = grower.top + shifts.get(grower.id) + grower.height;

    let shiftedCount = 0;
    for (const el of elements) {
      if (el.id === grower.id) continue;
      const elCurrentTop = el.top + shifts.get(el.id);
      if (elCurrentTop >= growerBottom) {
        shifts.set(el.id, shifts.get(el.id) + grow);
        shiftedCount++;
      }
    }

    sectionDelta += grow;
    log.push({ growElementId: grower.id, grow, shiftedCount });
  }

  return { shifts, sectionDelta, log };
}

/**
 * Parse per-element absolute-position CSS boxes for ONE section from the
 * page's <head> CSS. Matches LadiPage's `#w-<id>{top:Npx;left:Npx;width:Npx;height:Npx;}`
 * rule shape. Only elements whose id appears in `elementIds` (the ids present
 * in this section's HTML) are returned, in no particular order.
 *
 * @param {string} headCss  raw CSS text (already unwrapped from <style> tags)
 * @param {string[]} elementIds  element ids (without the "w-" prefix stripped) to look for
 * @returns {Array<{id: string, top: number, left: number, width: number, height: number}>}
 */
export function parseElementBoxes(headCss, elementIds) {
  const boxes = [];
  for (const id of elementIds) {
    const escId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word-boundary guard so #w-abc doesn't match #w-abcdef's rule.
    const re = new RegExp('#' + escId + '(?![A-Za-z0-9_-])\\s*\\{([^}]*)\\}', 'i');
    const m = headCss.match(re);
    if (!m) continue;
    const body = m[1];
    const top = body.match(/\btop\s*:\s*(-?\d+(?:\.\d+)?)px/i);
    const left = body.match(/\bleft\s*:\s*(-?\d+(?:\.\d+)?)px/i);
    const width = body.match(/\bwidth\s*:\s*(\d+(?:\.\d+)?)px/i);
    const height = body.match(/\bheight\s*:\s*(\d+(?:\.\d+)?)px/i);
    if (!top || !height) continue; // not a positioned box we can reflow
    boxes.push({
      id,
      top: parseFloat(top[1]),
      left: left ? parseFloat(left[1]) : 0,
      width: width ? parseFloat(width[1]) : 0,
      height: parseFloat(height[1]),
    });
  }
  return boxes;
}

/**
 * Extract the font CSS declaration body for an element's `.text-block-css` rule,
 * e.g. `#w-<id> .text-block-css{font-size:20px;font-weight:bold;...}`.
 * Returns '' if not found (caller should skip measurement — guard, not throw).
 */
export function parseFontCss(headCss, id) {
  const escId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('#' + escId + '(?![A-Za-z0-9_-])\\s+\\.text-block-css\\s*\\{([^}]*)\\}', 'i');
  const m = headCss.match(re);
  return m ? m[1] : '';
}

/**
 * Measure the rendered height of `text` when laid out in a box of the given
 * width using the given font CSS declarations, via a hidden offscreen div.
 * Canvas measureText cannot reproduce wrapping, so we let the real browser
 * layout engine do it.
 *
 * Browser-only (uses `document`). Returns null on any failure (missing font,
 * no DOM, etc.) so callers can skip that element rather than break conversion.
 *
 * @param {string} text
 * @param {string} fontCssBody  raw CSS declarations, e.g. "font-size:20px;font-weight:bold;"
 * @param {number} width  px, matches the element's box width
 * @returns {number|null}
 */
export function measureRenderedHeight(text, fontCssBody, width) {
  if (typeof document === 'undefined') return null;
  let probe;
  try {
    probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.top = '-99999px';
    probe.style.left = '-99999px';
    probe.style.width = width > 0 ? `${width}px` : 'auto';
    probe.style.boxSizing = 'border-box';
    probe.style.whiteSpace = 'normal';
    probe.style.wordBreak = 'break-word';
    // Carry over the element's own font declarations verbatim so wrapping
    // matches production rendering (font-family/size/weight/line-height/etc).
    if (fontCssBody) probe.style.cssText += ';' + fontCssBody;
    probe.textContent = text;
    document.body.appendChild(probe);
    const h = probe.scrollHeight;
    return Number.isFinite(h) && h > 0 ? h : null;
  } catch (err) {
    console.warn('[reflowLayout] measurement failed, skipping element:', err?.message);
    return null;
  } finally {
    if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
  }
}

/**
 * Rewrite a section's CSS `top` values (for shifted elements) and its own
 * fixed height, in place inside `headCss`. Returns the patched CSS text.
 * Pure string surgery — safe to unit test alongside computeShifts if desired,
 * but kept here since it's a small, low-risk step.
 */
function applyShiftsToCss(headCss, sectionId, shifts, sectionDelta) {
  let patched = headCss;

  for (const [id, delta] of shifts) {
    if (!delta) continue;
    const escId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(#' + escId + '(?![A-Za-z0-9_-])\\s*\\{[^}]*?\\btop\\s*:\\s*)(-?\\d+(?:\\.\\d+)?)(px)', 'i');
    patched = patched.replace(re, (full, pre, num, unit) => `${pre}${(parseFloat(num) + delta).toFixed(2)}${unit}`);
  }

  if (sectionDelta > 0) {
    const escSec = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(#' + escSec + '(?![A-Za-z0-9_-])\\s*\\{[^}]*?\\bheight\\s*:\\s*)(\\d+(?:\\.\\d+)?)(px)', 'i');
    patched = patched.replace(re, (full, pre, num, unit) => `${pre}${(parseFloat(num) + sectionDelta).toFixed(2)}${unit}`);
  }

  return patched;
}

/**
 * reflowSection — measure translated-vs-original text growth for one section
 * and shift overlapping elements downward. Browser-only.
 *
 * @param {Object} params
 * @param {string} params.sectionId       e.g. "SECTION6" (matches the section's own CSS id)
 * @param {string} params.sectionHtml     outerHTML of this section (post-translation)
 * @param {string} params.headCss         full page <head> CSS (mutated copy returned, not mutated in place)
 * @param {Array<{ id: string, original: string, translated: string }>} params.textChanges
 *        Per text-block-element changes detected by the translation step.
 *        `id` is the element's wrapper id (the "w-xxxx" in `id="w-xxxx"`).
 * @returns {{ headCss: string, shiftedCount: number, totalDelta: number }}
 */
export function reflowSection({ sectionId, sectionHtml, headCss, textChanges }) {
  if (!textChanges || textChanges.length === 0) {
    return { headCss, shiftedCount: 0, totalDelta: 0 };
  }

  const elementIds = textChanges.map((c) => c.id);
  const boxes = parseElementBoxes(headCss, elementIds);
  const boxById = new Map(boxes.map((b) => [b.id, b]));

  const growthById = new Map();
  for (const change of textChanges) {
    const box = boxById.get(change.id);
    if (!box) continue; // couldn't find geometry — skip silently (guard)

    const fontCss = parseFontCss(headCss, change.id);
    const originalH = measureRenderedHeight(change.original, fontCss, box.width);
    const translatedH = measureRenderedHeight(change.translated, fontCss, box.width);
    if (originalH == null || translatedH == null) continue; // measurement failed — skip silently

    const grow = translatedH - originalH;
    if (grow > 0) growthById.set(change.id, grow);
  }

  if (growthById.size === 0) {
    return { headCss, shiftedCount: 0, totalDelta: 0 };
  }

  // All elements in this section (not just the ones that grew) are needed so
  // computeShifts can decide who sits below a grower and must move.
  const allSectionIds = Array.from(
    new Set([...elementIds, ...extractSectionElementIds(sectionHtml)])
  );
  const allBoxes = parseElementBoxes(headCss, allSectionIds);

  const { shifts, sectionDelta, log } = computeShifts(allBoxes, growthById);

  let shiftedCount = 0;
  for (const delta of shifts.values()) {
    if (delta > 0) shiftedCount++;
  }

  const patchedCss = applyShiftsToCss(headCss, sectionId, shifts, sectionDelta);

  console.info(
    `[reflowLayout] section ${sectionId}: ${growthById.size} element(s) grew, ` +
      `${shiftedCount} element(s) shifted, total section delta +${sectionDelta.toFixed(1)}px`,
    log
  );

  return { headCss: patchedCss, shiftedCount, totalDelta: sectionDelta };
}

/**
 * Pull every `id="w-xxxx"` wrapper id out of a section's raw HTML, so
 * computeShifts sees the FULL set of elements in the section (siblings that
 * didn't change text still need to be considered as shift candidates).
 */
function extractSectionElementIds(sectionHtml) {
  const ids = [];
  const re = /\bid=["'](w-[A-Za-z0-9_-]+)["']/g;
  let m;
  while ((m = re.exec(sectionHtml)) !== null) ids.push(m[1]);
  return ids;
}

/**
 * Extract { id -> visible text } for every `.text-block-css` text element in
 * an HTML string, keyed by the STABLE wrapper id (`w-xxxx`) that survives
 * translation untouched (only the inner text node changes).
 *
 * Matches the shape confirmed in production LadiPage exports:
 *   <div id="w-xxxx" class="com-text-block ..."><div class="text-block">
 *     <h3 class="text-block-css ...">TEXT HERE</h3>
 *   </div></div>
 *
 * Deliberately simple regex scan (not a full DOM parse) so it can run
 * identically on both the pre- and post-translation HTML strings.
 */
export function extractTextBlockContents(html) {
  const map = new Map();
  const wrapperRe = /<div\s+id=["'](w-[A-Za-z0-9_-]+)["'][^>]*class=["'][^"']*com-text-block[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let m;
  while ((m = wrapperRe.exec(html)) !== null) {
    const id = m[1];
    const inner = m[2];
    const textMatch = inner.match(/class=["'][^"']*text-block-css[^"']*["'][^>]*>([\s\S]*?)<\//i);
    if (!textMatch) continue;
    // Strip any nested tags (e.g. <span>) to get plain text for measurement.
    const plain = textMatch[1].replace(/<[^>]+>/g, '').trim();
    if (plain) map.set(id, plain);
  }
  return map;
}

/**
 * Top-level entry point: given the FULL page HTML before and after translation,
 * detect which text-block elements actually changed, group by section, and
 * reflow each section's CSS in place. Returns the patched full HTML.
 *
 * Browser-only (calls measureRenderedHeight → needs `document`). No-op
 * (returns `afterHtml` unchanged) if the two HTML strings are identical —
 * this is what makes the same-language skip path bypass reflow entirely with
 * zero risk, since vertexTranslate.js returns the input html verbatim in
 * that case and beforeHtml === afterHtml.
 *
 * @param {string} beforeHtml  full page HTML before translation
 * @param {string} afterHtml   full page HTML after translation
 * @returns {string} patched full HTML (head CSS updated with shifted positions)
 */
export function reflowTranslatedPage(beforeHtml, afterHtml) {
  if (beforeHtml === afterHtml) return afterHtml;

  const headMatch = afterHtml.match(/<head\b[^>]*>[\s\S]*?<\/head>/i);
  if (!headMatch) return afterHtml; // no head CSS to patch — nothing we can safely do

  const beforeTexts = extractTextBlockContents(beforeHtml);
  const afterTexts = extractTextBlockContents(afterHtml);

  // Group per-section: find each section container and which w-ids live inside it.
  const sectionRe = /<div\s+id=["'](SECTION[A-Za-z0-9_-]+)["'][^>]*>/gi;
  const sections = [];
  let sm;
  while ((sm = sectionRe.exec(afterHtml)) !== null) {
    sections.push({ id: sm[1], start: sm.index });
  }
  if (sections.length === 0) return afterHtml; // no LadiPage sections found — skip reflow safely

  let patchedHead = headMatch[0];
  let totalShifted = 0;
  let totalDeltaAll = 0;

  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].start;
    const end = i + 1 < sections.length ? sections[i + 1].start : afterHtml.length;
    const sectionHtml = afterHtml.slice(start, end);

    const idsInSection = extractSectionElementIds(sectionHtml);
    const textChanges = [];
    for (const id of idsInSection) {
      const before = beforeTexts.get(id);
      const after = afterTexts.get(id);
      if (before && after && before !== after) {
        textChanges.push({ id, original: before, translated: after });
      }
    }
    if (textChanges.length === 0) continue;

    try {
      const result = reflowSection({
        sectionId: sections[i].id,
        sectionHtml,
        headCss: patchedHead,
        textChanges,
      });
      patchedHead = result.headCss;
      totalShifted += result.shiftedCount;
      totalDeltaAll += result.totalDelta;
    } catch (err) {
      // Guard: never let a reflow failure break the whole conversion.
      console.warn(`[reflowLayout] section ${sections[i].id} reflow failed, skipping:`, err?.message);
    }
  }

  if (totalShifted === 0) return afterHtml;

  console.info(`[reflowLayout] page reflow done: ${totalShifted} element(s) shifted across all sections, +${totalDeltaAll.toFixed(1)}px total`);
  return afterHtml.slice(0, headMatch.index) + patchedHead + afterHtml.slice(headMatch.index + headMatch[0].length);
}
