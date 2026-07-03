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
//   - Google OAuth: GET /auth/google redirects the browser straight to
//     Supabase's own GoTrue /authorize endpoint (implicit flow — no PKCE
//     code_verifier needed, since we have no persistent client-side
//     Supabase JS instance to hold it). Supabase redirects to Google,
//     then back to GET /auth/callback with the session in the URL
//     *fragment* (#access_token=...), which never reaches the server.
//     /auth/callback serves a tiny static page whose inline script reads
//     the fragment and POSTs the access_token to /auth/callback/verify,
//     which verifies it, checks the allowlist, and sets the SAME cookie
//     as the password path.
//   - Every other request (static app + all /api/*) is gated behind
//     requireSession: verifies the cookie's token via supabase.auth.getUser(),
//     then checks the resulting email against NAM_ALLOWED_EMAILS allowlist.
//   - GET /login serves a minimal static HTML form (no framework) that
//     posts to /auth/login, plus a "Đăng nhập với Google" link to /auth/google.
import { createClient } from '@supabase/supabase-js'

const COOKIE_NAME = 'zumia_tool_session'

export function createAuthGate(env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  // Separate client with flowType:'implicit' purely to build the OAuth
  // authorize URL — implicit flow returns tokens in the redirect fragment
  // instead of requiring a stored PKCE code_verifier, which fits this
  // server-only (no persistent browser SDK) setup.
  const oauthUrlClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
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

  // GET /auth/google — redirect straight to Supabase's authorize endpoint.
  async function googleStart(req, res) {
    const redirectTo = `${env.PUBLIC_BASE_URL || `https://${req.headers.host}`}/auth/callback`
    const { data, error } = await oauthUrlClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error || !data?.url) {
      res.status(500).send('Không khởi tạo được đăng nhập Google: ' + (error?.message || 'unknown error'))
      return
    }
    res.redirect(data.url)
  }

  // GET /auth/callback — serves a tiny page that reads the implicit-flow
  // token out of the URL fragment (server never sees it) and posts it on.
  function callbackPage(req, res) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(CALLBACK_PAGE_HTML)
  }

  // POST /auth/callback/verify {access_token} — verifies the Google-issued
  // Supabase token, checks the allowlist, sets the session cookie.
  async function callbackVerify(req, res) {
    try {
      let body = req.body
      if (!body) {
        const chunks = []
        for await (const c of req) chunks.push(c)
        body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
      }
      const { access_token, expires_in } = body
      if (!access_token) {
        res.status(400).json({ error: 'Missing access_token' })
        return
      }
      const { data, error } = await supabase.auth.getUser(access_token)
      if (error || !data?.user) {
        res.status(401).json({ error: 'Phiên Google không hợp lệ' })
        return
      }
      const userEmail = (data.user.email || '').toLowerCase()
      if (!allowlist.has(userEmail)) {
        res.status(403).json({ error: 'Email chưa được cấp quyền truy cập workspace này' })
        return
      }
      setSessionCookie(res, access_token, expires_in || 3600)
      res.status(200).json({ ok: true, email: userEmail })
    } catch (e) {
      console.error('[Auth/callbackVerify] Error:', e.message)
      res.status(500).json({ error: e.message })
    }
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

  return { login, logout, googleStart, callbackPage, callbackVerify, requireSession, COOKIE_NAME }
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
  .divider { display: flex; align-items: center; gap: 10px; margin: 16px 0; color: #666; font-size: 12px; }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #333; }
  .google-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #333; background: #0e0e13; color: #eee; text-decoration: none; font-size: 14px; font-weight: 500; box-sizing: border-box; }
  .google-btn:hover { background: #1a1a22; }
</style>
</head>
<body>
<form id="f">
  <h1>Zumia Tool — Đăng nhập</h1>
  <div id="err"></div>
  <input type="email" id="email" placeholder="Email" autocomplete="username" required />
  <input type="password" id="password" placeholder="Mật khẩu" autocomplete="current-password" required />
  <button type="submit">Đăng nhập</button>
  <div class="divider">HOẶC</div>
  <a class="google-btn" href="/auth/google">
    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
    Đăng nhập với Google
  </a>
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

// Served at GET /auth/callback. Implicit-flow tokens come back in the URL
// *fragment* (#access_token=...), which browsers never send to the server —
// so this inline script reads it client-side and forwards it over POST.
export const CALLBACK_PAGE_HTML = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Đang đăng nhập… — Zumia Tool</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0b0b10; color: #eee; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .box { text-align: center; }
  #err { color: #ff6b6b; font-size: 14px; margin-top: 12px; max-width: 340px; }
</style>
</head>
<body>
<div class="box">
  <div id="msg">Đang xác thực…</div>
  <div id="err"></div>
</div>
<script>
(function () {
  var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  var errDescription = params.get('error_description') || params.get('error');
  var accessToken = params.get('access_token');
  var expiresIn = params.get('expires_in');
  var errEl = document.getElementById('err');
  var msgEl = document.getElementById('msg');
  if (errDescription) {
    msgEl.textContent = 'Đăng nhập Google thất bại';
    errEl.textContent = errDescription;
    return;
  }
  if (!accessToken) {
    msgEl.textContent = 'Đăng nhập Google thất bại';
    errEl.textContent = 'Không nhận được token từ Google/Supabase';
    return;
  }
  fetch('/auth/callback/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, expires_in: expiresIn ? Number(expiresIn) : undefined }),
  })
    .then(function (resp) { return resp.json().then(function (data) { return { ok: resp.ok, data: data }; }); })
    .then(function (r) {
      if (!r.ok) throw new Error(r.data.error || 'Xác thực thất bại');
      window.location.href = '/';
    })
    .catch(function (ex) {
      msgEl.textContent = 'Email chưa được cấp quyền';
      errEl.textContent = ex.message;
    });
})();
</script>
</body>
</html>`
