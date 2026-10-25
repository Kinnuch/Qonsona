/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  ApiError,
  fail,
  newState,
  dayAt,
  weekAt,
  RULES,
  getDay,
  taskPlan,
  companionState,
  COMPANION_MILESTONES,
  monthlyStatus,
  homeState,
  HOME_SKINS
} from './domain.mjs'
import { CATALOG, catalogFor, speciesFor, shopFor, discountedCharacter } from './catalog.mjs'
import { poolSlot, cycleOrder, poolForSlot } from './draw-pools.mjs'

export const hash = (value) => createHash('sha256').update(value).digest('hex')
export function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.display_name,
    publicId: row.public_id,
    publicCollection: !!row.public_collection,
    publicTime: !!row.public_time,
    rankVisibility: row.rank_visibility || 'global',
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
      CREATE TABLE IF NOT EXISTS retired_test_requests(user_id TEXT NOT NULL,request_id TEXT NOT NULL,PRIMARY KEY(user_id,request_id));
      CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,request_id TEXT NOT NULL,at INTEGER NOT NULL,detail TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),tickets INTEGER NOT NULL,amount_fen INTEGER NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,payment_reference TEXT UNIQUE,approved_at INTEGER,support_spent_at_approval INTEGER);
      CREATE TABLE IF NOT EXISTS test_grants(user_id TEXT NOT NULL,epoch TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(user_id,epoch));
      CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL);`)
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS service_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS draw_pool_cycles(start_slot INTEGER PRIMARY KEY,ssr_order TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS draw_pools(id TEXT PRIMARY KEY,start_slot INTEGER NOT NULL UNIQUE,pool TEXT NOT NULL);`)
    this.db
      .prepare('INSERT OR IGNORE INTO service_settings VALUES(?,?)')
      .run('draw-pool-seed-v1', randomBytes(32).toString('hex'))
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS friend_requests(id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES users(id),recipient_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS pending_friend_pair ON friend_requests(sender_id,recipient_id) WHERE status='pending';
      CREATE TABLE IF NOT EXISTS friend_edges(user_id TEXT NOT NULL REFERENCES users(id),friend_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,PRIMARY KEY(user_id,friend_id));
      CREATE TABLE IF NOT EXISTS companion_answers(user_id TEXT NOT NULL REFERENCES users(id),language TEXT NOT NULL,answer_id TEXT NOT NULL,character_id TEXT NOT NULL,xp INTEGER NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(user_id,language,answer_id));`)
    const columns = this.db
      .prepare('PRAGMA table_info(orders)')
      .all()
      .map((column) => column.name)
    if (!columns.includes('testing'))
      this.db.exec('ALTER TABLE orders ADD COLUMN testing INTEGER NOT NULL DEFAULT 0')
    if (!columns.includes('adult_verified'))
      this.db.exec('ALTER TABLE orders ADD COLUMN adult_verified INTEGER NOT NULL DEFAULT 0')
    for (const [name, type] of Object.entries({
      provider: 'TEXT',
      out_trade_no: 'TEXT',
      merchant_id: 'TEXT',
      qr_code_url: 'TEXT',
      expires_at: 'INTEGER',
      payment_state: 'TEXT',
      provider_checked_at: 'INTEGER',
      provider_attempts: 'INTEGER NOT NULL DEFAULT 0',
      refunded_at: 'INTEGER',
      plan_id: 'TEXT',
      base_tickets: 'INTEGER',
      bonus_tickets: 'INTEGER',
      credited_tickets: 'INTEGER NOT NULL DEFAULT 0',
      provider_status: 'TEXT',
      verified_paid_claim_at: 'INTEGER',
      auto_close_attempts: 'INTEGER NOT NULL DEFAULT 0',
      auto_close_next_at: 'INTEGER NOT NULL DEFAULT 0',
      app: "TEXT NOT NULL DEFAULT 'qonsona'",
      purpose: "TEXT NOT NULL DEFAULT 'support-tickets'"
    }))
      if (!columns.includes(name)) this.db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${type}`)
    // Only the schema transition can infer old credits. Reopening a current
    // database must preserve an explicitly uncredited duplicate-promotion row.
    if (!columns.includes('credited_tickets'))
      this.db.exec(
        "UPDATE orders SET credited_tickets=CASE WHEN status='approved' THEN tickets ELSE 0 END"
      )
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS provider_order_number ON orders(provider,out_trade_no) WHERE out_trade_no IS NOT NULL;
      CREATE TABLE IF NOT EXISTS payment_receipts(provider TEXT NOT NULL,transaction_id TEXT NOT NULL,order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),amount_fen INTEGER NOT NULL,received_at INTEGER NOT NULL,PRIMARY KEY(provider,transaction_id));
      CREATE TABLE IF NOT EXISTS payment_leases(key TEXT PRIMARY KEY,until_at INTEGER NOT NULL);`)
    this.db.exec(`CREATE TABLE IF NOT EXISTS first_support_reservations(
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
      created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS first_support_claims(
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
      created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS unpaid_payment_deadlines ON orders(provider,status,auto_close_next_at,expires_at);`)
    const userColumns = this.db
      .prepare('PRAGMA table_info(users)')
      .all()
      .map((column) => column.name)
    if (!userColumns.includes('rank_visibility'))
      this.db.exec("ALTER TABLE users ADD COLUMN rank_visibility TEXT NOT NULL DEFAULT 'global'")
    // Existing false flags may be an explicit opt-out: never overwrite them during migration.
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
  drawPool(now) {
    const slot = poolSlot(now)
    const existing = this.db.prepare('SELECT pool FROM draw_pools WHERE start_slot=?').get(slot)
    if (existing) return JSON.parse(existing.pool)
    const seed = this.db
      .prepare('SELECT value FROM service_settings WHERE key=?')
      .get('draw-pool-seed-v1').value
    this.db
      .prepare('INSERT OR IGNORE INTO draw_pool_cycles VALUES(?,?)')
      .run(0, JSON.stringify(cycleOrder(seed, 0)))
    let cycle = this.db
      .prepare(
        'SELECT * FROM draw_pool_cycles WHERE start_slot<=? ORDER BY start_slot DESC LIMIT 1'
      )
      .get(slot)
    let order = JSON.parse(cycle.ssr_order)
    while (slot >= cycle.start_slot + order.length) {
      const start = cycle.start_slot + order.length
      this.db
        .prepare('INSERT OR IGNORE INTO draw_pool_cycles VALUES(?,?)')
        .run(start, JSON.stringify(cycleOrder(seed, start, order.at(-1))))
      cycle = this.db.prepare('SELECT * FROM draw_pool_cycles WHERE start_slot=?').get(start)
      order = JSON.parse(cycle.ssr_order)
    }
    const pool = poolForSlot(slot, order[slot - cycle.start_slot])
    this.db
      .prepare('INSERT OR IGNORE INTO draw_pools VALUES(?,?,?)')
      .run(pool.id, slot, JSON.stringify(pool))
    return JSON.parse(
      this.db.prepare('SELECT pool FROM draw_pools WHERE start_slot=?').get(slot).pool
    )
  }
  snapshot(id, now) {
    const row = this.user(id)
    if (!row) fail('ACCOUNT_NOT_FOUND', 404)
    const state = JSON.parse(row.state),
      day = dayAt(now),
      today = getDay(state, day)
    const companion = companionState(state)
    const home = homeState(state)
    const catalog = catalogFor(state, day)
    return {
      version: 1,
      revision: state.revision || 0,
      ...(state.starter ? { starter: state.starter } : {}),
      serverTime: now,
      day,
      user: publicUser(row),
      ...(this.paymentCapabilities ? { payments: this.paymentCapabilities(id) } : {}),
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
      catalog,
      species: speciesFor(catalog),
      shop: shopFor(day),
      gallery: this.gallery(day),
      companion: {
        currentId: companion.currentId,
        progress: Object.values(companion.progress),
        todayAnswers: state.answerDays[day] || 0,
        maxDailyAnswers: 200,
        xpPerAnswer: 5,
        milestones: COMPANION_MILESTONES
      },
      monthly: monthlyStatus(state, day),
      drawRules: RULES,
      drawPool: this.drawPool(now),
      home,
      homeSkins: HOME_SKINS.map((skin) => ({
        ...skin,
        owned: state.inventory.homeSkins.includes(skin.id)
      })),
      history: this.db
        .prepare(
          'SELECT id,kind,at,detail FROM ledger WHERE user_id=? ORDER BY at DESC,rowid DESC LIMIT 50'
        )
        .all(id)
        .map((entry) => ({ ...entry, detail: JSON.parse(entry.detail) }))
    }
  }
  gallery(day) {
    const available = CATALOG.filter((character) => character.introducedAt <= day)
    const newest = available.length
      ? available.reduce(
          (date, character) => (character.introducedAt > date ? character.introducedAt : date),
          ''
        )
      : ''
    const recent = available.filter((character) => character.introducedAt === newest)
    const selected = recent.length
      ? recent[Number.parseInt(hash(`gallery:${day}`).slice(0, 8), 16) % recent.length]
      : CATALOG[0]
    const discount = discountedCharacter(day)
    const price = shopFor(day).find((item) => item.characterId === discount.id)
    const owners = Object.fromEntries(
      CATALOG.filter((character) => character.tier === 'SSR').map((character) => [character.id, 0])
    )
    for (const row of this.db.prepare('SELECT state FROM users').all()) {
      const state = JSON.parse(row.state)
      for (const id of Object.keys(owners)) if (state.characters[id]) owners[id]++
    }
    const popular = Object.entries(owners).sort(
      ([idA, a], [idB, b]) => b - a || idA.localeCompare(idB)
    )[0]
    return [
      { type: 'new', characterId: selected.id, date: newest || day },
      {
        type: 'discount',
        characterId: discount.id,
        date: day,
        price: price.price,
        originalPrice: price.originalPrice
      },
      { type: 'popular', characterId: popular[0], date: day, ownerCount: popular[1] }
    ]
  }
  mutate(id, route, body, now, callback) {
    const digest = hash(JSON.stringify([route, canonical(body)]))
    return this.transaction(() => {
      if (
        this.db
          .prepare('SELECT 1 FROM retired_test_requests WHERE user_id=? AND request_id=?')
          .get(id, body.requestId)
      )
        fail('RETIRED_TEST_REQUEST', 409)
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
  /** 纯支持只登记付款与幂等收据，不改收藏状态、余额或 revision。 */
  mutatePayment(id, route, body, now, callback) {
    const digest = hash(JSON.stringify([route, canonical(body)]))
    return this.transaction(() => {
      if (
        this.db
          .prepare('SELECT 1 FROM retired_test_requests WHERE user_id=? AND request_id=?')
          .get(id, body.requestId)
      )
        fail('RETIRED_TEST_REQUEST', 409)
      const existing = this.db
        .prepare('SELECT * FROM requests WHERE user_id=? AND request_id=?')
        .get(id, body.requestId)
      if (existing) {
        if (existing.body_hash !== digest) fail('IDEMPOTENCY_CONFLICT', 409)
        return JSON.parse(existing.response)
      }
      if (!this.user(id)) fail('ACCOUNT_NOT_FOUND', 404)
      const response = callback() || {}
      this.db
        .prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?)')
        .run(randomUUID(), id, route, body.requestId, now, JSON.stringify(response))
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
          'INSERT INTO users(id,username,display_name,public_id,password_hash,public_collection,public_time,created_at,state) VALUES(?,?,?,?,?,1,1,?,?)'
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
