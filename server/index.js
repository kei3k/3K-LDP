// Production server for the "3K-LDP AI Video Tool" workspace (customer: Nam).
// Serves the built SPA (dist/) + the 7 API middlewares (ported from
// vite.config.js's dev-only configureServer) behind a Zumia-SSO gate.
import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createVertexHandlers } from './handlers/vertex.js'
import { compressVideo, swapAudio, createCloneTxHandler } from './handlers/ffmpeg.js'
import { createFetchUrlHandler } from './handlers/fetchUrl.js'
import { createAuthGate, LOGIN_PAGE_HTML } from './middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')

const env = process.env
const PORT = env.PORT || 5175

const app = express()
app.disable('x-powered-by')

// ── Auth gate (Zumia SSO via Supabase) ────────────────────────────────────
const auth = createAuthGate(env)

app.get('/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(LOGIN_PAGE_HTML)
})
// IMPORTANT: json parsing is scoped to /auth/* only. The vertex/ffmpeg
// handlers below read the raw request stream themselves (multipart video
// uploads, raw mp4 bodies) — a global body-parser would consume the
// stream before they get to it and break every upload endpoint.
app.post('/auth/login', express.json({ limit: '10kb' }), auth.login)
app.post('/auth/logout', auth.logout)

// Everything below this line requires a valid, allow-listed session.
app.use(auth.requireSession)

// ── Vertex AI proxy ────────────────────────────────────────────────────────
const vertex = createVertexHandlers(env)
app.use('/api/vertex-upload', vertex.vertexUpload) // define before /api/vertex (path is a prefix)
app.get('/api/vertex-status', vertex.vertexStatus)
app.use('/api/vertex', vertex.vertexProxy)

// ── ffmpeg endpoints ───────────────────────────────────────────────────────
app.post('/api/compress-video', compressVideo)
app.all('/api/swap-audio*', swapAudio)
app.all('/api/clone-tx*', createCloneTxHandler(env))

// ── URL fetch proxy (SSRF-guarded) ────────────────────────────────────────
app.get('/api/fetch-url', createFetchUrlHandler(env))

// ── Static SPA ─────────────────────────────────────────────────────────────
app.use(express.static(DIST_DIR, { index: false }))
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[3K-LDP Tool] listening on 127.0.0.1:${PORT}`)
  console.log(`[3K-LDP Tool] Vertex configured: ${!!(env.VERTEX_KEY_FILE && env.VERTEX_PROJECT_ID)}`)
})
