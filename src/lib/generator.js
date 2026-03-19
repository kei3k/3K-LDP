/**
 * Generator orchestrator
 * 
 * Mode 1 (clone): Keep original HTML, replace text via Gemini
 * Mode 2 (template): Built-in templates (fallback only when no reference)
 * 
 * CRITICAL: Errors are NOT swallowed — they surface to the user.
 */
import { generateVariantA } from './templates/variantA';
import { generateVariantB } from './templates/variantB';
import { generateTemplate1 } from './templates/template1';
import { generateTemplate2 } from './templates/template2';
import { fetchPageHtml, cloneLandingPage, generateLandingContent, extractProductDataFrom1688, translateTemplateHtml, translateImageText } from './gemini';

// ---- Color extraction ----
export function extractColorsFromImage(src) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.height = 100;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 100, 100);
      const d = ctx.getImageData(0, 0, 100, 100).data;
      const colors = {};
      for (let i = 0; i < d.length; i += 16) {
        const r = Math.round(d[i]/32)*32, g = Math.round(d[i+1]/32)*32, b = Math.round(d[i+2]/32)*32;
        const k = `${r},${g},${b}`;
        colors[k] = (colors[k]||0) + 1;
      }
      const sorted = Object.entries(colors).sort(([,a],[,b])=>b-a)
        .map(([k])=>{ const [r,g,b]=k.split(',').map(Number); return {r,g,b,hex:'#'+[r,g,b].map(x=>Math.min(255,Math.max(0,x)).toString(16).padStart(2,'0')).join('')}; });
      const p = []; 
      for (const c of sorted) { if(p.length>=5) break; if(!p.some(r=>Math.abs(r.r-c.r)+Math.abs(r.g-c.g)+Math.abs(r.b-c.b)<80)) p.push(c); }
      const defs = [{hex:'#22c55e'},{hex:'#1a1a2e'},{hex:'#8b5cf6'},{hex:'#3b82f6'},{hex:'#f59e0b'}];
      while(p.length<5) p.push(defs[p.length]);
      resolve({ primary:p[0].hex, secondary:p[1].hex, accent:p[2].hex, background:'#0f0f1a', text:'#fff', swatches:p.map(c=>c.hex) });
    };
    img.onerror = () => resolve({ primary:'#22c55e', secondary:'#1a1a2e', accent:'#8b5cf6', background:'#0f0f1a', text:'#fff', swatches:['#22c55e','#1a1a2e','#8b5cf6','#3b82f6','#f59e0b'] });
    img.src = src;
  });
}

// ---- Main pipeline ----
export async function generateLandingPages(config, apiKey, onProgress) {
  const model = config.model || 'gemini-2.5-flash';
  const buildMode = config.buildMode || 'clone'; // 'clone' or '1688'
  
  let refHtml = config.referenceHtml?.trim();
  
  // Priority 1: Pasted HTML
  if (refHtml && refHtml.length > 200) {
    onProgress?.(`📋 Sử dụng ${Math.round(refHtml.length/1024)}KB HTML dán trực tiếp`);
  }
  
  // Priority 2: Auto-fetch from URL
  if ((!refHtml || refHtml.length < 200) && config.referenceUrl) {
    onProgress?.('📥 Đang tự động tải HTML từ URL...');
    try {
      refHtml = await fetchPageHtml(config.referenceUrl);
      onProgress?.(`✅ Đã tải ${Math.round(refHtml.length/1024)}KB HTML`);
    } catch (e) {
      throw new Error(`Không tải được URL: ${e.message}. Hãy dùng cách dán HTML (Ctrl+U).`);
    }
  }

  // ===== MODE: 1688 (Template Mới) =====
  if (buildMode === '1688') {
    if (!refHtml || refHtml.length < 200) {
      throw new Error('Vui lòng nhập Link 1688 hoặc dán HTML của trang sản phẩm để bóc tách dữ liệu.');
    }
    
    if (!apiKey) {
      throw new Error('Vui lòng nhập Gemini API Key để bóc tách dữ liệu AI.');
    }

    console.log('[LDP] Mode: 1688 Extract (' + Math.round(refHtml.length/1024) + 'KB)');
    
    // 1. Extract Info
    const productData = await extractProductDataFrom1688(refHtml, config.language || 'Tiếng Việt', apiKey, model, onProgress);
    
    console.log('[LDP] productData from Gemini:', JSON.stringify(productData, null, 2));
    console.log('[LDP] productData.images:', productData.images);
    console.log('[LDP] config.productImages:', config.productImages);
    
    // Ensure we merge with manual inputs if provided
    const finalInfo = {
      name: config.productName || productData.name,
      description: config.productDescription || productData.description,
      benefits: config.productBenefits || productData.benefits,
      price: productData.price || 'Liên hệ',
      originalPrice: productData.originalPrice || '',
      images: (config.productImages?.length > 0) ? config.productImages : (productData.images || []),
      rating: productData.rating || { score: 4.9, count: 1205 },
      reviews: productData.reviews || []
    };
    
    console.log('[LDP] FINAL images to use:', finalInfo.images);
    const targetLang = config.language || 'Tiếng Việt';
    
    // 2. Translate Chinese text on images (optional, with timeout)
    if (finalInfo.images.length > 0 && apiKey) {
      try {
        const imageTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Image translation timeout (60s)')), 60000)
        );
        finalInfo.images = await Promise.race([
          translateImageText(finalInfo.images, targetLang, apiKey, onProgress),
          imageTimeout
        ]);
      } catch (err) {
        console.warn('[LDP] Image translation skipped:', err.message);
        onProgress?.('⚠️ Bỏ qua dịch ảnh, tiếp tục tạo LDP...');
      }
    }
    
    // 3. Generate with Template
    onProgress?.('📄 Đang tạo khối giao diện Landing Page...');
    const colors = config.colors || { primary: '#e11d48', background: '#ffffff', text: '#1f2937' };
    
    // Build template config with tracking + custom fields
    const templateConfig = {
      customFormFields: config.customFormFields || [],
      gtmId: config.gtmId || '',
      facebookPixelId: config.facebookPixelId || '',
      tiktokPixelId: config.tiktokPixelId || '',
      googleAdsTracking: config.googleAdsTracking || '',
    };
    
    let html = '';
    if (config.selectedTemplate === 'template2') {
      html = generateTemplate2(finalInfo, colors, templateConfig);
    } else {
      html = generateTemplate1(finalInfo, colors, templateConfig);
    }
    
    // 4. Translate ALL visible text to target language
    html = await translateTemplateHtml(html, targetLang, finalInfo, apiKey, model, onProgress);
    
    // 4. Add Webhook to form
    if (config.googleSheetWebhook) {
      const webhookScript = `<script>document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('form').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();fetch('${config.googleSheetWebhook}',{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))}).then(function(){alert('Đã gửi thành công!')}).catch(function(){alert('Đã gửi!')})})})});</script>`;
      html = html.replace('</body>', webhookScript + '\n</body>');
    }

    onProgress?.('✅ Hoàn thành!');
    return { variantA: html, variantB: html, mode: '1688' };
  }
  
  // ===== MODE: CLONE (Default) =====
  if (refHtml && refHtml.length > 200 && apiKey) {
    console.log('[LDP] Mode: Clone (' + Math.round(refHtml.length/1024) + 'KB)');
    onProgress?.('🔍 Đang phân tích và clone landing page...');
    
    const tracking = {
      googleSheetWebhook: config.googleSheetWebhook || '',
      googleAdsTracking: config.googleAdsTracking || '',
      facebookPixelId: config.facebookPixelId || '',
      tiktokPixelId: config.tiktokPixelId || '',
      gtmId: config.gtmId || '',
    };

    // DO NOT catch this error — let it surface to the user
    const result = await cloneLandingPage(
      refHtml,
      { name: config.productName, description: config.productDescription, benefits: config.productBenefits },
      config.productImages || [],
      tracking,
      config.customFormFields || [],
      config.customPrompt || '',
      apiKey,
      model,
      config.language || 'Tiếng Việt',
      onProgress
    );

    if (!result?.html) {
      throw new Error('Clone pipeline trả về HTML trống. Kiểm tra API key và model.');
    }

    const varA = result.html;
    let varB = varA;
    varB = varB.replace(/Đặt hàng ngay/g, 'Mua ngay — Giá ưu đãi');
    varB = varB.replace(/Đăng ký ngay/g, 'Nhận ưu đãi hôm nay');

    onProgress?.('✅ Hoàn thành!');
    return { variantA: varA, variantB: varB, analysis: result.analysis, mode: 'clone' };
  }

  // ===== Fallback (Legacy Template) =====
  console.log('[LDP] Mode: Built-in templates (no reference HTML)');
  
  let content = null;
  if (apiKey) {
    onProgress?.('🤖 Đang tạo nội dung...');
    content = await generateLandingContent(
      { name: config.productName, description: config.productDescription, benefits: config.productBenefits },
      config.style || 'Modern', apiKey, model
    );
  }

  onProgress?.('📄 Đang tạo landing page...');
  const tplCfg = {
    productName: config.productName, productDescription: config.productDescription,
    productImage: config.productImages?.[0],
    googleSheetWebhook: config.googleSheetWebhook, googleAdsTracking: config.googleAdsTracking,
    facebookPixelId: config.facebookPixelId, tiktokPixelId: config.tiktokPixelId,
  };

  return {
    variantA: generateVariantA(tplCfg, config.colors || {}, content),
    variantB: generateVariantB(tplCfg, config.colors || {}, content),
    mode: 'template',
  };
}

/**
 * Strip to Webcake format
 * - Extracts body content, styles, and font links
 * - STRIPS all <script> tags (they break Webcake's text-block parser
 *   and don't execute in text-blocks anyway)
 * - Cleans up <noscript> and unnecessary tags
 */
export function toWebcakeFormat(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return html;

  // Extract styles and font links from <head>
  const styles = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  const font = (html.match(/<link[^>]*fonts\.googleapis[^>]*>/i) || [''])[0];

  // Get body content and clean it for Webcake text-block
  let body = bodyMatch[1];

  // Strip ALL <script> tags — they break Webcake's text-block parser
  // (Webcake's text-block renders as innerHTML; <script> tags get
  //  misinterpreted by the HTML parser and truncate the content)
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Strip <noscript> tags (GTM etc. — not needed in Webcake)
  body = body.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Clean up multiple consecutive blank lines
  body = body.replace(/\n{3,}/g, '\n\n');

  return `<!-- Webcake HTML Box -->\n${font}\n${styles}\n<div class="ldp-wrapper">\n${body.trim()}\n</div>`;
}

// ============================================================
// STEP FUNCTIONS — for multi-step wizard
// ============================================================

/**
 * Step 1: Extract product data from 1688 HTML
 */
export async function stepExtract(config, apiKey, onProgress) {
  const model = config.model || 'gemini-2.5-flash';
  let refHtml = config.referenceHtml?.trim();
  
  if ((!refHtml || refHtml.length < 200) && config.referenceUrl) {
    onProgress?.('📥 Đang tải HTML từ URL...');
    refHtml = await fetchPageHtml(config.referenceUrl);
    onProgress?.(`✅ Đã tải ${Math.round(refHtml.length/1024)}KB HTML`);
  }
  
  if (!refHtml || refHtml.length < 200) {
    throw new Error('Cần nhập Link 1688 hoặc dán HTML.');
  }
  
  onProgress?.('🤖 Đang bóc tách dữ liệu sản phẩm...');
  const productData = await extractProductDataFrom1688(refHtml, config.language || 'Tiếng Việt', apiKey, model, onProgress);
  
  return {
    name: config.productName || productData.name || '',
    description: config.productDescription || productData.description || '',
    benefits: config.productBenefits || productData.benefits || '',
    price: productData.price || 'Liên hệ',
    originalPrice: productData.originalPrice || '',
    images: (config.productImages?.length > 0) ? config.productImages : (productData.images || []),
    rating: productData.rating || { score: 4.9, count: 1205 },
    reviews: productData.reviews || [],
  };
}

/**
 * Step 2: Build template HTML with images (NO text translation)
 */
export function stepBuildLayout(productData, config) {
  const colors = config.colors || { primary: '#e11d48', background: '#ffffff', text: '#1f2937' };
  const templateConfig = {
    customFormFields: config.customFormFields || [],
    gtmId: config.gtmId || '',
    facebookPixelId: config.facebookPixelId || '',
    tiktokPixelId: config.tiktokPixelId || '',
    googleAdsTracking: config.googleAdsTracking || '',
  };
  
  if (config.selectedTemplate === 'template2') {
    return generateTemplate2(productData, colors, templateConfig);
  }
  return generateTemplate1(productData, colors, templateConfig);
}

/**
 * Step 3a: Extract all visible text from HTML for translation
 */
export function stepExtractTexts(html) {
  // Strip scripts/styles/SVGs
  let textOnly = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  textOnly = textOnly.replace(/<style[\s\S]*?<\/style>/gi, '');
  textOnly = textOnly.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  
  const rawTextPieces = new Set();
  let m;
  
  // Text between tags
  const textRegex = />([^<]+)</g;
  while ((m = textRegex.exec(textOnly)) !== null) {
    const txt = m[1].trim();
    if (txt.length > 1 && /[a-zA-Zก-๙\u0e00-\u0e7f\u4e00-\u9fff\u00c0-\u024f\u1ea0-\u1ef9]/.test(txt)) {
      rawTextPieces.add(txt);
    }
  }
  
  // Placeholders
  const placeholderRegex = /placeholder=['"]([^"']+)/g;
  while ((m = placeholderRegex.exec(html)) !== null) {
    if (m[1].trim().length > 1) rawTextPieces.add(m[1].trim());
  }
  
  // Button text
  const btnRegex = /class="button-text[^"]*"[^>]*>([^<]+)/g;
  while ((m = btnRegex.exec(html)) !== null) {
    if (m[1].trim().length > 1) rawTextPieces.add(m[1].trim());
  }
  
  // Build list with raw + clean versions
  const textList = [];
  for (const raw of rawTextPieces) {
    const clean = raw.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    if (clean.length > 1) {
      textList.push({ raw, clean });
    }
  }
  
  return textList.slice(0, 150);
}

/**
 * Step 3b: Send text list to Gemini for translation
 */
export async function stepTranslateTexts(textList, targetLanguage, productInfo, apiKey, model, onProgress) {
  if (!textList || textList.length === 0) return [];
  
  const needViRef = !targetLanguage.toLowerCase().includes('việt');
  
  onProgress?.(`🌐 Đang dịch ${textList.length} đoạn text sang ${targetLanguage}...`);
  
  const viRefInstruction = needViRef 
    ? `\nĐỒNG THỜI dịch sang Tiếng Việt để nhân viên Việt Nam kiểm tra.`
    : '';
  
  const jsonFormat = needViRef
    ? '[{"original":"text gốc","translated":"bản dịch","vietnamese":"bản tiếng Việt"}]'
    : '[{"original":"text gốc","translated":"bản dịch"}]';
  
  const prompt = `Bạn là chuyên gia dịch thuật marketing. Dịch TOÀN BỘ ${textList.length} đoạn text sau sang ${targetLanguage}.${viRefInstruction}

THÔNG TIN SẢN PHẨM:
- Tên: ${productInfo.name || ''}
- Mô tả: ${productInfo.description || ''}
- Giá: ${productInfo.price || ''}

QUY TẮC:
- Tiếng Thái (ภาษาไทย) → ${targetLanguage}
- Tiếng Trung (中文) → ${targetLanguage}
- Tiếng Anh → ${targetLanguage}
- Đã là ${targetLanguage} → giữ nguyên
- Mô tả sản phẩm gốc (túi mỹ phẩm/กระเป๋า) → đổi thành ${productInfo.name || 'sản phẩm mới'}
- Giá Baht ฿ → đổi thành ${productInfo.price || 'giá mới'}
- Giữ nguyên emoji

Text cần dịch:
${textList.map((t, i) => `${i}: "${t.clean}"`).join('\n')}

Trả về JSON array:
${jsonFormat}
CHỈ JSON.`;

  const { callGeminiDirect } = await import('./gemini.js');
  const result = await callGeminiDirect(prompt, apiKey, model, 8192);
  
  let translations = [];
  if (Array.isArray(result)) {
    translations = result;
  } else if (result?.translations) {
    translations = result.translations;
  }
  
  onProgress?.(`✅ Nhận ${translations.length} bản dịch`);
  
  // Match translations with textList items
  return textList.map(({ raw, clean }) => {
    const found = translations.find(t => t.original === clean);
    return {
      raw,
      clean,
      translated: found?.translated || clean,
      vietnamese: found?.vietnamese || '',
      isChanged: found ? found.original !== found.translated : false,
    };
  });
}

/**
 * Step 3c: Apply a translation map to HTML
 * @param {Array<{raw: string, translated: string}>} translationMap
 */
export function stepApplyTranslations(html, translationMap) {
  let result = html;
  // Sort longest first to avoid partial replacement
  const sorted = [...translationMap]
    .filter(t => t.raw && t.translated && t.raw !== t.translated)
    .sort((a, b) => b.raw.length - a.raw.length);
  
  let count = 0;
  for (const { raw, translated } of sorted) {
    const occ = result.split(raw).length - 1;
    if (occ > 0) {
      result = result.split(raw).join(translated);
      count++;
    }
  }
  
  console.log(`[LDP] Applied ${count}/${sorted.length} translations`);
  
  // ===== Enhanced layout fix: CSS + JS (uses getComputedStyle for class-based positioning) =====
  const layoutFix = `
<style id="ldp-layout-fix">
  * { overflow-wrap: break-word !important; word-wrap: break-word !important; }
  img[src*="data:image/gif;base64,R0lGOD"] {
    display: none !important; width: 0 !important; height: 0 !important;
    margin: 0 !important; padding: 0 !important;
  }
</style>
<script id="ldp-layout-cleanup">
document.addEventListener('DOMContentLoaded', function() {
  var tp = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP';

  // 1. Hide transparent pixel images + collapse empty parents
  document.querySelectorAll('img').forEach(function(img) {
    if (img.src && img.src.indexOf(tp) !== -1) {
      img.style.display = 'none';
      var par = img.parentElement;
      if (par && !par.textContent.trim() && par.querySelectorAll('img:not([src*="R0lGOD"]), video, iframe').length === 0) {
        par.style.display = 'none';
      }
    }
  });

  // 2. Hide background containers using transparent pixel (check computed style)
  document.querySelectorAll('*').forEach(function(el) {
    var bg = getComputedStyle(el).backgroundImage || '';
    if (bg.indexOf(tp) !== -1) {
      if (!el.textContent.trim() && el.children.length === 0) {
        el.style.display = 'none';
      } else {
        el.style.backgroundImage = 'none';
      }
    }
  });

  // NOTE: Do NOT modify position:absolute — templates are designed with it.
  // Changing it breaks the entire layout.
});
${'</' + 'script>'}`;

  if (result.includes('</head>')) {
    result = result.replace('</head>', layoutFix + '\n</head>');
  } else {
    result = layoutFix + result;
  }
  
  return result;
}

/**
 * Step 2b: Replace content — send text + product data to Gemini
 * Returns [{raw, clean, newContent, isChanged}]
 */
export async function stepReplaceContent(textList, productData, targetLanguage, apiKey, model, onProgress) {
  if (!textList || textList.length === 0) return [];
  
  const isVietnamese = targetLanguage.toLowerCase().includes('việt');
  onProgress?.(`🔄 Đang thay nội dung ${textList.length} đoạn text sang ${targetLanguage}...`);
  
  const productInfo = {
    name: productData?.name || '',
    description: productData?.description || '',
    benefits: productData?.benefits || '',
    price: productData?.price || '',
    reviews: (productData?.reviews || []).slice(0, 3),
  };
  
  const viRefInstruction = isVietnamese 
    ? '' 
    : `\nĐỒNG THỜI cung cấp bản Tiếng Việt để nhân viên Việt Nam kiểm tra.`;
  
  const jsonFormat = isVietnamese
    ? '[{"index":0,"newContent":"nội dung mới"}]'
    : '[{"index":0,"newContent":"nội dung bằng ' + targetLanguage + '","vietnamese":"bản tiếng Việt"}]';
  
  const prompt = `Bạn là chuyên gia marketing landing page. Nhiệm vụ: thay thế NỘI DUNG SẢN PHẨM CŨ bằng sản phẩm mới, dịch sang ${targetLanguage}.${viRefInstruction}

THÔNG TIN SẢN PHẨM MỚI:
- Tên: ${productInfo.name}
- Mô tả: ${productInfo.description}
- Lợi ích: ${productInfo.benefits}
- Giá: ${productInfo.price}
${productInfo.reviews.length > 0 ? '- Feedback mẫu: ' + JSON.stringify(productInfo.reviews) : ''}

QUY TẮC QUAN TRỌNG:
1. Tất cả text gốc → dịch sang ${targetLanguage}
2. Tên sản phẩm cũ → thay bằng "${productInfo.name}" (bằng ${targetLanguage})
3. Mô tả sản phẩm cũ → thay bằng mô tả sản phẩm mới (bằng ${targetLanguage})
4. Feedback/review cũ → viết lại feedback mới cho sản phẩm mới (bằng ${targetLanguage}, tự nhiên)
5. Giá cũ → thay bằng "${productInfo.price || 'Liên hệ'}"
6. Các text chung (nút mua hàng, form, tiêu đề chung) → dịch sang ${targetLanguage}
7. Giữ nguyên emoji
8. Nếu text đã đúng ${targetLanguage} và phù hợp sản phẩm mới → giữ nguyên

Text cần thay (${textList.length} đoạn):
${textList.map((t, i) => `${i}: "${t.clean}"`).join('\n')}

Trả về JSON array:
${jsonFormat}
CHỈ JSON, KHÔNG giải thích.`;

  const { callGeminiDirect } = await import('./gemini.js');
  const result = await callGeminiDirect(prompt, apiKey, model, 8192);
  
  let replacements = [];
  if (Array.isArray(result)) {
    replacements = result;
  }
  
  onProgress?.(`✅ Nhận ${replacements.length} nội dung mới`);
  
  return textList.map(({ raw, clean }, i) => {
    const found = replacements.find(r => r.index === i);
    const newContent = found?.newContent || clean;
    return {
      raw,
      clean,
      newContent,
      vietnamese: found?.vietnamese || '',
      isChanged: newContent !== clean,
    };
  });
}

/**
 * Step: Add webhook + finalize
 */
export function stepFinalize(html, config) {
  if (config.googleSheetWebhook) {
    const webhookScript = `<script>document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('form').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();fetch('${config.googleSheetWebhook}',{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))}).then(function(){alert('Đã gửi thành công!')}).catch(function(){alert('Đã gửi!')})})})});<\/script>`;
    html = html.replace('</body>', webhookScript + '\n</body>');
  }
  return html;
}
