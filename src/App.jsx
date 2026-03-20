import { useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import ConfigForm from './components/ConfigForm';
import PreviewPanel from './components/PreviewPanel';
import StepWizard from './components/StepWizard';
import StepExtract from './components/StepExtract';
import StepLayout from './components/StepLayout';
import StepContentEdit from './components/StepContentEdit';
import TemplateWizard from './components/TemplateWizard';
import ImageTranslator from './components/ImageTranslator';
import { 
  generateLandingPages, 
  stepExtract, stepBuildLayout, stepExtractTexts, 
  stepReplaceContent, stepApplyTranslations, stepFinalize 
} from './lib/generator';
import { translateImageText, extractProductDataFrom1688, callGeminiDirect } from './lib/gemini';
import { decodePke, encodePke, flattenBlocks, extractBlockSummaries } from './lib/templateParser';
import { applyReplacements } from './lib/templateReplacer';

/**
 * Main App — sidebar config + multi-step wizard OR preview panel
 */
export default function App() {
  const [theme, setTheme] = useState('dark');
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [activeTab, setActiveTab] = useState('template'); // 'template' or 'translate'

  // Config state
  const [config, setConfig] = useState({
    productName: '',
    productDescription: '',
    productBenefits: '',
    language: 'Tiếng Việt',
    productImages: [],
    referenceUrl: '',
    referenceHtml: '',
    model: localStorage.getItem('gemini_model') || 'gemini-2.5-flash',
    colors: null,
    customFormFields: [],
    googleSheetWebhook: '',
    googleAdsTracking: '',
    facebookPixelId: '',
    tiktokPixelId: '',
    apiKey: localStorage.getItem('gemini_api_key') || '',
    buildMode: 'template',
  });

  // Wizard state
  const [wizardMode, setWizardMode] = useState(false); // false = old flow, true = wizard
  const [wizardStep, setWizardStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Step data
  const [productData, setProductData] = useState(null);
  const [layoutHtml, setLayoutHtml] = useState('');
  const [contentItems, setContentItems] = useState([]);
  const [finalHtml, setFinalHtml] = useState(null);
  const [contentError, setContentError] = useState(null);

  // Template wizard state
  const [templateWizardMode, setTemplateWizardMode] = useState(false);
  const [templateWizardStep, setTemplateWizardStep] = useState(0);
  const [templatePkeData, setTemplatePkeData] = useState(null);
  const [templateFlatBlocks, setTemplateFlatBlocks] = useState([]);
  const [templateInfo, setTemplateInfo] = useState(null);
  const [templateProduct, setTemplateProduct] = useState(null);
  const [templateImageReplacements, setTemplateImageReplacements] = useState([]);
  const [templateTextReplacements, setTemplateTextReplacements] = useState([]);

  // Legacy: single-shot generation
  const [generatedHtml, setGeneratedHtml] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.className = newTheme === 'light' ? 'light' : '';
  };

  // ===== OLD FLOW: Single-shot =====
  const handleGenerate = useCallback(async () => {
    // Route to template wizard if template mode
    if (config.buildMode === 'template') {
      return handleTemplateWizardStart();
    }

    if (!config.productName?.trim()) return;
    setIsGenerating(true);
    setError(null);
    setProgress('Đang khởi tạo...');
    try {
      const result = await generateLandingPages(config, config.apiKey, (msg) => setProgress(msg));
      setGeneratedHtml(result.variantA);
      setProgress('');
    } catch (err) {
      console.error('Generation failed:', err);
      setError(err.message);
      setProgress('');
    } finally {
      setIsGenerating(false);
    }
  }, [config]);

  // ===== TEMPLATE WIZARD FLOW (4 steps) =====

  /** Step 0: Decode PKE + Extract 1688 data */
  const handleTemplateWizardStart = useCallback(async () => {
    if (!config.templatePkeContent) {
      setError('Vui lòng upload file .PKE template trước!');
      return;
    }

    setTemplateWizardMode(true);
    setTemplateWizardStep(0);
    setIsLoading(true);
    setError(null);
    setWizardMode(false);
    setGeneratedHtml(null);

    try {
      // Decode PKE
      setProgress('📦 Đang decode template PKE...');
      const pkeData = decodePke(config.templatePkeContent);
      const flat = flattenBlocks(pkeData);
      setTemplatePkeData(pkeData);
      setTemplateFlatBlocks(flat);

      // Compute template info
      const largeImages = flat.filter(({ block }) => {
        if (block.type !== 'image-block' || !block.specials?.src) return false;
        const w = block.responsive?.desktop?.styles?.width || 0;
        const h = block.responsive?.desktop?.styles?.height || 0;
        return w > 150 && h > 150;
      }).length;
      const textBlocks = flat.filter(({ block }) => block.type === 'text-block' && block.specials?.text).length;
      setTemplateInfo({
        name: pkeData.name,
        totalBlocks: flat.length,
        largeImages,
        textBlocks,
      });

      // Extract 1688 product data
      const model = config.model || 'gemini-2.0-flash';
      let product = {
        name: config.productName || 'Sản phẩm mới',
        description: config.productDescription || '',
        benefits: config.productBenefits || '',
        price: '',
        originalPrice: '',
        images: config.productImages || [],
        reviews: [],
      };

      if (config.referenceHtml && config.referenceHtml.length > 200) {
        setProgress('🔍 Đang trích xuất dữ liệu từ 1688...');
        const extracted = await extractProductDataFrom1688(
          config.referenceHtml,
          config.language || 'Tiếng Việt',
          config.apiKey || '',
          model,
          (msg) => setProgress(msg)
        );
        if (extracted) {
          product = {
            name: extracted.name || product.name,
            description: extracted.description || product.description,
            benefits: extracted.benefits || product.benefits,
            price: extracted.price || '',
            originalPrice: extracted.originalPrice || '',
            images: (extracted.images?.length > 0) ? extracted.images : product.images,
            reviews: extracted.reviews || [],
          };
        }
      }

      setTemplateProduct(product);
      setProgress('');
    } catch (err) {
      setError(err.message);
      setProgress('');
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  /** Step 1: Re-host images + apply to PKE */
  const handleTemplateProceedImages = useCallback(async () => {
    setTemplateWizardStep(1);
    setIsLoading(true);
    setError(null);

    try {
      const images = templateProduct?.images || [];
      setProgress(`🖼️ Re-host ${images.length} ảnh...`);

      // Multi-key ImgBB rotation for avoiding rate limits
      const IMGBB_KEYS = [
        '02f64b3be9d269a7a8a41f3778dadc00',
        'b69da15baaeef837d4a3a389d9d93057',
        '99c7dcfd7b3f726700a39ae75032c773',
        'c82284897280ed2e46a1f3e5be11238b',
      ];
      let currentKeyIdx = 0;

      const rehostImage = async (url, attempt = 1) => {
        try {
          // Fetch image via proxy
          const needsProxy = url.includes('alicdn.com') || url.includes('1688.com') || url.includes('cbu01') || url.includes('cbu02');
          const fetchUrl = needsProxy ? '/api/fetch-url?url=' + encodeURIComponent(url) : url;
          const resp = await fetch(fetchUrl, { signal: AbortSignal.timeout(15000) });
          if (!resp.ok) {
            console.warn(`[ReHost] Fetch failed (${resp.status}): ${url.substring(0, 60)}`);
            return null;
          }
          const blob = await resp.blob();
          if (blob.size < 500) {
            console.warn(`[ReHost] Image too small (${blob.size}b): ${url.substring(0, 60)}`);
            return null;
          }

          // Convert to base64
          const base64 = await new Promise(r => {
            const reader = new FileReader();
            reader.onloadend = () => r(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
          });

          // Upload to ImgBB with key rotation
          const key = IMGBB_KEYS[currentKeyIdx % IMGBB_KEYS.length];
          const fd = new FormData();
          fd.append('key', key);
          fd.append('image', base64);
          const upRes = await fetch('https://api.imgbb.com/1/upload', { 
            method: 'POST', body: fd,
            signal: AbortSignal.timeout(15000) 
          });
          const data = await upRes.json();
          
          if (data.success) {
            console.log(`[ReHost] ✅ OK (key ${currentKeyIdx % IMGBB_KEYS.length}): ${data.data.url.substring(0, 50)}`);
            return data.data.url;
          }
          
          // If this key failed, try next key
          console.warn(`[ReHost] ImgBB error (key ${currentKeyIdx % IMGBB_KEYS.length}): ${JSON.stringify(data.error || data)}`);
          if (attempt < 2) {
            currentKeyIdx++;
            await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
            return rehostImage(url, attempt + 1);
          }
          return null;
        } catch (err) {
          console.warn(`[ReHost] Error: ${err.message} | URL: ${url.substring(0, 50)}`);
          if (attempt < 2) {
            currentKeyIdx++;
            await new Promise(r => setTimeout(r, 2000));
            return rehostImage(url, attempt + 1);
          }
          return null;
        }
      };

      // Re-host images with delay between uploads
      const maxImages = Math.min(images.length, 15);
      const rehosted = [];
      let failCount = 0;
      for (let i = 0; i < maxImages; i++) {
        setProgress(`🖼️ Re-host ảnh ${i + 1}/${maxImages}...`);
        const url = await rehostImage(images[i]);
        if (url) {
          rehosted.push(url);
          currentKeyIdx++; // rotate key for next upload
        } else {
          failCount++;
          console.warn(`[ReHost] FAILED image ${i + 1}: ${images[i].substring(0, 60)}`);
        }
        // Delay 1.5s between uploads to avoid rate limiting
        if (i < maxImages - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      
      if (failCount > 0) {
        setProgress(`⚠️ ${failCount}/${maxImages} ảnh không upload được. Đang dùng ${rehosted.length} ảnh thành công.`);
        console.warn(`[ReHost] ${failCount} images failed, ${rehosted.length} succeeded`);
      }
      const finalImages = rehosted.length > 0 ? rehosted : images;

      // Find and replace large images in PKE (protect footer/sticky)
      const replacements = [];
      let imgIdx = 0;
      
      // Build parent section map: which top-level section does each block belong to?
      const topSections = templatePkeData.source.page || [];
      const totalSections = topSections.length;
      const protectedSectionIndices = new Set();
      
      // Mark last 2 sections as protected (footer area)
      for (let si = Math.max(0, totalSections - 2); si < totalSections; si++) {
        protectedSectionIndices.add(si);
      }
      // Mark sticky/fixed/footer sections as protected
      topSections.forEach((sec, si) => {
        const pos = sec.responsive?.desktop?.styles?.position || '';
        const mPos = sec.responsive?.mobile?.styles?.position || '';
        const name = (sec.properties?.name || '').toLowerCase();
        if (pos === 'sticky' || pos === 'fixed' || mPos === 'sticky' || mPos === 'fixed' ||
            name.includes('footer') || name.includes('sticky') || name.includes('bar') ||
            name.includes('cta') || name.includes('bottom')) {
          protectedSectionIndices.add(si);
        }
      });
      
      console.log(`[TemplateWizard] Protected sections (footer/sticky): ${[...protectedSectionIndices].join(', ')}`);

      // Build a set of all block IDs inside protected sections
      const protectedBlockIds = new Set();
      function markProtected(items) {
        if (!items) return;
        for (const b of items) {
          if (b.id) protectedBlockIds.add(b.id);
          if (b.children) markProtected(b.children);
        }
      }
      for (const si of protectedSectionIndices) {
        markProtected(topSections[si]?.children);
        if (topSections[si]?.id) protectedBlockIds.add(topSections[si].id);
      }

      for (const { block } of templateFlatBlocks) {
        // Include BOTH image-block AND rectangle/other blocks that have specials.src
        // Webcake uses 'rectangle' blocks for carousel images too!
        if (!block.specials?.src) continue;
        const blockType = block.type || '';
        // Only process blocks that can hold images
        if (blockType !== 'image-block' && blockType !== 'rectangle') continue;
        
        const w = block.responsive?.desktop?.styles?.width || 0;
        const h = block.responsive?.desktop?.styles?.height || 0;
        
        // Skip protected (footer/sticky) blocks
        if (block.id && protectedBlockIds.has(block.id)) {
          console.log(`[TemplateWizard] SKIP protected: ${block.properties?.name} (${w}x${h})`);
          continue;
        }
        
        // Lower threshold to include feedback images (120x140), carousel icons (27x27 still skipped)
        // Minimum: 80px on each side, area > 8000px²
        if (w > 80 && h > 80 && w * h > 8000) {
          const oldSrc = block.specials.src;
          const newSrc = finalImages[imgIdx % finalImages.length];
          
          // CRITICAL: Update ALL 3 places where Webcake stores image URLs
          // 1. specials.src
          block.specials.src = newSrc;
          
          // 2. responsive.desktop.styles.background (CSS url())
          if (block.responsive?.desktop?.styles?.background) {
            block.responsive.desktop.styles.background = 
              block.responsive.desktop.styles.background.replace(
                /url\([^)]+\)/g, `url(${newSrc})`
              );
          }
          
          // 3. responsive.mobile.styles.background (CSS url())
          if (block.responsive?.mobile?.styles?.background) {
            block.responsive.mobile.styles.background = 
              block.responsive.mobile.styles.background.replace(
                /url\([^)]+\)/g, `url(${newSrc})`
              );
          }
          
          replacements.push({
            blockName: block.properties?.name || `image-${imgIdx}`,
            blockType, // log the type for debugging
            oldSrc, newSrc, width: w, height: h,
          });
          imgIdx++;
        } else {
          console.log(`[TemplateWizard] SKIP small: ${block.properties?.name} type:${blockType} (${w}x${h}=${w*h})`);
        }
      }

      // Also replace gallery/carousel images (stored in specials.media[])
      for (const { block } of templateFlatBlocks) {
        if (block.type !== 'gallery' || !block.specials?.media) continue;
        
        // Skip protected blocks
        if (block.id && protectedBlockIds.has(block.id)) {
          console.log(`[TemplateWizard] SKIP protected gallery: ${block.properties?.name}`);
          continue;
        }
        
        const media = block.specials.media;
        console.log(`[TemplateWizard] Gallery "${block.properties?.name}" with ${media.length} slides`);
        
        for (let mi = 0; mi < media.length; mi++) {
          const item = media[mi];
          if (item.type !== 'image') continue;
          
          const newSrc = finalImages[imgIdx % finalImages.length];
          const oldSrc = item.originLink || item.link || '';
          
          // Replace all URL fields in the media item
          if (item.originLink) item.originLink = newSrc;
          if (item.link) item.link = newSrc;
          if (item.src) item.src = newSrc;
          if (item.thumbnail) item.thumbnail = newSrc;
          
          replacements.push({
            blockName: `${block.properties?.name || 'gallery'}_slide_${mi}`,
            blockType: 'gallery-slide',
            oldSrc, newSrc, width: 420, height: 480,
          });
          imgIdx++;
        }
      }

      setTemplateImageReplacements(replacements);
      setProgress(`✅ Đã thay ${replacements.length} ảnh (gồm gallery)`);
      console.log(`[TemplateWizard] Replaced ${replacements.length} images total`);
    } catch (err) {
      setError(err.message);
      setProgress('');
    } finally {
      setIsLoading(false);
    }
  }, [templateProduct, templateFlatBlocks]);

  /** Step 2: Text replacement via Gemini */
  const handleTemplateProceedText = useCallback(async () => {
    setTemplateWizardStep(2);
    setIsLoading(true);
    setError(null);

    try {
      const textItems = [];
      for (const { block, index } of templateFlatBlocks) {
        if (block.type === 'text-block' && block.specials?.text) {
          const plain = block.specials.text.replace(/<[^>]+>/g, '').trim();
          if (plain.length > 0) textItems.push({ index, block, type: 'text', oldText: plain });
        }
        if (block.type === 'button' && block.specials?.text) {
          const plain = block.specials.text.replace(/<[^>]+>/g, '').trim();
          if (plain.length > 0) textItems.push({ index, block, type: 'button', oldText: plain });
        }
        if (block.type === 'input' && block.specials?.field_placeholder) {
          textItems.push({ index, block, type: 'placeholder', oldText: block.specials.field_placeholder });
        }
      }

      const product = templateProduct || { name: 'Sản phẩm', description: '', price: '' };
      const lang = config.language || 'Tiếng Việt';
      const isVietnamese = lang === 'Tiếng Việt';
      const model = config.model || 'gemini-2.0-flash';
      const allItems = textItems.map(t => ({ idx: t.index, type: t.type, text: t.oldText.substring(0, 200) }));

      // If target language is Vietnamese, single translation. Otherwise, dual translation.
      const prompt = isVietnamese
        ? `Bạn là chuyên gia dịch thuật và marketing. DỊCH và THAY THẾ toàn bộ nội dung landing page sang Tiếng Việt cho sản phẩm mới.

SẢN PHẨM MỚI:
- Tên: ${product.name}
- Mô tả: ${product.description || 'Sản phẩm chất lượng cao'}
- Giá: ${product.price || '299.000đ'}
- Giá gốc: ${product.originalPrice || '599.000đ'}

${allItems.length} text blocks:
${allItems.map(t => `[${t.idx}](${t.type}): "${t.text}"`).join('\n')}

QUY TẮC: DỊCH TẤT CẢ sang Tiếng Việt. Thay tên/giá/mô tả SP mới. Review viết lại hoàn toàn (tên Việt). Button/placeholder dịch sang Việt. Đơn vị tiền: đ/VNĐ.
Trả về JSON: {"items": [{"idx": 0, "text": "tiếng Việt"}]}
ĐẦY ĐỦ ${allItems.length} items. CHỈ JSON.`

        : `Bạn là chuyên gia dịch thuật và marketing đa ngôn ngữ. DỊCH nội dung landing page sang ${lang} cho sản phẩm mới. ĐỒNG THỜI cung cấp bản dịch Tiếng Việt để đối chiếu.

SẢN PHẨM MỚI:
- Tên: ${product.name}
- Mô tả: ${product.description || 'Sản phẩm chất lượng cao'}
- Giá: ${product.price || '299.000đ'}
- Giá gốc: ${product.originalPrice || '599.000đ'}

${allItems.length} text blocks:
${allItems.map(t => `[${t.idx}](${t.type}): "${t.text}"`).join('\n')}

QUY TẮC:
1. Dịch TẤT CẢ sang ${lang} (trường "text") — đây là bản xuất ra LDP
2. Đồng thời dịch sang Tiếng Việt (trường "vi") — để người Việt đối chiếu
3. Thay tên/giá/mô tả sản phẩm mới
4. Review: viết lại cho SP mới, tên người bản địa ${lang}
5. Button/placeholder: dịch sang ${lang}
6. Đơn vị tiền phù hợp với ${lang}

Trả về JSON: {"items": [{"idx": 0, "text": "bản ${lang}", "vi": "bản Tiếng Việt"}]}
ĐẦY ĐỦ ${allItems.length} items. CHỈ JSON.`;

      setProgress(`🌐 Đang dịch ${textItems.length} đoạn text sang ${lang}...`);

      // Call Gemini with retry
      let result = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          result = await callGeminiDirect(prompt, config.apiKey, model, 16384);
          break;
        } catch (err) {
          if ((err.message?.includes('429') || err.message?.includes('Resource')) && attempt < 3) {
            const waitSec = 10 * Math.pow(2, attempt - 1);
            setProgress(`⏳ Rate limit, đợi ${waitSec}s (${attempt}/3)...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
          } else throw err;
        }
      }

      const items = result?.items || (Array.isArray(result) ? result : []);

      // Map results back to textItems with both target lang + Vietnamese ref
      const replacements = textItems.map(t => {
        const match = items.find(r => r.idx === t.index);
        return {
          ...t,
          newText: match?.text || t.oldText,
          viRef: isVietnamese ? (match?.text || t.oldText) : (match?.vi || match?.text || t.oldText),
        };
      });

      setTemplateTextReplacements(replacements);
      setProgress(`✅ Đã dịch ${items.length} đoạn sang ${lang}`);
    } catch (err) {
      // Even if text fails, show what we have
      setError(`Lỗi dịch text: ${err.message}. Bạn vẫn có thể xuất PKE với ảnh mới.`);
      setProgress('');
      // Set empty text replacements so export button still shows
      const textItems = [];
      for (const { block, index } of templateFlatBlocks) {
        if (block.type === 'text-block' && block.specials?.text) {
          const plain = block.specials.text.replace(/<[^>]+>/g, '').trim();
          if (plain.length > 0) textItems.push({ index, block, type: 'text', oldText: plain, newText: plain });
        }
      }
      setTemplateTextReplacements(textItems);
    } finally {
      setIsLoading(false);
    }
  }, [templateFlatBlocks, templateProduct, config]);

  /** Update a single text replacement */
  const handleTemplateUpdateText = useCallback((idx, newText) => {
    setTemplateTextReplacements(prev => prev.map(t =>
      t.index === idx ? { ...t, newText } : t
    ));
  }, []);

  /** Update a single image replacement */
  const handleTemplateUpdateImage = useCallback((replacementIdx, newUrl) => {
    setTemplateImageReplacements(prev => {
      const updated = [...prev];
      if (updated[replacementIdx]) {
        const item = updated[replacementIdx];
        item.newSrc = newUrl;
        
        // Also update the actual PKE block data
        if (item.blockType === 'gallery-slide') {
          // Gallery slide: find the gallery block and update the media item
          for (const { block } of templateFlatBlocks) {
            if (block.type === 'gallery' && block.specials?.media) {
              const slideMatch = item.blockName.match(/_slide_(\d+)$/);
              if (slideMatch) {
                const slideIdx = parseInt(slideMatch[1]);
                const mediaItem = block.specials.media[slideIdx];
                if (mediaItem) {
                  if (mediaItem.originLink) mediaItem.originLink = newUrl;
                  if (mediaItem.link) mediaItem.link = newUrl;
                }
              }
            }
          }
        } else {
          // Regular image-block or rectangle
          for (const { block } of templateFlatBlocks) {
            if (block.specials?.src === item.oldSrc || block.specials?.src === prev[replacementIdx]?.newSrc) {
              block.specials.src = newUrl;
              if (block.responsive?.desktop?.styles?.background) {
                block.responsive.desktop.styles.background = 
                  block.responsive.desktop.styles.background.replace(/url\([^)]+\)/g, `url(${newUrl})`);
              }
              if (block.responsive?.mobile?.styles?.background) {
                block.responsive.mobile.styles.background = 
                  block.responsive.mobile.styles.background.replace(/url\([^)]+\)/g, `url(${newUrl})`);
              }
              break;
            }
          }
        }
      }
      return updated;
    });
  }, [templateFlatBlocks]);

  /** Step 3: Apply text + encode + download PKE */
  const handleTemplateExport = useCallback(() => {
    try {
      setProgress('💾 Đang áp dụng text và tạo PKE...');

      // Apply text replacements to PKE data
      for (const item of templateTextReplacements) {
        if (!item.newText || item.newText === item.oldText) continue;
        const { block, type, newText } = item;
        if (type === 'placeholder') {
          block.specials.field_placeholder = newText;
        } else if (block.specials?.text) {
          const oldHtml = block.specials.text;
          if (oldHtml.includes('<')) {
            // Preserve outermost HTML tags
            const match = oldHtml.match(/^(<[^>]+>)([\s\S]*)(<\/[^>]+>)$/);
            block.specials.text = match ? `${match[1]}${newText}${match[3]}` : newText;
          } else {
            block.specials.text = newText;
          }
        }
      }

      // Update page title
      const name = templateProduct?.name || 'Sản phẩm';
      if (templatePkeData.source.settings) {
        templatePkeData.source.settings.title = name;
      }
      templatePkeData.name = name;

      // Encode
      const newPkeBase64 = encodePke(templatePkeData);

      // Download
      const blob = new Blob([newPkeBase64], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}-page.pke`;
      a.click();
      URL.revokeObjectURL(url);

      setTemplateWizardStep(4);
      setProgress('✅ File PKE đã tải về!');
      setTimeout(() => setProgress(''), 5000);
    } catch (err) {
      setError(err.message);
    }
  }, [templatePkeData, templateTextReplacements, templateProduct]);

  // ===== NEW WIZARD FLOW =====
  
  /** Start wizard: Step 0 → Extract */
  const handleStartWizard = useCallback(async () => {
    setWizardMode(true);
    setWizardStep(0);
    setIsLoading(true);
    setError(null);
    setProductData(null);
    setLayoutHtml('');
    setContentItems([]);
    setFinalHtml(null);
    setGeneratedHtml(null);

    try {
      const data = await stepExtract(config, config.apiKey, (msg) => setProgress(msg));
      setProductData(data);
      setProgress('');
    } catch (err) {
      setError(err.message);
      setProgress('');
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  /** Step 0 → 1: Build layout */
  const handleBuildLayout = useCallback(() => {
    if (!productData) return;
    setWizardStep(1);
    setIsLoading(true);

    // Filter out excluded images
    const cleanData = {
      ...productData,
      images: (productData.images || []).filter(u => !u.startsWith('__EXCLUDED__')),
    };

    try {
      const html = stepBuildLayout(cleanData, config);
      setLayoutHtml(html);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [productData, config]);

  /** Layout step completed — proceed to content adjustment */
  const handleLayoutProceed = useCallback(async (processedHtml, skipTranslation) => {
    setLayoutHtml(processedHtml);
    
    if (skipTranslation) {
      // Skip content step → go directly to final
      try {
        const html = stepFinalize(processedHtml, config);
        setFinalHtml(html);
        setGeneratedHtml(html);
        setWizardStep(3);
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    
    // Proceed to content adjustment step
    setWizardStep(2);
    setIsLoading(true);
    setError(null);

    try {
      const textList = stepExtractTexts(processedHtml);
      setProgress(`Tìm thấy ${textList.length} đoạn text...`);
      
      const model = config.model || 'gemini-2.5-flash';
      const targetLang = config.language || 'Tiếng Việt';
      const cleanData = {
        ...productData,
        images: (productData.images || []).filter(u => !u.startsWith('__EXCLUDED__')),
      };
      
      const items = await stepReplaceContent(
        textList, cleanData, targetLang, config.apiKey, model, 
        (msg) => setProgress(msg)
      );
      
      setContentItems(items);
      setContentError(null);
      setProgress('');
    } catch (err) {
      setContentError(err.message);
      setProgress('');
    } finally {
      setIsLoading(false);
    }
  }, [productData, config]);

  /** Update a single content item */
  const handleUpdateContentItem = useCallback((index, newValue) => {
    setContentItems(prev => {
      const updated = [...prev];
      updated[index] = { 
        ...updated[index], 
        newContent: newValue,
        isChanged: newValue !== updated[index].clean,
      };
      return updated;
    });
  }, []);

  /** Step 2 → 3: Apply content changes & finalize */
  const handleContentApply = useCallback(() => {
    try {
      // Build translation map: {raw → newContent}
      const translationMap = contentItems.map(item => ({
        raw: item.raw,
        translated: item.newContent,
      }));
      let html = stepApplyTranslations(layoutHtml, translationMap);
      html = stepFinalize(html, config);
      setFinalHtml(html);
      setGeneratedHtml(html);
      setWizardStep(3);
    } catch (err) {
      setError(err.message);
    }
  }, [layoutHtml, contentItems, config]);

  /** Get current preview HTML for content step */
  const getContentPreviewHtml = useCallback(() => {
    if (!layoutHtml || contentItems.length === 0) return '';
    const translationMap = contentItems.map(item => ({
      raw: item.raw,
      translated: item.newContent,
    }));
    return stepApplyTranslations(layoutHtml, translationMap);
  }, [layoutHtml, contentItems]);

  const handleUpdateHtml = useCallback((newHtml) => {
    setGeneratedHtml(newHtml);
    setFinalHtml(newHtml);
  }, []);

  // ===== RENDER =====
  const showWizard = wizardMode && wizardStep < 3;
  const showFinalPreview = (wizardMode && wizardStep === 3) || (!wizardMode && generatedHtml);
  const showTemplateWizard = templateWizardMode && config.buildMode === 'template';

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Top bar — mobile only */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <span className="text-sm font-bold">LDP Generator</span>
        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-muted transition-colors">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Sidebar — fixed width, scrollable, border separator */}
        <div className="relative w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-r border-border">
          <ConfigForm
            config={config}
            setConfig={setConfig}
            onGenerate={handleGenerate}
            onStartWizard={handleStartWizard}
            isGenerating={isGenerating || isLoading}
            progress={progress}
            generatedHtml={generatedHtml}
          />
          <button
            onClick={toggleTheme}
            className="hidden lg:flex absolute top-4 right-4 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors z-20"
            title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex-shrink-0">
              <strong>Lỗi:</strong> {error}
              <button onClick={() => setError(null)} className="ml-2 underline text-xs">Đóng</button>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex border-b border-border flex-shrink-0">
            <button
              onClick={() => setActiveTab('template')}
              className={`flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'template'
                  ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              📦 Template PKE
            </button>
            <button
              onClick={() => setActiveTab('translate')}
              className={`flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'translate'
                  ? 'text-violet-500 border-b-2 border-violet-500 bg-violet-500/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              🌐 Dịch ảnh SP
            </button>
          </div>

          {/* Image Translator tab */}
          {activeTab === 'translate' && (
            <ImageTranslator apiKey={config.apiKey} model={config.model} />
          )}

          {/* Template PKE tab */}
          {activeTab === 'template' && (
            <>
          {/* Template wizard mode */}
          {showTemplateWizard && (
            <TemplateWizard
              step={templateWizardStep}
              productData={templateProduct}
              templateInfo={templateInfo}
              pkeData={templatePkeData}
              imageReplacements={templateImageReplacements}
              textReplacements={templateTextReplacements}
              isLoading={isLoading}
              progress={progress}
              error={error}
              onUpdateProduct={setTemplateProduct}
              onProceedImages={handleTemplateProceedImages}
              onProceedText={handleTemplateProceedText}
              onUpdateTextItem={handleTemplateUpdateText}
              onUpdateImage={handleTemplateUpdateImage}
              onExport={handleTemplateExport}
            />
          )}

          {/* Old wizard mode */}
          {showWizard && !showTemplateWizard && (
            <StepWizard currentStep={wizardStep} onStepChange={setWizardStep}>
              {wizardStep === 0 && (
                <StepExtract
                  productData={productData}
                  onChange={setProductData}
                  onNext={handleBuildLayout}
                  isLoading={isLoading}
                />
              )}
              {wizardStep === 1 && (
                <StepLayout
                  html={layoutHtml}
                  onProceed={handleLayoutProceed}
                  productImages={(productData?.images || []).filter(u => !u.startsWith('__EXCLUDED__'))}
                  onPrev={() => setWizardStep(0)}
                  isBuilding={isLoading}
                />
              )}
              {wizardStep === 2 && (
                <StepContentEdit
                  contentItems={contentItems}
                  onUpdateItem={handleUpdateContentItem}
                  onApply={handleContentApply}
                  onPrev={() => setWizardStep(1)}
                  onRetry={() => { setContentError(null); handleLayoutProceed(layoutHtml, false); }}
                  previewHtml={getContentPreviewHtml()}
                  isProcessing={isLoading}
                  progress={progress}
                  error={contentError}
                  currentModel={config.model}
                  onModelChange={(m) => setConfig(prev => ({ ...prev, model: m }))}
                  targetLang={config.language || 'Tiếng Việt'}
                />
              )}
            </StepWizard>
          )}

          {/* Final preview (after wizard step 3 or old flow) */}
          {showFinalPreview && !showTemplateWizard && (
            <PreviewPanel html={generatedHtml} onUpdateHtml={handleUpdateHtml} />
          )}

          {/* Empty state */}
          {!showWizard && !showFinalPreview && !showTemplateWizard && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Nhập thông tin và upload file PKE ở sidebar để bắt đầu
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
