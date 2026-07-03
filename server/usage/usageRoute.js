// Admin view for per-email usage: GET /api/usage/summary (JSON) and
// GET /usage (minimal HTML table). Restricted to a fixed admin email —
// separate from the general NAM_ALLOWED_EMAILS allowlist so regular
// workspace users can't see everyone else's usage.
import { getSummary, getCapForEmail } from './usage.js'

const ADMIN_EMAIL = 'kei.marketer@gmail.com'

function requireAdmin(req, res) {
  if (req.zumiaUser?.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Chỉ admin mới xem được trang này' })
    return false
  }
  return true
}

function buildRows(env) {
  return getSummary().map((r) => {
    const cap = r.capOverride !== null ? r.capOverride : getCapForEmail(r.email, env)
    const remaining = cap > 0 ? Math.max(0, cap - r.today) : null
    return { ...r, cap, remaining }
  })
}

export function usageSummaryJson(env) {
  return function (req, res) {
    if (!requireAdmin(req, res)) return
    res.json({ rows: buildRows(env) })
  }
}

export function usagePageHtml(env) {
  return function (req, res) {
    if (!requireAdmin(req, res)) return
    const rows = buildRows(env)
    const trs = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.email)}</td>
        <td>${r.today}</td>
        <td>${r.month}</td>
        <td>${r.cap > 0 ? r.cap : '∞'}</td>
        <td>${r.remaining === null ? '∞' : r.remaining}</td>
      </tr>`).join('')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8" /><title>Usage — Zumia Tool</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0b0b10; color: #eee; padding: 32px; }
  table { border-collapse: collapse; width: 100%; max-width: 720px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #333; }
  th { color: #999; font-weight: 600; font-size: 13px; }
  h1 { font-size: 18px; }
</style></head>
<body>
  <h1>Usage theo email (call tính phí)</h1>
  <table>
    <thead><tr><th>Email</th><th>Hôm nay</th><th>Tháng này</th><th>Hạn mức/ngày</th><th>Còn lại</th></tr></thead>
    <tbody>${trs || '<tr><td colspan="5">Chưa có dữ liệu</td></tr>'}</tbody>
  </table>
</body></html>`)
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
