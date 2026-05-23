/**
 * Post-install script — copies ffmpeg-core ESM files into public/ffmpeg/
 * so videoConcat.js can load them same-origin (avoids unpkg + COEP issues).
 *
 * Runs automatically after `npm install` via the "postinstall" hook in package.json.
 */
import { mkdirSync, copyFileSync, existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'node_modules/@ffmpeg/core/dist/esm');
const ffSrc = join(root, 'node_modules/@ffmpeg/ffmpeg/dist/esm');
const dest = join(root, 'public/ffmpeg');

if (!existsSync(src)) {
  console.warn('[copy-ffmpeg-core] @ffmpeg/core not installed — skipping. Run `npm install` first.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

const files = [
  [join(src, 'ffmpeg-core.js'), join(dest, 'ffmpeg-core.js')],
  [join(src, 'ffmpeg-core.wasm'), join(dest, 'ffmpeg-core.wasm')],
  [join(ffSrc, 'worker.js'), join(dest, 'ffmpeg-worker.js')],
  [join(ffSrc, 'const.js'), join(dest, 'const.js')],
  [join(ffSrc, 'errors.js'), join(dest, 'errors.js')],
];

let copied = 0;
for (const [s, d] of files) {
  if (!existsSync(s)) {
    console.warn(`[copy-ffmpeg-core] Missing source: ${s}`);
    continue;
  }
  copyFileSync(s, d);
  const kb = Math.round(statSync(d).size / 1024);
  console.log(`[copy-ffmpeg-core] ✓ ${d.replace(root, '.')} (${kb} KB)`);
  copied++;
}

console.log(`[copy-ffmpeg-core] Copied ${copied}/${files.length} files to public/ffmpeg/`);
