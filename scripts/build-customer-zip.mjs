/**
 * Build customer-distributable zip with Unix executable permissions
 * baked-in for *.command files (so Mac double-click works without chmod).
 *
 * Usage:  node scripts/build-customer-zip.mjs
 * Output: D:/Download/3K-LDP-AI-Video-Tool.zip
 */
import { readFileSync, statSync, readdirSync, existsSync } from 'fs';
import { join, relative, sep } from 'path';
import { writeFileSync } from 'fs';
import JSZip from 'jszip';

const SRC = 'D:/Download/3K-LDP-AI-Video-Tool';
const OUT = 'D:/Download/3K-LDP-AI-Video-Tool.zip';

if (!existsSync(SRC)) {
  console.error(`Source folder not found: ${SRC}`);
  process.exit(1);
}

const zip = new JSZip();

// Recursively walk and add files
function walk(dir, baseDir = SRC) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, baseDir);
    } else {
      const rel = relative(baseDir, full).split(sep).join('/');
      const content = readFileSync(full);
      // Unix permissions: 0755 for *.command/*.sh (executable), 0644 for others
      const isExec = /\.(command|sh)$/i.test(name);
      const unixPerm = isExec ? 0o755 : 0o644;
      zip.file(rel, content, {
        unixPermissions: unixPerm,
        date: st.mtime,
      });
      if (isExec) console.log(`  +x  ${rel}`);
    }
  }
}

console.log(`Building zip from ${SRC}...`);
walk(SRC);

const buf = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
  platform: 'UNIX', // CRITICAL: write Unix-style permissions in zip headers
});

writeFileSync(OUT, buf);
const sizeMB = (statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`\n✓ Zip ready: ${OUT}  (${sizeMB} MB)`);
console.log('Mac users can now double-click .command files without chmod.');
