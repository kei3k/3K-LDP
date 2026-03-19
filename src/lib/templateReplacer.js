/**
 * Template Replacer v3 — Aggressive replacement for Webcake PKE blocks
 * 
 * Key insight from testing: Gemini classification is unreliable for 100+ blocks.
 * Instead, use SIZE-BASED classification for images and replace ALL text blocks.
 */
import { flattenBlocks } from './templateParser';

const IMGBB_API_KEY = 'c82284897280ed2e46a1f3e5be11238b';

/**
 * Re-host image via Vite proxy → ImgBB
 */
async function rehostImage(imageUrl) {
  try {
    const needsProxy = imageUrl.includes('alicdn.com') || imageUrl.includes('1688.com');
    const fetchUrl = needsProxy
      ? '/api/fetch-url?url=' + encodeURIComponent(imageUrl)
      : imageUrl;

    const response = await fetch(fetchUrl, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (blob.size < 500) return null;

    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64);

    const uploadRes = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    const data = await uploadRes.json();
    if (data.success) {
      console.log(`[Rehost] ✅ ${imageUrl.substring(0, 50)} → ${data.data.url}`);
      return data.data.url;
    }
    return null;
  } catch (err) {
    console.warn(`[Rehost] Failed: ${err.message}`);
    return null;
  }
}

/**
 * Main replacement function — aggressive approach
 */
export async function applyReplacements(pkeData, classMap, flatBlocks, newProduct, targetLanguage, apiKey, model, onProgress) {
  const {
    name = 'Sản phẩm mới',
    description = '',
    benefits = '',
    price = '',
    originalPrice = '',
    images = [],
    reviews = [],
  } = newProduct;

  // ===== STEP 1: Re-host 1688 images to ImgBB =====
  onProgress?.(`🖼️ Re-host ${images.length} ảnh sản phẩm...`);
  
  const rehostedImages = [];
  for (let i = 0; i < Math.min(images.length, 8); i++) {
    onProgress?.(`🖼️ Re-host ảnh ${i + 1}/${Math.min(images.length, 8)}...`);
    const url = await rehostImage(images[i]);
    if (url) rehostedImages.push(url);
  }
  
  console.log(`[Replacer] Re-hosted ${rehostedImages.length} images`);
  if (rehostedImages.length === 0 && images.length > 0) {
    console.warn('[Replacer] No images re-hosted, using originals as fallback');
  }
  const finalImages = rehostedImages.length > 0 ? rehostedImages : images;

  // ===== STEP 2: Replace ALL large image blocks with new product images =====
  onProgress?.('🖼️ Thay ảnh sản phẩm trong template...');
  
  let imageReplaceCount = 0;
  if (finalImages.length > 0) {
    for (const { block } of flatBlocks) {
      if (block.type !== 'image-block' || !block.specials?.src) continue;
      
      const desktop = block.responsive?.desktop?.styles || {};
      const w = desktop.width || 0;
      const h = desktop.height || 0;
      const area = w * h;
      
      // Replace ALL images larger than 150x150 (product images, review images, gallery)
      // Keep small icons (<100px) and tiny decorations
      if (w > 150 && h > 150 && area > 30000) {
        const idx = imageReplaceCount % finalImages.length;
        console.log(`[Replacer] Image ${block.properties?.name} (${w}x${h}) → ${finalImages[idx].substring(0, 50)}`);
        
        // CRITICAL: Update ALL 3 places where Webcake stores image URLs
        block.specials.src = finalImages[idx];
        
        // responsive.desktop.styles.background (CSS url())
        if (block.responsive?.desktop?.styles?.background) {
          block.responsive.desktop.styles.background = 
            block.responsive.desktop.styles.background.replace(
              /url\([^)]+\)/g, `url(${finalImages[idx]})`
            );
        }
        
        // responsive.mobile.styles.background (CSS url())
        if (block.responsive?.mobile?.styles?.background) {
          block.responsive.mobile.styles.background = 
            block.responsive.mobile.styles.background.replace(
              /url\([^)]+\)/g, `url(${finalImages[idx]})`
            );
        }
        
        imageReplaceCount++;
      }
    }
  }
  console.log(`[Replacer] Replaced ${imageReplaceCount} large images`);

  // ===== STEP 3: Collect ALL text that needs translation/replacement =====
  onProgress?.('📝 Thu thập text cần thay...');
  
  const textItems = [];
  const buttonItems = [];
  const placeholderItems = [];
  
  for (const { block, index } of flatBlocks) {
    // Text blocks
    if (block.type === 'text-block' && block.specials?.text) {
      const plain = block.specials.text.replace(/<[^>]+>/g, '').trim();
      if (plain.length > 0) {
        textItems.push({ index, block, plainText: plain, htmlText: block.specials.text });
      }
    }
    // Buttons
    if (block.type === 'button' && block.specials?.text) {
      const plain = block.specials.text.replace(/<[^>]+>/g, '').trim();
      if (plain.length > 0) {
        buttonItems.push({ index, block, plainText: plain, htmlText: block.specials.text });
      }
    }
    // Form placeholders
    if (block.type === 'input' && block.specials?.field_placeholder) {
      placeholderItems.push({ index, block, plainText: block.specials.field_placeholder });
    }
  }
  
  console.log(`[Replacer] Found: ${textItems.length} texts, ${buttonItems.length} buttons, ${placeholderItems.length} placeholders`);

  // ===== STEP 4: Send ALL text to Gemini for replacement (single big call) =====
  if (textItems.length > 0 || buttonItems.length > 0 || placeholderItems.length > 0) {
    onProgress?.(`🌐 Đang dịch và thay ${textItems.length + buttonItems.length + placeholderItems.length} đoạn text...`);
    
    const allItems = [
      ...textItems.map(t => ({ idx: t.index, type: 'text', text: t.plainText.substring(0, 200) })),
      ...buttonItems.map(t => ({ idx: t.index, type: 'button', text: t.plainText.substring(0, 100) })),
      ...placeholderItems.map(t => ({ idx: t.index, type: 'placeholder', text: t.plainText.substring(0, 100) })),
    ];
    
    const langName = targetLanguage || 'Tiếng Việt';
    const prompt = `Bạn là chuyên gia marketing. Nhiệm vụ: THAY THẾ nội dung sản phẩm CŨ trong template landing page bằng sản phẩm MỚI.

SẢN PHẨM MỚI:
- Tên: ${name}
- Mô tả: ${description || 'Sản phẩm chất lượng cao'}
- Lợi ích: ${benefits || ''}
- Giá: ${price || '299.000đ'}
- Giá gốc: ${originalPrice || '599.000đ'}

DANH SÁCH ${allItems.length} text blocks cần DỊCH sang ${langName} và THAY nội dung sản phẩm:
${allItems.map(t => `[${t.idx}](${t.type}): "${t.text}"`).join('\n')}

QUY TẮC BẮT BUỘC:
1. DỊCH TẤT CẢ text sang ${langName} - KHÔNG để lại tiếng Thái/Trung
2. Thay TÊN sản phẩm cũ → "${name}"
3. Thay GIÁ cũ → "${price || '299.000đ'}" / "${originalPrice || '599.000đ'}"
4. Thay MÔ TẢ → mô tả sản phẩm mới
5. Thay REVIEW → viết review MỚI cho sản phẩm mới (tên người ${langName === 'Tiếng Việt' ? 'Việt Nam' : langName})
6. Thay BUTTON text → "${langName === 'Tiếng Việt' ? 'Mua ngay' : 'Buy now'}" hoặc tương tự
7. Thay PLACEHOLDER → dịch sang ${langName}
8. GIỮ NGUYÊN HTML tags/style nếu text gốc có HTML

Trả về JSON:
{"items": [{"idx": 0, "text": "nội dung mới"}]}
Mỗi item PHẢI có "idx" (block index) và "text" (nội dung mới bằng ${langName}).
PHẢI trả về ĐẦY ĐỦ ${allItems.length} items. KHÔNG bỏ sót.
CHỈ JSON.`;

    try {
      const { callGeminiDirect } = await import('./gemini.js');
      
      // Retry with exponential backoff for 429 rate limits
      let result = null;
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          onProgress?.(`🌐 Dịch text (lần ${attempt})... đợi Gemini xử lý...`);
          result = await callGeminiDirect(prompt, apiKey, model, 16384);
          break; // Success
        } catch (retryErr) {
          const is429 = retryErr.message?.includes('429') || retryErr.message?.includes('Resource');
          if (is429 && attempt < MAX_RETRIES) {
            const waitSec = 10 * Math.pow(2, attempt - 1); // 10s, 20s, 40s
            onProgress?.(`⏳ Gemini rate limit, đợi ${waitSec}s rồi thử lại (${attempt}/${MAX_RETRIES})...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
          } else {
            throw retryErr;
          }
        }
      }
      
      const items = result?.items || (Array.isArray(result) ? result : []);
      console.log(`[Replacer] Gemini returned ${items.length} text replacements`);
      
      let textApplied = 0;
      for (const { idx, text } of items) {
        if (typeof idx !== 'number' || !text) continue;
        
        // Find in text items
        const textItem = textItems.find(t => t.index === idx);
        if (textItem) {
          // Preserve HTML structure, replace inner text
          const oldHtml = textItem.block.specials.text;
          // If old HTML has tags, try to preserve structure
          if (oldHtml.includes('<')) {
            // Replace the plain text content within the HTML wrapper
            textItem.block.specials.text = replaceTextKeepHtml(oldHtml, text);
          } else {
            textItem.block.specials.text = text;
          }
          textApplied++;
          continue;
        }
        
        // Find in button items
        const btnItem = buttonItems.find(t => t.index === idx);
        if (btnItem) {
          if (btnItem.block.specials.text.includes('<')) {
            btnItem.block.specials.text = replaceTextKeepHtml(btnItem.block.specials.text, text);
          } else {
            btnItem.block.specials.text = text;
          }
          textApplied++;
          continue;
        }
        
        // Find in placeholder items
        const phItem = placeholderItems.find(t => t.index === idx);
        if (phItem) {
          phItem.block.specials.field_placeholder = text;
          textApplied++;
          continue;
        }
      }
      
      console.log(`[Replacer] Applied ${textApplied}/${items.length} text replacements`);
      onProgress?.(`✅ Đã thay ${textApplied} text blocks`);
    } catch (err) {
      console.error('[Replacer] Text replacement error:', err);
      onProgress?.(`⚠️ Lỗi thay text (ảnh vẫn OK): ${err.message}. File PKE vẫn được tạo với ảnh mới.`);
    }
  }

  // ===== STEP 5: Update page metadata =====
  if (pkeData.source.settings) {
    pkeData.source.settings.title = name;
  }
  pkeData.name = name;

  onProgress?.('✅ Hoàn tất thay thế!');
  return pkeData;
}

/**
 * Replace text content while preserving HTML wrapper tags
 */
function replaceTextKeepHtml(originalHtml, newText) {
  // If original has a simple structure like <span style="...">old text</span>
  // Keep the outer tag(s) and replace the innermost text
  
  // Find the outermost tag wrapper
  const match = originalHtml.match(/^(<[^>]+>)([\s\S]*)(<\/[^>]+>)$/);
  if (match) {
    const [, openTag, , closeTag] = match;
    return `${openTag}${newText}${closeTag}`;
  }
  
  // If multiple nested tags, try to keep all wrappers
  const openTags = [];
  const closeTags = [];
  let remaining = originalHtml;
  
  // Extract leading tags
  while (remaining.match(/^<[^/][^>]*>/)) {
    const tagMatch = remaining.match(/^(<[^/][^>]*>)/);
    if (!tagMatch) break;
    openTags.push(tagMatch[1]);
    remaining = remaining.substring(tagMatch[1].length);
  }
  
  // Extract trailing close tags
  while (remaining.match(/<\/[^>]+>$/)) {
    const tagMatch = remaining.match(/(<\/[^>]+>)$/);
    if (!tagMatch) break;
    closeTags.unshift(tagMatch[1]);
    remaining = remaining.substring(0, remaining.length - tagMatch[1].length);
  }
  
  if (openTags.length > 0) {
    return openTags.join('') + newText + closeTags.join('');
  }
  
  // Fallback: just return new text
  return newText;
}
