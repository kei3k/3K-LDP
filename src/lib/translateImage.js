/**
 * translateImage — translate visible text inside an image using Nano Banana 2.
 * Inherits rate limiting + 429 retry from nanoBananaClient.
 */

import { generateRefImage } from './nanoBananaClient.js';

/**
 * Convert a Blob to base64 string (without data-URI prefix).
 * @param {Blob} blob
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || blob.type || 'image/png';
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * translateImageWithNanoBanana
 *
 * @param {Blob} blob - original image blob
 * @param {string} targetLanguage - e.g. 'ภาษาไทย', 'English'
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<Blob>} - translated image blob
 */
export async function translateImageWithNanoBanana(blob, targetLanguage, onProgress) {
  const { base64, mimeType } = await blobToBase64(blob);

  const prompt = `Translate ALL visible text in this image to ${targetLanguage}.
CRITICAL rules:
- Keep the original layout, colors, fonts, design, image composition, product photos, person faces — UNCHANGED.
- ONLY replace text with the translated version.
- Use native script for ${targetLanguage}.
- Maintain the same font size, weight, and position as the original text.
- If the image has no visible text at all, return an identical image.
- Do NOT add watermarks, borders, or any elements not in the original.`;

  onProgress?.(`Đang dịch ảnh (Nano Banana 2)...`);

  const resultBlob = await generateRefImage({
    prompt,
    refImages: [{ mimeType, data: base64 }],
    onWait: onProgress,
  });

  return resultBlob;
}
