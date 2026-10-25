/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Independent local-only financial edge-case regressions. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Service } from './client-fixture.mjs'

function fixture(t) {
  let now = Date.parse('2026-10-25T04:00:00Z')
  const payments = new Map()
  const provider = {
    enabled: true,
    mchid: '1234567890',
    async create(input) {
      payments.set(input.outTradeNo, { ...input, mchid: this.mchid, status: 'pending' })
      return {
        qrCodeUrl: 'weixin://wxpay/bizpayurl?pr=INDEPENDENT_LOCAL_ONLY',
        expiresAt: input.expiresAt
      }
    },
    async query({ outTradeNo }) {
      return payments.get(outTradeNo)
    },
    async closeOrder({ outTradeNo }) {
      const result = { ...payments.get(outTradeNo), status: 'closed' }
      payments.set(outTradeNo, result)
      return result
    },
    async queryRefund() {
      return this.refund
    },
    verifyNotification(input) {
      return input
    }
  }
  const service = new Service({
    path: ':memory:',
    now: () => now,
    paymentProvider: provider,
    env: { NODE_ENV: 'production', QON_PAYMENTS_ENABLED: '1' }
  })
  t.after(() => service.close())
  const user = service.store.createUser(
    'independent_audit',
    'Synthetic audit',
    'not-a-password',
    now
  )
  const session = service.session(user, 'qonsona', now)
  const context = { token: session.token, paymentProtocol: 'yungouos-wechat-v2' }
  return {
    service,
    provider,
    user,
    advance: (ms) => {
      now += ms
    },
    snapshot: () => service.store.snapshot(user.id, now),
    row: (order) => service.supportPayments.get(order.id),
    async create(planId = 'support-6') {
      return service.handle(
        'POST',
        '/v1/support/orders',
        { requestId: randomUUID(), planId },
        context
      )
    },
    async check(order) {
      return service.handle('POST', `/v1/support/orders/${order.id}/check`, {}, context)
    },
    channelPaid(order) {
      const row = service.supportPayments.get(order.id)
      const paid = {
        outTradeNo: row.out_trade_no,
        mchid: provider.mchid,
        amountFen: row.amount_fen,
        status: 'paid',
        transactionId: `WX_${row.id.replaceAll('-', '')}`
      }
      payments.set(row.out_trade_no, paid)
      return paid
    }
  }
}

test('an owner can explicitly reconcile a channel-paid order after automatic closure even when no payment callback arrived', async (t) => {
  const f = fixture(t)
  const { order } = await f.create()
  f.advance(600000)
  await f.service.supportPayments.sweepExpiredOrders()
  assert.equal(f.row(order).payment_state, 'closed')
  f.channelPaid(order)
  f.advance(12001)
  const checked = await f.check(order)
  assert.equal(checked.order.status, 'approved')
  assert.equal(checked.snapshot.balances.tickets.support, 10)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 1)
})

test('a transient SQLite worker-lease error cannot permanently poison the in-process maintenance busy flag', async (t) => {
  const f = fixture(t)
  const { order } = await f.create()
  f.advance(600000)
  const payments = f.service.supportPayments
  const lease = payments.lease.bind(payments)
  let failOnce = true
  payments.lease = (...args) => {
    if (failOnce) {
      failOnce = false
      throw new Error('synthetic SQLITE_BUSY at BEGIN IMMEDIATE')
    }
    return lease(...args)
  }
  await assert.rejects(payments.sweepExpiredOrders(), /synthetic SQLITE_BUSY/)
  assert.equal(payments.maintenanceBusy, false)
  assert.deepEqual(await payments.sweepExpiredOrders(), { processed: 1 })
  assert.equal(f.row(order).payment_state, 'closed')
})

test('a verified refund arriving before the original payment callback records its receipt and permanently consumes the first-purchase promotion without crediting tickets', async (t) => {
  const f = fixture(t)
  const { order } = await f.create('first-support')
  f.provider.refund = {
    ...f.channelPaid(order),
    status: 'refunded',
    refundAmountFen: 1,
    refundNo: 'RF_PRE_CALLBACK_SYNTHETIC'
  }
  await f.service.supportPayments.observeRefund(order.id, 'RF_PRE_CALLBACK_SYNTHETIC')
  assert.equal(f.row(order).status, 'refunded')
  assert.equal(f.snapshot().balances.tickets.support, 0)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 1)
  assert.equal(
    f.service.store.db.prepare('SELECT COUNT(*) AS n FROM first_support_reservations').get().n,
    0
  )
  assert.equal(
    f.service.store.db
      .prepare('SELECT order_id FROM first_support_claims WHERE user_id=?')
      .get(f.user.id).order_id,
    order.id
  )
  assert.deepEqual(f.snapshot().payments.firstPurchase, { eligible: false, claimed: true })
})

test('partial then full channel refunds before the paid callback never deduct tickets credited by a different order', async (t) => {
  const f = fixture(t)
  const independent = (await f.create()).order
  f.channelPaid(independent)
  await f.check(independent)
  assert.equal(f.snapshot().balances.tickets.support, 10)
  const unpaidLocal = (await f.create()).order
  const missed = f.channelPaid(unpaidLocal)
  f.provider.refund = {
    ...missed,
    status: 'refunded',
    refundAmountFen: 1,
    refundNo: 'RF_PARTIAL_PRE_CALLBACK'
  }
  await f.service.supportPayments.observeRefund(unpaidLocal.id, 'RF_PARTIAL_PRE_CALLBACK')
  assert.equal(f.row(unpaidLocal).payment_state, 'refund_review')
  assert.equal(f.row(unpaidLocal).credited_tickets, 0)
  f.provider.refund = {
    ...missed,
    status: 'refunded',
    refundAmountFen: 600,
    refundNo: 'RF_FULL_PRE_CALLBACK'
  }
  await f.service.supportPayments.observeRefund(unpaidLocal.id, 'RF_FULL_PRE_CALLBACK')
  assert.equal(f.row(unpaidLocal).status, 'refunded')
  assert.equal(f.snapshot().balances.tickets.support, 10)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 2)
})

test('an authenticated original paid callback after a verified full refund is acknowledged without credit or a merchant-wide query-priority lock', async (t) => {
  const f = fixture(t)
  const { order } = await f.create('first-support')
  const paid = f.channelPaid(order)
  f.provider.refund = {
    ...paid,
    status: 'refunded',
    refundAmountFen: 1,
    refundNo: 'RF_BEFORE_LATE_NOTIFY'
  }
  await f.service.supportPayments.observeRefund(order.id, 'RF_BEFORE_LATE_NOTIFY')
  const revision = f.snapshot().revision
  for (let replay = 0; replay < 3; replay++) {
    assert.deepEqual(await f.service.handle('POST', '/v1/payments/yungouos/notify', paid), {
      ok: true
    })
  }
  assert.equal(f.row(order).status, 'refunded')
  assert.equal(f.snapshot().balances.tickets.support, 0)
  assert.equal(f.snapshot().revision, revision)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 1)
  assert.equal(
    f.service.store.db
      .prepare("SELECT COUNT(*) AS n FROM payment_leases WHERE key LIKE 'query-priority:%'")
      .get().n,
    0
  )
})
