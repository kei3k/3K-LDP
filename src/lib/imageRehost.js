/**
 * Image Re-hosting via ImgBB
 * 
 * Finds external image URLs in HTML and re-uploads them to ImgBB
 * so they work on any platform (Webcake, Vercel, etc.)
 */

const IMGBB_API_KEY = 'c82284897280ed2e46a1f3e5be11238b';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

/**
 * Upload a single image URL to ImgBB
 * @param {string} imageUrl - The source image URL
 * @returns {string|null} The new ImgBB URL, or null on failure
 */
async function uploadToImgBB(imageUrl) {
  try {
    // Fetch image as blob
    const response = await fetch(imageUrl, { mode: 'cors' });
    if (!response.ok) {
      // If CORS fails, try via proxy or just skip
      console.warn(`[ImgBB] Failed to fetch: ${imageUrl} (${response.status})`);
      return null;
    }

    const blob = await response.blob();
    
    // Convert to base64
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        // Strip "data:image/png;base64," prefix
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });

    // Upload to ImgBB
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64);

    const uploadRes = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    const data = await uploadRes.json();
    if (data.success) {
      console.log(`[ImgBB] ✅ Uploaded: ${data.data.url}`);
      return data.data.url;
    } else {
      console.warn(`[ImgBB] Upload failed:`, data);
      return null;
    }
  } catch (err) {
    console.warn(`[ImgBB] Error uploading ${imageUrl}:`, err.message);
    return null;
  }
}

/**
 * Domains that need re-hosting (blocked by hotlink protection)
 */
const REHOST_DOMAINS = [
  'cbu01.alicdn.com',
  'cbu02.alicdn.com',
  'cbu03.alicdn.com',
  'cbu04.alicdn.com',
  'img.alicdn.com',
  'img.1688.com',
  'gd1.alicdn.com',
  'gd2.alicdn.com',
  'gd3.alicdn.com',
  'gd4.alicdn.com',
  'sc01.alicdn.com',
  'sc02.alicdn.com',
  'sc03.alicdn.com',
  'sc04.alicdn.com',
];

function needsRehosting(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return REHOST_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

/**
 * Extract all image URLs from HTML that need re-hosting
 */
function extractImageUrls(html) {
  const urls = new Set();
  
  // <img src="...">
  const imgRegex = /(?:src|data-src)=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    if (needsRehosting(m[1])) urls.add(m[1]);
  }
  
  // background-image: url(...)
  const bgRegex = /url\(["']?([^"')]+)["']?\)/gi;
  while ((m = bgRegex.exec(html)) !== null) {
    if (needsRehosting(m[1])) urls.add(m[1]);
  }
  
  return [...urls];
}

/**
 * Re-host all external images in HTML and return the updated HTML
 * @param {string} html - The HTML string
 * @param {function} onProgress - Optional progress callback
 * @returns {Promise<string>} Updated HTML with re-hosted image URLs
 */
export async function rehostImages(html, onProgress) {
  const urls = extractImageUrls(html);
  
  if (urls.length === 0) {
    onProgress?.('✅ Không có ảnh cần re-host');
    return html;
  }
  
  onProgress?.(`🖼️ Đang re-host ${urls.length} ảnh lên ImgBB...`);
  
  const urlMap = new Map(); // old URL -> new URL
  
  // Upload in batches of 3 to avoid rate limiting
  const BATCH_SIZE = 3;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(url => uploadToImgBB(url)));
    
    batch.forEach((url, idx) => {
      if (results[idx]) {
        urlMap.set(url, results[idx]);
      }
    });
    
    const done = Math.min(i + BATCH_SIZE, urls.length);
    onProgress?.(`🖼️ Re-host ảnh: ${done}/${urls.length}`);
  }
  
  // Replace all URLs in HTML
  let result = html;
  for (const [oldUrl, newUrl] of urlMap) {
    // Replace all occurrences
    result = result.split(oldUrl).join(newUrl);
  }
  
  const successCount = urlMap.size;
  const failCount = urls.length - successCount;
  onProgress?.(`✅ Re-host xong: ${successCount} thành công${failCount > 0 ? `, ${failCount} thất bại` : ''}`);
  
  return result;
}
