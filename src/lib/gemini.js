/**
 * Gemini API — TEXT REPLACEMENT CLONING
 * 
 * Take ORIGINAL reference HTML → use Gemini to find product-specific text →
 * string replace in JavaScript → result is 95%+ identical to reference.
 */

/**
 * Build Gemini API URL from model name
 */
function getApiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

/**
 * Fetch HTML from URL via local Vite proxy (auto-scrape)
 */
export async function fetchPageHtml(url) {
  console.log('[LDP] Auto-fetching URL:', url);

  // Use local Vite proxy (Node.js native https — handles redirects, SSL)
  const proxyUrl = '/api/fetch-url?url=' + encodeURIComponent(url);
  const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
  
  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try { const j = await response.json(); errMsg = j.error || errMsg; } catch {}
    throw new Error(`Không tải được URL: ${errMsg}`);
  }

  const html = await response.text();
  if (html.length < 200) throw new Error('HTML quá ngắn. Trang có thể đang chặn bot.');
  
  console.log('[LDP] Auto-fetch success! HTML length:', html.length);
  return html;
}

/**
 * Extract visible text content from HTML for Gemini analysis
 */
function extractTextContent(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  text = text.replace(/<[^>]+>/g, '\n');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&#\d+;/g, '');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  return lines.join('\n');
}

/**
 * MAIN: Clone landing page via text replacement + custom form fields
 */
export async function cloneLandingPage(originalHtml, productInfo, productImages, tracking, customFormFields, customPrompt, apiKey, model, language, onProgress) {
  const textContent = extractTextContent(originalHtml);
  
  console.log('[LDP] Starting clone pipeline...');
  console.log('[LDP] HTML length:', originalHtml.length);
  console.log('[LDP] Text content length:', textContent.length);
  console.log('[LDP] Model:', model, 'Language:', language);

  // ---- Ask Gemini for text replacement pairs ----
  onProgress?.('🔍 Đang phân tích nội dung trang mẫu...');

  const langName = language || 'Tiếng Việt';

  const prompt = `Bạn là chuyên gia localization landing page. Nhiệm vụ: DỊCH TOÀN BỘ TEXT sang ${langName}.

LANDING PAGE GỐC có nội dung text:
---
${textContent.substring(0, 15000)}
---

SẢN PHẨM MỚI (thay thế sản phẩm gốc):
- Tên: ${productInfo.name}
- Mô tả: ${productInfo.description || 'Sản phẩm chất lượng cao'}
- Lợi ích: ${productInfo.benefits || 'Chất lượng cao, giao nhanh, bảo hành'}

NHIỆM VỤ: Trả về CẶP THAY THẾ cho TẤT CẢ text trong trang — dịch sang ${langName}.

QUY TẮC:
1. DỊCH TẤT CẢ text hiển thị sang ${langName} — kể cả tiêu đề, mô tả, nút, labels, tab, footer, disclaimer
2. Thay tên sản phẩm gốc bằng "${productInfo.name}"
3. Thay mô tả sản phẩm bằng nội dung sản phẩm mới
4. Reviews/testimonials: tạo MỚI hoàn toàn bằng ${langName} (tên người ${langName === 'Tiếng Việt' ? 'Việt Nam' : ''}, nội dung review tự nhiên về sản phẩm mới)
5. Giữ nguyên format số, rating (⭐), emoji, icons
6. Text nút: dịch sang ${langName} (VD: "ซื้อเลย" → "Mua ngay", "หยิบใส่ตะกร้า" → "Thêm vào giỏ")
7. Menu/navigation labels: dịch sang ${langName}
8. Giá: giữ format nhưng đổi tiền tệ nếu cần (VD: ฿299 → 299.000đ)
9. Trả về tối đa replacements — KHÔNG bỏ sót text nào

Trả về JSON:
{
  "replacements": [
    { "find": "text gốc CHÍNH XÁC", "replace": "text ${langName}" }
  ],
  "titleTag": "Tiêu đề tab ${langName}",
  "metaDescription": "Meta description ${langName}"
}

LƯU Ý QUAN TRỌNG:
- "find" phải match CHÍNH XÁC text gốc trong HTML
- DỊCH HẾT, không chừa text ngoại ngữ nào
- Số lượng replacements CÀng NHIỀU CÀNG TỐT (>30 cặp)${customPrompt ? `

YÊU CẦU BỔ SUNG TỪ NGƯỜI DÙNG:
${customPrompt}` : ''}`;

  const result = await callGemini(prompt, apiKey, model, 16384);

  // ---- Apply replacements to original HTML ----
  onProgress?.('✏️ Đang thay thế nội dung...');

  let clonedHtml = originalHtml;

  if (result.replacements && Array.isArray(result.replacements)) {
    let count = 0;
    for (const { find, replace } of result.replacements) {
      if (find && replace && find.length > 2) {
        const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
          const before = clonedHtml;
          clonedHtml = clonedHtml.replace(new RegExp(escaped, 'g'), replace);
          if (clonedHtml !== before) count++;
        } catch {
          if (clonedHtml.includes(find)) {
            clonedHtml = clonedHtml.split(find).join(replace);
            count++;
          }
        }
      }
    }
    console.log(`[LDP] Applied ${count}/${result.replacements.length} text replacements`);
  }

  // Replace <title>
  if (result.titleTag) {
    clonedHtml = clonedHtml.replace(/<title>[^<]*<\/title>/i, `<title>${result.titleTag}</title>`);
  }

  // Replace meta description
  if (result.metaDescription) {
    clonedHtml = clonedHtml.replace(
      /(<meta[^>]*name=["']description["'][^>]*content=["'])[^"']*(['"][^>]*>)/i,
      `$1${result.metaDescription}$2`
    );
  }

  // Replace product images
  if (productImages && productImages.length > 0) {
    clonedHtml = replaceImages(clonedHtml, productImages);
  }

  // Inject tracking
  const trackingScripts = buildTrackingScripts(tracking);
  if (trackingScripts) {
    clonedHtml = clonedHtml.replace('</head>', trackingScripts + '\n</head>');
  }

  // Inject form webhook
  if (tracking.googleSheetWebhook) {
    const webhookScript = `<script>document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('form').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();fetch('${tracking.googleSheetWebhook}',{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))}).then(function(){alert('Đã gửi thành công!')}).catch(function(){alert('Đã gửi!')})})})});</script>`;
    clonedHtml = clonedHtml.replace('</body>', webhookScript + '\n</body>');
  }

  // Inject custom form fields
  if (customFormFields && customFormFields.length > 0) {
    clonedHtml = injectCustomFormFields(clonedHtml, customFormFields);
  }

  return { html: clonedHtml, analysis: result };
}

/**
 * Inject custom form fields into the first form in HTML
 */
function injectCustomFormFields(html, fields) {
  let fieldsHtml = '';
  for (const field of fields) {
    if (!field.name || !field.label) continue;
    const name = field.name.replace(/[^a-zA-Z0-9_]/g, '_');
    const required = field.required ? 'required' : '';
    
    if (field.type === 'select' && field.options) {
      const opts = field.options.split(',').map(o => o.trim()).filter(Boolean);
      fieldsHtml += `<div style="margin-bottom:12px"><label style="display:block;margin-bottom:4px;font-size:14px;font-weight:500">${field.label}</label><select name="${name}" ${required} style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff"><option value="">-- Chọn --</option>${opts.map(o => `<option value="${o}">${o}</option>`).join('')}</select></div>`;
    } else if (field.type === 'textarea') {
      fieldsHtml += `<div style="margin-bottom:12px"><label style="display:block;margin-bottom:4px;font-size:14px;font-weight:500">${field.label}</label><textarea name="${name}" ${required} rows="3" style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:none" placeholder="${field.placeholder || ''}"></textarea></div>`;
    } else {
      const inputType = field.type || 'text';
      fieldsHtml += `<div style="margin-bottom:12px"><label style="display:block;margin-bottom:4px;font-size:14px;font-weight:500">${field.label}</label><input type="${inputType}" name="${name}" ${required} style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px" placeholder="${field.placeholder || ''}" /></div>`;
    }
  }

  if (!fieldsHtml) return html;

  // Try to inject before submit button in the first form
  let injected = html.replace(
    /(<form[\s\S]*?)((<button[^>]*type=["']submit["'][^>]*>)|(<input[^>]*type=["']submit["'][^>]*>))/i,
    `$1<!-- Custom Fields -->\n${fieldsHtml}\n$2`
  );
  
  // If no submit button found, inject before </form>
  if (injected === html) {
    injected = html.replace(
      /<\/form>/i,
      `<!-- Custom Fields -->\n${fieldsHtml}\n</form>`
    );
  }

  return injected;
}

function replaceImages(html, images) {
  let result = html;
  let imgIndex = 0;
  result = result.replace(
    /(<img[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, src, suffix) => {
      if (src.includes('svg') || src.includes('pixel') || src.includes('tracking') ||
          src.includes('logo') || src.includes('icon') || src.includes('flag') ||
          src.includes('avatar') || src.length < 10) return match;
      const r = images[imgIndex % images.length];
      imgIndex++;
      return prefix + r + suffix;
    }
  );
  return result;
}

function buildTrackingScripts(config) {
  let s = '';
  if (config.googleAdsTracking) s += config.googleAdsTracking + '\n';
  if (config.facebookPixelId) s += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${config.facebookPixelId}');fbq('track','PageView');</script>\n`;
  if (config.tiktokPixelId) s += `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e+""]=+new Date;ttq._o=ttq._o||{};ttq._o[e+""]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${config.tiktokPixelId}');ttq.page()}(window,document,'ttq');</script>\n`;
  return s;
}

/**
 * Legacy: content-only generation (no reference)
 */
export async function generateLandingContent(productInfo, style, apiKey, model) {
  const prompt = `Copywriter chuyên landing page. Tạo nội dung Tiếng Việt cho 2 variant.
Sản phẩm: ${productInfo.name} | Mô tả: ${productInfo.description} | Lợi ích: ${productInfo.benefits}
Trả về JSON:
{
  "variantA": { "headline":"","subheadline":"","benefitsList":[{"icon":"✅","title":"","desc":""},{"icon":"🚀","title":"","desc":""},{"icon":"💎","title":"","desc":""},{"icon":"🔥","title":"","desc":""}],"ctaText":"","urgencyText":"","socialProofText":"","guaranteeText":"" },
  "variantB": { "headline":"","subheadline":"","benefitsList":[{"icon":"⭐","title":"","desc":""},{"icon":"💪","title":"","desc":""},{"icon":"🎯","title":"","desc":""},{"icon":"❤️","title":"","desc":""}],"ctaText":"","testimonials":[{"name":"","role":"","text":"","rating":5},{"name":"","role":"","text":"","rating":5}],"socialProofStats":[{"number":"10,000+","label":"Khách hàng"},{"number":"99%","label":"Hài lòng"}] }
}`;
  return callGemini(prompt, apiKey, model);
}

/**
 * Gemini API call — THROWS on error (no silent swallowing)
 */
async function callGemini(prompt, apiKey, model = 'gemini-2.0-flash', maxTokens = 8192) {
  const url = getApiUrl(model);
  console.log('[LDP] Calling Gemini:', model);

  const response = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[LDP] Gemini API error:', response.status, errText);
    throw new Error(`Gemini API lỗi (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini không trả về nội dung');

  return parseGeminiJson(text);
}

/**
 * Robust JSON parser — handles truncated Gemini responses
 */
function parseGeminiJson(text) {
  // Try direct parse
  try { return JSON.parse(text); } catch {}

  // Try extracting JSON object
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  // Repair truncated JSON — fix unclosed arrays and objects
  let repaired = text.trim();
  
  // If it starts with { but doesn't end with }, try to close it
  if (repaired.startsWith('{')) {
    // Remove trailing comma if present
    repaired = repaired.replace(/,\s*$/, '');
    
    // Count open/close brackets
    let openBraces = 0, openBrackets = 0;
    let inString = false, escaped = false;
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }

    // If we're inside a string, close it
    if (inString) repaired += '"';
    
    // Close open brackets and braces
    // Remove any trailing incomplete object/property
    repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
    repaired = repaired.replace(/,\s*\{[^}]*$/, '');
    repaired = repaired.replace(/,\s*$/, '');
    
    for (let i = 0; i < openBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces; i++) repaired += '}';

    try { return JSON.parse(repaired); } catch {}
  }

  // Last resort: extract replacement pairs manually via regex
  const replacements = [];
  const pairRegex = /"find"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"replace"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = pairRegex.exec(text)) !== null) {
    replacements.push({ find: m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'), replace: m[2].replace(/\\"/g, '"').replace(/\\n/g, '\n') });
  }
  
  if (replacements.length > 0) {
    console.log(`[LDP] Repaired JSON: extracted ${replacements.length} replacement pairs via regex`);
    return { replacements };
  }

  throw new Error('Không thể parse JSON từ Gemini. Thử lại hoặc đổi model.');
}
