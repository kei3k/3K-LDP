// Self-managed user store for this workspace. Storage: SQLite file at
// data/users.db (better-sqlite3, sync API — fine for this call volume).
// Passwords are bcrypt-hashed (cost 10) — plaintext never touches disk or logs.
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import crypto from 'crypto'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const DATA_DIR = path.join(ROOT, 'data')
const DB_PATH = path.join(DATA_DIR, 'users.db')

const BCRYPT_COST = 10

fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    created_by TEXT
  );
`)

const getByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?')
const insertStmt = db.prepare(
  'INSERT INTO users (email, password_hash, role, active, created_at, created_by) VALUES (?, ?, ?, 1, ?, ?)'
)
const listStmt = db.prepare('SELECT id, email, role, active, created_at, created_by FROM users ORDER BY created_at ASC')
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM users')
const setActiveStmt = db.prepare('UPDATE users SET active = ? WHERE id = ?')
const setPasswordStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
const getByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?')

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function findByEmail(email) {
  return getByEmailStmt.get(normalizeEmail(email))
}

function findById(id) {
  return getByIdStmt.get(id)
}

function listUsers() {
  return listStmt.all().map((u) => ({ ...u, active: !!u.active }))
}

function createUser({ email, password, role = 'employee', createdBy = null }) {
  const norm = normalizeEmail(email)
  if (!norm) throw new Error('Email is required')
  if (findByEmail(norm)) throw new Error('Email already exists')
  const hash = bcrypt.hashSync(password, BCRYPT_COST)
  const info = insertStmt.run(norm, hash, role, Date.now(), createdBy)
  return findById(info.lastInsertRowid)
}

function setActive(id, active) {
  setActiveStmt.run(active ? 1 : 0, id)
}

function resetPassword(id, newPassword) {
  const hash = bcrypt.hashSync(newPassword, BCRYPT_COST)
  setPasswordStmt.run(hash, id)
}

function verifyPassword(user, password) {
  if (!user || !user.password_hash) return false
  return bcrypt.compareSync(password, user.password_hash)
}

// Generates a strong random password for bootstrap/new-account flows.
// 16 chars, URL-safe alphabet — easy to relay over chat, no ambiguous chars issue.
function generateStrongPassword() {
  return crypto.randomBytes(12).toString('base64url')
}

// Seeds the admin account for Nam on first boot (idempotent — only runs
// when the users table is empty). Also seeds kei.marketer@gmail.com as a
// second admin so CoS/anh Kei keep access alongside Nam.
// Returns { seeded: boolean, adminEmail, adminPassword } — adminPassword is
// only present when a NEW seed happened (never re-generated on subsequent boots).
function seedAdminIfEmpty(env) {
  const { n } = countStmt.get()
  if (n > 0) return { seeded: false }

  const adminEmail = normalizeEmail(env.NAM_ADMIN_EMAIL)
  if (!adminEmail) {
    throw new Error('NAM_ADMIN_EMAIL is required to bootstrap the first admin account')
  }
  const adminPassword = env.NAM_ADMIN_PASSWORD || generateStrongPassword()

  createUser({ email: adminEmail, password: adminPassword, role: 'admin', createdBy: 'system:bootstrap' })

  const kei = 'kei.marketer@gmail.com'
  if (normalizeEmail(kei) !== adminEmail) {
    const keiPassword = generateStrongPassword()
    createUser({ email: kei, password: keiPassword, role: 'admin', createdBy: 'system:bootstrap' })
  }

  return { seeded: true, adminEmail, adminPassword }
}

export {
  findByEmail,
  findById,
  listUsers,
  createUser,
  setActive,
  resetPassword,
  verifyPassword,
  generateStrongPassword,
  seedAdminIfEmpty,
}
