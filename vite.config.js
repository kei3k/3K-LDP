import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import https from 'https'
import http from 'http'
import { GoogleAuth } from 'google-auth-library'
import { Storage } from '@google-cloud/storage'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { promises as fs } from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Lazy GoogleAuth — only init if env present
  let auth = null
  function getAuth() {
    if (auth) return auth
    if (!env.VERTEX_KEY_FILE || !env.VERTEX_PROJECT_ID) return null
    auth = new GoogleAuth({
      keyFile: path.resolve(env.VERTEX_KEY_FILE),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    return auth
  }

  let storage = null
  function getStorage() {
    if (storage) return storage
    if (!env.VERTEX_KEY_FILE || !env.VERTEX_PROJECT_ID) return null
    storage = new Storage({
      keyFilename: path.resolve(env.VERTEX_KEY_FILE),
      projectId: env.VERTEX_PROJECT_ID,
    })
    return storage
  }

  const BUCKET_NAME = env.VERTEX_PROJECT_ID ? `${env.VERTEX_PROJECT_ID}-video-pipeline`.toLowerCase().replace(/[^a-z0-9-]/g, '-') : null
  let bucketReady = false
  async function ensureBucket() {
    if (bucketReady) return BUCKET_NAME
    const s = getStorage()
    if (!s) throw new Error('Storage not configured')
    const bucket = s.bucket(BUCKET_NAME)
    const [exists] = await bucket.exists()
    if (!exists) {
      console.log('[VertexUpload] Creating bucket:', BUCKET_NAME)
      await s.createBucket(BUCKET_NAME, { location: 'US', storageClass: 'STANDARD' })
    }
    bucketReady = true
    return BUCKET_NAME
  }

  return {
  plugins: [
    react(),
    tailwindcss(),
    // Vertex AI proxy — signs JWT server-side, auto-refreshes token
    {
      name: 'vertex-proxy',
      configureServer(server) {
        server.middlewares.use('/api/vertex', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end(JSON.stringify({ error: 'POST only' }))
            return
          }
          const a = getAuth()
          if (!a) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: 'Vertex AI not configured. Set VERTEX_KEY_FILE and VERTEX_PROJECT_ID in .env',
            }))
            return
          }
          const region = env.VERTEX_REGION || 'us-central1'
          const project = env.VERTEX_PROJECT_ID
          // Path expected: /api/vertex/models/{model}:{method}  OR  /api/vertex/operations
          const subPath = req.url.replace(/^\/+/, '')
          let upstreamPath
          if (subPath.startsWith('models/')) {
            upstreamPath = `/v1/projects/${project}/locations/${region}/publishers/google/${subPath}`
          } else if (subPath === 'operations') {
            // Body must contain { model, operationName } — call fetchPredictOperation
            upstreamPath = null // handled below
          } else {
            res.statusCode = 400
            res.end(JSON.stringify({ error: `Unknown vertex path: ${subPath}` }))
            return
          }

          try {
            // Collect raw body
            const chunks = []
            for await (const c of req) chunks.push(c)
            const raw = Buffer.concat(chunks).toString('utf-8')
            let body
            try { body = JSON.parse(raw) } catch { body = {} }

            // Special case for poll: rewrite to fetchPredictOperation
            if (subPath === 'operations') {
              if (!body.model || !body.operationName) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'operations requires { model, operationName }' }))
                return
              }
              upstreamPath = `/v1/projects/${project}/locations/${region}/publishers/google/models/${body.model}:fetchPredictOperation`
              body = { operationName: body.operationName }
            }

            const client = await a.getClient()
            const tokenResp = await client.getAccessToken()
            const token = tokenResp.token
            const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`
            const upstream = `https://${host}${upstreamPath}`
            console.log('[VertexProxy]', subPath, '→', upstreamPath)

            const upstreamResp = await fetch(upstream, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(body),
            })
            const respText = await upstreamResp.text()
            res.statusCode = upstreamResp.status
            res.setHeader('Content-Type', 'application/json')
            res.end(respText)
          } catch (e) {
            console.error('[VertexProxy] Error:', e.message)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e.message }))
          }
        })

        // Upload binary (video) to GCS, return gs:// URI for Vertex fileData
        server.middlewares.use('/api/vertex-upload', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end(JSON.stringify({ error: 'POST only' }))
            return
          }
          try {
            const bucketName = await ensureBucket()
            const contentType = req.headers['content-type'] || ''
            // Parse multipart manually (file part only, no extra fields needed)
            const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType)
            if (!boundaryMatch) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing multipart boundary' }))
              return
            }
            const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]).trim()
            const chunks = []
            for await (const c of req) chunks.push(c)
            const raw = Buffer.concat(chunks)
            // Locate first part headers/body
            const bIdx = raw.indexOf(boundary)
            const hdrEnd = raw.indexOf('\r\n\r\n', bIdx)
            if (hdrEnd < 0) throw new Error('Malformed multipart')
            const headers = raw.slice(bIdx, hdrEnd).toString('utf-8')
            const filenameMatch = /filename="([^"]+)"/.exec(headers)
            const ctMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headers)
            const filename = filenameMatch ? filenameMatch[1] : 'upload.bin'
            const mimeType = ctMatch ? ctMatch[1].trim() : 'application/octet-stream'
            const closing = Buffer.from('\r\n' + boundary)
            const bodyStart = hdrEnd + 4
            const bodyEnd = raw.indexOf(closing, bodyStart)
            if (bodyEnd < 0) throw new Error('Cannot locate part end')
            const fileBuf = raw.slice(bodyStart, bodyEnd)

            const objectName = `videos/${Date.now()}-${randomUUID().slice(0, 8)}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
            const file = getStorage().bucket(bucketName).file(objectName)
            console.log('[VertexUpload]', objectName, fileBuf.length, 'bytes')
            await file.save(fileBuf, { contentType: mimeType, resumable: false })

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              fileUri: `gs://${bucketName}/${objectName}`,
              mimeType,
              size: fileBuf.length,
            }))
          } catch (e) {
            console.error('[VertexUpload] Error:', e.message)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e.message }))
          }
        })

        // Expose proxy status for frontend to detect config state
        server.middlewares.use('/api/vertex-status', (req, res) => {
          const ready = !!(env.VERTEX_KEY_FILE && env.VERTEX_PROJECT_ID)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            ready,
            projectId: env.VERTEX_PROJECT_ID || null,
            region: env.VERTEX_REGION || 'us-central1',
          }))
        })
      }
    },
    // Native ffmpeg compressor — receives raw mp4 body, returns compressed mp4 (audio preserved)
    {
      name: 'video-compressor',
      configureServer(server) {
        server.middlewares.use('/api/compress-video', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('POST only')
            return
          }
          const id = randomUUID()
          const inPath = path.join(tmpdir(), `vc_in_${id}.mp4`)
          const outPath = path.join(tmpdir(), `vc_out_${id}.mp4`)
          try {
            // Stream request body to temp file
            const fh = await fs.open(inPath, 'w')
            const ws = fh.createWriteStream()
            await new Promise((resolve, reject) => {
              req.pipe(ws)
              req.on('end', resolve)
              req.on('error', reject)
              ws.on('error', reject)
            })
            console.log(`[Compress] Input saved: ${inPath} (${(await fs.stat(inPath)).size} bytes)`)

            // Run native ffmpeg: 480p, h264 fast, aac audio 64k, target ~10MB for 60s
            await new Promise((resolve, reject) => {
              const ff = spawn('ffmpeg', [
                '-y',
                '-i', inPath,
                '-vf', 'scale=-2:480',
                '-c:v', 'libx264',
                '-preset', 'veryfast',
                '-crf', '30',
                '-c:a', 'aac',
                '-b:a', '64k',
                '-ac', '1',
                '-movflags', '+faststart',
                outPath,
              ])
              let stderr = ''
              ff.stderr.on('data', (c) => { stderr += c.toString() })
              ff.on('close', (code) => {
                if (code === 0) resolve()
                else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`))
              })
              ff.on('error', reject)
            })
            const outBuf = await fs.readFile(outPath)
            console.log(`[Compress] Output: ${outBuf.length} bytes`)
            res.statusCode = 200
            res.setHeader('Content-Type', 'video/mp4')
            res.setHeader('Content-Length', outBuf.length)
            res.end(outBuf)
          } catch (e) {
            console.error('[Compress] Error:', e.message)
            res.statusCode = 500
            res.setHeader('Content-Type', 'text/plain')
            res.end(e.message)
          } finally {
            fs.unlink(inPath).catch(() => {})
            fs.unlink(outPath).catch(() => {})
          }
        })
      }
    },
    // Audio swap — replaces video's audio track with a new audio file (Clone Voice feature)
    // Two endpoints: upload (slot=video|audio) + run (trigger ffmpeg)
    {
      name: 'swap-audio',
      configureServer(server) {
        server.middlewares.use('/api/swap-audio', async (req, res) => {
          const parsedUrl = new URL(req.url, 'http://localhost')
          const pathname = parsedUrl.pathname  // '/upload' or '/run'
          const id = parsedUrl.searchParams.get('id') || ''
          const slot = parsedUrl.searchParams.get('slot') || ''

          if (req.method !== 'POST') {
            res.statusCode = 405; res.end('POST only'); return
          }
          if (!id) {
            res.statusCode = 400; res.end('Missing id param'); return
          }

          // ── Upload endpoint: save raw body to temp file ──────────────────
          if (pathname === '/upload' || pathname === '/api/swap-audio/upload') {
            if (!['video', 'audio'].includes(slot)) {
              res.statusCode = 400; res.end('slot must be video or audio'); return
            }
            const ext = slot === 'video' ? 'mp4' : 'audio'
            const tmpPath = path.join(tmpdir(), `sa_${id}_${slot}.${ext}`)
            try {
              const fh = await fs.open(tmpPath, 'w')
              const ws = fh.createWriteStream()
              await new Promise((resolve, reject) => {
                req.pipe(ws)
                req.on('end', resolve)
                req.on('error', reject)
                ws.on('error', reject)
              })
              console.log(`[SwapAudio] Saved ${slot}: ${tmpPath}`)
              res.statusCode = 200; res.end('ok')
            } catch (e) {
              console.error('[SwapAudio] Upload error:', e.message)
              res.statusCode = 500; res.end(e.message)
            }
            return
          }

          // ── Run endpoint: ffmpeg swap then stream result ──────────────────
          if (pathname === '/run' || pathname === '/api/swap-audio/run') {
            const videoPath = path.join(tmpdir(), `sa_${id}_video.mp4`)
            const audioPath = path.join(tmpdir(), `sa_${id}_audio.audio`)
            const outPath   = path.join(tmpdir(), `sa_${id}_out.mp4`)
            try {
              // Verify both files exist
              await fs.access(videoPath)
              await fs.access(audioPath)

              let stderr = ''
              await new Promise((resolve, reject) => {
                const ff = spawn('ffmpeg', [
                  '-y',
                  '-i', videoPath,
                  '-i', audioPath,
                  '-map', '0:v',
                  '-map', '1:a',
                  '-c:v', 'copy',
                  '-c:a', 'aac',
                  '-shortest',
                  outPath,
                ])
                ff.stderr.on('data', (c) => { stderr += c.toString() })
                ff.on('close', (code) => {
                  if (code === 0) resolve()
                  else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-600)}`))
                })
                ff.on('error', (e) => reject(new Error(`spawn error: ${e.message}`)))
              })

              const outBuf = await fs.readFile(outPath)
              console.log(`[SwapAudio] Output: ${outBuf.length} bytes`)
              res.statusCode = 200
              res.setHeader('Content-Type', 'video/mp4')
              res.setHeader('Content-Length', outBuf.length)
              res.end(outBuf)
            } catch (e) {
              console.error('[SwapAudio] Run error:', e.message)
              res.statusCode = 500
              res.setHeader('Content-Type', 'text/plain')
              res.end(e.message)
            } finally {
              fs.unlink(videoPath).catch(() => {})
              fs.unlink(audioPath).catch(() => {})
              fs.unlink(outPath).catch(() => {})
            }
            return
          }

          res.statusCode = 404; res.end('Not found')
        })
      }
    },
    // Local proxy to fetch external URLs — bypasses CORS
    {
      name: 'fetch-proxy',
      configureServer(server) {
        server.middlewares.use('/api/fetch-url', async (req, res) => {
          const url = new URL(req.url, 'http://localhost').searchParams.get('url');
          if (!url) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url param' }));
            return;
          }
          
          try {
            const result = await fetchWithRedirects(url, 5);
            
            // Binary mode: if content-type is image, return raw buffer
            if (result.contentType && result.contentType.startsWith('image/')) {
              res.setHeader('Content-Type', result.contentType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(result.buffer);
            } else {
              // Text mode: return as UTF-8 string
              const html = result.buffer.toString('utf-8');
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(html);
            }
          } catch (e) {
            console.error('[Proxy] Error:', e.message);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      }
    }
  ],
  server: {
    open: !process.env.DOCKER,
    headers: {
      // Required by ffmpeg.wasm (SharedArrayBuffer)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  }
})

/**
 * Fetch URL using Node.js native https/http modules
 * Handles redirects, SSL, and sets proper browser-like headers
 */
function fetchWithRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/jpeg,image/png,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        // Add Referer for alicdn.com images (prevents 403)
        ...(parsedUrl.hostname.includes('alicdn.com') || parsedUrl.hostname.includes('1688.com')
          ? { 'Referer': 'https://detail.1688.com/' }
          : {}),
        // Shopee anti-bot bypass headers
        ...(parsedUrl.hostname.includes('shopee.vn') || parsedUrl.hostname.includes('susercontent.com') || parsedUrl.hostname.includes('shopeemobile.com')
          ? {
              'Referer': 'https://shopee.vn/',
              'X-API-SOURCE': 'pc',
              'X-Requested-With': 'XMLHttpRequest',
              'X-Shopee-Language': 'vi',
              'af-ac-enc-dat': 'null',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-origin',
            }
          : {}),
      },
      rejectUnauthorized: false, // Accept self-signed certs
    };

    const req = client.request(options, (response) => {
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        const redirectUrl = new URL(response.headers.location, url).href;
        console.log('[Proxy] Redirect:', response.statusCode, '->', redirectUrl);
        fetchWithRedirects(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode} from ${url}`));
      }

      const chunks = [];
      const contentType = response.headers['content-type'] || '';
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('[Proxy] Success:', url, '- Size:', buffer.length, '- Type:', contentType);
        resolve({ buffer, contentType });
      });
      response.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout (15s)'));
    });
    req.end();
  });
}
