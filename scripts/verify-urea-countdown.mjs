// Verification harness — run the REAL generatePkeBuffer() pipeline against
// the REAL fetched hangnhapkhau.pro.vn/urea HTML and inspect every resolved
// countdown widget's full JSON (T-23 reopened, countdown-disappears-on-
// publish fix). Run: node scripts/verify-urea-countdown.mjs
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { decode } from '@msgpack/msgpack';
import { generatePkeBuffer } from '../src/lib/htmlToPke.js';

const srcPath = process.argv[2] || 'scratch/source-urea.html';
const html = fs.readFileSync(srcPath, 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.DOMParser = dom.window.DOMParser;

const base64 = generatePkeBuffer(html, 'urea-countdown-verify');
const bytes = Buffer.from(base64, 'base64');
const pke = decode(bytes);

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

const countdowns = findAllByType(pke, 'countdown');
console.log('countdown widgets found:', countdowns.length);
countdowns.forEach((cd, i) => {
  console.log(`\n--- widget #${i + 1} ---`);
  console.log(JSON.stringify(cd, null, 2));
});

// leak check: no leftover .com-countdown markup in any text-block
const textBlocks = findAllByType(pke, 'text-block');
const leaked = textBlocks.filter((tb) => (tb.specials.text || '').includes('com-countdown'));
console.log('\ntext-blocks with leaked com-countdown markup:', leaked.length);

const assertions = [
  ['4 countdown widgets resolved', countdowns.length === 4],
  ['no leaked markup', leaked.length === 0],
  ['all runtime.firstInit === false', countdowns.every((c) => c.runtime.firstInit === false)],
  ['all runtime.changeSection undefined', countdowns.every((c) => c.runtime.changeSection === undefined)],
  ['all have finite desktop top/left/width/height', countdowns.every((c) => {
    const s = c.responsive.desktop.styles;
    return [s.top, s.left, s.width, s.height].every(Number.isFinite);
  })],
  ['all have id + properties.name', countdowns.every((c) => !!c.id && !!c.properties && !!c.properties.name)],
];
console.log('\n--- assertions ---');
let fail = 0;
for (const [msg, ok] of assertions) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + msg);
  if (!ok) fail += 1;
}
process.exit(fail > 0 ? 1 : 0);
