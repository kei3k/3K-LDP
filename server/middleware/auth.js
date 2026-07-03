// Self-managed auth gate for this workspace (replaces Supabase SSO + Google
// OAuth + email allowlist). Nam admins his own employees locally.
//
// Design:
//   - POST /auth/login {email,password} → looks up server/store/users.js,
//     bcrypt-compares the password, rejects inactive accounts → on success
//     sets an httpOnly, secure, signed session cookie containing the user id.
//     The cookie is HMAC-signed with SESSION_SECRET so it can't be forged
//     client-side (no server-side session table needed — the signature IS
//     the integrity check, and requireSession re-reads the user row on
//     every request so role/active changes take effect immediately).
//   - No OAuth, no external allowlist: every requireSession check re-loads
//     the user by id and rejects if the row was deactivated or deleted.
//   - Login is rate-limited in-memory per IP+email to slow brute force.
import crypto from 'crypto'
import { findById, findByEmail, verifyPassword } from '../store/users.js'

const COOKIE_NAME = 'nam_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

// ── Simple in-memory login throttle (per email, resets on process restart) ─
const LOGIN_WINDOW_MS = 5 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 8
const loginAttempts = new Map() // key -> { count, windowStart }

function isRateLimited(key) {
  const now = Date.now()
  const entry = loginAttempts.get(key)
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  return entry.count > LOGIN_MAX_ATTEMPTS
}

export function createAuthGate(env) {
  const secret = env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET is required (add it to .env)')
  }

  function sign(value) {
    const hmac = crypto.createHmac('sha256', secret).update(value).digest('base64url')
    return `${value}.${hmac}`
  }

  function unsign(signed) {
    const idx = signed.lastIndexOf('.')
    if (idx < 0) return null
    const value = signed.slice(0, idx)
    const mac = signed.slice(idx + 1)
    const expected = crypto.createHmac('sha256', secret).update(value).digest('base64url')
    // timing-safe compare
    const a = Buffer.from(mac)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    return value
  }

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

  function setSessionCookie(res, userId) {
    const signed = sign(String(userId))
    const attrs = [
      `${COOKIE_NAME}=${encodeURIComponent(signed)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
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
        res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' })
        return
      }
      const rlKey = `${req.ip}:${String(email).toLowerCase()}`
      if (isRateLimited(rlKey)) {
        res.status(429).json({ error: 'Thử lại quá nhiều lần, vui lòng đợi vài phút' })
        return
      }
      const user = findByEmail(email)
      if (!user || !verifyPassword(user, password)) {
        res.status(401).json({ error: 'Sai email hoặc mật khẩu' })
        return
      }
      if (!user.active) {
        res.status(403).json({ error: 'Tài khoản đã bị khoá' })
        return
      }
      setSessionCookie(res, user.id)
      res.status(200).json({ ok: true, email: user.email, role: user.role })
    } catch (e) {
      console.error('[Auth/login] Error:', e.message)
      res.status(500).json({ error: 'Lỗi máy chủ' })
    }
  }

  function logout(req, res) {
    clearSessionCookie(res)
    res.status(200).json({ ok: true })
  }

  // Express middleware: verifies signed session cookie, re-loads user,
  // rejects if missing/inactive. Attaches req.zumiaUser = {email, id, role}
  // (kept as `zumiaUser` — quotaGate and existing handlers already read
  // this field name; renaming it would ripple into usage.js call sites).
  async function requireSession(req, res, next) {
    const isApi = req.path.startsWith('/api/')
    const cookies = parseCookies(req)
    const signed = cookies[COOKIE_NAME]
    const userId = signed ? unsign(signed) : null
    if (!userId) {
      if (isApi) return res.status(401).json({ error: 'Not authenticated' })
      return res.redirect('/login')
    }
    try {
      const user = findById(Number(userId))
      if (!user || !user.active) {
        clearSessionCookie(res)
        if (isApi) return res.status(401).json({ error: 'Session expired' })
        return res.redirect('/login')
      }
      req.zumiaUser = { email: user.email, id: user.id, role: user.role }
      next()
    } catch (e) {
      console.error('[Auth/requireSession] Error:', e.message)
      if (isApi) return res.status(500).json({ error: 'Auth check failed' })
      return res.redirect('/login')
    }
  }

  // Express middleware: requires an authenticated admin. Must run AFTER
  // requireSession. Never trusts client input for the role check.
  function requireAdmin(req, res, next) {
    if (req.zumiaUser?.role !== 'admin') {
      const isApi = req.path.startsWith('/api/')
      if (isApi) return res.status(403).json({ error: 'Chỉ admin mới truy cập được' })
      return res.status(403).send('Forbidden: chỉ admin mới truy cập được trang này')
    }
    next()
  }

  return { login, logout, requireSession, requireAdmin, COOKIE_NAME }
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
