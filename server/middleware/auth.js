// Zumia SSO gate for this workspace.
//
// Design (chosen for simplicity + no client build changes):
//   - POST /auth/login {email,password} → server calls Supabase
//     signInWithPassword using the SAME Supabase project as main Zumia
//     (SUPABASE_URL/SUPABASE_ANON_KEY, reused from backend/.env) → on
//     success sets an httpOnly, secure, samesite=lax session cookie
//     containing the Supabase access token. No client-side Supabase JS,
//     no CSP relaxation needed (avoids loading Supabase from a CDN into
//     this untouched React SPA).
//   - Every other request (static app + all /api/*) is gated behind
//     requireSession: verifies the cookie's token via supabase.auth.getUser(),
//     then checks the resulting email against NAM_ALLOWED_EMAILS allowlist.
//   - GET /login serves a minimal static HTML form (no framework) that
//     posts to /auth/login.
import { createClient } from '@supabase/supabase-js'

const COOKIE_NAME = 'zumia_tool_session'

export function createAuthGate(env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  const allowlist = new Set(
    (env.NAM_ALLOWED_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )

  function parseCookies(req) {
    const header = req.headers.cookie || ''
    const out = {}
    header.split(';').forEach((pair) => {
      const idx = pair.indexOf('=')
      if (idx < 0) return
      const k = pair.slice(0, idx).trim()
      const v = pair.slice(idx + 1).trim()
      if (k) out[k] = decodeURIComponent(v)
    })
    return out
  }

  function setSessionCookie(res, token, maxAgeSeconds) {
    const attrs = [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAgeSeconds}`,
    ]
    if (env.NODE_ENV === 'production') attrs.push('Secure')
    res.setHeader('Set-Cookie', attrs.join('; '))
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`)
  }

  // POST /auth/login
  async function login(req, res) {
    try {
      let body = req.body
      if (!body) {
        const chunks = []
        for await (const c of req) chunks.push(c)
        body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
      }
      const { email, password } = body
      if (!email || !password) {
        res.status(400).json({ error: 'Missing email/password' })
        return
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data?.session) {
        res.status(401).json({ error: error?.message || 'Invalid credentials' })
        return
      }
      const userEmail = (data.user?.email || '').toLowerCase()
      if (!allowlist.has(userEmail)) {
        res.status(403).json({ error: 'Email not authorized for this workspace' })
        return
      }
      setSessionCookie(res, data.session.access_token, data.session.expires_in || 3600)
      res.status(200).json({ ok: true, email: userEmail })
    } catch (e) {
      console.error('[Auth/login] Error:', e.message)
      res.status(500).json({ error: e.message })
    }
  }

  function logout(req, res) {
    clearSessionCookie(res)
    res.status(200).json({ ok: true })
  }

  // Express middleware: verifies session cookie, gates by allowlist.
  // Unauthenticated API calls → 401 JSON. Unauthenticated page loads → redirect /login.
  async function requireSession(req, res, next) {
    const isApi = req.path.startsWith('/api/')
    const cookies = parseCookies(req)
    const token = cookies[COOKIE_NAME]
    if (!token) {
      if (isApi) return res.status(401).json({ error: 'Not authenticated' })
      return res.redirect('/login')
    }
    try {
      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data?.user) {
        clearSessionCookie(res)
        if (isApi) return res.status(401).json({ error: 'Session expired' })
        return res.redirect('/login')
      }
      const userEmail = (data.user.email || '').toLowerCase()
      if (!allowlist.has(userEmail)) {
        if (isApi) return res.status(403).json({ error: 'Email not authorized' })
        return res.status(403).send('Forbidden: email not authorized for this workspace')
      }
      req.zumiaUser = { email: userEmail, id: data.user.id }
      next()
    } catch (e) {
      console.error('[Auth/requireSession] Error:', e.message)
      if (isApi) return res.status(500).json({ error: 'Auth check failed' })
      return res.redirect('/login')
    }
  }

  return { login, logout, requireSession, COOKIE_NAME }
}

export const LOGIN_PAGE_HTML = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Đăng nhập — Zumia Tool</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0b0b10; color: #eee; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  form { background: #16161d; padding: 32px; border-radius: 12px; width: 320px; box-shadow: 0 8px 30px rgba(0,0,0,.4); }
  h1 { font-size: 18px; margin: 0 0 20px; }
  input { width: 100%; box-sizing: border-box; padding: 10px 12px; margin-bottom: 12px; border-radius: 8px; border: 1px solid #333; background: #0e0e13; color: #eee; }
  button { width: 100%; padding: 10px; border-radius: 8px; border: none; background: #7c5cff; color: #fff; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  #err { color: #ff6b6b; font-size: 13px; margin-bottom: 12px; min-height: 16px; }
</style>
</head>
<body>
<form id="f">
  <h1>Zumia Tool — Đăng nhập</h1>
  <div id="err"></div>
  <input type="email" id="email" placeholder="Email" autocomplete="username" required />
  <input type="password" id="password" placeholder="Mật khẩu" autocomplete="current-password" required />
  <button type="submit">Đăng nhập</button>
</form>
<script>
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const err = document.getElementById('err');
  err.textContent = '';
  btn.disabled = true;
  try {
    const resp = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Đăng nhập thất bại');
    window.location.href = '/';
  } catch (ex) {
    err.textContent = ex.message;
    btn.disabled = false;
  }
});
</script>
</body>
</html>`
