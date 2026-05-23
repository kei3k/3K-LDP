/**
 * videoFrames — extract N evenly-spaced JPEG frames from a video File using
 * HTML5 <video> + <canvas>. Pure browser-native, completes in seconds even
 * for 100MB+ files (no re-encoding).
 */

/**
 * extractFrames
 * @param {File|Blob} file
 * @param {object} [opts]
 * @param {number} [opts.maxFrames=24]   - target frame count
 * @param {number} [opts.maxHeight=480]  - downscale longest side
 * @param {number} [opts.quality=0.7]    - JPEG quality 0..1
 * @param {(msg: string) => void} [opts.onProgress]
 * @returns {Promise<{ frames: { mimeType: string, data: string }[], duration: number }>}
 */
export async function extractFrames(file, opts = {}) {
  const { maxFrames = 24, maxHeight = 480, quality = 0.7, onProgress } = opts;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error('Failed to load video metadata'));
  });

  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    throw new Error('Video has invalid duration');
  }

  const scale = Math.min(1, maxHeight / video.videoHeight);
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const frames = [];
  const count = Math.min(maxFrames, Math.max(4, Math.floor(duration)));

  for (let i = 0; i < count; i++) {
    const t = (duration * (i + 0.5)) / count;
    onProgress?.(`Extracting frame ${i + 1}/${count} (${t.toFixed(1)}s)`);
    await seek(video, t);
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    const b64 = await blobToBase64(blob);
    frames.push({ mimeType: 'image/jpeg', data: b64 });
  }

  URL.revokeObjectURL(url);
  return { frames, duration };
}

function seek(video, time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('Seek failed')); };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = time;
  });
}

async function blobToBase64(blob) {
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
