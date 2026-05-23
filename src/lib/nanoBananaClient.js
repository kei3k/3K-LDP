/**
 * Nano Banana 2 — gemini-3.1-flash-image-preview via Vertex AI
 * Calls through /api/vertex proxy (server-side service-account auth).
 * Has built-in rate limiting + 429 retry with exponential backoff.
 */

const MODEL = 'gemini-3.1-flash-image-preview';

// Default Vertex AI Nano Banana 2 quota: ~10 RPM. Stay safe at 8 RPM (≈7.5s gap).
const MIN_INTERVAL_MS = 7500;
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 8000;

let lastCallAt = 0;
let serialChain = Promise.resolve();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle(onWait) {
  const now = Date.now();
  const wait = lastCallAt + MIN_INTERVAL_MS - now;
  if (wait > 0) {
    onWait?.(wait);
    await sleep(wait);
  }
  lastCallAt = Date.now();
}

async function callOnce(body) {
  const resp = await fetch(`/api/vertex/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp;
}

/**
 * generateRefImage
 * Calls are serialized (one at a time) AND throttled to stay under Vertex RPM quota.
 *
 * @param {object} params
 * @param {string} params.prompt
 * @param {Array<{mimeType: string, data: string}>} params.refImages
 * @param {(msg: string) => void} [params.onWait]   - notified when throttling/backoff sleeps
 * @returns {Promise<Blob>}
 */
export async function generateRefImage({ prompt, refImages = [], onWait } = {}) {
  // Serialize through a shared chain so concurrent callers don't all hit the rate limit
  const task = serialChain.then(async () => {
    const imageParts = refImages.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    }));

    const body = {
      contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 0.25,
      },
    };

    let attempt = 0;
    while (true) {
      await throttle((ms) => onWait?.(`Rate-limit pacing: chờ ${Math.ceil(ms / 1000)}s...`));
      const resp = await callOnce(body);

      if (resp.ok) {
        const data = await resp.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if (p.inlineData?.data) {
            const binary = atob(p.inlineData.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return new Blob([bytes], { type: p.inlineData.mimeType || 'image/png' });
          }
        }
        throw new Error('Nano Banana 2 returned no image in response');
      }

      const errText = await resp.text();
      const is429 = resp.status === 429 || /RESOURCE_EXHAUSTED/i.test(errText);
      if (!is429 || attempt >= MAX_RETRIES) {
        throw new Error(`Nano Banana 2 error (${resp.status}): ${errText.substring(0, 300)}`);
      }

      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
      onWait?.(`Quota 429 — backoff ${Math.ceil(backoff / 1000)}s (lần ${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(backoff);
      attempt++;
    }
  });

  serialChain = task.catch(() => {}); // chain continues even if a call fails
  return task;
}
