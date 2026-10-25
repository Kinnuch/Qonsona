/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node payment boundary tests. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Service } from './client-fixture.mjs'
import { YunGouOSError } from '../yungouos.mjs'
import { createApi } from '../index.mjs'
import { Store } from '../store.mjs'

const ROUTE = '/v1/qonlang/support/orders'
const code = (expected) => (error) => error.code === expected
class Provider {
  enabled = true
  mchid = '1234567890'
  creates = []
  queries = []
  closes = []
  payments = new Map()
  async create(input) {
    this.creates.push(input)
    this.payments.set(input.outTradeNo, { ...input, mchid: this.mchid, status: 'pending' })
    await this.onCreate?.(input)
    return { qrCodeUrl: 'weixin://wxpay/bizpayurl?pr=PURE_SUPPORT', expiresAt: input.expiresAt }
  }
  async query(input) {
    this.queries.push(input)
    await this.onQuery?.(input)
    return this.payments.get(input.outTradeNo)
  }
  async closeOrder(input) {
    this.closes.push(input)
    await this.onClose?.(input)
    return { ...input, mchid: this.mchid, status: 'closed' }
  }
  verifyNotification(input) {
    if (input.sign !== 'valid') throw new YunGouOSError('PAYMENT_PROVIDER_INVALID_SIGNATURE')
    return { ...input, amountFen: Number(input.amountFen) }
  }
  async queryRefund() {
    return this.refund
  }
}
async function fixture(t, { path = ':memory:', enabled = true } = {}) {
  let now = Date.parse('2026-10-25T06:00:00Z')
  const provider = new Provider()
  const options = {
    path,
    now: () => now,
    paymentProvider: provider,
    env: { NODE_ENV: 'production', QON_PAYMENTS_ENABLED: enabled ? '1' : '0' }
  }
  const service = new Service(options)
  t.after(() => service.close())
  const credentials = {
    username: `q_${randomUUID().replaceAll('-', '').slice(0, 28)}`,
    password: 'synthetic-password-1234'
  }
  const user = await service.handle('POST', '/v1/auth/register', credentials, {
    app: 'qonlang',
    clientVersion: '1.0.0-beta.3'
  })
  const context = {
    app: 'qonlang',
    clientVersion: '1.0.0-beta.3',
    token: user.token,
    paymentProtocol: 'qonlang-support-v1'
  }
  const call = (method, path, body = {}, extra = {}) =>
    service.handle(method, path, body, { ...context, ...extra })
  const create = (amountFen = 123, requestId = randomUUID()) =>
    call('POST', ROUTE, { requestId, amountFen })
  const row = (order) => service.store.db.prepare('SELECT * FROM orders WHERE id=?').get(order.id)
  const state = () => service.store.user(user.user.id).state
  const pay = (order, extra = {}) => {
    const stored = row(order)
    const paid = {
      outTradeNo: stored.out_trade_no,
      mchid: provider.mchid,
      amountFen: stored.amount_fen,
      status: 'paid',
      transactionId: `TX_${order.id.replaceAll('-', '')}`,
      ...extra
    }
    provider.payments.set(stored.out_trade_no, paid)
    return paid
  }
  const notify = (facts) =>
    service.handle(
      'POST',
      '/v1/payments/yungouos/notify',
      { ...facts, sign: 'valid' },
      { app: 'not-a-client', clientVersion: 'old' }
    )
  return {
    service,
    options,
    provider,
    user,
    credentials,
    context,
    call,
    create,
    row,
    state,
    pay,
    notify,
    advance: (ms = 12001) => {
      now += ms
    }
  }
}

test('Qonlang beta auth and capabilities remain independent of Qonsona exact-latest and payments can fail closed', async (t) => {
  const f = await fixture(t, { enabled: false })
  assert.deepEqual(await f.call('GET', '/v1/qonlang/support'), {
    enabled: false,
    provider: null,
    currency: 'CNY',
    minAmountFen: 1,
    maxAmountFen: 60000
  })
  await assert.rejects(f.create(), code('PAYMENTS_DISABLED'))
  assert.equal(
    (await f.call('GET', '/v1/client-policy', {}, { query: { app: 'qonlang' } })).mode,
    'legacy-auth-only'
  )
  assert.equal(f.provider.creates.length, 0)
})

test('arbitrary integer-fen support is explicit, zero-entitlement and never changes economic state', async (t) => {
  const f = await fixture(t),
    before = f.state(),
    first = f.service.supportPayments.firstPurchase(f.user.user.id)
  const created = await f.create(123)
  assert.deepEqual(Object.keys(created), ['order'])
  assert.equal(created.order.amountFen, 123)
  assert.equal(created.order.status, 'pending')
  assert.equal(created.order.payment.state, 'pending')
  assert.ok(created.order.payment.qrCodeUrl)
  assert.equal(created.order.tickets, undefined)
  assert.equal(f.row(created.order).tickets, 0)
  assert.equal(f.row(created.order).app, 'qonlang')
  assert.ok(f.provider.creates[0].outTradeNo.startsWith('QL'))
  assert.equal(f.provider.creates[0].description, 'Qonlang 千语集 · 支持开发')
  assert.equal(f.state(), before)
  await f.notify(f.pay(created.order))
  const paid = (await f.call('POST', `${ROUTE}/${created.order.id}/refresh`)).order
  assert.equal(paid.status, 'paid')
  assert.equal(paid.payment.state, 'paid')
  assert.equal(paid.payment.qrCodeUrl, undefined)
  assert.equal(typeof paid.paidAt, 'number')
  assert.equal(f.row(paid).credited_tickets, 0)
  assert.equal(f.state(), before)
  assert.deepEqual(f.service.supportPayments.firstPurchase(f.user.user.id), first)
})

test('amount, request shape and protocol are validated before provider I/O or receipt reservation', async (t) => {
  const f = await fixture(t)
  for (const amountFen of [0, -1, 60001, 1.5, '100', null, NaN])
    await assert.rejects(f.create(amountFen))
  await assert.rejects(
    f.call('POST', ROUTE, { requestId: randomUUID(), amountFen: 1, tickets: 10 }),
    code('INVALID_FIELDS')
  )
  await assert.rejects(
    f.call(
      'POST',
      ROUTE,
      { requestId: randomUUID(), amountFen: 1 },
      { paymentProtocol: 'yungouos-wechat-v2' }
    ),
    code('PAYMENT_CLIENT_UPDATE_REQUIRED')
  )
  assert.equal(f.provider.creates.length, 0)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0)
})

test('same create UUID is durable and changing amount is rejected; second pending order is refused', async (t) => {
  const f = await fixture(t),
    id = randomUUID(),
    before = f.state()
  const a = await f.create(1, id),
    b = await f.create(1, id)
  assert.equal(a.order.id, b.order.id)
  await assert.rejects(f.create(2, id), code('IDEMPOTENCY_CONFLICT'))
  await assert.rejects(f.create(1), code('SUPPORT_ORDER_PENDING'))
  assert.equal(f.provider.creates.length, 1)
  assert.equal(f.state(), before)
})

test('Qonlang ownership and product routes prevent accessing or closing another product order', async (t) => {
  const f = await fixture(t),
    a = await f.create()
  const other = await f.service.handle(
    'POST',
    '/v1/auth/register',
    {
      username: `other_${randomUUID().slice(0, 12).replaceAll('-', '')}`,
      password: 'synthetic-password-1234'
    },
    { app: 'qonlang' }
  )
  await assert.rejects(
    f.call('POST', `${ROUTE}/${a.order.id}/refresh`, {}, { token: other.token }),
    code('ORDER_NOT_FOUND')
  )
  await assert.rejects(
    f.call(
      'POST',
      `${ROUTE}/${a.order.id}/close`,
      { requestId: randomUUID() },
      { token: other.token }
    ),
    code('ORDER_NOT_FOUND')
  )
  const qs = await f.service.handle('POST', '/v1/auth/login', f.credentials, { app: 'qonsona' })
  const qsContext = { token: qs.token, app: 'qonsona', paymentProtocol: 'yungouos-wechat-v2' }
  await assert.rejects(
    f.service.handle('POST', `${ROUTE}/${a.order.id}/refresh`, {}, qsContext),
    code('CLIENT_ROUTE_UNAVAILABLE')
  )
  await assert.rejects(
    f.service.handle('POST', `/v1/support/orders/${a.order.id}/check`, {}, qsContext),
    code('ORDER_NOT_FOUND')
  )
  await assert.rejects(f.call('GET', ROUTE, {}, { app: 'qonsona' }), code('CLIENT_APP_MISMATCH'))
  assert.deepEqual((await f.service.handle('GET', '/v1/support/orders', {}, qsContext)).orders, [])
  const qso = await f.service.handle(
    'POST',
    '/v1/support/orders',
    { requestId: randomUUID(), planId: 'custom', amountFen: 60 },
    qsContext
  )
  assert.equal(qso.order.tickets, 1)
  await assert.rejects(f.call('POST', `${ROUTE}/${qso.order.id}/refresh`), code('ORDER_NOT_FOUND'))
  assert.deepEqual(
    (await f.call('GET', ROUTE)).orders.map((o) => o.id),
    [a.order.id]
  )
})

test('unknown create is persisted across replacement service connections and never creates a new provider charge', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'qonlang-support-'))
  const f = await fixture(t, { path: join(dir, 'db.sqlite') }),
    id = randomUUID(),
    before = f.state()
  f.provider.onCreate = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  const a = await f.create(234, id)
  assert.equal(a.order.payment.state, 'creating')
  assert.equal(a.order.payment.qrCodeUrl, undefined)
  const second = new Service(f.options)
  t.after(() => second.close())
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const b = await second.handle('POST', ROUTE, { requestId: id, amountFen: 234 }, f.context)
  assert.equal(a.order.id, b.order.id)
  assert.equal(f.provider.creates.length, 1)
  await f.notify(f.pay(a.order))
  assert.equal(f.row(a.order).status, 'approved')
  assert.equal(f.state(), before)
})

test('signed callbacks need matching active channel facts and duplicate callbacks cannot re-settle', async (t) => {
  const f = await fixture(t),
    a = await f.create(),
    before = f.state()
  const facts = f.pay(a.order)
  await assert.rejects(f.notify({ ...facts, amountFen: 999 }), code('PAYMENT_AMOUNT_MISMATCH'))
  f.provider.payments.set(facts.outTradeNo, { ...facts, status: 'pending' })
  await assert.rejects(f.notify(facts), code('PAYMENT_NOT_CONFIRMED'))
  f.advance()
  f.provider.payments.set(facts.outTradeNo, facts)
  await f.notify(facts)
  const queries = f.provider.queries.length
  await f.notify(facts)
  assert.equal(f.provider.queries.length, queries)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 1)
  assert.equal(f.state(), before)
})

test('one merchant transaction can fund only one order across Qonlang and Qonsona', async (t) => {
  const f = await fixture(t),
    a = await f.create()
  const facts = f.pay(a.order)
  await f.notify(facts)
  const qs = await f.service.handle('POST', '/v1/auth/login', f.credentials, { app: 'qonsona' })
  const b = await f.service.handle(
    'POST',
    '/v1/support/orders',
    { requestId: randomUUID(), planId: 'custom', amountFen: 60 },
    { token: qs.token, app: 'qonsona', paymentProtocol: 'yungouos-wechat-v2' }
  )
  f.advance()
  const collision = f.pay(b.order, { transactionId: facts.transactionId })
  await assert.rejects(f.notify(collision), code('PAYMENT_ALREADY_USED'))
  assert.equal(f.row(b.order).status, 'pending')
  assert.equal(JSON.parse(f.state()).balances.tickets.support, 0)
})

test('shared merchant cooldown serializes checks across products and pure support worker persists closure without state changes', async (t) => {
  const f = await fixture(t),
    a = await f.create(),
    before = f.state()
  f.advance(10 * 60000 + 1)
  assert.deepEqual(await f.service.supportPayments.sweepExpiredOrders(), { processed: 1 })
  assert.equal(f.row(a.order).payment_state, 'closed')
  assert.equal(f.provider.closes.length, 1)
  assert.equal(f.state(), before)
  const late = f.pay(a.order)
  f.advance()
  await f.notify(late)
  assert.equal(f.row(a.order).payment_state, 'paid')
  assert.equal(f.state(), before)
})

test('expiry and close failures retain the original unknown order and can never imply payment cancellation', async (t) => {
  const f = await fixture(t),
    a = await f.create(),
    before = f.state(),
    closeId = randomUUID()
  f.provider.onQuery = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  await assert.rejects(
    f.call('POST', `${ROUTE}/${a.order.id}/close`, { requestId: closeId }),
    code('PAYMENT_PROVIDER_TIMEOUT')
  )
  assert.equal(f.row(a.order).status, 'pending')
  assert.equal(f.provider.closes.length, 0)
  f.advance(10 * 60000 + 1)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(a.order).status, 'pending')
  assert.ok(f.row(a.order).auto_close_attempts > 0)
  assert.equal(f.state(), before)
})

test('close UUID replay and verified full/partial refund observations do not mutate Qonsona economy', async (t) => {
  const f = await fixture(t),
    before = f.state(),
    a = await f.create(),
    closeId = randomUUID()
  const closed = await f.call('POST', `${ROUTE}/${a.order.id}/close`, { requestId: closeId })
  assert.equal(closed.order.status, 'closed')
  assert.equal(
    (await f.call('POST', `${ROUTE}/${a.order.id}/close`, { requestId: closeId })).order.status,
    'closed'
  )
  assert.equal(f.provider.closes.length, 1)
  f.advance()
  const b = await f.create(567)
  const paid = f.pay(b.order)
  await f.notify(paid)
  f.provider.refund = { ...paid, status: 'refunded', refundAmountFen: 1 }
  assert.equal(
    (await f.service.supportPayments.observeRefund(b.order.id, 'SYNTHETIC_REFUND')).order.status,
    'refund_review'
  )
  assert.equal(f.state(), before)
  assert.equal(f.service.supportPayments.firstPurchase(f.user.user.id).eligible, true)
  f.provider.refund = { ...paid, status: 'refunded', refundAmountFen: 567 }
  assert.equal(
    (await f.service.supportPayments.observeRefund(b.order.id, 'SYNTHETIC_REFUND')).order.status,
    'refunded'
  )
  assert.equal(f.state(), before)
})

test('real HTTP Qonlang callback returns exact SUCCESS and anonymous support endpoints never expose private orders', async (t) => {
  const f = await fixture(t),
    a = await f.create(),
    facts = f.pay(a.order)
  const api = createApi({ service: f.service })
  await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => api.close(resolve)))
  const base = `http://127.0.0.1:${api.address().port}`
  const anon = await fetch(base + ROUTE, { headers: { 'X-Qon-App': 'qonlang' } })
  assert.equal(anon.status, 401)
  const response = await fetch(base + '/v1/payments/yungouos/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...facts, sign: 'valid' })
  })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'SUCCESS')
})

test('merchant query lease applies across products rather than per application', async (t) => {
  const f = await fixture(t),
    a = await f.create()
  const qs = await f.service.handle('POST', '/v1/auth/login', f.credentials, { app: 'qonsona' })
  const context = { token: qs.token, app: 'qonsona', paymentProtocol: 'yungouos-wechat-v2' }
  const b = await f.service.handle(
    'POST',
    '/v1/support/orders',
    { requestId: randomUUID(), planId: 'custom', amountFen: 60 },
    context
  )
  await f.call('POST', `${ROUTE}/${a.order.id}/refresh`)
  await f.service.handle('POST', `/v1/support/orders/${b.order.id}/check`, {}, context)
  assert.equal(f.provider.queries.length, 1)
  f.advance()
  await f.service.handle('POST', `/v1/support/orders/${b.order.id}/check`, {}, context)
  assert.equal(f.provider.queries.length, 2)
})

test('Qonlang refund review cannot freeze Qonsona support-ticket spending', async (t) => {
  const f = await fixture(t),
    a = await f.create()
  const donation = f.pay(a.order)
  await f.notify(donation)
  f.provider.refund = { ...donation, status: 'refunded', refundAmountFen: 1 }
  await f.service.supportPayments.observeRefund(a.order.id, 'SYNTHETIC_REFUND')
  const qs = await f.service.handle('POST', '/v1/auth/login', f.credentials, { app: 'qonsona' })
  const context = { token: qs.token, app: 'qonsona', paymentProtocol: 'yungouos-wechat-v2' }
  const b = await f.service.handle(
    'POST',
    '/v1/support/orders',
    { requestId: randomUUID(), planId: 'custom', amountFen: 60 },
    context
  )
  f.advance()
  await f.notify(f.pay(b.order))
  const result = await f.service.handle(
    'POST',
    '/v1/draw',
    {
      requestId: randomUUID(),
      source: 'support',
      count: 1,
      expectedPoolId: f.service.store.drawPool(f.service.now()).id
    },
    context
  )
  assert.equal(result.snapshot.balances.tickets.support, 0)
  assert.equal(f.row(a.order).payment_state, 'refund_review')
})

test('a zero-QR expired reservation needs strict channel absence and a signed paid claim prevents cancellation', async (t) => {
  const f = await fixture(t),
    before = f.state()
  f.provider.onCreate = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  const a = await f.create()
  f.provider.onQuery = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_ORDER_NOT_FOUND')
  }
  const paid = f.pay(a.order)
  await assert.rejects(f.notify(paid), code('PAYMENT_NOT_CONFIRMED'))
  f.advance(10 * 60000 + 1)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(a.order).status, 'pending')
  f.provider.onQuery = null
  f.advance()
  await f.notify(paid)
  assert.equal(f.row(a.order).payment_state, 'paid')
  assert.equal(f.state(), before)
})

test('two SQLite connections cannot reserve a second pure support while provider creation is in flight', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'qonlang-concurrent-'))
  const f = await fixture(t, { path: join(dir, 'db.sqlite') })
  const second = new Service(f.options)
  t.after(() => second.close())
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  f.provider.onCreate = async () => {
    await assert.rejects(
      second.handle('POST', ROUTE, { requestId: randomUUID(), amountFen: 200 }, f.context),
      code('SUPPORT_ORDER_PENDING')
    )
  }
  await f.create()
  assert.equal(f.provider.creates.length, 1)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1)
})

test('additive product migration preserves every historical order field and original one-fen entitlement', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'qonlang-migration-')),
    path = join(dir, 'db.sqlite')
  const old = new Store(path)
  const user = old.createUser('historical', 'Historical', 'synthetic-password-hash', 1792900000000)
  const id = randomUUID()
  old.db
    .prepare(
      "INSERT INTO orders(id,user_id,tickets,amount_fen,status,created_at,credited_tickets,payment_reference) VALUES(?,?,1,1,'approved',?,1,'SYNTHETIC_OLD_TX')"
    )
    .run(id, user.id, 1792900000000)
  old.db
    .prepare('INSERT INTO payment_receipts VALUES(?,?,?,?,?)')
    .run('yungouos', 'SYNTHETIC_OLD_TX', id, 1, 1792900000000)
  old.db.exec('ALTER TABLE orders DROP COLUMN app; ALTER TABLE orders DROP COLUMN purpose;')
  const baseline = old.db.prepare('SELECT * FROM orders WHERE id=?').get(id)
  const identities = JSON.stringify(old.db.prepare('SELECT * FROM users').all())
  const receipts = JSON.stringify(old.db.prepare('SELECT * FROM payment_receipts').all())
  old.close()
  const current = new Store(path)
  t.after(() => current.close())
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const migrated = current.db.prepare('SELECT * FROM orders WHERE id=?').get(id)
  assert.equal(migrated.app, 'qonsona')
  assert.equal(migrated.purpose, 'support-tickets')
  for (const key of Object.keys(baseline)) assert.equal(migrated[key], baseline[key], key)
  assert.equal(JSON.stringify(current.db.prepare('SELECT * FROM users').all()), identities)
  assert.equal(JSON.stringify(current.db.prepare('SELECT * FROM payment_receipts').all()), receipts)
})

test('independent SQLite settlement connections retain exactly one receipt and no economic revision', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'qonlang-settlement-'))
  const f = await fixture(t, { path: join(dir, 'db.sqlite') })
  const second = new Service(f.options)
  t.after(() => second.close())
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const a = await f.create(),
    before = f.state(),
    payment = f.pay(a.order)
  f.provider.onQuery = () => second.supportPayments.settle(a.order.id, payment)
  await f.notify(payment)
  second.supportPayments.settle(a.order.id, payment)
  assert.equal(
    f.service.store.db
      .prepare('SELECT COUNT(*) AS n FROM payment_receipts WHERE order_id=?')
      .get(a.order.id).n,
    1
  )
  assert.equal(f.row(a.order).credited_tickets, 0)
  assert.equal(f.state(), before)
})
