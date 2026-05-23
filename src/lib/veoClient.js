/**
 * Veo 3.1 — Vertex AI video generation via /api/vertex proxy
 */

const MODEL = 'veo-3.1-generate-001';
const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * generateClip
 * @param {object} params
 * @param {string} params.videoPrompt
 * @param {{ mimeType: string, data: string }} params.refImage
 * @param {number} [params.durationSec=8]
 * @returns {Promise<Blob>} mp4
 */
export async function generateClip({ videoPrompt, refImage, durationSec = 8 }) {
  const requestBody = {
    instances: [{
      prompt: videoPrompt,
      image: {
        bytesBase64Encoded: refImage.data,
        mimeType: refImage.mimeType,
      }
    }],
    parameters: {
      aspectRatio: '9:16',
      durationSeconds: durationSec,
      sampleCount: 1,
    }
  };

  const initResp = await fetch(`/api/vertex/models/${MODEL}:predictLongRunning`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!initResp.ok) {
    const errText = await initResp.text();
    throw new Error(`Veo predictLongRunning failed (${initResp.status}): ${errText.substring(0, 300)}`);
  }

  const initData = await initResp.json();
  const operationName = initData.name;
  if (!operationName) throw new Error('Veo did not return an operation name');

  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const pollResp = await fetch('/api/vertex/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, operationName }),
    });

    if (!pollResp.ok) {
      const errText = await pollResp.text();
      throw new Error(`Veo poll failed (${pollResp.status}): ${errText.substring(0, 300)}`);
    }

    const pollData = await pollResp.json();
    if (pollData.error) {
      throw new Error(`Veo operation error: ${JSON.stringify(pollData.error)}`);
    }

    if (pollData.done) {
      const videoB64 = pollData.response?.videos?.[0]?.bytesBase64Encoded
        || pollData.response?.predictions?.[0]?.bytesBase64Encoded;
      if (!videoB64) throw new Error('Veo operation done but no video bytes in response');

      const binary = atob(videoB64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: 'video/mp4' });
    }
  }

  throw new Error('Veo operation timed out after 5 minutes');
}
