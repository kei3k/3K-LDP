// Admin panel: manage employee accounts + view per-employee usage.
// GET  /admin              — server-rendered page (list users + usage table)
// POST /admin/users        — create employee account {email, password?}
// POST /admin/users/:id/active   — toggle active {active: bool}
// POST /admin/users/:id/password — reset password {password}
// All routes require requireSession + requireAdmin (wired in server/index.js).
// Role is re-checked server-side by requireAdmin — never trust the client.
import { listUsers, createUser, setActive, resetPassword, findById, generateStrongPassword } from '../store/users.js'
import { getSummary, getCapForEmail } from '../usage/usage.js'

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function buildUsageRows(env) {
  return getSummary().map((r) => {
    const cap = r.capOverride !== null ? r.capOverride : getCapForEmail(r.email, env)
    const remaining = cap > 0 ? Math.max(0, cap - r.today) : null
    return { ...r, cap, remaining }
  })
}

export function adminPageHtml(env) {
  return function (req, res) {
    const users = listUsers()
    const usageByEmail = new Map(buildUsageRows(env).map((r) => [r.email, r]))

    const userRows = users.map((u) => {
      const usage = usageByEmail.get(u.email)
      const today = usage ? usage.today : 0
      const month = usage ? usage.month : 0
      return `
      <tr>
        <td>${escapeHtml(u.email)}</td>
        <td>${u.role === 'admin' ? 'Admin' : 'Nhân viên'}</td>
        <td>${u.active ? '<span class="ok">Đang hoạt động</span>' : '<span class="bad">Đã khoá</span>'}</td>
        <td>${today}</td>
        <td>${month}</td>
        <td>
          <form class="inline" method="post" action="/admin/users/${u.id}/active" data-ajax>
            <input type="hidden" name="active" value="${u.active ? '0' : '1'}" />
            <button type="submit" class="small">${u.active ? 'Khoá' : 'Mở khoá'}</button>
          </form>
          <button type="button" class="small" data-reset="${u.id}" data-email="${escapeHtml(u.email)}">Đặt lại mật khẩu</button>
        </td>
      </tr>`
    }).join('')

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Quản trị — Zumia Tool</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0b0b10; color: #eee; padding: 32px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; color: #999; margin-top: 36px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #262630; font-size: 14px; }
  th { color: #999; font-weight: 600; font-size: 12px; text-transform: uppercase; }
  .ok { color: #4ade80; }
  .bad { color: #ff6b6b; }
  .inline { display: inline; }
  button, input[type=submit] { cursor: pointer; }
  button.small { font-size: 12px; padding: 5px 10px; border-radius: 6px; border: 1px solid #333; background: #16161d; color: #eee; margin-right: 6px; }
  button.small:hover { background: #1e1e28; }
  form.create { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
  form.create input { padding: 8px 10px; border-radius: 6px; border: 1px solid #333; background: #0e0e13; color: #eee; }
  form.create button { padding: 8px 16px; border-radius: 6px; border: none; background: #7c5cff; color: #fff; font-weight: 600; }
  #msg { min-height: 20px; font-size: 13px; margin-top: 10px; }
  #msg.ok { color: #4ade80; }
  #msg.bad { color: #ff6b6b; }
  a.top { color: #7c5cff; font-size: 13px; text-decoration: none; }
</style>
</head>
<body>
  <a class="top" href="/">← Về trang chính</a>
  <h1>Quản trị workspace</h1>
  <div>Đăng nhập: ${escapeHtml(req.zumiaUser.email)}</div>

  <h2>＋ Tạo tài khoản nhân viên</h2>
  <form class="create" id="createForm">
    <input type="email" name="email" placeholder="Email nhân viên" required />
    <input type="text" name="password" placeholder="Mật khẩu (để trống = tự tạo)" />
    <button type="submit">Tạo tài khoản</button>
  </form>
  <div id="msg"></div>

  <h2>Danh sách tài khoản &amp; lượt dùng</h2>
  <table>
    <thead><tr><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Hôm nay</th><th>Tháng này</th><th>Hành động</th></tr></thead>
    <tbody id="userTbody">${userRows || '<tr><td colspan="6">Chưa có tài khoản</td></tr>'}</tbody>
  </table>

<script>
function showMsg(text, ok) {
  var el = document.getElementById('msg');
  el.textContent = text;
  el.className = ok ? 'ok' : 'bad';
}

document.getElementById('createForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var form = e.target;
  var email = form.email.value;
  var password = form.password.value;
  try {
    var resp = await fetch('/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password || undefined }),
    });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Tạo tài khoản thất bại');
    showMsg('Đã tạo tài khoản ' + data.email + '. Mật khẩu: ' + data.password, true);
    setTimeout(function () { window.location.reload(); }, 1800);
  } catch (ex) {
    showMsg(ex.message, false);
  }
});

document.querySelectorAll('form[data-ajax]').forEach(function (form) {
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var action = form.getAttribute('action');
    var active = form.querySelector('input[name=active]').value;
    try {
      var resp = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: active === '1' }),
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Thao tác thất bại');
      window.location.reload();
    } catch (ex) {
      showMsg(ex.message, false);
    }
  });
});

document.querySelectorAll('[data-reset]').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    var id = btn.getAttribute('data-reset');
    var email = btn.getAttribute('data-email');
    if (!confirm('Đặt lại mật khẩu cho ' + email + '?')) return;
    try {
      var resp = await fetch('/admin/users/' + id + '/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Thao tác thất bại');
      showMsg('Mật khẩu mới cho ' + email + ': ' + data.password, true);
    } catch (ex) {
      showMsg(ex.message, false);
    }
  });
});
</script>
</body></html>`)
  }
}

// POST /admin/users {email, password?}
export function createEmployeeHandler(req, res) {
  try {
    const { email, password } = req.body || {}
    if (!email) {
      res.status(400).json({ error: 'Thiếu email' })
      return
    }
    const finalPassword = password && password.length >= 6 ? password : generateStrongPassword()
    const user = createUser({ email, password: finalPassword, role: 'employee', createdBy: req.zumiaUser.email })
    res.status(200).json({ ok: true, email: user.email, password: finalPassword })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// POST /admin/users/:id/active {active: bool}
export function setActiveHandler(req, res) {
  try {
    const id = Number(req.params.id)
    const user = findById(id)
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })
    const { active } = req.body || {}
    setActive(id, !!active)
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// POST /admin/users/:id/password {password?}
export function resetPasswordHandler(req, res) {
  try {
    const id = Number(req.params.id)
    const user = findById(id)
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })
    const { password } = req.body || {}
    const finalPassword = password && password.length >= 6 ? password : generateStrongPassword()
    resetPassword(id, finalPassword)
    res.status(200).json({ ok: true, password: finalPassword })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}
