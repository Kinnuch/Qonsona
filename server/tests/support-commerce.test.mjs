/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Isolated commerce and deadline security tests. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { Service } from './client-fixture.mjs'
import { YunGouOSError } from '../yungouos.mjs'

const ADMIN = 'isolated-local-commerce-admin-key-'.repeat(2)
const START = Date.parse('2026-10-25T04:00:00Z')
const code = (expected) => (error) => error.code === expected
class FakeProvider {
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
    return {
      qrCodeUrl: 'weixin://wxpay/bizpayurl?pr=LOCAL_COMMERCE_ONLY',
      expiresAt: input.expiresAt
    }
  }
  async query(input) {
    this.queries.push(input)
    await this.onQuery?.(input)
    return this.payments.get(input.outTradeNo)
  }
  async closeOrder(input) {
    this.closes.push(input)
    await this.onClose?.(input)
    const result = { ...this.payments.get(input.outTradeNo), mchid: this.mchid, status: 'closed' }
    this.payments.set(input.outTradeNo, result)
    return result
  }
  verifyNotification(input) {
    if (input.sign !== 'local-valid') throw new YunGouOSError('PAYMENT_PROVIDER_INVALID_SIGNATURE')
    return input
  }
  async queryRefund() {
    return this.refund
  }
}
function fixture(t, { disk = false } = {}) {
  let now = START
  const directory = disk ? mkdtempSync(join(tmpdir(), 'qon-commerce-security-')) : null
  const path = directory ? join(directory, 'accounts.sqlite') : ':memory:'
  const provider = new FakeProvider()
  const options = {
    path,
    now: () => now,
    paymentProvider: provider,
    env: { NODE_ENV: 'production', QON_PAYMENTS_ENABLED: '1', QON_ADMIN_KEY: ADMIN }
  }
  const service = new Service(options)
  const services = [service]
  const user = service.store.createUser('commerce_user', 'Local Only', 'not-a-password', now)
  const session = service.session(user, 'qonsona', now)
  const context = { token: session.token, paymentProtocol: 'yungouos-wechat-v2' }
  t.after(() => {
    for (const instance of services.reverse()) instance.close()
    if (directory) {
      assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
      assert.ok(basename(directory).startsWith('qon-commerce-security-'))
      rmSync(directory, { recursive: true, force: true })
    }
  })
  const create = (
    planId = 'custom',
    amountFen = 60,
    requestId = randomUUID(),
    instance = service
  ) =>
    instance.handle(
      'POST',
      '/v1/support/orders',
      { requestId, planId, ...(planId === 'custom' ? { amountFen } : {}) },
      context
    )
  const row = (order) => service.supportPayments.get(order.id)
  const pay = (order) => {
    const record = row(order)
    const paid = {
      outTradeNo: record.out_trade_no,
      amountFen: record.amount_fen,
      mchid: provider.mchid,
      status: 'paid',
      transactionId: `WX_${record.id.replaceAll('-', '')}`
    }
    provider.payments.set(record.out_trade_no, paid)
    return paid
  }
  const notify = (order, instance = service) =>
    instance.handle('POST', '/v1/payments/yungouos/notify', { ...pay(order), sign: 'local-valid' })
  return {
    service,
    provider,
    user,
    context,
    create,
    async createOther(planId = 'support-6') {
      const row = service.store.createUser(
        `other_${randomUUID().slice(0, 8)}`,
        'Other synthetic account',
        'not-a-password',
        now
      )
      const other = service.session(row, 'qonsona', now)
      return service.handle(
        'POST',
        '/v1/support/orders',
        { requestId: randomUUID(), planId },
        { token: other.token, paymentProtocol: 'yungouos-wechat-v2' }
      )
    },
    row,
    pay,
    notify,
    snapshot: () => service.store.snapshot(user.id, now),
    advance: (ms = 12001) => (now += ms),
    peer: () => {
      const peer = new Service(options)
      services.push(peer)
      return peer
    },
    close: (order) =>
      service.handle(
        'POST',
        `/v1/support/orders/${order.id}/close`,
        { requestId: randomUUID() },
        context
      ),
    request: (path, body) => service.handle('POST', path, body, context)
  }
}

test('server catalog defines the exact fixed plans, custom step and no obsolete monthly application cap', (t) => {
  const f = fixture(t),
    payments = f.snapshot().payments
  assert.equal(payments.unitAmountFen, 60)
  assert.equal(payments.orderMaxFen, 60000)
  assert.equal(payments.monthLimitFen, null)
  assert.deepEqual(
    payments.plans.map(
      ({ id, amountFen, baseTickets, bonusTickets, tickets, firstPurchaseOnly }) => ({
        id,
        amountFen,
        baseTickets,
        bonusTickets,
        tickets,
        firstPurchaseOnly
      })
    ),
    [
      {
        id: 'first-support',
        amountFen: 1,
        baseTickets: 10,
        bonusTickets: 0,
        tickets: 10,
        firstPurchaseOnly: true
      },
      {
        id: 'support-6',
        amountFen: 600,
        baseTickets: 10,
        bonusTickets: 0,
        tickets: 10,
        firstPurchaseOnly: false
      },
      {
        id: 'support-60',
        amountFen: 6000,
        baseTickets: 100,
        bonusTickets: 10,
        tickets: 110,
        firstPurchaseOnly: false
      },
      {
        id: 'support-600',
        amountFen: 60000,
        baseTickets: 1000,
        bonusTickets: 100,
        tickets: 1100,
        firstPurchaseOnly: false
      }
    ]
  )
  assert.deepEqual(payments.custom, {
    minAmountFen: 60,
    maxAmountFen: 60000,
    stepAmountFen: 60,
    ticketAmountFen: 60
  })
  assert.deepEqual(payments.firstPurchase, { eligible: true, claimed: false })
})

test('fixed packages cannot accept client amount, bonus, tickets, merchant or currency overrides', async (t) => {
  const f = fixture(t)
  for (const extra of [
    { amountFen: 1 },
    { tickets: 999999 },
    { bonusTickets: 1000 },
    { currency: 'USD' },
    { mchid: 'wrong' }
  ])
    await assert.rejects(
      f.request('/v1/support/orders', { requestId: randomUUID(), planId: 'support-600', ...extra }),
      code('INVALID_FIELDS')
    )
  await assert.rejects(f.create('missing-plan'), code('INVALID_SUPPORT_PLAN'))
  await assert.rejects(
    f.service.handle(
      'POST',
      '/v1/support/orders',
      { requestId: randomUUID(), tickets: 1 },
      { ...f.context, paymentProtocol: 'yungouos-wechat-v1' }
    ),
    code('PAYMENT_CLIENT_UPDATE_REQUIRED')
  )
  await assert.rejects(
    f.request('/v1/support/orders', { requestId: randomUUID(), tickets: 1 }),
    code('INVALID_FIELDS')
  )
  assert.equal(f.provider.creates.length, 0)
})

test('custom amounts require exact integer fen multiples from 60 through 60000 and grant no bonus', async (t) => {
  const f = fixture(t)
  await assert.rejects(
    f.request('/v1/support/orders', { requestId: randomUUID(), planId: 'custom' }),
    code('INVALID_NUMBER')
  )
  for (const amount of [null, '60', 0, -60, 59, 60001, 60.1, true])
    await assert.rejects(f.create('custom', amount), code('INVALID_NUMBER'))
  for (const amount of [61, 100, 59999])
    await assert.rejects(f.create('custom', amount), code('INVALID_SUPPORT_AMOUNT'))
  for (const [amount, tickets] of [
    [60, 1],
    [120, 2],
    [60000, 1000]
  ]) {
    const { order } = await f.create('custom', amount)
    assert.equal(order.amountFen, amount)
    assert.equal(order.tickets, tickets)
    assert.equal(order.baseTickets, tickets)
    assert.equal(order.bonusTickets, 0)
    assert.equal(order.planId, 'custom')
    await f.close(order)
    f.advance()
  }
  assert.equal(f.snapshot().balances.tickets.support, 0)
})

test('channel-verified package payments credit exact base plus bonus once while repeated high-value packages remain available', async (t) => {
  const f = fixture(t)
  for (const [planId, tickets] of [
    ['support-6', 10],
    ['support-60', 110],
    ['support-600', 1100]
  ]) {
    const { order } = await f.create(planId)
    const before = f.snapshot().balances.tickets.support
    await f.notify(order)
    await f.notify(order)
    assert.equal(f.snapshot().balances.tickets.support, before + tickets)
    assert.equal(f.row(order).credited_tickets, tickets)
    f.advance()
  }
  assert.equal(f.snapshot().balances.tickets.support, 1220)
  assert.equal((await f.create('support-600')).order.amountFen, 60000)
  assert.equal(f.snapshot().payments.firstPurchase.eligible, false)
})

test('one account can reserve only one first-purchase promotion across two SQLite connections and unknown creation keeps it locked', async (t) => {
  const f = fixture(t, { disk: true }),
    peer = f.peer()
  f.provider.onCreate = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  const results = await Promise.allSettled([
    f.create('first-support'),
    f.create('first-support', 1, randomUUID(), peer)
  ])
  const completed = results.filter((result) => result.status === 'fulfilled')
  assert.equal(completed.length, 1)
  assert.equal(
    results.filter(
      (result) => result.status === 'rejected' && result.reason.code === 'SUPPORT_ORDER_PENDING'
    ).length,
    1
  )
  assert.equal(f.provider.creates.length, 1)
  const { order } = completed[0].value
  assert.equal(order.payment.state, 'creating')
  assert.deepEqual(f.snapshot().payments.firstPurchase, {
    eligible: false,
    claimed: false,
    pendingOrderId: order.id
  })
  await assert.rejects(f.create('first-support'), code('SUPPORT_ORDER_PENDING'))
  assert.equal(f.snapshot().balances.tickets.support, 0)
})

test('confirmed unpaid closure releases first-purchase opportunity, whereas close timeout keeps the same reservation', async (t) => {
  const f = fixture(t),
    { order } = await f.create('first-support')
  f.provider.onClose = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  await assert.rejects(f.close(order), code('PAYMENT_PROVIDER_TIMEOUT'))
  assert.equal(f.snapshot().payments.firstPurchase.pendingOrderId, order.id)
  await assert.rejects(f.create('first-support'), code('SUPPORT_ORDER_PENDING'))
  f.advance()
  f.provider.onClose = null
  await f.close(order)
  assert.deepEqual(f.snapshot().payments.firstPurchase, { eligible: true, claimed: false })
  const next = await f.create('first-support')
  assert.notEqual(next.order.id, order.id)
  assert.equal(next.order.amountFen, 1)
})

test('historical 0.01-yuan one-ticket receipts keep original entitlement and permanently exclude new first-purchase offers even when refunded', async (t) => {
  const f = fixture(t, { disk: true }),
    orderId = randomUUID()
  f.service.store.db
    .prepare(
      "INSERT INTO orders(id,user_id,tickets,amount_fen,status,created_at,testing,provider,out_trade_no,merchant_id,payment_state,payment_reference) VALUES(?,?,1,1,'refunded',?,0,'yungouos',?,?,'refunded',?)"
    )
    .run(
      orderId,
      f.user.id,
      START - 10000,
      `QS${orderId.replaceAll('-', '')}`,
      f.provider.mchid,
      'WX_HISTORICAL_ONE_FEN'
    )
  f.service.store.db
    .prepare('INSERT INTO payment_receipts VALUES(?,?,?,?,?)')
    .run('yungouos', 'WX_HISTORICAL_ONE_FEN', orderId, 1, START - 10000)
  const peer = f.peer()
  const row = peer.supportPayments.get(orderId)
  assert.equal(row.amount_fen, 1)
  assert.equal(row.tickets, 1)
  assert.equal(row.plan_id, null)
  assert.deepEqual(f.snapshot().payments.firstPurchase, { eligible: false, claimed: true })
  await assert.rejects(f.create('first-support'), code('FIRST_SUPPORT_UNAVAILABLE'))
  assert.equal(f.provider.creates.length, 0)
})

test('a genuine old-schema approved one-fen one-ticket row backfills credited tickets exactly once and reopening never rewrites a new uncredited review row', (t) => {
  const f = fixture(t, { disk: true })
  const old = randomUUID(),
    pending = randomUUID(),
    refunded = randomUUID()
  for (const [id, status] of [
    [old, 'approved'],
    [pending, 'pending'],
    [refunded, 'refunded']
  ])
    f.service.store.db
      .prepare(
        'INSERT INTO orders(id,user_id,tickets,amount_fen,status,created_at,testing) VALUES(?,?,1,1,?,?,0)'
      )
      .run(id, f.user.id, status, START - 10000)
  f.service.store.db
    .prepare('INSERT INTO payment_receipts VALUES(?,?,?,?,?)')
    .run('yungouos', 'WX_OLD_ONE_FEN_PAID', old, 1, START - 10000)
  const before = JSON.parse(f.service.store.user(f.user.id).state)
  before.balances.tickets.support = 1
  f.service.store.db
    .prepare('UPDATE users SET state=? WHERE id=?')
    .run(JSON.stringify(before), f.user.id)
  f.service.store.db.exec('ALTER TABLE orders DROP COLUMN credited_tickets')
  assert.equal(
    f.service.store.db
      .prepare('PRAGMA table_info(orders)')
      .all()
      .some((column) => column.name === 'credited_tickets'),
    false
  )
  const migrated = f.peer()
  assert.equal(migrated.supportPayments.get(old).credited_tickets, 1)
  assert.equal(migrated.supportPayments.get(old).tickets, 1)
  assert.equal(migrated.supportPayments.get(old).amount_fen, 1)
  assert.equal(migrated.supportPayments.get(old).plan_id, null)
  assert.equal(migrated.supportPayments.get(pending).credited_tickets, 0)
  assert.equal(migrated.supportPayments.get(refunded).credited_tickets, 0)
  assert.deepEqual(JSON.parse(migrated.store.user(f.user.id).state), before)

  const uncredited = randomUUID()
  migrated.store.db
    .prepare(
      "INSERT INTO orders(id,user_id,tickets,amount_fen,status,created_at,testing,provider,payment_state,plan_id,credited_tickets) VALUES(?,?,10,1,'approved',?,0,'yungouos','refund_review','first-support',0)"
    )
    .run(uncredited, f.user.id, START)
  const reopened = f.peer()
  assert.equal(reopened.supportPayments.get(old).credited_tickets, 1)
  assert.equal(reopened.supportPayments.get(uncredited).credited_tickets, 0)
  assert.deepEqual(JSON.parse(reopened.store.user(f.user.id).state), before)
})

test('a valid promotional invoice retains its entitlement on late payment after another normal package was paid', async (t) => {
  const f = fixture(t),
    first = (await f.create('first-support')).order
  await f.close(first)
  const normal = (await f.create('support-6')).order
  f.advance()
  await f.notify(normal)
  f.advance()
  await f.notify(first)
  assert.equal(f.snapshot().balances.tickets.support, 20)
  assert.equal(f.row(first).credited_tickets, 10)
  await assert.rejects(f.create('first-support'), code('FIRST_SUPPORT_UNAVAILABLE'))
})

test('closed old and replacement first orders both paid can claim only one promotion; second payment is preserved for review and full verified refund deducts zero unissued tickets', async (t) => {
  const f = fixture(t, { disk: true }),
    old = (await f.create('first-support')).order
  await f.close(old)
  const replacement = (await f.create('first-support')).order
  const peer = f.peer()
  f.advance()
  await f.notify(old, peer)
  f.advance()
  await f.notify(replacement)
  assert.equal(f.row(old).credited_tickets, 10)
  assert.equal(f.row(replacement).credited_tickets, 0)
  assert.equal(f.row(replacement).status, 'approved')
  assert.equal(f.row(replacement).payment_state, 'refund_review')
  assert.equal(f.snapshot().balances.tickets.support, 10)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 2)
  assert.equal(
    f.service.store.db.prepare('SELECT COUNT(*) AS n FROM first_support_claims').get().n,
    1
  )
  await f.notify(old)
  await f.notify(replacement)
  assert.equal(f.snapshot().balances.tickets.support, 10)
  await assert.rejects(
    f.request('/v1/draw', { requestId: randomUUID(), source: 'support', count: 1 }),
    code('PAYMENT_REVIEW_REQUIRED')
  )
  f.provider.refund = {
    ...f.pay(replacement),
    status: 'refunded',
    refundAmountFen: 1,
    refundNo: 'RF_ZERO_CREDIT'
  }
  const refunded = await f.service.supportPayments.observeRefund(replacement.id, 'RF_ZERO_CREDIT')
  assert.equal(refunded.order.status, 'refunded')
  assert.equal(f.snapshot().balances.tickets.support, 10)
  await assert.rejects(f.create('first-support'), code('FIRST_SUPPORT_UNAVAILABLE'))
})

test('a normal first-purchase full refund reverses its ten unused tickets without resetting the unique promotion', async (t) => {
  const f = fixture(t),
    { order } = await f.create('first-support')
  await f.notify(order)
  f.provider.refund = {
    ...f.pay(order),
    status: 'refunded',
    refundAmountFen: 1,
    refundNo: 'RF_FIRST_SUPPORT'
  }
  await f.service.supportPayments.observeRefund(order.id, 'RF_FIRST_SUPPORT')
  assert.equal(f.snapshot().balances.tickets.support, 0)
  assert.equal(f.snapshot().payments.firstPurchase.claimed, true)
  await assert.rejects(f.create('first-support'), code('FIRST_SUPPORT_UNAVAILABLE'))
})

test('ten-minute deadline starts a real active query and unpaid channel close without granting tickets', async (t) => {
  const f = fixture(t),
    { order } = await f.create('first-support')
  assert.equal(order.payment.expiresAt, START + 600000)
  f.advance(599999)
  assert.deepEqual(await f.service.supportPayments.sweepExpiredOrders(), { processed: 0 })
  assert.equal(f.provider.queries.length, 0)
  f.advance(1)
  assert.deepEqual(await f.service.supportPayments.sweepExpiredOrders(), { processed: 1 })
  assert.equal(f.provider.queries.length, 1)
  assert.equal(f.provider.closes.length, 1)
  assert.equal(f.row(order).payment_state, 'closed')
  assert.equal(f.snapshot().balances.tickets.support, 0)
  assert.equal(f.snapshot().payments.firstPurchase.eligible, true)
})

test('deadline query timeout persists bounded retry/backoff and never fabricates closure or releases promotion', async (t) => {
  const f = fixture(t),
    { order } = await f.create('first-support')
  f.provider.onQuery = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  f.advance(600000)
  await f.service.supportPayments.sweepExpiredOrders()
  const failed = f.row(order)
  assert.equal(failed.status, 'pending')
  assert.equal(failed.auto_close_attempts, 1)
  assert.equal(failed.auto_close_next_at, START + 630000)
  assert.equal(f.provider.closes.length, 0)
  assert.equal(f.snapshot().payments.firstPurchase.eligible, false)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.provider.queries.length, 1)
  f.advance(30000)
  f.provider.onQuery = null
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(order).payment_state, 'closed')
  assert.equal(f.provider.closes.length, 1)
})

test('missing or longer channel display deadlines cannot erase or extend the authoritative ten-minute timeout', async (t) => {
  const f = fixture(t)
  const create = f.provider.create.bind(f.provider)
  f.provider.create = async (input) => ({ ...(await create(input)), expiresAt: undefined })
  const first = (await f.create('support-6')).order
  assert.equal(first.payment.expiresAt, START + 600000)
  await f.close(first)
  f.provider.create = async (input) => ({ ...(await create(input)), expiresAt: START + 1200000 })
  const second = (await f.create('support-60')).order
  assert.equal(second.payment.expiresAt, START + 600000)
})

test('unknown channel state is not an unpaid fact and cannot automatically close an invoice', async (t) => {
  const f = fixture(t),
    { order } = await f.create('support-6')
  f.provider.payments.get(f.row(order).out_trade_no).status = 'unknown'
  f.advance(600000)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(order).status, 'pending')
  assert.equal(f.row(order).provider_status, 'unknown')
  assert.equal(f.provider.closes.length, 0)
  assert.equal(f.snapshot().balances.tickets.support, 0)
})

test('an expired paid invoice is settled to its exact package entitlement instead of closed or refunded', async (t) => {
  const f = fixture(t),
    { order } = await f.create('support-60')
  f.pay(order)
  f.advance(600000)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(order).status, 'approved')
  assert.equal(f.snapshot().balances.tickets.support, 110)
  assert.equal(f.provider.closes.length, 0)
})

test('process replacement recovers old pending deadlines and a startup worker closes them without a client window', async (t) => {
  const f = fixture(t, { disk: true }),
    { order } = await f.create('support-6')
  f.service.store.db
    .prepare('UPDATE orders SET expires_at=? WHERE id=?')
    .run(START + 1200000, order.id)
  f.advance(600000)
  const peer = f.peer()
  assert.equal(peer.supportPayments.get(order.id).expires_at, START + 600000)
  peer.supportPayments.startMaintenance()
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(f.row(order).payment_state, 'closed')
  assert.equal(f.provider.queries.length, 1)
  assert.equal(f.provider.closes.length, 1)
})

test('persisted worker lease prevents simultaneous processes consuming duplicate channel-query slots', async (t) => {
  const f = fixture(t, { disk: true }),
    peer = f.peer()
  await f.create('support-6')
  await f.createOther('support-60')
  f.advance(600000)
  const results = await Promise.all([
    f.service.supportPayments.sweepExpiredOrders(),
    peer.supportPayments.sweepExpiredOrders()
  ])
  assert.equal(
    results.reduce((sum, result) => sum + result.processed, 0),
    1
  )
  assert.equal(f.provider.queries.length, 1)
  assert.equal(f.provider.closes.length, 1)
  f.advance(30000)
  await peer.supportPayments.sweepExpiredOrders()
  assert.equal(f.provider.queries.length, 2)
  assert.equal(f.provider.closes.length, 2)
})

test('authenticated callback demand takes priority over background closures after a merchant query cooldown', async (t) => {
  const f = fixture(t),
    old = (await f.createOther('first-support')).order,
    paid = (await f.create('support-6')).order
  f.advance(600000)
  f.service.supportPayments.lease(`query:yungouos:${f.provider.mchid}`, 12000)
  await assert.rejects(f.notify(paid), code('PAYMENT_CHECK_BUSY'))
  f.advance()
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.provider.queries.length, 0)
  assert.equal(f.row(old).status, 'pending')
  await f.notify(paid)
  assert.equal(f.snapshot().balances.tickets.support, 10)
  f.advance(2 * 60000 + 1)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(old).payment_state, 'closed')
})

test('legacy operator mutations cannot fake provider evidence and production cannot approve provider-less manual orders', async (t) => {
  const f = fixture(t),
    { order } = await f.create('support-6')
  await f.notify(order)
  for (const action of ['approve', 'reject', 'refund']) {
    const body = {
      requestId: randomUUID(),
      ...(action === 'approve'
        ? { amountFen: 600, paymentReference: 'MANUAL_CLAIM', adultVerified: true }
        : {})
    }
    await assert.rejects(
      f.service.handle('POST', `/v1/admin/support/orders/${order.id}/${action}`, body, {
        token: ADMIN
      }),
      code('PAYMENT_PROVIDER_VERIFICATION_REQUIRED')
    )
  }
  const manual = randomUUID()
  f.service.store.db
    .prepare(
      "INSERT INTO orders(id,user_id,tickets,amount_fen,status,created_at,testing) VALUES(?,?,10,600,'pending',?,0)"
    )
    .run(manual, f.user.id, START)
  await assert.rejects(
    f.service.handle(
      'POST',
      `/v1/admin/support/orders/${manual}/approve`,
      {
        requestId: randomUUID(),
        amountFen: 600,
        paymentReference: 'MANUAL_CLAIM',
        adultVerified: true
      },
      { token: ADMIN }
    ),
    code('PAYMENT_PROVIDER_VERIFICATION_REQUIRED')
  )
  assert.equal(f.snapshot().balances.tickets.support, 10)
  assert.equal(f.row(order).status, 'approved')
})

test('one pending order per account is enforced atomically across SQLite connections while same-request replay remains safe', async (t) => {
  const f = fixture(t, { disk: true }),
    peer = f.peer(),
    requestId = randomUUID()
  const created = await f.create('support-6', undefined, requestId)
  const revision = f.snapshot().revision
  const results = await Promise.allSettled([
    f.create('support-60'),
    f.create('support-600', undefined, randomUUID(), peer),
    f.create('support-6', undefined, requestId, peer)
  ])
  assert.equal(
    results.filter(
      (result) => result.status === 'rejected' && result.reason.code === 'SUPPORT_ORDER_PENDING'
    ).length,
    2
  )
  const replay = results.find((result) => result.status === 'fulfilled').value
  assert.equal(replay.order.id, created.order.id)
  assert.equal(f.provider.creates.length, 1)
  assert.equal(f.snapshot().revision, revision)
  assert.equal(
    f.service.store.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status='pending'").get().n,
    1
  )
  assert.equal(f.snapshot().balances.tickets.support, 0)
})

for (const method of ['check', 'close', 'worker']) {
  test(`expired never-issued QR with exact channel absence can release its local reservation via ${method} without a fabricated upstream close`, async (t) => {
    const f = fixture(t)
    f.provider.onCreate = () => {
      throw new YunGouOSError('PAYMENT_PROVIDER_INVALID_RESPONSE')
    }
    const { order } = await f.create('first-support')
    f.provider.onQuery = () => {
      throw new YunGouOSError('PAYMENT_PROVIDER_ORDER_NOT_FOUND')
    }
    const before = await f.request(`/v1/support/orders/${order.id}/check`, {})
    assert.equal(before.order.payment.state, 'creating')
    assert.equal(f.row(order).status, 'pending')
    assert.equal(f.snapshot().payments.firstPurchase.eligible, false)
    f.advance(600000)
    if (method === 'worker') await f.service.supportPayments.sweepExpiredOrders()
    else if (method === 'close') await f.close(order)
    else await f.request(`/v1/support/orders/${order.id}/check`, {})
    assert.equal(f.row(order).status, 'rejected')
    assert.equal(f.row(order).payment_state, 'closed')
    assert.equal(f.row(order).provider_status, 'absent')
    assert.equal(f.provider.closes.length, 0)
    assert.equal(f.snapshot().balances.tickets.support, 0)
    assert.equal(f.snapshot().payments.firstPurchase.eligible, true)
    assert.equal(
      f.service.store.db
        .prepare("SELECT COUNT(*) AS n FROM ledger WHERE kind='/v1/payments/yungouos/absent'")
        .get().n,
      1
    )
    await f.create('first-support')
  })
}

test('a channel absence response cannot cancel a QR that was issued or a never-issued QR with ordinary timeout uncertainty', async (t) => {
  const f = fixture(t),
    { order } = await f.create('support-6')
  f.provider.onQuery = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_ORDER_NOT_FOUND')
  }
  f.advance(600000)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(order).status, 'pending')
  assert.equal(f.row(order).provider_status, 'unknown')
  assert.equal(f.provider.closes.length, 0)
  f.provider.onQuery = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  f.service.store.db
    .prepare("UPDATE orders SET qr_code_url=NULL,payment_state='creating' WHERE id=?")
    .run(order.id)
  f.advance(30000)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(order).status, 'pending')
  assert.equal(f.snapshot().balances.tickets.support, 0)
})

test('a verified paid callback permanently protects a no-QR order from later absence cancellation until paid reconciliation succeeds', async (t) => {
  const f = fixture(t)
  f.provider.onCreate = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  const { order } = await f.create('first-support')
  f.provider.onQuery = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_ORDER_NOT_FOUND')
  }
  await assert.rejects(f.notify(order), code('PAYMENT_NOT_CONFIRMED'))
  assert.equal(f.row(order).verified_paid_claim_at, START)
  f.advance(600000)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(order).status, 'pending')
  assert.equal(f.snapshot().payments.firstPurchase.eligible, false)
  assert.equal(f.snapshot().balances.tickets.support, 0)
  f.advance()
  f.provider.onQuery = null
  await f.notify(order)
  assert.equal(f.row(order).status, 'approved')
  assert.equal(f.snapshot().balances.tickets.support, 10)
})

test('a late valid payment after audited absence cancellation retains its entitlement without a second promotional credit', async (t) => {
  const f = fixture(t)
  f.provider.onCreate = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  const old = (await f.create('first-support')).order
  f.provider.onQuery = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_ORDER_NOT_FOUND')
  }
  f.advance(600000)
  await f.service.supportPayments.sweepExpiredOrders()
  f.provider.onCreate = null
  f.provider.onQuery = null
  const next = (await f.create('first-support')).order
  f.advance()
  await f.notify(old)
  f.advance()
  await f.notify(next)
  assert.equal(f.row(old).credited_tickets, 10)
  assert.equal(f.row(next).credited_tickets, 0)
  assert.equal(f.row(next).payment_state, 'refund_review')
  assert.equal(f.snapshot().balances.tickets.support, 10)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 2)
})
