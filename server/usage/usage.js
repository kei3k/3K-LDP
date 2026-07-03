// Per-email usage metering + quota enforcement for expensive AI calls.
// Storage: SQLite file at data/usage.db (better-sqlite3, sync API — fine for
// this call volume). Logs only {email, endpoint, ts, weight} — never
// payload bodies or secrets.
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const DATA_DIR = path.join(ROOT, 'data')
const DB_PATH = path.join(DATA_DIR, 'usage.db')
const QUOTAS_PATH = path.join(DATA_DIR, 'quotas.json')

fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    ts INTEGER NOT NULL,
    weight REAL NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_usage_email_ts ON usage_events(email, ts);
`)

const insertStmt = db.prepare(
  'INSERT INTO usage_events (email, endpoint, ts, weight) VALUES (?, ?, ?, ?)'
)
const countSinceStmt = db.prepare(
  'SELECT COALESCE(SUM(weight), 0) AS total FROM usage_events WHERE email = ? AND ts >= ?'
)
const summaryStmt = db.prepare(`
  SELECT email,
    SUM(CASE WHEN ts >= ? THEN weight ELSE 0 END) AS today,
    SUM(CASE WHEN ts >= ? THEN weight ELSE 0 END) AS month
  FROM usage_events
  GROUP BY email
  ORDER BY month DESC
`)

function dayStartMs(now = Date.now()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function monthStartMs(now = Date.now()) {
  const d = new Date(now)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// ── Per-email cap overrides (data/quotas.json: {"email": cap}) ────────────
function readQuotaOverrides() {
  try {
    const raw = fs.readFileSync(QUOTAS_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// Returns the daily cap for an email: per-email override > env default.
// 0 or unset env default = unlimited.
function getCapForEmail(email, env) {
  const overrides = readQuotaOverrides()
  if (Object.prototype.hasOwnProperty.call(overrides, email)) {
    const v = Number(overrides[email])
    return Number.isFinite(v) ? v : 0
  }
  const envDefault = Number(env.NAM_QUOTA_PER_EMAIL)
  return Number.isFinite(envDefault) ? envDefault : 200
}

// Records one usage event. weight = cost-weight (default 1 call = 1 unit).
function recordUsage(email, endpoint, weight = 1) {
  insertStmt.run(email, endpoint, Date.now(), weight)
}

// Throws-free check: returns { allowed, used, cap, remaining }.
function checkQuota(email, env) {
  const cap = getCapForEmail(email, env)
  if (!cap || cap <= 0) return { allowed: true, used: 0, cap: 0, remaining: Infinity }
  const used = countSinceStmt.get(email, dayStartMs()).total
  return { allowed: used < cap, used, cap, remaining: Math.max(0, cap - used) }
}

// Express middleware factory: gate + meter an expensive endpoint.
// Usage: app.use('/api/vertex', quotaGate(env, 'vertex'), vertex.vertexProxy)
function quotaGate(env, endpointLabel, weight = 1) {
  return function (req, res, next) {
    const email = req.zumiaUser?.email
    if (!email) return res.status(401).json({ error: 'Not authenticated' })
    const { allowed, cap, used, remaining } = checkQuota(email, env)
    if (!allowed) {
      return res.status(429).json({
        error: 'Đã vượt hạn mức ngày',
        cap,
        used,
        remaining,
      })
    }
    recordUsage(email, endpointLabel, weight)
    next()
  }
}

function getSummary() {
  const today = dayStartMs()
  const month = monthStartMs()
  const rows = summaryStmt.all(today, month)
  const overrides = readQuotaOverrides()
  return rows.map((r) => {
    const cap = Object.prototype.hasOwnProperty.call(overrides, r.email)
      ? Number(overrides[r.email]) || 0
      : null // resolved against env default by caller if null
    return { email: r.email, today: r.today || 0, month: r.month || 0, capOverride: cap }
  })
}

export { recordUsage, checkQuota, quotaGate, getCapForEmail, getSummary }
