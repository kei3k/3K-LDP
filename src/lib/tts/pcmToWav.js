/**
 * Convert raw PCM bytes to WAV Blob with standard 44-byte RIFF header.
 * Gemini TTS returns base64 PCM @ 24kHz mono 16-bit little-endian.
 *
 * @param {Uint8Array} pcmBytes
 * @param {number} sampleRate  default 24000
 * @param {number} channels    default 1 (mono)
 * @param {number} bitsPerSample default 16
 * @returns {Blob}
 */
export function pcmToWav(pcmBytes, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcmBytes.byteLength;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);       // chunk size
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);                  // sub-chunk size (PCM = 16)
  view.setUint16(20, 1, true);                   // audio format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM payload
  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(pcmBytes, headerSize);

  return new Blob([wavBytes], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
