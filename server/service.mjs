/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { Store, hash, publicUser } from './store.mjs'
import {
  fail,
  shape,
  text,
  integer,
  requestId,
  activity,
  configureTasks,
  importLegacy,
  draw,
  purchase,
  makeup,
  validLanguage,
  dayAt
} from './domain.mjs'

const derive = promisify(scrypt)
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const TOKEN_AGE = 30 * 86400000
const username = (value) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,32}$/.test(value)) fail('INVALID_USERNAME')
  return value.toLowerCase()
}
const password = (value) => {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) fail('INVALID_PASSWORD')
  return value
}
async function passwordHash(value) {
  const salt = randomBytes(16).toString('hex')
  const result = await derive(value, salt, 64, PARAMS)
  return `scrypt-v1$${salt}$${result.toString('hex')}`
}
async function passwordMatches(value, encoded) {
  const [, salt, digest] = (encoded || '').split('$')
  const result = await derive(value, salt || 'qonsona-missing-user', 64, PARAMS)
  const expected = /^[a-f0-9]{128}$/.test(digest || '')
    ? Buffer.from(digest, 'hex')
    : Buffer.alloc(64)
  return timingSafeEqual(result, expected) && !!digest
}
function orderView(row) {
  return {
    id: row.id,
    tickets: row.tickets,
    amountFen: row.amount_fen,
    currency: 'CNY',
    status: row.status,
    testing: !!row.testing,
    createdAt: row.created_at,
    approvedAt: row.approved_at || null
  }
}
export class Service {
  constructor({ path = ':memory:', now = Date.now, random, env = process.env } = {}) {
    this.store = new Store(path)
    this.now = now
    this.random = random
    this.env = { ...env }
    this.testEnabled = env.NODE_ENV !== 'production' && env.QON_TEST_GRANTS === '1'
    this.paymentsEnabled = env.QON_PAYMENTS_ENABLED === '1'
    this.simulatedPayments = !this.paymentsEnabled && env.NODE_ENV !== 'production'
    this.testEpoch = env.QON_TEST_EPOCH || 'local-test-v1'
    this.supportPrice = Number(env.QON_SUPPORT_TICKET_FEN || 600)
    if (
      !Number.isSafeInteger(this.supportPrice) ||
      this.supportPrice < 1 ||
      this.supportPrice > 6000
    )
      throw new Error('Invalid QON_SUPPORT_TICKET_FEN')
    this.passwordJobs = 0
  }
  close() {
    this.store.close()
  }
  async withPassword(callback) {
    if (this.passwordJobs >= 8) fail('AUTH_BUSY', 503)
    this.passwordJobs++
    try {
      return await callback()
    } finally {
      this.passwordJobs--
    }
  }
  session(user, app, now) {
    const token = randomBytes(32).toString('base64url'),
      expiresAt = now + TOKEN_AGE
    this.store.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now)
    this.store.db
      .prepare('INSERT INTO sessions VALUES(?,?,?,?,?)')
      .run(hash(token), user.id, app, expiresAt, now)
    // Bound active sessions without giving older sessions access after revocation.
    this.store.db
      .prepare(
        'DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 10)'
      )
      .run(user.id, user.id)
    return { token, expiresAt, user: publicUser(user), snapshot: this.store.snapshot(user.id, now) }
  }
  authenticate(token, now) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) fail('UNAUTHORIZED', 401)
    const session = this.store.db
      .prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?')
      .get(hash(token), now)
    if (!session) fail('UNAUTHORIZED', 401)
    return session
  }
  admin(token) {
    const key = this.env.QON_ADMIN_KEY
    if (!key || key.length < 32) fail('ADMIN_DISABLED', 503)
    const a = Buffer.from(hash(token || '')),
      b = Buffer.from(hash(key))
    if (!timingSafeEqual(a, b)) fail('ADMIN_UNAUTHORIZED', 401)
  }
  async handle(method, path, body = {}, { token, ip = 'local', app = 'qonsona', query = {} } = {}) {
    const now = this.now()
    this.store.rate(`ip:${hash(ip)}`, now, 120)
    if (method === 'POST' || method === 'PATCH') shape(body, Object.keys(body || {}))
    if (!['qonlang', 'qonsona'].includes(app)) fail('INVALID_APP')
    if (method === 'GET' && path === '/v1/health')
      return {
        status: 'ok',
        testing: { grantsEnabled: this.testEnabled },
        payments: { enabled: this.paymentsEnabled, simulation: this.simulatedPayments }
      }
    if (path.startsWith('/v1/admin/')) return this.adminRoute(method, path, body, token, now)
    if (method === 'POST' && path === '/v1/auth/register') {
      shape(body, ['username', 'password', 'nickname'], ['username', 'password'])
      const name = username(body.username),
        secret = password(body.password),
        nickname = text(body.nickname ?? name, 1, 40)
      this.store.rate(`register:${hash(ip)}`, now, 5)
      const encoded = await this.withPassword(() => passwordHash(secret))
      const user = this.store.createUser(name, nickname, encoded, now)
      return this.session(user, app, now)
    }
    if (method === 'POST' && path === '/v1/auth/login') {
      shape(body, ['username', 'password'], ['username', 'password'])
      const name = username(body.username),
        secret = password(body.password)
      this.store.rate(`login-ip:${hash(ip)}`, now, 12)
      this.store.rate(`login-account:${hash(name)}`, now, 6)
      const user = this.store.db.prepare('SELECT * FROM users WHERE username=?').get(name)
      if (!(await this.withPassword(() => passwordMatches(secret, user?.password_hash))))
        fail('INVALID_CREDENTIALS', 401)
      return this.session(user, app, now)
    }
    // The isolated grant route is invisible in production even to authenticated administrators.
    if (path === '/v1/test/grant' && !this.testEnabled) fail('NOT_FOUND', 404)
    const session = this.authenticate(token, now),
      id = session.user_id
    this.store.rate(`account:${id}`, now, 90)
    if (method === 'POST' && path === '/v1/auth/logout') {
      shape(body, [])
      this.store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token))
      return { ok: true }
    }
    if (method === 'GET' && path === '/v1/auth/me')
      return { user: publicUser(this.store.user(id)), snapshot: this.store.snapshot(id, now) }
    if (method === 'PATCH' && path === '/v1/auth/me') {
      shape(body, ['nickname', 'publicCollection', 'publicTime'])
      const user = this.store.user(id)
      const nickname = body.nickname === undefined ? user.display_name : text(body.nickname, 1, 40)
      for (const key of ['publicCollection', 'publicTime'])
        if (body[key] !== undefined && typeof body[key] !== 'boolean') fail('INVALID_PRIVACY')
      this.store.transaction(() => {
        const fresh = this.store.user(id),
          state = JSON.parse(fresh.state)
        state.revision = (state.revision || 0) + 1
        this.store.db
          .prepare(
            'UPDATE users SET display_name=?,public_collection=?,public_time=?,state=? WHERE id=?'
          )
          .run(
            nickname,
            body.publicCollection === undefined
              ? fresh.public_collection
              : Number(body.publicCollection),
            body.publicTime === undefined ? fresh.public_time : Number(body.publicTime),
            JSON.stringify(state),
            id
          )
      })
      return { user: publicUser(this.store.user(id)), snapshot: this.store.snapshot(id, now) }
    }
    if (method === 'GET' && path === '/v1/collection') return this.store.snapshot(id, now)
    if (method === 'GET' && path === '/v1/leaderboards') return this.leaderboards(query)
    if (method === 'GET' && path === '/v1/support/orders')
      return {
        orders: this.store.db
          .prepare(
            'SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100'
          )
          .all(id)
          .map(orderView)
      }
    if (method === 'POST' && path === '/v1/test/grant') {
      shape(body, [])
      return this.store.mutate(
        id,
        path,
        { requestId: `test-grant:${this.testEpoch}` },
        now,
        (state) => {
          this.store.db
            .prepare('INSERT INTO test_grants VALUES(?,?,?)')
            .run(id, this.testEpoch, now)
          state.balances.tickets.learning += 100
          return { granted: 100, epoch: this.testEpoch }
        }
      )
    }
    const handlers = {
      '/v1/reward/activity': (state) => activity(state, body, now),
      '/v1/tasks/configure': (state) => configureTasks(state, body, now),
      '/v1/collection/legacy': (state) => importLegacy(state, body, now),
      '/v1/shop/purchase': (state) => purchase(state, body, now),
      '/v1/draw': (state) => draw(state, body, now, this.random),
      '/v1/inventory/use': (state) => makeup(state, body, now),
      '/v1/support/orders': (state) => this.createOrder(id, body, state, now)
    }
    if (method === 'POST' && handlers[path]) {
      requestId(body?.requestId)
      return this.store.mutate(id, path, body, now, handlers[path])
    }
    fail('NOT_FOUND', 404)
  }
  createOrder(id, body, _state, now) {
    if (!this.paymentsEnabled && !this.simulatedPayments) fail('PAYMENTS_DISABLED', 403)
    shape(body, ['requestId', 'tickets'], ['requestId', 'tickets'])
    const tickets = integer(body.tickets, 1, 100),
      amount = tickets * this.supportPrice
    const month = dayAt(now).slice(0, 7),
      from = Date.parse(`${month}-01T00:00:00+08:00`)
    const used = this.store.db
      .prepare(
        "SELECT COALESCE(SUM(amount_fen),0) AS total FROM orders WHERE user_id=? AND created_at>=? AND status IN ('pending','approved')"
      )
      .get(id, from).total
    if (used + amount > 6000) fail('SUPPORT_MONTH_LIMIT', 409)
    const order = {
      id: randomUUID(),
      user_id: id,
      tickets,
      amount_fen: amount,
      status: 'pending',
      created_at: now,
      testing: Number(this.simulatedPayments)
    }
    this.store.db
      .prepare(
        'INSERT INTO orders(id,user_id,tickets,amount_fen,status,created_at,testing) VALUES(?,?,?,?,?,?,?)'
      )
      .run(order.id, id, tickets, amount, 'pending', now, order.testing)
    return { order: orderView(order) }
  }
  adminRoute(method, path, body, token, now) {
    this.admin(token)
    this.store.rate('admin:mutation', now, 60)
    if (method === 'GET' && path === '/v1/admin/support/orders')
      return {
        orders: this.store.db
          .prepare("SELECT * FROM orders WHERE status='pending' ORDER BY created_at LIMIT 100")
          .all()
          .map((row) => ({ ...orderView(row), userId: row.user_id }))
      }
    const match = /^\/v1\/admin\/support\/orders\/([a-f0-9-]{36})\/(approve|reject|refund)$/.exec(
      path
    )
    if (method !== 'POST' || !match) fail('NOT_FOUND', 404)
    const [, orderId, action] = match
    const required =
      action === 'approve'
        ? ['requestId', 'paymentReference', 'amountFen', 'adultVerified']
        : ['requestId']
    shape(body, required, required)
    requestId(body?.requestId)
    if (action === 'approve') {
      if (!this.paymentsEnabled && !this.simulatedPayments) fail('PAYMENTS_DISABLED', 403)
      if (body.adultVerified !== true) fail('ADULT_VERIFICATION_REQUIRED', 403)
      text(body.paymentReference, 6, 128)
      integer(body.amountFen, 1, 6000)
    }
    const order = this.store.db.prepare('SELECT * FROM orders WHERE id=?').get(orderId)
    if (!order) fail('ORDER_NOT_FOUND', 404)
    return this.store.mutate(
      order.user_id,
      path,
      { ...body, requestId: `admin:${body.requestId}` },
      now,
      (state) => {
        const current = this.store.db.prepare('SELECT * FROM orders WHERE id=?').get(orderId)
        if (action === 'approve') {
          if (current.status !== 'pending') fail('ORDER_NOT_PENDING', 409)
          if (body.amountFen !== current.amount_fen) fail('PAYMENT_AMOUNT_MISMATCH', 409)
          const reference = text(body.paymentReference, 6, 128)
          if (!!current.testing !== this.simulatedPayments) fail('ORDER_MODE_MISMATCH', 409)
          if (this.simulatedPayments && !reference.startsWith('QA-'))
            fail('TEST_REFERENCE_REQUIRED')
          if (
            this.store.db.prepare('SELECT id FROM orders WHERE payment_reference=?').get(reference)
          )
            fail('PAYMENT_ALREADY_USED', 409)
          this.store.db
            .prepare(
              "UPDATE orders SET status='approved',payment_reference=?,approved_at=?,support_spent_at_approval=?,adult_verified=1 WHERE id=?"
            )
            .run(reference, now, state.supportSpent, orderId)
          state.balances.tickets.support += current.tickets
        } else if (action === 'reject') {
          if (current.status !== 'pending') fail('ORDER_NOT_PENDING', 409)
          this.store.db.prepare("UPDATE orders SET status='rejected' WHERE id=?").run(orderId)
        } else {
          if (current.status !== 'approved') fail('ORDER_NOT_APPROVED', 409)
          if (
            state.supportSpent !== current.support_spent_at_approval ||
            state.balances.tickets.support < current.tickets
          )
            fail('REFUND_REQUIRES_MANUAL_REVIEW', 409)
          state.balances.tickets.support -= current.tickets
          this.store.db.prepare("UPDATE orders SET status='refunded' WHERE id=?").run(orderId)
        }
        return {
          order: orderView(this.store.db.prepare('SELECT * FROM orders WHERE id=?').get(orderId))
        }
      }
    )
  }
  leaderboards(query) {
    const kind = query.kind || 'collection',
      language = query.language || null
    if (!['collection', 'time'].includes(kind)) fail('INVALID_LEADERBOARD')
    if (language !== null && !validLanguage(language)) fail('INVALID_LANGUAGE')
    const limit = integer(query.limit === undefined ? 20 : Number(query.limit), 1, 100)
    const rows = this.store.db
      .prepare(
        `SELECT public_id,display_name,state FROM users WHERE ${kind === 'collection' ? 'public_collection' : 'public_time'}=1`
      )
      .all()
      .map((row) => {
        const state = JSON.parse(row.state)
        const value =
          kind === 'collection'
            ? Object.keys(state.characters).length
            : language
              ? state.languageSeconds[language] || 0
              : Object.values(state.languageSeconds).reduce((a, b) => a + b, 0)
        return { publicId: row.public_id, nickname: row.display_name, value }
      })
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value || a.publicId.localeCompare(b.publicId))
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))
    return { kind, language: kind === 'collection' ? null : language, rows }
  }
}
