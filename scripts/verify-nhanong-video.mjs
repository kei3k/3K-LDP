// Verification harness (T-23 follow-up per anh Kei) — run the REAL
// generatePkeBuffer() pipeline against the REAL fetched source HTML
// (https://www.nhanong.top/htxtaybac) and inspect the output for the
// VIDEO6 widget, to confirm current code (cb18235 + resolvePancakeVideos)
// resolves it to a playable <video> and not a stuck play-button / empty box.
//
// Run: node scripts/verify-nhanong-video.mjs
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { decode } from '@msgpack/msgpack';
import { generatePkeBuffer } from '../src/lib/htmlToPke.js';

const srcPath = process.argv[2] || 'scratch/source.html';
const html = fs.readFileSync(srcPath, 'utf8');

// generatePkeBuffer uses the bare global `DOMParser` (browser API) — inject
// jsdom's implementation into globalThis so it runs the same way it does in
// the browser bundle.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.DOMParser = dom.window.DOMParser;

const base64 = generatePkeBuffer(html, 'nhanong-htxtaybac-verify');
const bytes = Buffer.from(base64, 'base64');
const pke = decode(bytes);

let videoSection = null;
for (const sec of pke.source.page) {
  const textBlock = sec.children && sec.children[0];
  const text = textBlock && textBlock.specials && textBlock.specials.text;
  if (text && text.includes('id="VIDEO6"')) {
    videoSection = text;
    break;
  }
}

if (!videoSection) {
  console.log('RESULT: VIDEO6 section not found in any pageSection at all.');
  process.exit(1);
}

const videoTagMatch = videoSection.match(/<video\b[^>]*>/i);
const idx = videoSection.indexOf('id="VIDEO6"');
const snippet = videoSection.slice(idx, idx + 800);

console.log('--- VIDEO6 wrapper + surrounding markup in final PKE output ---');
console.log(snippet);
console.log('\n--- verdict ---');
if (videoTagMatch) {
  console.log('PASS: <video> tag present ->', videoTagMatch[0]);
  const srcMatch = videoSection.match(/<video[^>]*\ssrc="([^"]+)"/i);
  console.log('video src =', srcMatch ? srcMatch[1] : '(not found in tag — check attr order)');
} else {
  console.log('FAIL: no <video> tag in VIDEO6 section — still broken.');
  process.exit(1);
}
