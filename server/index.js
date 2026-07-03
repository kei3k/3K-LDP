// Production server for the "3K-LDP AI Video Tool" workspace (customer: Nam).
// Serves the built SPA (dist/) + the API middlewares behind a self-managed
// local auth gate (Nam admins his own company's employees — no Supabase SSO).
import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createVertexHandlers } from './handlers/vertex.js'
import { compressVideo, swapAudio, createCloneTxHandler } from './handlers/ffmpeg.js'
import { createFetchUrlHandler } from './handlers/fetchUrl.js'
import { createAuthGate, LOGIN_PAGE_HTML } from './middleware/auth.js'
import { quotaGate } from './usage/usage.js'
import { usageSummaryJson, usagePageHtml } from './usage/usageRoute.js'
import { seedAdminIfEmpty } from './store/users.js'
import { adminPageHtml, createEmployeeHandler, setActiveHandler, resetPasswordHandler } from './admin/adminRoute.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')

const env = process.env
const PORT = env.PORT || 5175

// ── Bootstrap the local user store (first boot only) ──────────────────────
const seedResult = seedAdminIfEmpty(env)
if (seedResult.seeded) {
  console.log('[Users] Seeded first admin account:', seedResult.adminEmail)
  console.log('[Users] Bootstrap password (shown once, save it now):', seedResult.adminPassword)
} else {
  console.log('[Users] User store already initialized, skipping seed.')
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)

// ── Auth gate (self-managed: local email+password, no Supabase/Google) ────
const auth = createAuthGate(env)

app.get('/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(LOGIN_PAGE_HTML)
})
// IMPORTANT: json parsing is scoped to /auth/* and /admin/* only. The
// vertex/ffmpeg handlers below read the raw request stream themselves
// (multipart video uploads, raw mp4 bodies) — a global body-parser would
// consume the stream before they get to it and break every upload endpoint.
app.post('/auth/login', express.json({ limit: '10kb' }), auth.login)
app.post('/auth/logout', auth.logout)

// Everything below this line requires a valid local session.
app.use(auth.requireSession)

// GET /auth/me — lets the SPA know who is logged in + their role, so it
// can show/hide role-gated UI (e.g. the admin tab). Role is re-read from
// the DB on every request via requireSession, never trusted from client.
app.get('/auth/me', (req, res) => {
  res.json({ email: req.zumiaUser.email, role: req.zumiaUser.role })
})

// ── Admin panel (role=admin only) ─────────────────────────────────────────
// requireAdmin MUST be mounted before any /admin route handler, otherwise
// Express matches app.get('/admin', ...) first and never reaches the gate.
app.use('/admin', auth.requireAdmin)
app.get('/admin', adminPageHtml(env))
app.post('/admin/users', express.json({ limit: '10kb' }), createEmployeeHandler)
app.post('/admin/users/:id/active', express.json({ limit: '10kb' }), setActiveHandler)
app.post('/admin/users/:id/password', express.json({ limit: '10kb' }), resetPasswordHandler)

// ── Usage admin view (session gate above + role=admin gate inside) ────────
app.get('/api/usage/summary', usageSummaryJson(env))
app.get('/usage', usagePageHtml(env))

// ── Vertex AI proxy ────────────────────────────────────────────────────────
// Metered: each of these calls costs money (Vertex generateContent /
// predict / video ops), so quotaGate logs + enforces NAM_QUOTA_PER_EMAIL
// before the handler runs.
const vertex = createVertexHandlers(env)
app.use('/api/vertex-upload', quotaGate(env, 'vertex-upload'), vertex.vertexUpload) // define before /api/vertex (path is a prefix)
app.get('/api/vertex-status', vertex.vertexStatus)
app.use('/api/vertex', quotaGate(env, 'vertex'), vertex.vertexProxy)

// ── ffmpeg endpoints ───────────────────────────────────────────────────────
app.post('/api/compress-video', compressVideo)
app.all('/api/swap-audio*', swapAudio)
// clone-tx's /stt sub-route calls Vertex directly (bypasses vertexProxy),
// so it is metered too; /upload and /assemble sub-routes are local ffmpeg
// only and stay unmetered. Sub-route is parsed the same way the handler
// itself parses it (req.url with the /api/clone-tx prefix stripped).
app.all('/api/clone-tx*', (req, res, next) => {
  const sub = new URL(req.url, 'http://localhost').pathname.replace('/api/clone-tx', '') || '/'
  if (sub === '/stt') {
    return quotaGate(env, 'clone-tx-stt')(req, res, next)
  }
  next()
}, createCloneTxHandler(env))

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
