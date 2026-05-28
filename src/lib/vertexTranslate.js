/**
 * Vertex-based HTML text translator for landing pages.
 * Uses gemini-3-flash-preview via /api/vertex proxy — no API key needed.
 */

const MODEL = 'gemini-3-flash-preview';

function parseJsonArray(text) {
  // Strip markdown fences
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(t); } catch {}
  // Try to extract array
  const match = t.match(/\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  throw new Error('Cannot parse JSON array from Gemini response');
}

async function callVertexFlash(prompt) {
  const resp = await fetch(`/api/vertex/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 32768,
        responseMimeType: 'application/json',
        // Disable extended thinking for flash-preview — saves output budget
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Vertex error (${resp.status}): ${err.substring(0, 300)}`);
  }
  const data = await resp.json();
  const cand = data.candidates?.[0];
  const text = cand?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = cand?.finishReason || 'unknown';
    const safety = cand?.safetyRatings?.filter(r => r.blocked).map(r => r.category).join(',') || '';
    console.error('[Vertex-Translate] empty response. finishReason=', reason, 'safety=', safety, 'usage=', data.usageMetadata);
    throw new Error(`Vertex returned no content (finishReason=${reason}${safety ? ', safety=' + safety : ''})`);
  }
  return text;
}

/**
 * translateLandingHtml — translate visible text + alt/placeholder/title attrs
 * in a landing page HTML to a target language. Returns translated HTML.
 *
 * @param {string} html
 * @param {string} targetLanguage  - e.g. 'ภาษาไทย', 'English', 'Tiếng Việt'
 * @param {(msg: string) => void} [onProgress]
 */
export async function translateLandingHtml(html, targetLanguage, onProgress) {
  // NOTE: Do NOT skip when target === 'Tiếng Việt'. Source may be Thai/EN/CN
  // (e.g. dealmobi.click Thai landing) and customer chose VN as target.
  // Let Gemini handle identity case (source==target) naturally — it returns
  // the text unchanged when no translation is needed.
  if (!targetLanguage) return html;
  onProgress?.(`🌐 Đang dịch sang ${targetLanguage} (Vertex ${MODEL})...`);

  // Strip noise
  let stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  stripped = stripped.replace(/<style[\s\S]*?<\/style>/gi, '');
  stripped = stripped.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  const rawPieces = new Set();

  // Visible text between tags
  const textRegex = />([^<]+)</g;
  let m;
  while ((m = textRegex.exec(stripped)) !== null) {
    const txt = m[1].trim();
    if (txt.length > 1 && /[a-zA-Zก-๙฀-๿一-鿿À-ɏẠ-ỹ]/.test(txt)) {
      rawPieces.add(txt);
    }
  }

  // Attributes: placeholder, alt, title
  for (const re of [/placeholder=['"]([^"']+)/g, /alt=['"]([^"']+)/g, /title=['"]([^"']+)/g]) {
    while ((m = re.exec(html)) !== null) {
      if (m[1].trim().length > 1) rawPieces.add(m[1].trim());
    }
  }

  const decode = (s) =>
    s.replace(/&nbsp;/g, ' ')
     .replace(/&amp;/g, '&')
     .replace(/&lt;/g, '<')
     .replace(/&gt;/g, '>')
     .replace(/&quot;/g, '"')
     .trim();

  const textMap = [];
  for (const raw of rawPieces) {
    const clean = decode(raw);
    if (clean.length > 1) textMap.push({ raw, clean });
  }
  // Cap to avoid token blow-up
  const textList = textMap.slice(0, 250);

  if (!textList.length) {
    onProgress?.('Không có text để dịch.');
    return html;
  }
  console.log(`[Vertex-Translate] ${textList.length} pieces → ${targetLanguage}`);

  // Chunk list to avoid token blow-up on a single call (flash-preview output budget)
  const CHUNK_SIZE = 40;
  const chunks = [];
  for (let i = 0; i < textList.length; i += CHUNK_SIZE) {
    chunks.push(textList.slice(i, i + CHUNK_SIZE));
  }
  console.log(`[Vertex-Translate] Split into ${chunks.length} chunks of ≤${CHUNK_SIZE}`);

  const translations = [];
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    onProgress?.(`🌐 Dịch chunk ${ci + 1}/${chunks.length} (${chunk.length} text)...`);

    const prompt = `Dịch ${chunk.length} text sau sang ${targetLanguage}. Văn phong marketing tự nhiên. Giữ emoji + số + tiền tệ. KHÔNG dịch URL/mã SP. Text đã đúng ngôn ngữ thì giữ nguyên.

${chunk.map((t, i) => `${i}: "${t.clean.replace(/"/g, '\\"')}"`).join('\n')}

Trả về JSON array đúng ${chunk.length} phần tử:
[{"original":"...","translated":"..."}, ...]
CHỈ JSON ARRAY.`;

    try {
      const text = await callVertexFlash(prompt);
      const parsed = parseJsonArray(text);
      const arr = Array.isArray(parsed) ? parsed : (parsed?.translations || []);
      translations.push(...arr);
    } catch (err) {
      console.error(`[Vertex-Translate] chunk ${ci + 1} error:`, err.message);
      onProgress?.(`⚠️ Chunk ${ci + 1} fail: ${err.message}`);
      // Continue with other chunks instead of failing entire translation
    }
  }

  if (!translations.length) {
    onProgress?.('⚠️ Không dịch được text nào.');
    return html;
  }

  const lookup = new Map();
  for (const t of translations) {
    if (t?.original && t?.translated && t.original !== t.translated) {
      lookup.set(t.original, t.translated);
    }
  }

  // Replace longest first to avoid partial overlaps
  let translatedHtml = html;
  let applied = 0;
  const sorted = [...textMap].sort((a, b) => b.raw.length - a.raw.length);
  for (const { raw, clean } of sorted) {
    const tr = lookup.get(clean);
    if (tr && translatedHtml.includes(raw)) {
      translatedHtml = translatedHtml.split(raw).join(tr);
      applied++;
    }
  }

  console.log(`[Vertex-Translate] Applied ${applied}/${translations.length}`);
  onProgress?.(`✅ Dịch xong ${applied} text sang ${targetLanguage}`);
  return translatedHtml;
}
