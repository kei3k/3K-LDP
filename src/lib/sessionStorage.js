/**
 * Session persistence for the AI Video Pipeline wizard.
 * Uses IndexedDB so Blob data (ref images, Veo clips, final mp4) survives a page refresh.
 * Object URLs are NOT persisted — they're regenerated on load from the underlying Blob/base64.
 */

const DB_NAME = 'video_pipeline_db';
const STORE = 'sessions';
const KEY = 'current';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(data) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(stripUrls(data), KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[sessionStorage] save failed:', e);
  }
}

export async function loadSession() {
  try {
    const db = await openDB();
    const raw = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    return raw ? rehydrate(raw) : null;
  } catch (e) {
    console.error('[sessionStorage] load failed:', e);
    return null;
  }
}

export async function clearSession() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[sessionStorage] clear failed:', e);
  }
}

// ---------- helpers ----------

function stripUrls(session) {
  if (!session) return session;
  const out = { ...session };
  if (out.assets?.productImages) {
    out.assets = {
      ...out.assets,
      productImages: out.assets.productImages.map(({ preview, ...rest }) => rest),
    };
  }
  if (Array.isArray(out.refImages)) {
    out.refImages = out.refImages.map(({ previewUrl, ...rest }) => rest);
  }
  return out;
}

function previewFromBase64(b64, mime) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime || 'image/jpeg' }));
}

function rehydrate(session) {
  if (!session) return null;
  const out = { ...session };
  if (out.assets?.productImages) {
    out.assets = {
      ...out.assets,
      productImages: out.assets.productImages.map((img) => ({
        ...img,
        preview: img.data ? previewFromBase64(img.data, img.mimeType) : null,
      })),
    };
  }
  if (Array.isArray(out.refImages)) {
    out.refImages = out.refImages.map((r) => ({
      ...r,
      previewUrl: r.blob ? URL.createObjectURL(r.blob) : null,
    }));
  }
  return out;
}
