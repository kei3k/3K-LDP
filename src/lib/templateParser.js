/**
 * Template Parser — Decode PKE + Classify blocks via Gemini
 * 
 * Parses Webcake .pke files into block trees and uses Gemini AI
 * to classify each block (product image, design image, text, price, etc.)
 */
import { decode, encode } from '@msgpack/msgpack';

/**
 * Decode a PKE file (base64 string or Uint8Array) → full data object
 */
export function decodePke(pkeContent) {
  let buffer;

  if (typeof pkeContent === 'string') {
    // Base64 string → binary
    const trimmed = pkeContent.trim();
    const binaryString = atob(trimmed);
    buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }
  } else if (pkeContent instanceof ArrayBuffer) {
    buffer = new Uint8Array(pkeContent);
  } else {
    buffer = pkeContent; // already Uint8Array
  }

  return decode(buffer);
}

/**
 * Encode data object back to PKE base64 string
 */
export function encodePke(data) {
  const buffer = encode(data);
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Flatten all blocks from a PKE into a list with path references
 * Returns: [{ block, path, parentType }]
 */
export function flattenBlocks(pkeData) {
  const blocks = [];

  function walk(items, pathPrefix = 'page') {
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const block = items[i];
      const path = `${pathPrefix}[${i}]`;
      blocks.push({
        block,
        path,
        index: blocks.length,
      });
      if (block.children && block.children.length > 0) {
        walk(block.children, `${path}.children`);
      }
    }
  }

  walk(pkeData.source.page);
  
  // Also walk popups
  if (pkeData.source.popup && pkeData.source.popup.length > 0) {
    walk(pkeData.source.popup, 'popup');
  }

  return blocks;
}

/**
 * Extract summary of all blocks for Gemini classification
 */
export function extractBlockSummaries(flatBlocks) {
  return flatBlocks.map(({ block, index }) => {
    const type = block.type || 'unknown';
    const id = block.id || '';
    const name = block.properties?.name || '';
    const desktop = block.responsive?.desktop?.styles || {};
    const width = desktop.width || 0;
    const height = desktop.height || 0;

    let content = '';
    if (block.specials) {
      if (block.specials.text) {
        // Strip HTML tags for classification
        const plainText = block.specials.text.replace(/<[^>]+>/g, '').trim();
        content = plainText.substring(0, 150);
      }
      if (block.specials.src) {
        content = 'IMAGE: ' + block.specials.src.substring(0, 80);
      }
      if (block.specials.field_name) {
        content = 'FORM_FIELD: ' + block.specials.field_name;
      }
      if (block.specials.submit_success) {
        content = 'FORM_SUBMIT';
      }
    }

    return { index, type, id, name, width, height, content };
  });
}

/**
 * Classification categories
 */
export const BLOCK_CATEGORIES = {
  PRODUCT_IMAGE: 'product_image',       // Product photos (replace with new product)
  DESIGN_IMAGE: 'design_image',         // Icons, decorations, UI elements (keep)
  SECTION_BG: 'section_bg',             // Section background images (keep)
  PRODUCT_NAME: 'product_name',         // Product name text (replace)
  PRODUCT_DESC: 'product_description',  // Product description/benefits (replace)
  PRODUCT_PRICE: 'product_price',       // Price text (replace)
  PROMOTION_TEXT: 'promotion_text',     // Flash sale, discount text (replace numbers only)
  REVIEW_TEXT: 'review_text',           // Review/feedback text (generate new)
  REVIEW_IMAGE: 'review_image',        // Review/feedback photos (replace)
  FORM: 'form',                        // Order form (keep structure, translate labels)
  UI_ELEMENT: 'ui_element',            // Buttons, countdown, rectangles (keep)
  GENERAL_TEXT: 'general_text',        // General UI text (translate only)
  KEEP: 'keep',                        // Keep unchanged
};

/**
 * Classify blocks using Gemini AI
 * @param {Array} blockSummaries - from extractBlockSummaries
 * @param {string} apiKey - Gemini API key
 * @param {string} model - Gemini model name
 * @param {function} onProgress - progress callback
 * @returns {Map<number, string>} blockIndex → category
 */
export async function classifyBlocks(blockSummaries, apiKey, model, onProgress) {
  onProgress?.('🔍 Đang phân tích template...');

  // Filter to blocks that have content (skip empty groups, sections without bg)
  const relevantBlocks = blockSummaries.filter(b =>
    b.type === 'text-block' ||
    b.type === 'image-block' ||
    (b.type === 'section' && b.content.startsWith('IMAGE:')) ||
    b.type === 'form' ||
    b.type === 'button' ||
    b.type === 'input'
  );

  const prompt = `Bạn là chuyên gia phân tích cấu trúc landing page. Dưới đây là danh sách ${relevantBlocks.length} block từ template bán hàng Webcake.

Nhiệm vụ: Phân loại TỪNG block vào 1 trong các category sau:
- product_image: Ảnh sản phẩm chính (ảnh to, gallery, ảnh chi tiết sản phẩm)
- design_image: Ảnh thiết kế/icon/decor/logo/badge nhỏ (KHÔNG thay đổi)
- section_bg: Ảnh nền section (KHÔNG thay đổi)
- product_name: Text chứa tên sản phẩm
- product_description: Mô tả sản phẩm, lợi ích, công dụng
- product_price: Giá sản phẩm (cũ/mới)
- promotion_text: Text khuyến mãi (giảm giá, flash sale, ưu đãi)
- review_text: Nội dung đánh giá/feedback khách hàng
- review_image: Ảnh review/feedback khách hàng
- form: Form đặt hàng / input fields
- ui_element: Nút bấm, countdown, rectangle, decor
- general_text: Text giao diện chung (tiêu đề section, chú thích)
- keep: Giữ nguyên không đổi

QUY TẮC QUAN TRỌNG:
1. Image-block to (>300px) có ảnh sản phẩm → product_image
2. Image-block nhỏ (<100px) → design_image (icon/badge)
3. Image-block vừa (100-300px) với nội dung review → review_image
4. Section có background image → section_bg
5. Text có giá tiền (số + đơn vị tiền) → product_price
6. Text có tên/mô tả sản phẩm → product_name hoặc product_description
7. Text có review/feedback → review_text
8. Form/input → form
9. Button → ui_element

Danh sách blocks:
${relevantBlocks.map(b => `[${b.index}] ${b.type} "${b.name}" ${b.width}x${b.height} :: ${b.content}`).join('\n')}

Trả về JSON object:
{
  "classifications": [
    {"index": 0, "category": "product_image", "reason": "lý do ngắn"}
  ]
}
CHỈ JSON.`;

  const { callGeminiDirect } = await import('./gemini.js');
  const result = await callGeminiDirect(prompt, apiKey, model, 8192);

  const classMap = new Map();
  
  // Set defaults for all blocks
  for (const b of blockSummaries) {
    if (b.type === 'section') classMap.set(b.index, BLOCK_CATEGORIES.KEEP);
    else if (b.type === 'group') classMap.set(b.index, BLOCK_CATEGORIES.KEEP);
    else if (b.type === 'rectangle') classMap.set(b.index, BLOCK_CATEGORIES.KEEP);
    else if (b.type === 'countdown') classMap.set(b.index, BLOCK_CATEGORIES.UI_ELEMENT);
    else classMap.set(b.index, BLOCK_CATEGORIES.KEEP);
  }

  // Apply Gemini classifications
  const classifications = result?.classifications || (Array.isArray(result) ? result : []);
  for (const { index, category } of classifications) {
    if (typeof index === 'number' && category && Object.values(BLOCK_CATEGORIES).includes(category)) {
      classMap.set(index, category);
    }
  }

  onProgress?.(`✅ Phân loại xong ${classifications.length} blocks`);
  console.log('[Template] Classifications:', Object.fromEntries(classMap));
  
  return classMap;
}
