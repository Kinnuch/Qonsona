/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node security-boundary tests. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { Service, CLIENT_VERSION } from './client-fixture.mjs'
import { createApi } from '../index.mjs'
import { YunGouOSError } from '../yungouos.mjs'

const ADMIN = 'isolated-admin-key-'.repeat(3)
class Provider {
  enabled = true
  mchid = '1234567890'
  creates = []
  queries = []
  payments = new Map()
  async create(input) {
    this.creates.push(input)
    await this.onCreate?.(input)
    this.payments.set(
      input.outTradeNo,
      this.payments.get(input.outTradeNo) || {
        outTradeNo: input.outTradeNo,
        mchid: this.mchid,
        amountFen: input.amountFen,
        status: 'pending'
      }
    )
    return { qrCodeUrl: 'weixin://wxpay/bizpayurl?pr=LOCAL_ONLY', expiresAt: input.expiresAt }
  }
  async query(input) {
    this.queries.push(input)
    await this.onQuery?.(input)
    return this.payments.get(input.outTradeNo)
  }
  verifyNotification(input) {
    if (input.sign !== 'valid') throw new YunGouOSError('PAYMENT_PROVIDER_INVALID_SIGNATURE')
    return {
      outTradeNo: input.outTradeNo,
      mchid: input.mchid,
      amountFen: Number(input.amountFen),
      status: 'paid',
      transactionId: input.transactionId
    }
  }
  async queryRefund() {
    return this.refund
  }
  closes = []
  async closeOrder(input) {
    this.closes.push(input)
    await this.onClose?.(input)
    return { outTradeNo: input.outTradeNo, mchid: this.mchid, status: 'closed' }
  }
}
async function fixture(t, { path = ':memory:', env = {}, provider = new Provider() } = {}) {
  let now = Date.parse('2026-10-25T04:00:00Z')
  const service = new Service({
    path,
    now: () => now,
    paymentProvider: provider,
    env: { NODE_ENV: 'production', QON_PAYMENTS_ENABLED: '1', QON_ADMIN_KEY: ADMIN, ...env }
  })
  t.after(() => service.close())
  const user = await service.handle('POST', '/v1/auth/register', {
    username: `u_${randomUUID().replaceAll('-', '')}`.slice(0, 32),
    password: 'local-test-password-1234'
  })
  const context = { token: user.token, paymentProtocol: 'yungouos-wechat-v2' }
  const call = (method, path, body = {}) => service.handle(method, path, body, context)
  const create = (tickets = 1, requestId = randomUUID()) =>
    call('POST', '/v1/support/orders', { requestId, planId: 'custom', amountFen: tickets * 60 })
  const row = (order) => service.store.db.prepare('SELECT * FROM orders WHERE id=?').get(order.id)
  const pay = (order, extra = {}) => {
    const record = row(order),
      paid = {
        outTradeNo: record.out_trade_no,
        mchid: provider.mchid,
        amountFen: record.amount_fen,
        status: 'paid',
        transactionId: `TX_${order.id.replaceAll('-', '')}`,
        ...extra
      }
    provider.payments.set(record.out_trade_no, paid)
    return paid
  }
  const notify = (order, extra = {}) =>
    service.handle(
      'POST',
      '/v1/payments/yungouos/notify',
      { ...pay(order), sign: 'valid', ...extra },
      { clientVersion: '0.0.0', app: 'untrusted-no-account' }
    )
  return {
    service,
    provider,
    user,
    context,
    call,
    create,
    row,
    pay,
    notify,
    advance: (ms = 12001) => {
      now += ms
    }
  }
}
const code = (value) => (error) => error.code === value

test('ordinary signed-in users can create live orders without fabricated adult verification', async (t) => {
  const f = await fixture(t)
  assert.equal(f.user.snapshot.payments.mode, 'live')
  assert.equal(f.user.snapshot.payments.eligible, true)
  await assert.rejects(
    f.call('POST', '/v1/support/orders', {
      requestId: randomUUID(),
      tickets: 1,
      adultVerified: true
    }),
    code('INVALID_FIELDS')
  )
  const created = await f.create()
  assert.equal(created.order.amountFen, 60)
  assert.equal(created.order.testing, false)
  assert.equal(created.snapshot.payments.eligible, true)
  assert.equal(created.snapshot.balances.tickets.support, 0)
  assert.equal(f.row(created.order).adult_verified, 0)
  assert.equal(f.provider.creates.length, 1)
})

test('explicit real-payment configuration with test grants fails closed', async (t) => {
  const f = await fixture(t, { env: { NODE_ENV: 'test', QON_TEST_GRANTS: '1' } })
  assert.equal(f.user.snapshot.payments.mode, 'disabled')
  await assert.rejects(f.create(), code('PAYMENTS_DISABLED'))
  assert.equal(f.provider.creates.length, 0)
})

test('create is durable before external I/O, does not hold SQLite and replays one stable merchant order', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'qon-payments-'))
  const path = join(dir, 'isolated.sqlite'),
    f = await fixture(t, { path })
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  f.provider.onCreate = () => {
    const other = new DatabaseSync(path)
    try {
      other.exec('BEGIN IMMEDIATE')
      assert.equal(other.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1)
      other.exec('ROLLBACK')
    } finally {
      other.close()
    }
  }
  const requestId = randomUUID()
  const [a, b] = await Promise.all([f.create(2, requestId), f.create(2, requestId)])
  assert.equal(a.order.id, b.order.id)
  assert.equal(f.provider.creates.length, 1)
  const replay = await f.create(2, requestId)
  assert.equal(replay.order.payment.qrCodeUrl, a.order.payment.qrCodeUrl)
  assert.equal(f.provider.creates.length, 1)
  await assert.rejects(f.create(3, requestId), code('IDEMPOTENCY_CONFLICT'))
})

test('a timed-out create returns only its durable reservation; an explicit check credits the same paid merchant number', async (t) => {
  const f = await fixture(t)
  let first = true
  f.provider.onCreate = (input) => {
    if (!first) return
    first = false
    f.provider.payments.set(input.outTradeNo, {
      ...input,
      mchid: f.provider.mchid,
      status: 'paid',
      transactionId: 'TX_recovered_after_timeout'
    })
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  const requestId = randomUUID()
  const reserved = await f.create(1, requestId)
  assert.equal(reserved.order.status, 'pending')
  assert.equal(reserved.order.payment.state, 'creating')
  assert.equal(reserved.order.payment.qrCodeUrl, undefined)
  assert.equal(reserved.snapshot.balances.tickets.support, 0)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1)
  const retry = await f.create(1, requestId)
  assert.equal(retry.order.id, reserved.order.id)
  assert.equal(retry.order.status, 'pending')
  assert.equal(retry.snapshot.balances.tickets.support, 0)
  assert.equal(f.provider.creates.length, 1)
  const checked = await f.call('POST', `/v1/support/orders/${retry.order.id}/check`)
  assert.equal(checked.order.status, 'approved')
  assert.equal(checked.snapshot.balances.tickets.support, 1)
  assert.equal(f.provider.creates.length, 1)
})

test('HTTP lost native QR is recoverable as the same zero-credit reservation, enabling explicit close and a replacement order', async (t) => {
  const f = await fixture(t)
  let lostOutTradeNo
  f.provider.onCreate = (input) => {
    if (!lostOutTradeNo) {
      lostOutTradeNo = input.outTradeNo
      f.provider.payments.set(input.outTradeNo, {
        outTradeNo: input.outTradeNo,
        mchid: f.provider.mchid,
        amountFen: input.amountFen,
        status: 'pending'
      })
      throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
    }
    if (input.outTradeNo === lostOutTradeNo)
      throw new YunGouOSError('PAYMENT_PROVIDER_INVALID_RESPONSE')
  }
  const server = createApi({ service: f.service })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const post = (path, body) =>
    fetch(origin + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${f.user.token}`,
        'X-Qon-Version': CLIENT_VERSION,
        'X-Qon-Payment-Protocol': 'yungouos-wechat-v2'
      },
      body: JSON.stringify(body)
    })
  const body = { requestId: randomUUID(), planId: 'custom', amountFen: 600 }
  const first = await post('/v1/support/orders', body)
  assert.equal(first.status, 200)
  const reserved = await first.json()
  assert.equal(reserved.order.payment.state, 'creating')
  assert.equal(reserved.order.payment.qrCodeUrl, undefined)
  assert.equal(reserved.snapshot.balances.tickets.support, 0)
  const replayResponse = await post('/v1/support/orders', body)
  assert.equal(replayResponse.status, 200)
  const replay = await replayResponse.json()
  assert.equal(replay.order.id, reserved.order.id)
  assert.equal(replay.snapshot.balances.tickets.support, 0)
  assert.equal(f.provider.creates.length, 1)
  const closedResponse = await post(`/v1/support/orders/${reserved.order.id}/close`, {
    requestId: randomUUID()
  })
  assert.equal(closedResponse.status, 200)
  const closed = await closedResponse.json()
  assert.equal(closed.order.status, 'rejected')
  assert.equal(closed.order.payment.state, 'closed')
  assert.equal(f.provider.closes.length, 1)
  const nextResponse = await post('/v1/support/orders', {
    requestId: randomUUID(),
    planId: 'custom',
    amountFen: 60
  })
  assert.equal(nextResponse.status, 200)
  const next = await nextResponse.json()
  assert.notEqual(next.order.id, reserved.order.id)
  assert.ok(next.order.payment.qrCodeUrl)
  assert.equal(next.snapshot.balances.tickets.support, 0)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 0)
})

test('signed notification bypasses account/version gates but needs matching active query and credits once', async (t) => {
  const f = await fixture(t)
  const { order } = await f.create(2)
  const paid = f.pay(order)
  await assert.rejects(
    f.notify(order, { sign: 'wrong' }),
    code('PAYMENT_PROVIDER_INVALID_SIGNATURE')
  )
  assert.equal(f.provider.queries.length, 0)
  const before = f.service.store.snapshot(f.user.user.id, f.service.now())
  await f.notify(order)
  assert.equal(f.row(order).status, 'approved')
  assert.equal(
    f.service.store.snapshot(f.user.user.id, f.service.now()).balances.tickets.support,
    2
  )
  const revision = f.service.store.snapshot(f.user.user.id, f.service.now()).revision
  await f.notify(order)
  assert.equal(f.provider.queries.length, 1)
  assert.equal(f.service.store.snapshot(f.user.user.id, f.service.now()).revision, revision)
  assert.deepEqual(f.service.store.snapshot(f.user.user.id, f.service.now()).pity, before.pity)
  assert.equal(
    f.service.store.db
      .prepare('SELECT COUNT(*) AS n FROM payment_receipts WHERE transaction_id=?')
      .get(paid.transactionId).n,
    1
  )
})

test('HTTP legacy payment clients cannot create live orders, while the explicit payment protocol can', async (t) => {
  const f = await fixture(t),
    server = createApi({ service: f.service })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const body = { requestId: randomUUID(), planId: 'custom', amountFen: 60 }
  const post = (protocol) =>
    fetch(`${origin}/v1/support/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${f.user.token}`,
        'X-Qon-Version': CLIENT_VERSION,
        ...(protocol === undefined ? {} : { 'X-Qon-Payment-Protocol': protocol })
      },
      body: JSON.stringify(body)
    })
  for (const protocol of [undefined, 'old-static-qr', 'yungouos-wechat-v1']) {
    const denied = await post(protocol)
    assert.equal(denied.status, 409)
    assert.equal((await denied.json()).error.code, 'PAYMENT_CLIENT_UPDATE_REQUIRED')
  }
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0)
  assert.equal(f.provider.creates.length, 0)
  const health = await fetch(`${origin}/v1/health`)
  assert.equal(health.status, 200)
  const created = await post('yungouos-wechat-v2')
  assert.equal(created.status, 200)
  assert.equal((await created.json()).order.payment.state, 'pending')
  assert.equal(f.provider.creates.length, 1)
})

test('retired test request identifiers cannot replay into real orders or revive any economic mutation', async (t) => {
  const f = await fixture(t),
    requestId = randomUUID()
  const before = JSON.parse(f.service.store.user(f.user.user.id).state)
  f.service.store.db
    .prepare('INSERT INTO retired_test_requests VALUES(?,?)')
    .run(f.user.user.id, requestId)
  await assert.rejects(f.create(1, requestId), code('RETIRED_TEST_REQUEST'))
  let callbackRan = false
  assert.throws(
    () =>
      f.service.store.mutate(
        f.user.user.id,
        '/v1/shop/purchase',
        { requestId },
        f.service.now(),
        (state) => {
          callbackRan = true
          state.balances.points = 999999
          state.balances.tickets.support = 99
        }
      ),
    code('RETIRED_TEST_REQUEST')
  )
  assert.equal(callbackRan, false)
  assert.deepEqual(JSON.parse(f.service.store.user(f.user.user.id).state), before)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM requests').get().n, 0)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n, 0)
  assert.equal(f.provider.creates.length, 0)
  const fresh = await f.create()
  assert.equal(fresh.order.testing, false)
  assert.equal(fresh.snapshot.balances.tickets.support, 0)
})

test('forged amount, merchant, unknown order and mismatched transaction never credit', async (t) => {
  const f = await fixture(t)
  const { order } = await f.create()
  await assert.rejects(f.notify(order, { amountFen: 1 }), code('PAYMENT_AMOUNT_MISMATCH'))
  await assert.rejects(f.notify(order, { mchid: '999999999' }), code('PAYMENT_ORDER_MISMATCH'))
  await assert.rejects(f.notify(order, { outTradeNo: 'QS_unknown_order' }), code('ORDER_NOT_FOUND'))
  const paid = f.pay(order)
  await assert.rejects(
    f.notify(order, { transactionId: `${paid.transactionId}_wrong` }),
    code('PAYMENT_REFERENCE_MISMATCH')
  )
  assert.equal(f.row(order).status, 'pending')
  assert.equal(
    f.service.store.snapshot(f.user.user.id, f.service.now()).balances.tickets.support,
    0
  )
})

test('a signed paid claim with an unpaid/unknown active query cannot mint a ticket', async (t) => {
  const f = await fixture(t)
  const { order } = await f.create()
  const claimed = f.pay(order)
  f.provider.payments.set(claimed.outTradeNo, { ...claimed, status: 'pending' })
  await assert.rejects(
    f.service.handle('POST', '/v1/payments/yungouos/notify', { ...claimed, sign: 'valid' }),
    code('PAYMENT_NOT_CONFIRMED')
  )
  assert.equal(
    f.service.store.snapshot(f.user.user.id, f.service.now()).balances.tickets.support,
    0
  )
})

test('owner-only refresh reconciles payment and merchant-wide persisted cooldown limits queries', async (t) => {
  const f = await fixture(t)
  const { order } = await f.create()
  const stranger = await f.service.handle('POST', '/v1/auth/register', {
    username: 'other_account',
    password: 'other-test-password'
  })
  const check = `/v1/support/orders/${order.id}/check`
  await assert.rejects(
    f.service.handle('POST', check, {}, { token: stranger.token }),
    code('ORDER_NOT_FOUND')
  )
  await f.call('POST', check)
  f.pay(order)
  const immediate = await f.call('POST', check)
  assert.equal(immediate.order.status, 'pending')
  assert.equal(f.provider.queries.length, 1)
  f.advance()
  const paid = await f.call('POST', check)
  assert.equal(paid.order.status, 'approved')
  assert.equal(paid.snapshot.balances.tickets.support, 1)
  assert.equal(f.provider.queries.length, 2)
})

test('concurrent notification and refresh, including separate SQLite connections, cannot double credit', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'qon-payments-race-'))
  const path = join(dir, 'race.sqlite'),
    f = await fixture(t, { path })
  const { order } = await f.create(2),
    paid = f.pay(order)
  const second = new Service({
    path,
    now: f.service.now,
    paymentProvider: f.provider,
    env: { NODE_ENV: 'production', QON_PAYMENTS_ENABLED: '1', QON_ADMIN_KEY: ADMIN }
  })
  t.after(() => second.close())
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const results = await Promise.allSettled([
    f.call('POST', `/v1/support/orders/${order.id}/check`),
    f.notify(order),
    second.handle('POST', '/v1/payments/yungouos/notify', { ...paid, sign: 'valid' })
  ])
  assert.ok(results.some((r) => r.status === 'fulfilled'))
  assert.equal(
    f.service.store.snapshot(f.user.user.id, f.service.now()).balances.tickets.support,
    2
  )
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 1)
})

test('one real transaction cannot fund two different orders', async (t) => {
  const f = await fixture(t)
  const a = (await f.create()).order
  f.pay(a, { transactionId: 'TX_shared_transaction' })
  await f.call('POST', `/v1/support/orders/${a.id}/check`)
  const b = (await f.create()).order
  f.advance()
  f.pay(b, { transactionId: 'TX_shared_transaction' })
  await assert.rejects(
    f.call('POST', `/v1/support/orders/${b.id}/check`),
    code('PAYMENT_ALREADY_USED')
  )
  assert.equal(
    f.service.store.snapshot(f.user.user.id, f.service.now()).balances.tickets.support,
    1
  )
})

test('server computes custom price and no longer imposes the obsolete 60-yuan monthly cap', async (t) => {
  const f = await fixture(t)
  const order = (await f.create(10)).order
  assert.equal(order.amountFen, 600)
  f.pay(order)
  await f.call('POST', `/v1/support/orders/${order.id}/check`)
  const high = await f.call('POST', '/v1/support/orders', {
    requestId: randomUUID(),
    planId: 'support-600'
  })
  assert.equal(high.order.amountFen, 60000)
  assert.equal(high.order.tickets, 1100)
  assert.equal(f.provider.creates.length, 2)
  await assert.rejects(
    f.call('POST', '/v1/support/orders', { requestId: randomUUID(), tickets: 1, amountFen: 1 }),
    code('INVALID_FIELDS')
  )
})

test('explicit close verifies ownership and active unpaid status, then releases the monthly reservation', async (t) => {
  const f = await fixture(t),
    { order } = await f.create(10)
  const body = { requestId: randomUUID() },
    path = `/v1/support/orders/${order.id}/close`
  await assert.rejects(f.service.handle('POST', path, body), code('UNAUTHORIZED'))
  const other = await f.service.handle('POST', '/v1/auth/register', {
    username: 'close_other_user',
    password: 'local-close-password'
  })
  await assert.rejects(
    f.service.handle('POST', path, body, { token: other.token }),
    code('ORDER_NOT_FOUND')
  )
  await assert.rejects(
    f.service.handle('POST', path, body, { token: f.user.token, clientVersion: '0.0.1' }),
    code('CLIENT_UPDATE_REQUIRED')
  )
  const closed = await f.call('POST', path, body)
  assert.equal(closed.order.status, 'rejected')
  assert.equal(closed.order.payment.state, 'closed')
  assert.equal(closed.order.payment.qrCodeUrl, undefined)
  assert.equal(f.provider.queries.length, 1)
  assert.equal(f.provider.closes.length, 1)
  await f.call('POST', path, body)
  assert.equal(f.provider.closes.length, 1)
  assert.equal((await f.create(1)).order.amountFen, 60)
})

test('a paid order is credited instead of being closed or refunded', async (t) => {
  const f = await fixture(t),
    { order } = await f.create()
  f.pay(order)
  const result = await f.call('POST', `/v1/support/orders/${order.id}/close`, {
    requestId: randomUUID()
  })
  assert.equal(result.order.status, 'approved')
  assert.equal(result.snapshot.balances.tickets.support, 1)
  assert.equal(f.provider.closes.length, 0)
})

test('close timeout keeps the original pending order and grants no tickets', async (t) => {
  const f = await fixture(t),
    { order } = await f.create(10)
  f.provider.onClose = () => {
    throw new YunGouOSError('PAYMENT_PROVIDER_TIMEOUT')
  }
  await assert.rejects(
    f.call('POST', `/v1/support/orders/${order.id}/close`, { requestId: randomUUID() }),
    code('PAYMENT_PROVIDER_TIMEOUT')
  )
  assert.equal(f.row(order).status, 'pending')
  assert.equal(
    f.service.store.snapshot(f.user.user.id, f.service.now()).balances.tickets.support,
    0
  )
  assert.equal(f.provider.creates.length, 1)
})

test('a payment reconciled during in-flight close is never overwritten by a close response', async (t) => {
  const f = await fixture(t),
    { order } = await f.create()
  f.provider.onClose = () => {
    // Simulates a second process finishing already authenticated provider evidence.
    f.service.supportPayments.settle(order.id, f.pay(order))
  }
  const result = await f.call('POST', `/v1/support/orders/${order.id}/close`, {
    requestId: randomUUID()
  })
  assert.equal(result.order.status, 'approved')
  assert.equal(result.snapshot.balances.tickets.support, 1)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 1)
})

test('a late signed payment is actively rechecked and takes precedence over cached closure', async (t) => {
  const f = await fixture(t),
    { order } = await f.create()
  await f.call('POST', `/v1/support/orders/${order.id}/close`, { requestId: randomUUID() })
  assert.equal(f.row(order).status, 'rejected')
  f.advance()
  await f.notify(order)
  assert.equal(f.row(order).status, 'approved')
  assert.equal(
    f.service.store.snapshot(f.user.user.id, f.service.now()).balances.tickets.support,
    1
  )
})

test('manual approval cannot bypass provider verification and a simulated order cannot become payable', async (t) => {
  const f = await fixture(t)
  const { order } = await f.create()
  await assert.rejects(
    f.service.handle(
      'POST',
      `/v1/admin/support/orders/${order.id}/approve`,
      {
        requestId: randomUUID(),
        amountFen: 600,
        adultVerified: true,
        paymentReference: 'operator-claim-without-bank'
      },
      { token: ADMIN }
    ),
    code('PAYMENT_PROVIDER_VERIFICATION_REQUIRED')
  )
  f.service.store.db.prepare('UPDATE orders SET testing=1 WHERE id=?').run(order.id)
  await assert.rejects(
    f.call('POST', `/v1/support/orders/${order.id}/check`),
    code('ORDER_MODE_MISMATCH')
  )
  await assert.rejects(f.notify(order), code('ORDER_MODE_MISMATCH'))
  assert.equal(
    f.service.store.snapshot(f.user.user.id, f.service.now()).balances.tickets.support,
    0
  )
})

test('refund observation never initiates money transfer and reverses only unused full credit', async (t) => {
  const f = await fixture(t)
  const { order } = await f.create(2)
  const paid = f.pay(order)
  await f.call('POST', `/v1/support/orders/${order.id}/check`)
  f.provider.refund = {
    ...paid,
    status: 'refunded',
    refundAmountFen: 120,
    refundNo: 'RF_verified_full'
  }
  const result = await f.service.handle(
    'POST',
    `/v1/admin/support/orders/${order.id}/check-refund`,
    { requestId: randomUUID(), refundNo: 'RF_verified_full' },
    { token: ADMIN }
  )
  assert.equal(result.order.status, 'refunded')
  assert.equal(result.snapshot.balances.tickets.support, 0)
  assert.deepEqual(await f.notify(order), { ok: true })
  assert.equal(result.snapshot.balances.tickets.support, 0)
  assert.equal(f.provider.refundMoney, undefined)
})

test('consumed or partial refund enters manual review and blocks additional support spending', async (t) => {
  const f = await fixture(t)
  const { order } = await f.create(2),
    paid = f.pay(order)
  await f.call('POST', `/v1/support/orders/${order.id}/check`)
  await f.call('POST', '/v1/draw', { requestId: randomUUID(), source: 'support', count: 1 })
  f.provider.refund = { ...paid, status: 'refunded', refundAmountFen: 120, refundNo: 'RF_spent' }
  const result = await f.service.handle(
    'POST',
    `/v1/admin/support/orders/${order.id}/check-refund`,
    { requestId: randomUUID(), refundNo: 'RF_spent' },
    { token: ADMIN }
  )
  assert.equal(result.order.payment.state, 'refund_review')
  assert.equal(result.snapshot.balances.tickets.support, 1)
  await assert.rejects(
    f.call('POST', '/v1/draw', { requestId: randomUUID(), source: 'support', count: 1 }),
    code('PAYMENT_REVIEW_REQUIRED')
  )
})

test('a refund review committed on another SQLite connection before the draw transaction blocks all new spending atomically', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'qon-refund-draw-race-'))
  const path = join(dir, 'race.sqlite'),
    f = await fixture(t, { path })
  const second = new Service({
    path,
    now: f.service.now,
    paymentProvider: f.provider,
    env: { NODE_ENV: 'production', QON_PAYMENTS_ENABLED: '1', QON_ADMIN_KEY: ADMIN }
  })
  t.after(() => second.close())
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const { order } = await f.create(2),
    paid = f.pay(order)
  await f.call('POST', `/v1/support/orders/${order.id}/check`)
  const before = JSON.parse(f.service.store.user(f.user.user.id).state)
  const mutate = f.service.store.mutate.bind(f.service.store)
  let injected = false
  f.service.store.mutate = (id, route, ...rest) => {
    if (route === '/v1/draw' && !injected) {
      injected = true
      // This independent connection commits after request validation and before
      // connection one acquires the transaction that will deduct the ticket.
      second.supportPayments.settle(order.id, { ...paid, status: 'refunded', refundAmountFen: 1 })
      assert.equal(second.supportPayments.get(order.id).payment_state, 'refund_review')
    }
    return mutate(id, route, ...rest)
  }
  const requestId = randomUUID()
  await assert.rejects(
    f.call('POST', '/v1/draw', { requestId, source: 'support', count: 1 }),
    code('PAYMENT_REVIEW_REQUIRED')
  )
  assert.equal(injected, true)
  const after = JSON.parse(f.service.store.user(f.user.user.id).state)
  assert.equal(after.balances.tickets.support, 2)
  assert.equal(after.supportSpent, before.supportSpent)
  assert.deepEqual(after.characters, before.characters)
  assert.deepEqual(after.pity, before.pity)
  assert.equal(
    f.service.store.db
      .prepare('SELECT COUNT(*) AS n FROM requests WHERE user_id=? AND request_id=?')
      .get(f.user.user.id, requestId).n,
    0
  )
  assert.equal(
    f.service.store.db
      .prepare("SELECT COUNT(*) AS n FROM ledger WHERE user_id=? AND kind='/v1/draw'")
      .get(f.user.user.id).n,
    0
  )
})

test('HTTP callbacks accept form only, reject duplicate fields and acknowledge exact SUCCESS without account headers', async (t) => {
  const f = await fixture(t)
  const { order } = await f.create(),
    paid = f.pay(order)
  const server = createApi({ service: f.service })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/v1/payments/yungouos/notify`
  const fields = { ...paid, amountFen: String(paid.amountFen), sign: 'valid' }
  const form = new URLSearchParams(fields).toString()
  const duplicate = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `${form}&amountFen=1`
  })
  assert.equal(duplicate.status, 400)
  assert.equal(await duplicate.text(), 'FAIL')
  const json = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  })
  assert.equal(json.status, 415)
  const success = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Qon-Version': '0.0.1' },
    body: form
  })
  assert.equal(success.status, 200)
  assert.equal(await success.text(), 'SUCCESS')
  assert.match(success.headers.get('content-type'), /^text\/plain/)
  assert.equal(
    f.service.store.snapshot(f.user.user.id, f.service.now()).balances.tickets.support,
    1
  )
  const refresh = await fetch(
    `http://127.0.0.1:${server.address().port}/v1/support/orders/${order.id}/check`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${f.user.token}`,
        'X-Qon-Version': CLIENT_VERSION
      },
      body: '{}'
    }
  )
  assert.equal(refresh.status, 200)
})
