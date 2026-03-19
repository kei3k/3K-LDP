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
  console.log('[LDP] RAW FETCHED HTML HEAD:', html.substring(0, 1000));
  
  if (html.length < 200) throw new Error('HTML quá ngắn. Trang có thể đang chặn bot.');
  
  // 1688 Anti-bot Detection: Usually redirects to login.1688.com or a generic block page
  if (html.includes('login.1688.com') || html.includes('baxia-dialog') || html.includes('captcha')) {
    throw new Error('1688 đang yêu cầu xác thực bảo mật (Captcha/Login). Vui lòng dùng giải pháp dán Code HTML (Ctrl+U) ở ô bên dưới!');
  }

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
 * MAIN: Extract product data from 1688 or any e-commerce HTML using Gemini
 */
export async function extractProductDataFrom1688(html, targetLanguage, apiKey, model, onProgress) {
  onProgress?.('🔍 Đang phân tích HTML để trích xuất dữ liệu sản phẩm...');
  
  // Cut HTML to fit within token limits, prioritizing text and images
  let textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[\s\S]*?<\/style>/gi, '')
                        .replace(/<svg[\s\S]*?<\/svg>/gi, '');
  
  // Extract all high-res images from multiple patterns
  // 1688 uses lazy loading: data-src, data-lazy, data-imgs, plus regular src
  const extractedImages = new Set();
  
  // Pattern 1: src="..." 
  const srcRegex = /src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)(?:[?#][^"']*)?)/gi;
  for (const m of textContent.matchAll(srcRegex)) extractedImages.add(m[1]);
  
  // Pattern 2: data-src, data-lazy, data-lazyload, data-original
  const dataSrcRegex = /data-(?:src|lazy|lazyload|original)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)(?:[?#][^"']*)?)/gi;
  for (const m of html.matchAll(dataSrcRegex)) extractedImages.add(m[1]);
  
  // Pattern 3: data-imgs or other JSON-embedded image arrays (1688 specific)
  const dataImgsRegex = /data-imgs=["']([^"']+)/gi;
  for (const m of html.matchAll(dataImgsRegex)) {
    try {
      const decoded = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      const urls = decoded.match(/https?:\/\/[^\s"',\]]+\.(?:jpg|jpeg|png|webp)(?:[?#][^\s"',\]]*)*/gi);
      if (urls) urls.forEach(u => extractedImages.add(u));
    } catch {}
  }
  
  // Pattern 4: Any alicdn.com image URL found anywhere in the HTML 
  const alicdnRegex = /https?:\/\/(?:cbu01|img|gd\d?)\.alicdn\.com\/[^\s"')]+\.(?:jpg|jpeg|png|webp)(?:_\d+x\d+)?(?:[?#][^\s"')]*)?/gi;
  for (const m of html.matchAll(alicdnRegex)) extractedImages.add(m[0]);
  
  // Pattern 5: Any other CDN image URL in the full HTML  
  const generalImgRegex = /["'](https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png)(?:[?#][^"'\s]*)?)["']/gi;
  for (const m of html.matchAll(generalImgRegex)) extractedImages.add(m[1]);
  
  const imageUrls = [...extractedImages].filter(u => !u.includes('logo') && !u.includes('icon') && u.length > 30);
  console.log('[LDP] Extracted image URLs from 1688 HTML:', imageUrls.length, imageUrls.slice(0, 5));
  
  // Clean up content further
  textContent = textContent.replace(/<[^>]+>/g, '\n')
                           .replace(/[ \t]+/g, ' ')
                           .replace(/\n\s*\n/g, '\n');
  
  const langDisplay = targetLanguage || 'Tiếng Việt';
  const prompt = `Bạn là chuyên gia trích xuất dữ liệu e-commerce. Từ nội dung HTML (đã được làm sạch) dưới đây hãy trích xuất thông tin sản phẩm. 
Bạn PHẢI DỊCH TOÀN BỘ TEXT TÌM ĐƯỢC sang ${langDisplay} chuẩn ngữ pháp và văn phong tự nhiên.
  
Nội dung HTML trang sản phẩm:
---
${textContent.substring(0, 12000)}
---

Danh sách link ảnh tìm thấy trong trang:
${imageUrls.slice(0, 30).join('\n')}

NHIỆM VỤ:
Trả về 1 chuỗi JSON chứa cấu trúc sau:
{
  "name": "Tên sản phẩm (ngắn gọn, hấp dẫn bằng ${langDisplay})",
  "description": "Mô tả ngắn gọn khoảng 2-3 câu bằng ${langDisplay}",
  "benefits": "Mỗi lợi ích 1 dòng (tối đa 4-5 dòng) bằng ${langDisplay}",
  "price": "Giá hiển thị (lấy từ trang hoặc bịa 1 mức hợp lý, VD: 399.000đ/20$)",
  "originalPrice": "Giá gốc (cao hơn giá hiển thị khoảng 30-50%)",
  "images": ["link ảnh 1", "link ảnh 2", "link ảnh 3", "link ảnh 4", "link ảnh 5"],
  "rating": { "score": 4.9, "count": 120 },
  "reviews": [
    { "name": "Người mua 1", "content": "Review ${langDisplay} tự nhiên..." },
    { "name": "Người mua 2", "content": "Review ${langDisplay} tự nhiên..." }
  ]
}

QUY TẮC QUAN TRỌNG:
1. Bạn phải LỌC link ảnh từ danh sách ở trên cung cấp để chọn đúng ảnh sản phẩm sắc nét (chỉ giữ lại 5 ảnh tốt nhất, không lấy icon/logo).
2. LOẠI BỎ các ảnh banner/quảng cáo shop (thường có chữ Trung Quốc như 工厂直供, OEM/ODM, 品质保障, 支持). Chỉ giữ ảnh CHỤP SẢN PHẨM thật sự.
3. Nếu trang 1688 có video hoặc không có ảnh, hãy cung cấp link fallback 1688. 
4. TỰ ĐỘNG SINH (bịa) một vài review bằng ${langDisplay} thật tự nhiên khen ngợi sản phẩm, dựa vào công dụng của nó. Tên người review cũng phải phù hợp với ngôn ngữ ${langDisplay}.
5. KHÔNG TRẢ VỀ GÌ THÊM ngoài JSON.`;

  const result = await callGemini(prompt, apiKey, model, 4096);
  onProgress?.('✅ Phân tích dữ liệu thành công!');
  return result;
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
      const opts = field.options.split('\n').map(o => o.trim()).filter(Boolean); // use \n to match textarea
      fieldsHtml += `<div style="margin-bottom:12px"><label style="display:block;margin-bottom:4px;font-size:14px;font-weight:500">${field.label}</label><select name="${name}" ${required} style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff"><option value="">-- Chọn --</option>${opts.map(o => `<option value="${o}">${o}</option>`).join('')}</select></div>`;
    } else if (field.type === 'radio' && field.options) {
      // Multiple choice (Combo) rendering
      const opts = field.options.split('\n').map(o => o.trim()).filter(Boolean);
      fieldsHtml += `<div style="margin-bottom:12px"><label style="display:block;margin-bottom:8px;font-size:14px;font-weight:700">${field.label}</label><div style="display:flex;flex-direction:column;gap:8px">`;
      opts.forEach((opt, idx) => {
        fieldsHtml += `<label style="display:flex;align-items:center;gap:8px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;background:#f9fafb;transition:background 0.2s"><input type="radio" name="${name}" value="${opt}" ${required && idx === 0 ? 'required' : ''} style="width:18px;height:18px;accent-color:#2563eb;cursor:pointer"><span style="font-size:14px;font-weight:500;color:#1f2937">${opt}</span></label>`;
      });
      fieldsHtml += `</div></div>`;
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
  if (config.gtmId) {
    s += `<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\nnew Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\nj=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=\n'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);\n})(window,document,'script','dataLayer','${config.gtmId}');</script>\n<!-- End Google Tag Manager -->\n`;
  }
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
 * Translate ALL visible text in a template HTML to the target language.
 * Extracts text, sends to Gemini for translation pairs, then string-replaces.
 */
export async function translateTemplateHtml(html, targetLanguage, productInfo, apiKey, model, onProgress) {
  onProgress?.(`🌐 Đang dịch toàn bộ text sang ${targetLanguage}...`);
  
  // Extract visible text from HTML (skip scripts, styles, SVGs)
  let textOnly = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  textOnly = textOnly.replace(/<style[\s\S]*?<\/style>/gi, '');
  textOnly = textOnly.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  
  // Find all text inside HTML tags (between > and <)
  const textRegex = />([^<]+)</g;
  const rawTextPieces = new Set();
  let m;
  while ((m = textRegex.exec(textOnly)) !== null) {
    const txt = m[1].trim();
    if (txt.length > 1 && /[a-zA-Zก-๙\u0e00-\u0e7f\u4e00-\u9fff\u00c0-\u024f\u1ea0-\u1ef9]/.test(txt)) {
      rawTextPieces.add(txt);
    }
  }
  
  // Also find placeholder text
  const placeholderRegex = /placeholder=['"]([^"']+)/g;
  while ((m = placeholderRegex.exec(html)) !== null) {
    if (m[1].trim().length > 1) rawTextPieces.add(m[1].trim());
  }
  
  // Also find button text
  const btnRegex = /class="button-text[^"]*"[^>]*>([^<]+)/g;
  while ((m = btnRegex.exec(html)) !== null) {
    if (m[1].trim().length > 1) rawTextPieces.add(m[1].trim());
  }
  
  // Build text list: store both the raw version (with &nbsp;) and clean version
  const textMap = []; // [{raw: string_in_html, clean: string_for_gemini}]
  for (const raw of rawTextPieces) {
    const clean = raw.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    if (clean.length > 1) {
      textMap.push({ raw, clean });
    }
  }
  
  const textList = textMap.slice(0, 150);
  
  if (textList.length === 0) {
    console.log('[LDP] No text to translate');
    return html;
  }
  
  console.log(`[LDP] Found ${textList.length} text pieces to translate`);
  console.log('[LDP] Sample pieces:', textList.slice(0, 5).map(t => t.clean));
  
  const prompt = `Bạn là chuyên gia dịch thuật và marketing. Dưới đây là danh sách các đoạn text từ một landing page bán hàng.

THÔNG TIN SẢN PHẨM CẦN BÁN (từ 1688):
- Tên: ${productInfo.name || ''}
- Mô tả: ${productInfo.description || ''}
- Lợi ích: ${productInfo.benefits || ''}
- Giá: ${productInfo.price || ''}

NHIỆM VỤ: Dịch TOÀN BỘ ${textList.length} text sang ${targetLanguage}. 
- Tiếng Thái (ภาษาไทย) → ${targetLanguage}
- Tiếng Trung (中文) → ${targetLanguage}  
- Tiếng Anh → ${targetLanguage}
- Text đã là ${targetLanguage} → giữ nguyên

QUAN TRỌNG: 
- Mô tả sản phẩm GỐC (túi mỹ phẩm/กระเป๋า/cosmetics) → đổi thành mô tả ${productInfo.name || 'sản phẩm mới'}
- Giá Baht ฿ → đổi thành ${productInfo.price || 'giá mới'}
- Giữ nguyên emoji, format

Danh sách ${textList.length} text:
${textList.map((t, i) => `${i}: "${t.clean}"`).join('\n')}

Trả về ĐÚNG JSON array với ${textList.length} phần tử:
[{"original":"text gốc 0","translated":"bản dịch 0"},{"original":"text gốc 1","translated":"bản dịch 1"}]
CHỈ JSON ARRAY.`;

  try {
    const result = await callGemini(prompt, apiKey, model, 8192);
    
    let translations = [];
    if (Array.isArray(result)) {
      translations = result;
    } else if (result && result.translations) {
      translations = result.translations;
    } else {
      console.error('[LDP] Unexpected Gemini result format:', typeof result, result);
      return html;
    }
    
    console.log(`[LDP] Got ${translations.length} translations from Gemini`);
    
    // Build replacement map: raw HTML text → translated text
    let translatedHtml = html;
    let appliedCount = 0;
    
    // Create a lookup from clean text → translation
    const translationLookup = new Map();
    translations.forEach(({ original, translated }) => {
      if (original && translated && original !== translated) {
        translationLookup.set(original, translated);
      }
    });
    
    // Sort by length (longest first) to avoid partial replacements
    const sortedTextList = [...textList].sort((a, b) => b.raw.length - a.raw.length);
    
    for (const { raw, clean } of sortedTextList) {
      const translated = translationLookup.get(clean);
      if (translated) {
        // Replace the RAW version in HTML (which may have &nbsp; etc.)
        const before = translatedHtml.split(raw).length - 1;
        if (before > 0) {
          translatedHtml = translatedHtml.split(raw).join(translated);
          appliedCount++;
        }
      }
    }
    
    console.log(`[LDP] Applied ${appliedCount}/${translations.length} translations`);
    onProgress?.(`✅ Đã dịch ${appliedCount} text sang ${targetLanguage}`);
    return translatedHtml;
  } catch (err) {
    console.error('[LDP] Translation error:', err.message || err);
    onProgress?.('⚠️ Lỗi dịch text: ' + (err.message || 'Unknown error'));
    return html;
  }
}

/**
 * Translate Chinese text on product images using Gemini image editing.
 * Downloads each image, sends to Gemini with edit prompt, returns data URL.
 * NOTE: Must use gemini-2.0-flash-exp for image output (2.5 Pro doesn't support it).
 */
export async function translateImageText(imageUrls, targetLanguage, apiKey, onProgress) {
  if (!imageUrls || imageUrls.length === 0) return imageUrls;
  
  onProgress?.(`🖼️ Đang dịch chữ trên ${imageUrls.length} ảnh sản phẩm...`);
  const translatedUrls = [];
  
  // Models that support image output (responseModalities: IMAGE), ordered by quality
  const imageModels = [
    'gemini-3.1-flash-image-preview',  // Nano Banana 2 — best for text localization on images
    'gemini-2.5-flash-preview-image-generation', // Stable, 500 RPM
    'gemini-2.0-flash-exp',            // Legacy fallback
  ];
  
  for (let i = 0; i < imageUrls.length; i++) {
    const imgUrl = imageUrls[i];
    onProgress?.(`🖼️ Xử lý ảnh ${i + 1}/${imageUrls.length}...`);
    
    try {
      // Download image via proxy
      console.log(`[LDP] Downloading image ${i}:`, imgUrl.substring(0, 80));
      const imgResponse = await fetch('/api/fetch-url?url=' + encodeURIComponent(imgUrl), {
        signal: AbortSignal.timeout(8000)
      });
      
      if (!imgResponse.ok) {
        console.warn(`[LDP] Failed to download image ${i}, keeping original`);
        translatedUrls.push(imgUrl);
        continue;
      }
      
      const imgBlob = await imgResponse.blob();
      const mimeType = imgBlob.type || 'image/jpeg';
      
      // Convert to base64
      const arrayBuffer = await imgBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let j = 0; j < uint8Array.length; j++) {
        binary += String.fromCharCode(uint8Array[j]);
      }
      const base64 = btoa(binary);
      
      if (base64.length < 100) {
        translatedUrls.push(imgUrl);
        continue;
      }
      
      // Try image editing with each model
      let success = false;
      for (const model of imageModels) {
        console.log(`[LDP] Trying image edit with ${model} for image ${i} (${Math.round(base64.length / 1024)}KB)`);
        
        try {
          const editUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          
          const editResponse = await fetch(editUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              contents: [{
                parts: [
                  { inlineData: { mimeType, data: base64 } },
                  { text: `Localize this product image: translate ALL Chinese text (中文) on the image to ${targetLanguage}. Keep the exact same layout, colors, font style, and design. Only change the language of the text. If there is no Chinese text, return the image unchanged. Output the edited image.` }
                ]
              }],
              generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
                temperature: 0.1,
              }
            })
          });
          
          if (!editResponse.ok) {
            const errText = await editResponse.text().catch(() => '');
            console.warn(`[LDP] ${model} failed for image ${i}: ${editResponse.status}`, errText.substring(0, 300));
            continue;
          }
          
          const editData = await editResponse.json();
          const parts = editData.candidates?.[0]?.content?.parts || [];
          let editedImage = null;
          for (const part of parts) {
            if (part.inlineData) { editedImage = part.inlineData; break; }
          }
          
          if (editedImage && editedImage.data && editedImage.data.length > 100) {
            const dataUrl = `data:${editedImage.mimeType || 'image/png'};base64,${editedImage.data}`;
            console.log(`[LDP] ✅ Image ${i} translated by ${model} (${Math.round(editedImage.data.length / 1024)}KB)`);
            translatedUrls.push(dataUrl);
            success = true;
            break;
          } else {
            console.warn(`[LDP] ${model} returned no image for ${i}`);
          }
        } catch (err) {
          console.warn(`[LDP] ${model} error for image ${i}:`, err.message);
        }
      }
      
      if (!success) {
        console.log(`[LDP] Image ${i}: no model could edit, keeping original`);
        translatedUrls.push(imgUrl);
      }
    } catch (err) {
      console.warn(`[LDP] Image ${i} error:`, err.message);
      translatedUrls.push(imgUrl);
    }
  }
  
  onProgress?.(`✅ Đã xử lý ${translatedUrls.length} ảnh`);
  return translatedUrls;
}

/**
 * Gemini API call — THROWS on error (no silent swallowing)
 */
export async function callGeminiDirect(prompt, apiKey, model = 'gemini-2.0-flash', maxTokens = 8192) {
  return callGemini(prompt, apiKey, model, maxTokens);
}

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
