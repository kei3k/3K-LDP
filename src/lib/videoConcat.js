/**
 * videoConcat — ffmpeg.wasm wrapper for concatenating mp4 clips
 * Lazy-loads FFmpeg singleton. Requires COOP/COEP headers (already set in vite.config.js).
 */

let ffmpegInstance = null;
let ffmpegLoading = null;

export async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    const ff = new FFmpeg();

    // All self-hosted in public/ffmpeg/ — no CDN, no COEP issues
    const baseURL = '/ffmpeg';
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      // NOT toBlobURL — worker has relative imports (./const.js, ./errors.js)
      // that only resolve when served from the same path
      classWorkerURL: `${baseURL}/ffmpeg-worker.js`,
    });

    ffmpegInstance = ff;
    return ff;
  })();

  return ffmpegLoading;
}

/**
 * concatClips — concatenate an array of mp4 Blobs into one mp4 Blob
 * @param {Blob[]} blobs
 * @returns {Promise<Blob>}
 */
export async function concatClips(blobs, onProgress) {
  if (!blobs || blobs.length === 0) throw new Error('No clips to concatenate');
  if (blobs.length === 1) return blobs[0];

  const ff = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  // Capture stderr so we can surface a real error message
  let stderrTail = '';
  const logHandler = ({ message }) => {
    if (typeof message === 'string') {
      stderrTail = (stderrTail + '\n' + message).slice(-1500);
    }
  };
  ff.on('log', logHandler);

  const listLines = [];
  for (let i = 0; i < blobs.length; i++) {
    const name = `clip_${i}.mp4`;
    onProgress?.(`Loading clip ${i + 1}/${blobs.length}...`);
    const fileData = await fetchFile(blobs[i]);
    await ff.writeFile(name, fileData);
    listLines.push(`file '${name}'`);
  }

  const listContent = listLines.join('\n');
  const encoder = new TextEncoder();
  await ff.writeFile('list.txt', encoder.encode(listContent));

  // Strategy: try fast stream-copy first (works when all clips share codec/res/fps).
  // If that fails (mismatched streams from Veo), fall back to a re-encode.
  let usedFallback = false;
  try {
    onProgress?.('Ghép nhanh (stream copy)...');
    await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-movflags', '+faststart', 'out.mp4']);
  } catch (e1) {
    usedFallback = true;
    onProgress?.('Stream copy thất bại — re-encode (chậm hơn)...');
    // Re-encode all clips to a common format
    await ff.deleteFile('out.mp4').catch(() => {});
    try {
      await ff.exec([
        '-f', 'concat', '-safe', '0', '-i', 'list.txt',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        'out.mp4',
      ]);
    } catch (e2) {
      ff.off('log', logHandler);
      const msg = `ffmpeg concat failed (both copy + reencode). Last stderr: ${stderrTail.slice(-400) || '(empty)'}`;
      throw new Error(msg);
    }
  }

  let outData;
  try {
    outData = await ff.readFile('out.mp4');
  } catch (e) {
    ff.off('log', logHandler);
    throw new Error(`Could not read concat output. ffmpeg stderr: ${stderrTail.slice(-400) || '(empty)'}`);
  }
  ff.off('log', logHandler);

  const outBlob = new Blob([outData.buffer], { type: 'video/mp4' });
  onProgress?.(`Done (${usedFallback ? 're-encoded' : 'stream-copied'}, ${(outBlob.size / 1024 / 1024).toFixed(1)} MB)`);

  // Cleanup
  for (let i = 0; i < blobs.length; i++) {
    await ff.deleteFile(`clip_${i}.mp4`).catch(() => {});
  }
  await ff.deleteFile('list.txt').catch(() => {});
  await ff.deleteFile('out.mp4').catch(() => {});

  return outBlob;
}

/**
 * compressVideoForAnalysis — downscale + low-bitrate re-encode so video fits inline (<18MB).
 * 480p height, 1 fps (we want scene content not motion), low audio bitrate.
 * @param {File|Blob} file
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<Blob>} compressed mp4
 */
export async function compressVideoForAnalysis(file, onProgress) {
  const ff = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  onProgress?.('Loading video into ffmpeg...');
  const inputName = 'in.mp4';
  const outputName = 'out.mp4';
  await ff.writeFile(inputName, await fetchFile(file));

  // Wire up progress event (ratio 0..1)
  const progressHandler = ({ progress, time }) => {
    const pct = Math.min(99, Math.max(0, Math.round(progress * 100)));
    const sec = time != null ? ` (${(time / 1_000_000).toFixed(1)}s processed)` : '';
    onProgress?.(`Compressing... ${pct}%${sec}`);
  };
  ff.on('progress', progressHandler);

  try {
    await ff.exec([
      '-i', inputName,
      '-vf', 'scale=-2:360',
      '-r', '1',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '34',
      '-c:a', 'aac',
      '-b:a', '32k',
      '-ac', '1',
      '-movflags', '+faststart',
      outputName,
    ]);
  } finally {
    ff.off('progress', progressHandler);
  }

  const data = await ff.readFile(outputName);
  const blob = new Blob([data.buffer], { type: 'video/mp4' });

  await ff.deleteFile(inputName).catch(() => {});
  await ff.deleteFile(outputName).catch(() => {});

  return blob;
}

/**
 * downloadBlob — trigger browser download of a Blob
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
