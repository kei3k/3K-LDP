/**
 * Shopee product importer — scrape product page HTML via /api/fetch-url
 * (the Vite proxy injects anti-bot headers), extract title + image hashes,
 * download each image as base64 ready for the wizard's productImages state.
 */

const IMAGE_HOST = 'https://down-vn.img.susercontent.com/file';

/**
 * parseShopeeUrl — accept any Shopee product URL variant, return { shopid, itemid }.
 * Pattern: https://shopee.vn/<slug>-i.<shopid>.<itemid>
 */
export function parseShopeeUrl(url) {
  if (!url) return null;
  const m = url.match(/i\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { shopid: m[1], itemid: m[2] };
}

/**
 * fetchProductHtml — get raw HTML for a Shopee product page through the local proxy.
 */
async function fetchProductHtml(url) {
  const resp = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Fetch Shopee page failed (${resp.status}): ${err.substring(0, 200)}`);
  }
  return await resp.text();
}

/**
 * extractProductData — parse the HTML for title + image hashes + category breadcrumb.
 */
function extractProductData(html) {
  const ogTitleMatch = html.match(/og:title"\s+content="([^"]+)"/);
  const ogImageMatch = html.match(/og:image"\s+content="([^"]+)"/);
  const imagesMatch = html.match(/"images":\[([^\]]+)\]/);

  const name = ogTitleMatch
    ? ogTitleMatch[1].replace(/\s*\|\s*Shopee.*$/, '').replace(/&amp;/g, '&').trim()
    : '';

  let imageHashes = [];
  if (imagesMatch) {
    imageHashes = imagesMatch[1].match(/"([^"]+)"/g)?.map(s => s.slice(1, -1)) || [];
  }
  if (imageHashes.length === 0 && ogImageMatch) {
    const single = ogImageMatch[1].match(/file\/([a-z0-9_-]+)/i);
    if (single) imageHashes = [single[1]];
  }

  const breadcrumb = [];
  const breadRe = /"BreadcrumbList".*?"itemListElement":\[(.*?)\]\}/s;
  const breadMatch = html.match(breadRe);
  if (breadMatch) {
    const items = breadMatch[1].match(/"name":"([^"]+)"/g) || [];
    items.forEach(it => {
      const v = it.match(/"name":"([^"]+)"/);
      if (v && v[1] !== 'Shopee') breadcrumb.push(v[1]);
    });
  }

  return { name, imageHashes, breadcrumb };
}

/**
 * downloadImageAsBase64 — fetch an image through the proxy and return base64 + mime.
 */
async function downloadImageAsBase64(url) {
  const resp = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
  if (!resp.ok) throw new Error(`Image fetch failed (${resp.status})`);
  const blob = await resp.blob();
  const arrayBuf = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return {
    mimeType: blob.type || 'image/jpeg',
    data: btoa(bin),
    blob,
  };
}

/**
 * importFromShopee — main entry. Takes a Shopee URL, returns:
 * { name, breadcrumb, productImages: [{ id, name, mimeType, data, preview }] }
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.maxImages=6]   - cap how many images to download
 * @param {(msg: string) => void} [opts.onProgress]
 */
export async function importFromShopee(url, opts = {}) {
  const { maxImages = 6, onProgress } = opts;

  const ids = parseShopeeUrl(url);
  if (!ids) throw new Error('URL không phải Shopee product page (cần dạng .../i.SHOPID.ITEMID)');

  onProgress?.('Đang lấy thông tin sản phẩm từ Shopee...');
  const html = await fetchProductHtml(url);
  const { name, imageHashes, breadcrumb } = extractProductData(html);

  if (!imageHashes.length) {
    throw new Error('Không tìm thấy ảnh nào trên trang Shopee này (page có thể đã đổi format)');
  }

  const hashes = imageHashes.slice(0, maxImages);
  const productImages = [];

  for (let i = 0; i < hashes.length; i++) {
    const hash = hashes[i];
    const imgUrl = `${IMAGE_HOST}/${hash}`;
    onProgress?.(`Tải ảnh ${i + 1}/${hashes.length}...`);
    try {
      const { mimeType, data, blob } = await downloadImageAsBase64(imgUrl);
      productImages.push({
        id: crypto.randomUUID(),
        name: `shopee_${hash.slice(0, 12)}.jpg`,
        mimeType,
        data,
        preview: URL.createObjectURL(blob),
      });
    } catch (e) {
      console.warn(`Skip image ${hash}: ${e.message}`);
    }
  }

  if (!productImages.length) {
    throw new Error('Tải ảnh Shopee thất bại — proxy có thể đã bị chặn');
  }

  return { name, breadcrumb, productImages };
}
