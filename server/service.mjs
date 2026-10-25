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
  claimStarter,
  draw,
  purchase,
  makeup,
  validLanguage,
  dayAt,
  selectCompanion,
  companionAnswer,
  updateHome
} from './domain.mjs'
import { characterFor } from './catalog.mjs'
import { ClientPolicy } from './client-policy.mjs'
import { YunGouOSProvider } from './yungouos.mjs'
import { SupportPayments, orderView } from './support-payments.mjs'

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
export class Service {
  constructor({
    path = ':memory:',
    now = Date.now,
    random,
    env = process.env,
    policyFetch,
    paymentProvider,
    paymentFetch
  } = {}) {
    this.store = new Store(path)
    this.now = now
    this.random = random
    this.env = { ...env }
    this.clientPolicy = new ClientPolicy({ now, env, fetch: policyFetch })
    this.testEnabled = env.NODE_ENV !== 'production' && env.QON_TEST_GRANTS === '1'
    const requestedPayments = env.QON_PAYMENTS_ENABLED === '1'
    if (requestedPayments && !this.testEnabled && paymentProvider === undefined) {
      try {
        paymentProvider = new YunGouOSProvider({
          mchId: env.QON_YUNGOUOS_MCH_ID || '',
          payKey: env.QON_YUNGOUOS_PAY_KEY || '',
          notifyUrl: env.QON_YUNGOUOS_NOTIFY_URL || '',
          now,
          ...(paymentFetch ? { fetchImpl: paymentFetch } : {})
        })
      } catch {
        paymentProvider = null
      }
    }
    this.paymentsEnabled = requestedPayments && !this.testEnabled && !!paymentProvider?.enabled
    this.simulatedPayments = !requestedPayments && env.NODE_ENV !== 'production'
    this.supportPayments = new SupportPayments(this, paymentProvider)
    this.testEpoch = env.QON_TEST_EPOCH || 'local-test-v1'
    this.supportPrice = Number(env.QON_SUPPORT_TICKET_FEN || 600)
    if (
      !Number.isSafeInteger(this.supportPrice) ||
      this.supportPrice < 1 ||
      this.supportPrice > 6000
    )
      throw new Error('Invalid QON_SUPPORT_TICKET_FEN')
    this.store.paymentCapabilities = (id) => ({
      enabled: this.paymentsEnabled,
      provider: this.paymentsEnabled ? 'yungouos' : null,
      mode: this.paymentsEnabled ? 'live' : this.simulatedPayments ? 'simulation' : 'disabled',
      currency: 'CNY',
      unitAmountFen: this.supportPrice,
      monthLimitFen: 6000,
      eligible: !!this.store.user(id)
    })
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
  async handle(
    method,
    path,
    body = {},
    { token, ip = 'local', app = 'qonsona', clientVersion, paymentProtocol, query = {} } = {}
  ) {
    const now = this.now()
    this.store.rate(`ip:${hash(ip)}`, now, 120)
    if (method === 'POST' || method === 'PATCH') shape(body, Object.keys(body || {}))
    // Provider retries must work after an application release or account-session expiry.
    if (method === 'POST' && path === '/v1/payments/yungouos/notify')
      return this.supportPayments.notification(body)
    if (!['qonlang', 'qonsona'].includes(app)) fail('INVALID_APP')
    if (method === 'GET' && path === '/v1/health')
      return {
        status: 'ok',
        testing: { grantsEnabled: this.testEnabled },
        payments: { enabled: this.paymentsEnabled, simulation: this.simulatedPayments }
      }
    if (method === 'GET' && path === '/v1/client-policy') {
      if (Object.keys(query).some((key) => key !== 'app')) fail('INVALID_FIELDS')
      return this.clientPolicy.get(query.app ?? app)
    }
    if (path.startsWith('/v1/admin/')) return this.adminRoute(method, path, body, token, now)
    if (method === 'POST' && path === '/v1/auth/register') {
      await this.clientPolicy.require(app, clientVersion)
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
      await this.clientPolicy.require(app, clientVersion)
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
    if (session.app !== app) fail('CLIENT_APP_MISMATCH', 403)
    this.store.rate(`account:${id}`, now, 90)
    if (method === 'POST' && path === '/v1/auth/logout') {
      shape(body, [])
      this.store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token))
      return { ok: true }
    }
    if (app === 'qonlang' && !['/v1/auth/me'].includes(path)) fail('CLIENT_ROUTE_UNAVAILABLE', 403)
    await this.clientPolicy.require(app, clientVersion)
    if (method === 'GET' && path === '/v1/auth/me')
      return { user: publicUser(this.store.user(id)), snapshot: this.store.snapshot(id, now) }
    if (method === 'PATCH' && path === '/v1/auth/me') {
      shape(body, ['nickname', 'publicCollection', 'publicTime', 'rankVisibility'])
      const user = this.store.user(id)
      const nickname = body.nickname === undefined ? user.display_name : text(body.nickname, 1, 40)
      for (const key of ['publicCollection', 'publicTime'])
        if (body[key] !== undefined && typeof body[key] !== 'boolean') fail('INVALID_PRIVACY')
      if (body.rankVisibility !== undefined && !['global', 'friends'].includes(body.rankVisibility))
        fail('INVALID_PRIVACY')
      this.store.transaction(() => {
        const fresh = this.store.user(id),
          state = JSON.parse(fresh.state)
        state.revision = (state.revision || 0) + 1
        this.store.db
          .prepare(
            'UPDATE users SET display_name=?,public_collection=?,public_time=?,rank_visibility=?,state=? WHERE id=?'
          )
          .run(
            nickname,
            body.publicCollection === undefined
              ? fresh.public_collection
              : Number(body.publicCollection),
            body.publicTime === undefined ? fresh.public_time : Number(body.publicTime),
            body.rankVisibility ?? fresh.rank_visibility,
            JSON.stringify(state),
            id
          )
      })
      return { user: publicUser(this.store.user(id)), snapshot: this.store.snapshot(id, now) }
    }
    if (method === 'GET' && path === '/v1/collection') return this.store.snapshot(id, now)
    if (method === 'GET' && path === '/v1/leaderboards') return this.leaderboards(query, id)
    if (method === 'GET' && path === '/v1/friends') return this.friends(id)
    if (method === 'GET' && path === '/v1/support/orders')
      return {
        orders: this.store.db
          .prepare(
            'SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100'
          )
          .all(id)
          .map(orderView)
      }
    const checkOrder = /^\/v1\/support\/orders\/([a-f0-9-]{36})\/check$/.exec(path)
    if (method === 'POST' && checkOrder) {
      shape(body, [])
      return this.supportPayments.check(checkOrder[1], id)
    }
    const closeOrder = /^\/v1\/support\/orders\/([a-f0-9-]{36})\/close$/.exec(path)
    if (method === 'POST' && closeOrder) return this.supportPayments.close(closeOrder[1], id, body)
    if (method === 'POST' && path === '/v1/support/orders' && !this.simulatedPayments) {
      if (this.paymentsEnabled && paymentProtocol !== 'yungouos-wechat-v1')
        fail('PAYMENT_CLIENT_UPDATE_REQUIRED', 409)
      return this.supportPayments.create(id, body, now)
    }
    if (method === 'POST' && path === '/v1/test/grant') {
      shape(body, ['requestId'], ['requestId'])
      requestId(body.requestId)
      return this.store.mutate(id, path, body, now, (state) => {
        state.balances.tickets.learning += 100
        return { granted: 100 }
      })
    }
    const handlers = {
      '/v1/reward/activity': (state) => activity(state, body, now),
      '/v1/tasks/configure': (state) => configureTasks(state, body, now),
      '/v1/collection/legacy': (state) => importLegacy(state, body, now),
      '/v1/collection/starter': (state) => claimStarter(state, body, now),
      '/v1/shop/purchase': (state) => purchase(state, body, now),
      '/v1/draw': (state) => {
        // The refund freeze and the ticket deduction share BEGIN IMMEDIATE.
        // A preflight read cannot protect against another connection committing
        // a refund review before this transaction starts.
        if (
          body.source === 'support' &&
          this.store.db
            .prepare("SELECT 1 FROM orders WHERE user_id=? AND payment_state='refund_review'")
            .get(id)
        )
          fail('PAYMENT_REVIEW_REQUIRED', 409)
        return draw(state, body, now, this.random, this.store.drawPool(now))
      },
      '/v1/home/update': (state) => updateHome(state, body),
      '/v1/inventory/use': (state) => makeup(state, body, now),
      '/v1/support/orders': (state) => this.createOrder(id, body, state, now),
      '/v1/companion/select': (state) => selectCompanion(state, body),
      '/v1/companion/answer': (state) =>
        companionAnswer(
          state,
          body,
          now,
          (language, answerId) =>
            this.store.db
              .prepare(
                'SELECT * FROM companion_answers WHERE user_id=? AND language=? AND answer_id=?'
              )
              .get(id, language, answerId),
          (language, answerId, characterId, xp) =>
            this.store.db
              .prepare('INSERT INTO companion_answers VALUES(?,?,?,?,?,?)')
              .run(id, language, answerId, characterId, xp, now)
        ),
      '/v1/friends/request': (state) => this.requestFriend(id, body, state, now),
      '/v1/friends/respond': (state) => this.respondFriend(id, body, state, now),
      '/v1/friends/remove': (state) => this.removeFriend(id, body, state, now)
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
  async adminRoute(method, path, body, token, now) {
    this.admin(token)
    this.store.rate('admin:mutation', now, 60)
    const refundCheck = /^\/v1\/admin\/support\/orders\/([a-f0-9-]{36})\/check-refund$/.exec(path)
    if (method === 'POST' && refundCheck) {
      shape(body, ['requestId', 'refundNo'], ['requestId', 'refundNo'])
      requestId(body.requestId)
      const refundNo = text(body.refundNo, 6, 128)
      return this.supportPayments.observeRefund(refundCheck[1], refundNo)
    }
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
          // Provider-backed orders can only be credited from authenticated provider evidence.
          if (current.provider) fail('PAYMENT_PROVIDER_VERIFICATION_REQUIRED', 409)
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
          if (current.provider) fail('PAYMENT_PROVIDER_VERIFICATION_REQUIRED', 409)
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
          this.store.db
            .prepare(
              "UPDATE orders SET status='refunded',payment_state=CASE WHEN provider IS NULL THEN payment_state ELSE 'refunded' END,refunded_at=? WHERE id=?"
            )
            .run(now, orderId)
        }
        return {
          order: orderView(this.store.db.prepare('SELECT * FROM orders WHERE id=?').get(orderId))
        }
      }
    )
  }
  publicProfile(user) {
    const state = JSON.parse(user.state)
    return {
      publicId: user.public_id,
      nickname: user.display_name,
      currentCompanion: characterFor(state.companion?.currentId)
    }
  }
  friends(id) {
    const profiles = this.store.db
      .prepare(
        'SELECT users.* FROM friend_edges JOIN users ON users.id=friend_edges.friend_id WHERE friend_edges.user_id=? ORDER BY friend_edges.created_at,users.public_id'
      )
      .all(id)
    const invitations = this.store.db
      .prepare(
        "SELECT * FROM friend_requests WHERE status='pending' AND (sender_id=? OR recipient_id=?) ORDER BY created_at DESC"
      )
      .all(id, id)
    return {
      friends: profiles.map((row) => this.publicProfile(row)),
      incoming: invitations
        .filter((entry) => entry.recipient_id === id)
        .map((entry) => ({
          id: entry.id,
          profile: this.publicProfile(this.store.user(entry.sender_id)),
          createdAt: entry.created_at
        })),
      outgoing: invitations
        .filter((entry) => entry.sender_id === id)
        .map((entry) => ({
          id: entry.id,
          profile: this.publicProfile(this.store.user(entry.recipient_id)),
          createdAt: entry.created_at
        })),
      ownPublicId: this.store.user(id).public_id
    }
  }
  friendByPublicId(publicId) {
    if (typeof publicId !== 'string' || !/^[a-f0-9-]{36}$/.test(publicId)) fail('INVALID_PUBLIC_ID')
    const user = this.store.db.prepare('SELECT * FROM users WHERE public_id=?').get(publicId)
    if (!user) fail('FRIEND_NOT_FOUND', 404)
    return user
  }
  bumpOtherUser(id) {
    const user = this.store.user(id),
      state = JSON.parse(user.state)
    state.revision = (state.revision || 0) + 1
    this.store.db.prepare('UPDATE users SET state=? WHERE id=?').run(JSON.stringify(state), id)
  }
  requestFriend(id, body, _state, now) {
    shape(body, ['requestId', 'publicId'], ['requestId', 'publicId'])
    const target = this.friendByPublicId(body.publicId)
    if (target.id === id) fail('CANNOT_FRIEND_SELF')
    if (
      this.store.db
        .prepare('SELECT 1 FROM friend_edges WHERE user_id=? AND friend_id=?')
        .get(id, target.id)
    )
      fail('ALREADY_FRIENDS', 409)
    if (
      this.store.db
        .prepare(
          "SELECT 1 FROM friend_requests WHERE status='pending' AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))"
        )
        .get(id, target.id, target.id, id)
    )
      fail('FRIEND_REQUEST_PENDING', 409)
    const pending = (account) =>
      this.store.db
        .prepare(
          "SELECT COUNT(*) AS count FROM friend_requests WHERE status='pending' AND (sender_id=? OR recipient_id=?)"
        )
        .get(account, account).count
    if (pending(id) >= 50 || pending(target.id) >= 50) fail('FRIEND_REQUEST_LIMIT', 409)
    this.store.db
      .prepare('INSERT INTO friend_requests VALUES(?,?,?,?,?)')
      .run(randomUUID(), id, target.id, 'pending', now)
    this.bumpOtherUser(target.id)
    return { friends: this.friends(id) }
  }
  respondFriend(id, body, _state, now) {
    shape(body, ['requestId', 'invitationId', 'accept'], ['requestId', 'invitationId', 'accept'])
    if (typeof body.accept !== 'boolean') fail('INVALID_FRIEND_RESPONSE')
    const invitationId = text(body.invitationId, 36, 36)
    const invitation = this.store.db
      .prepare('SELECT * FROM friend_requests WHERE id=?')
      .get(invitationId)
    if (!invitation || invitation.recipient_id !== id) fail('FRIEND_INVITATION_NOT_FOUND', 404)
    if (invitation.status !== 'pending') fail('FRIEND_INVITATION_HANDLED', 409)
    if (body.accept) {
      for (const account of [id, invitation.sender_id])
        if (
          this.store.db
            .prepare('SELECT COUNT(*) AS count FROM friend_edges WHERE user_id=?')
            .get(account).count >= 200
        )
          fail('FRIEND_LIMIT', 409)
      this.store.db
        .prepare('INSERT INTO friend_edges VALUES(?,?,?)')
        .run(id, invitation.sender_id, now)
      this.store.db
        .prepare('INSERT INTO friend_edges VALUES(?,?,?)')
        .run(invitation.sender_id, id, now)
    }
    this.store.db
      .prepare('UPDATE friend_requests SET status=? WHERE id=?')
      .run(body.accept ? 'accepted' : 'rejected', invitationId)
    this.bumpOtherUser(invitation.sender_id)
    return { friends: this.friends(id) }
  }
  removeFriend(id, body) {
    shape(body, ['requestId', 'publicId'], ['requestId', 'publicId'])
    const target = this.friendByPublicId(body.publicId)
    if (
      !this.store.db
        .prepare('SELECT 1 FROM friend_edges WHERE user_id=? AND friend_id=?')
        .get(id, target.id)
    )
      fail('NOT_FRIENDS', 409)
    this.store.db
      .prepare(
        'DELETE FROM friend_edges WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)'
      )
      .run(id, target.id, target.id, id)
    this.bumpOtherUser(target.id)
    return { friends: this.friends(id) }
  }
  leaderboards(query, viewerId) {
    const kind = query.kind || 'collection',
      language = query.language || null,
      scope = query.scope || 'global'
    if (!['collection', 'time'].includes(kind)) fail('INVALID_LEADERBOARD')
    if (!['global', 'friends'].includes(scope)) fail('INVALID_LEADERBOARD_SCOPE')
    if (language !== null && !validLanguage(language)) fail('INVALID_LANGUAGE')
    const limit = integer(query.limit === undefined ? 20 : Number(query.limit), 1, 100)
    const included = new Set([
      viewerId,
      ...this.store.db
        .prepare('SELECT friend_id FROM friend_edges WHERE user_id=?')
        .all(viewerId)
        .map((row) => row.friend_id)
    ])
    const rows = this.store.db
      .prepare(
        `SELECT id,public_id,display_name,state,rank_visibility FROM users WHERE ${kind === 'collection' ? 'public_collection' : 'public_time'}=1`
      )
      .all()
      .filter((row) =>
        scope === 'global' ? row.rank_visibility === 'global' : included.has(row.id)
      )
      .map((row) => {
        const state = JSON.parse(row.state)
        const value =
          kind === 'collection'
            ? Object.keys(state.characters).length
            : language
              ? state.languageSeconds[language] || 0
              : Object.values(state.languageSeconds).reduce((a, b) => a + b, 0)
        return {
          publicId: row.public_id,
          nickname: row.display_name,
          value,
          currentCompanion: characterFor(state.companion?.currentId)
        }
      })
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value || a.publicId.localeCompare(b.publicId))
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))
    return { kind, language: kind === 'collection' ? null : language, scope, rows }
  }
}
