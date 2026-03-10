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
import { fetchPageHtml, cloneLandingPage, generateLandingContent } from './gemini';

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
  const model = config.model || 'gemini-3.1-pro';
  
  // ===== MODE 1: Clone from HTML (pasted or auto-fetched) =====
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
  
  if (refHtml && refHtml.length > 200 && apiKey) {
    console.log('[LDP] Mode 1: Clone (' + Math.round(refHtml.length/1024) + 'KB)');
    onProgress?.('🔍 Đang phân tích và clone landing page...');
    
    const tracking = {
      googleSheetWebhook: config.googleSheetWebhook || '',
      googleAdsTracking: config.googleAdsTracking || '',
      facebookPixelId: config.facebookPixelId || '',
      tiktokPixelId: config.tiktokPixelId || '',
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

  // ===== MODE 2: Built-in templates (no reference HTML) =====
  if (!refHtml || refHtml.length < 200) {
    console.log('[LDP] Mode 2: Built-in templates (no reference HTML)');
  }
  
  let content = null;
  if (apiKey) {
    onProgress?.('🤖 Đang tạo nội dung...');
    // Let errors surface here too
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
 */
export function toWebcakeFormat(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return html;
  const styles = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  const font = (html.match(/<link[^>]*fonts\.googleapis[^>]*>/i) || [''])[0];
  return `<!-- Webcake HTML Box -->\n${font}\n${styles}\n<div class="ldp-wrapper">\n${bodyMatch[1]}\n</div>`;
}
