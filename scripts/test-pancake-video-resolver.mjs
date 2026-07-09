// jsdom harness for resolvePancakeVideos() (T-23, customer Nam).
// Run: node scripts/test-pancake-video-resolver.mjs
//
// Fixtures:
//   (a) Pancake video widget WITH an extractable data-video-url -> <video> injected.
//   (b) Pancake video widget with NO extractable url (verified real shape from
//       bdsnguyennam.com/0709test2) -> byte-for-byte untouched.
//   (c) LadiPage script_event_data fixture -> resolveVideoWidgets() regression
//       guard (cb18235: only "ch":"direct" widgets get resolved; "embed" stays
//       untouched even with resolvePancakeVideos now also running).
import { JSDOM } from 'jsdom';
import { resolveVideoWidgets, resolvePancakeVideos } from '../src/lib/htmlToPke.js';

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log('  PASS', label);
  } else {
    failures += 1;
    console.log('  FAIL', label, detail ? '— ' + detail : '');
  }
}

function docFrom(html) {
  return new JSDOM(html).window.document;
}

// --- Fixture A: Pancake widget WITH data-video-url -----------------------
console.log('\n[A] Pancake widget with extractable mp4 data-video-url');
{
  const html = `<!doctype html><html><body>
    <div id="VIDEO6" class="ladi-element" data-video-url="https://content.pancake.vn/videos/abc123.mp4" style="pointer-events: none;"></div>
  </body></html>`;
  const doc = docFrom(html);
  resolvePancakeVideos(doc);
  const wrapper = doc.getElementById('VIDEO6');
  const video = wrapper.querySelector('video');
  check('injects a <video> element', !!video);
  check('video src matches the mp4 url', video && video.getAttribute('src') === 'https://content.pancake.vn/videos/abc123.mp4');
  check('video has controls + playsinline', video && video.hasAttribute('controls') && video.hasAttribute('playsinline'));
  check('wrapper set to pointer-events:none', wrapper.style.pointerEvents === 'none');
}

// --- Fixture B: real verified empty Pancake widget (no config anywhere) --
console.log('\n[B] Pancake widget with no extractable url (verified real shape)');
{
  const original = '<div id="VIDEO6" class="ladi-element" style="pointer-events: none;"></div>';
  const html = `<!doctype html><html><body>${original}</body></html>`;
  const doc = docFrom(html);
  resolvePancakeVideos(doc);
  const wrapper = doc.getElementById('VIDEO6');
  check('no <video> injected', !wrapper.querySelector('video'));
  check('markup byte-for-byte untouched', wrapper.outerHTML === original, wrapper.outerHTML);
}

// --- Fixture B2: HLS-only config must also be skipped ---------------------
console.log('\n[B2] Pancake widget with HLS-only (.m3u8) url');
{
  const html = `<!doctype html><html><body>
    <div id="VIDEO9" class="ladi-element" data-video-url="https://content.pancake.vn/videos/xyz.m3u8" style="pointer-events: none;"></div>
  </body></html>`;
  const doc = docFrom(html);
  resolvePancakeVideos(doc);
  const wrapper = doc.getElementById('VIDEO9');
  check('no <video> injected for HLS-only url', !wrapper.querySelector('video'));
}

// --- Fixture C: LadiPage direct fixture — cb18235 + nesting-bug regression
// guard. Markup mirrors the REAL structure fetched from
// https://www.nhanong.top/htxtaybac (the source of T-23's 0709test2 clone):
// `#VIDEO{n}.ladi-element > .ladi-video > (.ladi-video-background,
// #SHAPE{n}.ladi-element)` — the play-button overlay (SHAPE) is bg's
// SIBLING under `.ladi-video`, NOT a direct child of the outer widget. The
// previous resolveVideoWidgets cleanup step iterated `widget.children`
// (only `.ladi-video`) and removed it because it wasn't `=== bg`, deleting
// bg (and the freshly-appended <video> inside it) a line after inserting it
// — net result: an entirely empty widget, the real T-23 bug. This fixture
// fails on that old code and passes on the parentElement-scoped fix.
console.log('\n[C] LadiPage script_event_data — real-shape regression guard (T-23 root cause)');
{
  const html = `<!doctype html><html><body>
    <div id="VIDEO1" class="ladi-element">
      <div class="ladi-video">
        <div class="ladi-video-background"></div>
        <div id="SHAPE1" class="ladi-element"><div class="ladi-shape"><svg></svg></div></div>
      </div>
    </div>
    <div id="VIDEO2" class="ladi-element">
      <div class="ladi-video">
        <div class="ladi-video-background"></div>
        <div id="SHAPE2" class="ladi-element"><div class="ladi-shape"><svg></svg></div></div>
      </div>
    </div>
    <script id="script_event_data" type="application/json">
      {"VIDEO1":{"a":"video","ci":"https://s.ladicdn.com/videos/direct.mp4","ch":"direct"},
       "VIDEO2":{"a":"video","ci":"youtube-embed-id-123","ch":"embed"}}
    </script>
  </body></html>`;
  const doc = docFrom(html);
  resolveVideoWidgets(doc);
  resolvePancakeVideos(doc); // must not interfere — VIDEO1 already has a <video>, VIDEO2 has no config resolvePancakeVideos can see either

  const v1 = doc.getElementById('VIDEO1');
  const v2 = doc.getElementById('VIDEO2');
  const v1video = v1.querySelector('video');
  check('VIDEO1 (ch:direct) gets a <video>', !!v1video, v1.outerHTML);
  check('VIDEO1 video src is the direct mp4', v1video && v1video.getAttribute('src') === 'https://s.ladicdn.com/videos/direct.mp4');
  check('VIDEO1 .ladi-video-background survived (not deleted as a "sibling")', !!v1.querySelector('.ladi-video-background'));
  check('VIDEO1 SHAPE1 overlay was removed (bg sibling cleanup)', !v1.querySelector('#SHAPE1'));
  check('VIDEO2 (ch:embed) stays untouched — no <video>', !v2.querySelector('video'));
  check('VIDEO2 still has its original SHAPE2 play-button overlay', !!v2.querySelector('#SHAPE2'));
}

console.log('\n' + (failures === 0 ? `ALL PASS` : `${failures} FAILURE(S)`));
process.exit(failures === 0 ? 0 : 1);
