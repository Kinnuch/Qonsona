/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node payment coordinator. */
import { randomUUID } from 'node:crypto'
import { ApiError, fail, shape, requestId, integer, dayAt } from './domain.mjs'
import { isYunGouOSQrCode } from './yungouos.mjs'

export function orderView(row) {
  return {
    id: row.id,
    tickets: row.tickets,
    amountFen: row.amount_fen,
    currency: 'CNY',
    status: row.status,
    testing: !!row.testing,
    createdAt: row.created_at,
    approvedAt: row.approved_at || null,
    ...(row.provider
      ? {
          payment: {
            provider: row.provider,
            method: 'wechat',
            state: row.payment_state || 'creating',
            ...(row.qr_code_url && row.status === 'pending' ? { qrCodeUrl: row.qr_code_url } : {}),
            ...(row.expires_at ? { expiresAt: row.expires_at } : {})
          }
        }
      : {})
  }
}

/** Network calls are deliberately outside Store.mutate/SQLite transactions. */
export class SupportPayments {
  constructor(service, provider) {
    this.service = service
    this.store = service.store
    this.provider = provider
    this.creating = new Map()
    this.checking = new Map()
    this.closing = new Map()
  }
  get enabled() {
    return this.service.paymentsEnabled && !!this.provider?.enabled
  }
  get(id) {
    return this.store.db.prepare('SELECT * FROM orders WHERE id=?').get(id)
  }
  result(id) {
    const row = this.get(id)
    return { order: orderView(row), snapshot: this.store.snapshot(row.user_id, this.service.now()) }
  }
  async remote(callback) {
    try {
      return await callback()
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error?.name === 'YunGouOSError' && /^PAYMENT_PROVIDER_[A-Z_]+$/.test(error.code || ''))
        fail(error.code, 503)
      fail('PAYMENT_PROVIDER_UNAVAILABLE', 503)
    }
  }
  lease(key, duration) {
    const now = this.service.now(),
      until = now + duration
    return this.store.transaction(() => {
      const prior = this.store.db
        .prepare('SELECT until_at FROM payment_leases WHERE key=?')
        .get(key)
      if (prior?.until_at > now) return null
      this.store.db
        .prepare(
          'INSERT INTO payment_leases VALUES(?,?) ON CONFLICT(key) DO UPDATE SET until_at=excluded.until_at'
        )
        .run(key, until)
      return until
    })
  }
  release(key, until) {
    this.store.db.prepare('DELETE FROM payment_leases WHERE key=? AND until_at=?').run(key, until)
  }
  async create(id, body, now) {
    if (!this.enabled) fail('PAYMENTS_DISABLED', 403)
    shape(body, ['requestId', 'tickets'], ['requestId', 'tickets'])
    requestId(body.requestId)
    integer(body.tickets, 1, 100)
    const reserved = this.store.mutate(id, '/v1/support/orders', body, now, () => {
      const amount = body.tickets * this.service.supportPrice
      const from = Date.parse(`${dayAt(now).slice(0, 7)}-01T00:00:00+08:00`)
      const used = this.store.db
        .prepare(
          "SELECT COALESCE(SUM(amount_fen),0) AS total FROM orders WHERE user_id=? AND created_at>=? AND status IN ('pending','approved')"
        )
        .get(id, from).total
      if (used + amount > 6000) fail('SUPPORT_MONTH_LIMIT', 409)
      const orderId = randomUUID(),
        outTradeNo = `QS${orderId.replaceAll('-', '')}`
      this.store.db
        .prepare(
          "INSERT INTO orders(id,user_id,tickets,amount_fen,status,created_at,testing,provider,out_trade_no,merchant_id,payment_state,expires_at) VALUES(?,?,?,?,'pending',?,0,'yungouos',?,?,'creating',?)"
        )
        .run(
          orderId,
          id,
          body.tickets,
          amount,
          now,
          outTradeNo,
          this.provider.mchid,
          now + 20 * 60000
        )
      return { order: orderView(this.get(orderId)) }
    })
    const orderId = reserved.order.id
    const row = this.get(orderId)
    // A request persisted in simulation is never upgraded to a payable transaction.
    if (row.testing || row.provider !== 'yungouos') fail('ORDER_MODE_MISMATCH', 409)
    if (row.status !== 'pending' || row.qr_code_url) return this.result(orderId)
    if (this.creating.has(orderId)) return this.creating.get(orderId)
    // The reservation is the durable outcome of this request. An earlier provider
    // attempt may have succeeded even when its response was lost; do not resend it.
    if (row.provider_attempts > 0) return this.result(orderId)
    const work = this.createReserved(row).finally(() => this.creating.delete(orderId))
    this.creating.set(orderId, work)
    return work
  }
  async createReserved(row) {
    const key = `create:${row.id}`,
      lease = this.lease(key, 30000)
    if (!lease) return this.result(row.id)
    try {
      if (this.get(row.id).provider_attempts > 0) return this.result(row.id)
      this.store.db
        .prepare('UPDATE orders SET provider_attempts=provider_attempts+1 WHERE id=?')
        .run(row.id)
      const payment = await this.remote(() =>
        this.provider.create({
          outTradeNo: row.out_trade_no,
          amountFen: row.amount_fen,
          description: `Qonsona 支持开发 · 寻访笺 ${row.tickets} 张`,
          expiresAt: row.expires_at
        })
      )
      if (!payment || !isYunGouOSQrCode(payment.qrCodeUrl)) fail('PAYMENT_PROVIDER_INVALID', 502)
      if (
        payment.expiresAt !== undefined &&
        (!Number.isSafeInteger(payment.expiresAt) || payment.expiresAt <= row.created_at)
      )
        fail('PAYMENT_PROVIDER_INVALID', 502)
      this.store.transaction(() => {
        const fresh = this.get(row.id)
        if (fresh.status !== 'pending') return
        this.store.db
          .prepare(
            "UPDATE orders SET qr_code_url=?,expires_at=?,payment_state='pending' WHERE id=?"
          )
          .run(payment.qrCodeUrl, payment.expiresAt || null, row.id)
      })
      return this.result(row.id)
    } catch (error) {
      if (error instanceof ApiError && error.code.startsWith('PAYMENT_PROVIDER_')) {
        // HTTP 200 confirms only that the local order exists. It does not confirm
        // payment, provide a fabricated QR, or grant any ticket. Returning this
        // fact lets the desktop clear its create journal and explicitly check or
        // close the same order, rather than blocking all later economic writes.
        return this.result(row.id)
      }
      throw error
    } finally {
      this.release(key, lease)
    }
  }
  async check(id, owner, { notify = false, expected } = {}) {
    const row = this.get(id)
    if (!row || (owner && row.user_id !== owner)) fail('ORDER_NOT_FOUND', 404)
    if (row.testing || row.provider !== 'yungouos') fail('ORDER_MODE_MISMATCH', 409)
    if (!this.enabled) fail('PAYMENTS_DISABLED', 403)
    if (row.status === 'refunded') return this.result(id)
    if (row.status === 'rejected' && (!notify || row.payment_state !== 'closed'))
      return this.result(id)
    if (this.checking.has(id)) return this.checking.get(id)
    const work = this.checkReserved(row, notify, expected).finally(() => this.checking.delete(id))
    this.checking.set(id, work)
    return work
  }
  async checkReserved(row, notify, expected) {
    // Merchant-wide cooldown persists across processes and restarts.
    const lease = this.lease(`query:yungouos:${this.provider.mchid}`, 12000)
    if (!lease) {
      if (notify) fail('PAYMENT_CHECK_BUSY', 503)
      return this.result(row.id)
    }
    this.store.db
      .prepare('UPDATE orders SET provider_checked_at=? WHERE id=?')
      .run(this.service.now(), row.id)
    const remote = await this.remote(() =>
      this.provider.query({ outTradeNo: row.out_trade_no, amountFen: row.amount_fen })
    )
    this.validate(row, remote)
    if (expected?.transactionId && remote.transactionId !== expected.transactionId)
      fail('PAYMENT_REFERENCE_MISMATCH', 409)
    this.settle(row.id, remote)
    return this.result(row.id)
  }
  validate(row, payment) {
    if (
      !payment ||
      payment.outTradeNo !== row.out_trade_no ||
      payment.mchid !== row.merchant_id ||
      payment.mchid !== this.provider.mchid
    )
      fail('PAYMENT_ORDER_MISMATCH', 409)
    if (!Number.isSafeInteger(payment.amountFen) || payment.amountFen !== row.amount_fen)
      fail('PAYMENT_AMOUNT_MISMATCH', 409)
    if (!['pending', 'paid', 'closed', 'refunded', 'unknown'].includes(payment.status))
      fail('PAYMENT_PROVIDER_INVALID', 502)
    if (
      ['paid', 'refunded'].includes(payment.status) &&
      (typeof payment.transactionId !== 'string' ||
        !/^[A-Za-z0-9_-]{6,128}$/.test(payment.transactionId))
    )
      fail('PAYMENT_REFERENCE_INVALID', 409)
    if (
      row.payment_reference &&
      payment.transactionId &&
      row.payment_reference !== payment.transactionId
    )
      fail('PAYMENT_REFERENCE_MISMATCH', 409)
  }
  settle(id, remote) {
    const now = this.service.now()
    return this.store.transaction(() => {
      const row = this.get(id)
      this.validate(row, remote)
      if (row.testing || row.provider !== 'yungouos') fail('ORDER_MODE_MISMATCH', 409)
      const user = this.store.user(row.user_id),
        state = JSON.parse(user.state)
      let changed = false
      if (remote.status === 'paid') {
        if (row.status === 'refunded' || row.payment_state === 'refund_review')
          fail('PAYMENT_REFUNDED', 409)
        if (row.status === 'approved') return
        // Confirmed payment takes precedence over a cached, previously closed state.
        if (
          row.status !== 'pending' &&
          !(row.status === 'rejected' && row.payment_state === 'closed')
        )
          fail('ORDER_NOT_PENDING', 409)
        if (
          this.store.db
            .prepare('SELECT 1 FROM payment_receipts WHERE provider=? AND transaction_id=?')
            .get('yungouos', remote.transactionId) ||
          this.store.db
            .prepare('SELECT id FROM orders WHERE payment_reference=?')
            .get(remote.transactionId)
        )
          fail('PAYMENT_ALREADY_USED', 409)
        this.store.db
          .prepare('INSERT INTO payment_receipts VALUES(?,?,?,?,?)')
          .run('yungouos', remote.transactionId, id, row.amount_fen, now)
        this.store.db
          .prepare(
            "UPDATE orders SET status='approved',payment_state='paid',payment_reference=?,approved_at=?,support_spent_at_approval=? WHERE id=?"
          )
          .run(remote.transactionId, now, state.supportSpent, id)
        state.balances.tickets.support += row.tickets
        changed = true
      } else if (remote.status === 'refunded') {
        if (row.status === 'refunded') return
        if (
          (remote.refundAmountFen !== undefined && remote.refundAmountFen !== row.amount_fen) ||
          (row.status === 'approved' &&
            (state.supportSpent !== row.support_spent_at_approval ||
              state.balances.tickets.support < row.tickets))
        ) {
          this.store.db
            .prepare("UPDATE orders SET payment_state='refund_review',refunded_at=? WHERE id=?")
            .run(now, id)
          if (row.payment_state === 'refund_review') return
        } else {
          if (row.status === 'approved') state.balances.tickets.support -= row.tickets
          this.store.db
            .prepare(
              "UPDATE orders SET status='refunded',payment_state='refunded',refunded_at=? WHERE id=?"
            )
            .run(now, id)
        }
        changed = true
      } else if (remote.status === 'closed' && row.status === 'pending') {
        this.store.db
          .prepare("UPDATE orders SET status='rejected',payment_state='closed' WHERE id=?")
          .run(id)
        changed = true
      }
      if (changed) {
        state.revision = (state.revision || 0) + 1
        this.store.db
          .prepare('UPDATE users SET state=? WHERE id=?')
          .run(JSON.stringify(state), row.user_id)
        this.store.db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?)').run(
          randomUUID(),
          row.user_id,
          `/v1/payments/yungouos/${remote.status}`,
          `payment:${id}:${remote.status}`,
          now,
          JSON.stringify({
            orderId: id,
            amountFen: row.amount_fen,
            tickets: row.tickets,
            state: this.get(id).payment_state
          })
        )
      }
    })
  }
  async notification(body) {
    if (!this.enabled) fail('PAYMENTS_DISABLED', 403)
    const claimed = await this.remote(() => this.provider.verifyNotification(body))
    if (claimed.status !== 'paid') fail('PAYMENT_NOT_CONFIRMED', 409)
    const row = this.store.db
      .prepare("SELECT * FROM orders WHERE provider='yungouos' AND out_trade_no=?")
      .get(claimed.outTradeNo)
    if (!row) fail('ORDER_NOT_FOUND', 404)
    this.validate(row, claimed)
    // An already settled, authenticated duplicate does not need another provider query.
    if (
      row.status === 'approved' &&
      claimed.status === 'paid' &&
      row.payment_reference === claimed.transactionId
    )
      return { ok: true }
    const result = await this.check(row.id, null, { notify: true, expected: claimed })
    const fresh = this.get(row.id)
    if (
      claimed.status === 'paid' &&
      (result.order.status !== 'approved' || fresh.payment_reference !== claimed.transactionId)
    )
      fail('PAYMENT_NOT_CONFIRMED', 409)
    return { ok: true }
  }
  async observeRefund(id, refundNo) {
    const row = this.get(id)
    if (!row) fail('ORDER_NOT_FOUND', 404)
    if (!this.enabled || typeof this.provider.queryRefund !== 'function')
      fail('PAYMENTS_DISABLED', 403)
    if (row.testing || row.provider !== 'yungouos') fail('ORDER_MODE_MISMATCH', 409)
    const remote = await this.remote(() =>
      this.provider.queryRefund({
        refundNo,
        outTradeNo: row.out_trade_no,
        amountFen: row.amount_fen
      })
    )
    this.validate(row, remote)
    if (remote.status === 'refunded') {
      if (
        !Number.isSafeInteger(remote.refundAmountFen) ||
        remote.refundAmountFen < 1 ||
        remote.refundAmountFen > row.amount_fen
      )
        fail('PAYMENT_AMOUNT_MISMATCH', 409)
      this.settle(id, remote)
    }
    return this.result(id)
  }
  async close(id, owner, body) {
    if (!this.enabled || typeof this.provider.closeOrder !== 'function')
      fail('PAYMENTS_DISABLED', 403)
    shape(body, ['requestId'], ['requestId'])
    requestId(body.requestId)
    const route = `/v1/support/orders/${id}/close`
    this.store.mutate(owner, route, body, this.service.now(), () => {
      const row = this.get(id)
      if (!row || row.user_id !== owner) fail('ORDER_NOT_FOUND', 404)
      if (row.testing || row.provider !== 'yungouos') fail('ORDER_MODE_MISMATCH', 409)
      return { order: orderView(row) }
    })
    const row = this.get(id)
    if (row.status !== 'pending') return this.result(id)
    if (this.closing.has(id)) return this.closing.get(id)
    const work = this.closeReserved(row, owner).finally(() => this.closing.delete(id))
    this.closing.set(id, work)
    return work
  }
  async closeReserved(row, owner) {
    const key = `close:${row.id}`,
      lease = this.lease(key, 30000)
    if (!lease) fail('PAYMENT_CHECK_BUSY', 503)
    try {
      await this.check(row.id, owner, { notify: true })
      if (this.get(row.id).status !== 'pending') return this.result(row.id)
      const result = await this.remote(() =>
        this.provider.closeOrder({ outTradeNo: row.out_trade_no })
      )
      if (
        result?.status !== 'closed' ||
        result.outTradeNo !== row.out_trade_no ||
        result.mchid !== row.merchant_id
      )
        fail('PAYMENT_PROVIDER_INVALID', 502)
      this.store.transaction(() => {
        const fresh = this.get(row.id)
        if (fresh.status !== 'pending') return
        this.store.db
          .prepare("UPDATE orders SET status='rejected',payment_state='closed' WHERE id=?")
          .run(row.id)
        const state = JSON.parse(this.store.user(row.user_id).state)
        state.revision = (state.revision || 0) + 1
        this.store.db
          .prepare('UPDATE users SET state=? WHERE id=?')
          .run(JSON.stringify(state), row.user_id)
        this.store.db
          .prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?)')
          .run(
            randomUUID(),
            row.user_id,
            '/v1/payments/yungouos/closed',
            `payment:${row.id}:closed`,
            this.service.now(),
            JSON.stringify({ orderId: row.id })
          )
      })
      return this.result(row.id)
    } finally {
      this.release(key, lease)
    }
  }
}
