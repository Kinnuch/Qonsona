/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import {
  ApiError,
  fail,
  newState,
  dayAt,
  weekAt,
  CATALOG,
  SHOP,
  RULES,
  getDay,
  taskPlan
} from './domain.mjs'

export const hash = (value) => createHash('sha256').update(value).digest('hex')
export function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.display_name,
    publicId: row.public_id,
    publicCollection: !!row.public_collection,
    publicTime: !!row.public_time,
    createdAt: row.created_at
  }
}
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,public_id TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,
        public_collection INTEGER NOT NULL DEFAULT 0,public_time INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),app TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS requests(user_id TEXT NOT NULL,request_id TEXT NOT NULL,body_hash TEXT NOT NULL,response TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,request_id));
      CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,request_id TEXT NOT NULL,at INTEGER NOT NULL,detail TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),tickets INTEGER NOT NULL,amount_fen INTEGER NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,payment_reference TEXT UNIQUE,approved_at INTEGER,support_spent_at_approval INTEGER);
      CREATE TABLE IF NOT EXISTS test_grants(user_id TEXT NOT NULL,epoch TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(user_id,epoch));
      CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL);`)
    const columns = this.db
      .prepare('PRAGMA table_info(orders)')
      .all()
      .map((column) => column.name)
    if (!columns.includes('testing'))
      this.db.exec('ALTER TABLE orders ADD COLUMN testing INTEGER NOT NULL DEFAULT 0')
    if (!columns.includes('adult_verified'))
      this.db.exec('ALTER TABLE orders ADD COLUMN adult_verified INTEGER NOT NULL DEFAULT 0')
  }
  close() {
    this.db.close()
  }
  transaction(callback) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = callback()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  user(id) {
    return this.db.prepare('SELECT * FROM users WHERE id=?').get(id)
  }
  snapshot(id, now) {
    const row = this.user(id)
    if (!row) fail('ACCOUNT_NOT_FOUND', 404)
    const state = JSON.parse(row.state),
      day = dayAt(now),
      today = getDay(state, day)
    return {
      version: 1,
      revision: state.revision || 0,
      serverTime: now,
      day,
      user: publicUser(row),
      balances: state.balances,
      pity: state.pity,
      characters: Object.values(state.characters),
      legacy: Object.values(state.legacy || {}),
      inventory: state.inventory,
      checkins: Object.entries(state.days)
        .filter(([, d]) => d.checkin)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 90)
        .map(([date, d]) => ({ day: date, kind: d.checkin })),
      today: {
        seconds: today.seconds,
        timePoints: today.timePoints,
        taskPoints: today.taskPoints,
        tasks: today.tasks.length,
        taskPlan: taskPlan(today),
        planChanges: today.planChanges,
        weeklyBonus: state.weeklyClaims.includes(weekAt(day)) ? 80 : 0
      },
      totals: {
        seconds: Object.values(state.languageSeconds).reduce((a, b) => a + b, 0),
        collectionCount: Object.keys(state.characters).length
      },
      catalog: CATALOG,
      shop: SHOP,
      drawRules: RULES,
      history: this.db
        .prepare(
          'SELECT id,kind,at,detail FROM ledger WHERE user_id=? ORDER BY at DESC,rowid DESC LIMIT 50'
        )
        .all(id)
        .map((entry) => ({ ...entry, detail: JSON.parse(entry.detail) }))
    }
  }
  mutate(id, route, body, now, callback) {
    const digest = hash(JSON.stringify([route, canonical(body)]))
    return this.transaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM requests WHERE user_id=? AND request_id=?')
        .get(id, body.requestId)
      if (existing) {
        if (existing.body_hash !== digest) fail('IDEMPOTENCY_CONFLICT', 409)
        return JSON.parse(existing.response)
      }
      const row = this.user(id)
      if (!row) fail('ACCOUNT_NOT_FOUND', 404)
      const state = JSON.parse(row.state)
      const result = callback(state, row) || {}
      state.revision = (state.revision || 0) + 1
      this.db.prepare('UPDATE users SET state=? WHERE id=?').run(JSON.stringify(state), id)
      this.db
        .prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?)')
        .run(randomUUID(), id, route, body.requestId, now, JSON.stringify(result))
      const response = { ...result, snapshot: this.snapshot(id, now) }
      this.db
        .prepare('INSERT INTO requests VALUES(?,?,?,?,?)')
        .run(id, body.requestId, digest, JSON.stringify(response), now)
      return response
    })
  }
  rate(key, now, max, span = 60000) {
    const window = Math.floor(now / span)
    const old = this.db.prepare('SELECT * FROM rate_limits WHERE key=?').get(key)
    if (old?.window === window && old.count >= max) fail('RATE_LIMITED', 429)
    this.db
      .prepare(
        `INSERT INTO rate_limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN rate_limits.window=excluded.window THEN rate_limits.count+1 ELSE 1 END`
      )
      .run(key, window)
    // IP accounting expires; avoid retaining raw IP addresses or unlimited stale rows.
    this.db.prepare('DELETE FROM rate_limits WHERE window<?').run(window - 1440)
  }
  createUser(username, displayName, passwordHash, now) {
    const id = randomUUID()
    try {
      this.db
        .prepare(
          'INSERT INTO users(id,username,display_name,public_id,password_hash,created_at,state) VALUES(?,?,?,?,?,?,?)'
        )
        .run(id, username, displayName, randomUUID(), passwordHash, now, JSON.stringify(newState()))
    } catch (error) {
      if (String(error).includes('UNIQUE')) throw new ApiError('USERNAME_TAKEN', 409)
      throw error
    }
    return this.user(id)
  }
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    )
  return value
}
