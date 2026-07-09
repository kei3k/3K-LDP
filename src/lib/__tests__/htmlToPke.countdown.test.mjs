/**
 * jsdom harness for the countdown-widget fix (T-23 reopened,
 * hangnhapkhau.pro.vn/urea — countdown breaks after clone).
 *
 * No test runner (vitest/jest) is wired up in this repo yet — run directly:
 *   node src/lib/__tests__/htmlToPke.countdown.test.mjs
 *
 * Polyfills the browser globals htmlToPke.js relies on (DOMParser, btoa) via
 * jsdom, since the module is written for the browser (client-side bundle).
 */
import { JSDOM } from 'jsdom';
import { decode } from '@msgpack/msgpack';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.DOMParser = dom.window.DOMParser;
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

const { generatePkeBuffer, resolveCountdowns, resolveVideoWidgets } = await import('../htmlToPke.js');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass += 1;
    console.log('  PASS -', msg);
  } else {
    fail += 1;
    console.log('  FAIL -', msg);
  }
}

function decodePke(base64) {
  const buf = Buffer.from(base64, 'base64');
  return decode(buf);
}

function findAllByType(obj, type, out = []) {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    obj.forEach((v) => findAllByType(v, type, out));
    return out;
  }
  if (obj.type === type) out.push(obj);
  for (const k of Object.keys(obj)) findAllByType(obj[k], type, out);
  return out;
}

// ---------------------------------------------------------------------
// Fixture (a): a com-section with a NESTED group wrapper containing a
// com-countdown widget — mirrors the real hangnhapkhau.pro.vn/urea shape
// (widget position is relative to the group wrapper, not the section root).
// ---------------------------------------------------------------------
function fixtureCountdownHtml() {
  return `<!doctype html>
<html>
<head>
<style>
#SEC1{top:0px;left:0px;position:relative;width:420px;height:400px;}
#GROUP1{top:6px;left:55px;width:133px;height:41px;}
#CD1{top:22px;left:17.5px;width:115px;height:19px;}
#CD1 .countdown-item{background:rgba(0,219,222,1);border-radius:4px;border-style:solid;border-width:0px;color:rgba(255,18,0,1);font-size:22px;font-weight:bold;}
</style>
</head>
<body>
<div id="SEC1" class="com-section" data-section>
  <div class="section-wrapper full-width full-height p-relative">
    <div class="section-container full-height p-relative">
      <div id="GROUP1" class="p-absolute group-container-wrap">
        <div class="group-container">
          <div id="CD1" class="com-countdown p-absolute">
            <div class="countdown-wrapper full-width full-height" data-mode="none">
              <div class="countdown-item countdown-item-day" style="display: none;"><div>00</div><div class="text" style="display: none;">Days</div></div>
              <div class="countdown-item countdown-item-hour" style="display: none;"><div>00</div><div class="text" style="display: none;">Hours</div></div>
              <div class="countdown-item countdown-item-minute"><div>00</div><div class="text" style="display: none;">Minutes</div></div>
              <div class="countdown-item countdown-item-second" style=""><div>00</div><div class="text" style="display: none;">Seconds</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

console.log('Fixture (a): countdown widget -> resolved to native PKE widget');
{
  const html = fixtureCountdownHtml();
  const base64 = generatePkeBuffer(html, 'Countdown Fixture');
  const data = decodePke(base64);
  const countdownWidgets = findAllByType(data, 'countdown');
  assert(countdownWidgets.length === 1, 'exactly 1 native countdown widget in output');

  const cd = countdownWidgets[0];
  if (cd) {
    const desk = cd.responsive.desktop.styles;
    assert(desk.top === 28, 'cumulative offset top = group(6) + own(22) = 28, got ' + desk.top);
    assert(desk.left === 72.5, 'cumulative offset left = group(55) + own(17.5) = 72.5, got ' + desk.left);
    assert(desk.width === 115 && desk.height === 19, 'box size carried through from source CSS');
    assert(cd.specials.showDay === false, 'showDay=false (source item had display:none)');
    assert(cd.specials.showHour === false, 'showHour=false (source item had display:none)');
    assert(cd.specials.showSecond === true, 'showSecond=true (source item visible)');
    assert(cd.specials.showText === false, 'showText=false (label divs had display:none)');
    assert(cd.specials.type === 'minute', 'specials.type=minute (matches real Webcake export schema)');
    assert(cd.specials.duration === 60, 'duration=60min default (only minute+second visible granularity)');
    assert(typeof cd.specials.startTime === 'string' && cd.specials.startTime.length > 0, 'startTime is set');
  }

  // The dead static countdown markup must NOT survive into the text-block's
  // raw HTML (would otherwise double-render: native widget + frozen ghost box).
  const textBlocks = findAllByType(data, 'text-block');
  const leaked = textBlocks.some((tb) => (tb.specials.text || '').includes('com-countdown'));
  assert(!leaked, 'no leftover com-countdown markup inside any text-block HTML');
}

// ---------------------------------------------------------------------
// Fixture (b): a normal page, no countdown widget at all — must be a
// complete no-op (no countdown widgets appear, pipeline doesn't throw).
// ---------------------------------------------------------------------
console.log('\nFixture (b): page without countdown -> untouched');
{
  const html = `<!doctype html>
<html><head><style>#SEC1{top:0px;left:0px;position:relative;width:420px;height:200px;}</style></head>
<body><div id="SEC1" class="com-section" data-section>
  <div class="section-wrapper full-width full-height p-relative"><div class="section-container full-height p-relative">
    <div id="TXT1" class="com-text-block p-absolute"><div class="text-block"><p>Hello world</p></div></div>
  </div></div>
</div></body></html>`;
  const base64 = generatePkeBuffer(html, 'No Countdown Fixture');
  const data = decodePke(base64);
  const countdownWidgets = findAllByType(data, 'countdown');
  assert(countdownWidgets.length === 0, 'no countdown widgets synthesized when none exist in source');
  const textBlocks = findAllByType(data, 'text-block');
  assert(textBlocks.some((tb) => (tb.specials.text || '').includes('Hello world')), 'unrelated content untouched');
}

// ---------------------------------------------------------------------
// Fixture (c): regression guard for the T-23 video-widget fix (e5a8d98 /
// cb18235 / 8728586) — real confirmed shape from the module comment on
// resolveVideoWidgets: widget(#VIDEO6) > .ladi-video > .ladi-video-background
// (=bg), with the play-button overlay (#SHAPE6) as bg's SIBLING under
// .ladi-video, not widget's direct child. Must resolve to a working <video>
// without deleting bg's parent wrapper (the exact regression e5a8d98 fixed).
// ---------------------------------------------------------------------
console.log('\nFixture (c): regression guard - video widget fix (e5a8d98) paths still hold');
{
  const html = `<!doctype html>
<html><head>
<script id="script_event_data" type="application/json">{"VIDEO6":{"a":"video","ci":"https://example.com/clip.mp4","ch":"direct"}}</script>
</head>
<body>
<div id="VIDEO6" class="ladi-video-widget">
  <div class="ladi-video">
    <div class="ladi-video-background"><img class="poster" src="poster.jpg"></div>
    <div id="SHAPE6" class="play-button-overlay">PLAY</div>
  </div>
</div>
</body></html>`;
  const doc = new (global.DOMParser)().parseFromString(html, 'text/html');
  resolveVideoWidgets(doc);
  const widget = doc.getElementById('VIDEO6');
  const bg = widget.querySelector('.ladi-video-background');
  const video = bg && bg.querySelector('video');
  assert(!!video, 'video element inserted into .ladi-video-background');
  assert(video && video.getAttribute('src') === 'https://example.com/clip.mp4', 'resolved direct src carried through');
  assert(!doc.getElementById('SHAPE6'), 'stuck play-button overlay (bg sibling) removed');
  assert(!!doc.querySelector('.ladi-video'), '.ladi-video wrapper (bg\'s own parent) survives — the e5a8d98 regression');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
