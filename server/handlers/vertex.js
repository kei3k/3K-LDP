// Vertex AI proxy — signs JWT server-side, auto-refreshes token.
// Extracted from vite.config.js (dev-only middleware) so it also runs
// under the production Express server (see server/index.js).
import path from 'path'
import { GoogleAuth } from 'google-auth-library'
import { Storage } from '@google-cloud/storage'
import { randomUUID } from 'crypto'

export function createVertexHandlers(env) {
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

  const BUCKET_NAME = env.VERTEX_PROJECT_ID
    ? `${env.VERTEX_PROJECT_ID}-video-pipeline`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    : null
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

  // POST /api/vertex/*
  async function vertexProxy(req, res) {
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
    const subPath = req.url.replace(/^\/+/, '')
    let upstreamPath
    if (subPath.startsWith('models/')) {
      upstreamPath = `/v1/projects/${project}/locations/${region}/publishers/google/${subPath}`
    } else if (subPath === 'operations') {
      upstreamPath = null
    } else {
      res.statusCode = 400
      res.end(JSON.stringify({ error: `Unknown vertex path: ${subPath}` }))
      return
    }

    try {
      const chunks = []
      for await (const c of req) chunks.push(c)
      const raw = Buffer.concat(chunks).toString('utf-8')
      let body
      try { body = JSON.parse(raw) } catch { body = {} }

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
  }

  // POST /api/vertex-upload
  async function vertexUpload(req, res) {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end(JSON.stringify({ error: 'POST only' }))
      return
    }
    try {
      const bucketName = await ensureBucket()
      const contentType = req.headers['content-type'] || ''
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
  }

  // GET /api/vertex-status
  function vertexStatus(req, res) {
    const ready = !!(env.VERTEX_KEY_FILE && env.VERTEX_PROJECT_ID)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      ready,
      projectId: env.VERTEX_PROJECT_ID || null,
      region: env.VERTEX_REGION || 'us-central1',
    }))
  }

  return { vertexProxy, vertexUpload, vertexStatus, getAuth }
}
