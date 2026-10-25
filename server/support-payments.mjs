/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node payment coordinator. */
import { randomUUID } from 'node:crypto'
import { ApiError, fail, shape, requestId } from './domain.mjs'
import { isYunGouOSQrCode } from './yungouos.mjs'
import { supportSelection } from './support-catalog.mjs'

const PAYMENT_WINDOW_MS = 10 * 60000
const MAINTENANCE_INTERVAL_MS = 30000

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
    ...(row.plan_id
      ? { planId: row.plan_id, baseTickets: row.base_tickets, bonusTickets: row.bonus_tickets }
      : {}),
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
    this.maintenanceTimer = null
    this.maintenanceBusy = false
    // Existing unpaid orders also receive the shorter checkout deadline. Amount,
    // ticket entitlement, receipt and already-paid history are never repriced.
    this.store.db
      .prepare(
        "UPDATE orders SET expires_at=created_at+? WHERE provider='yungouos' AND testing=0 AND status='pending' AND (expires_at IS NULL OR expires_at>created_at+?)"
      )
      .run(PAYMENT_WINDOW_MS, PAYMENT_WINDOW_MS)
  }
  get enabled() {
    return this.service.paymentsEnabled && !!this.provider?.enabled
  }
  get(id) {
    return this.store.db.prepare('SELECT * FROM orders WHERE id=?').get(id)
  }
  firstPurchase(userId) {
    const paid = !!this.store.db
      .prepare(
        'SELECT 1 FROM payment_receipts r JOIN orders o ON o.id=r.order_id WHERE o.user_id=? LIMIT 1'
      )
      .get(userId)
    const reservation = this.store.db
      .prepare(
        'SELECT o.id,o.status FROM first_support_reservations f JOIN orders o ON o.id=f.order_id WHERE f.user_id=?'
      )
      .get(userId)
    return {
      eligible: !paid && !reservation,
      claimed: paid,
      ...(reservation?.status === 'pending' ? { pendingOrderId: reservation.id } : {})
    }
  }
  startMaintenance() {
    if (this.maintenanceTimer || !this.enabled) return
    this.maintenanceTimer = setInterval(() => {
      void this.sweepExpiredOrders().catch(() => {})
    }, MAINTENANCE_INTERVAL_MS)
    this.maintenanceTimer.unref?.()
    // Run after startup as well as on future ticks; persisted deadlines and retry
    // times survive a process restart, and no renderer window is required.
    void this.sweepExpiredOrders().catch(() => {})
  }
  stopMaintenance() {
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer)
    this.maintenanceTimer = null
  }
  async sweepExpiredOrders() {
    if (!this.enabled || this.maintenanceBusy) return { processed: 0 }
    this.maintenanceBusy = true
    const workerKey = `auto-close:yungouos:${this.provider.mchid}`
    let workerLease
    try {
      workerLease = this.lease(workerKey, MAINTENANCE_INTERVAL_MS)
      if (!workerLease) return { processed: 0 }
      const now = this.service.now()
      const row = this.store.db
        .prepare(
          "SELECT * FROM orders WHERE provider='yungouos' AND testing=0 AND status='pending' AND expires_at<=? AND auto_close_next_at<=? ORDER BY auto_close_next_at,expires_at,id LIMIT 1"
        )
        .get(now, now)
      if (!row) {
        this.release(workerKey, workerLease)
        return { processed: 0 }
      }
      // One query per 30-second worker window leaves a channel-query interval
      // available for genuine callbacks and explicit customer checks.
      try {
        await this.closeInternal(row, row.user_id)
        if (this.get(row.id).status === 'pending') throw new ApiError('PAYMENT_NOT_CONFIRMED', 409)
        return { processed: 1 }
      } catch {
        const attempts = row.auto_close_attempts + 1
        const retryMs = Math.min(
          15 * 60000,
          MAINTENANCE_INTERVAL_MS * 2 ** Math.min(attempts - 1, 5)
        )
        this.store.db
          .prepare(
            "UPDATE orders SET auto_close_attempts=auto_close_attempts+1,auto_close_next_at=? WHERE id=? AND status='pending'"
          )
          .run(this.service.now() + retryMs, row.id)
        return { processed: 1 }
      }
    } finally {
      // Keep the worker lease for its whole interval even after a fast request;
      // another process must not consume every merchant query slot.
      this.maintenanceBusy = false
    }
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
    const plan = supportSelection(body)
    requestId(body.requestId)
    const reserved = this.store.mutate(id, '/v1/support/orders', body, now, () => {
      if (
        this.store.db
          .prepare(
            "SELECT 1 FROM orders WHERE user_id=? AND testing=0 AND status='pending' LIMIT 1"
          )
          .get(id)
      )
        fail('SUPPORT_ORDER_PENDING', 409)
      if (plan.firstPurchaseOnly && !this.firstPurchase(id).eligible)
        fail('FIRST_SUPPORT_UNAVAILABLE', 409)
      const orderId = randomUUID(),
        outTradeNo = `QS${orderId.replaceAll('-', '')}`
      this.store.db
        .prepare(
          "INSERT INTO orders(id,user_id,tickets,amount_fen,status,created_at,testing,provider,out_trade_no,merchant_id,payment_state,expires_at,plan_id,base_tickets,bonus_tickets) VALUES(?,?,?,?,'pending',?,0,'yungouos',?,?,'creating',?,?,?,?)"
        )
        .run(
          orderId,
          id,
          plan.tickets,
          plan.amountFen,
          now,
          outTradeNo,
          this.provider.mchid,
          now + PAYMENT_WINDOW_MS,
          plan.id,
          plan.baseTickets,
          plan.bonusTickets
        )
      // Unknown orders keep the sole active reservation. A confirmed unpaid
      // closure can release it; the separate paid winner below remains forever.
      if (plan.firstPurchaseOnly)
        this.store.db
          .prepare('INSERT INTO first_support_reservations VALUES(?,?,?)')
          .run(id, orderId, now)
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
          .run(
            payment.qrCodeUrl,
            Math.min(payment.expiresAt ?? row.expires_at, row.expires_at),
            row.id
          )
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
    if (row.status === 'approved') return this.result(id)
    if (row.status === 'rejected' && row.payment_state !== 'closed') return this.result(id)
    if (this.checking.has(id)) return this.checking.get(id)
    const work = this.checkReserved(row, notify, expected).finally(() => this.checking.delete(id))
    this.checking.set(id, work)
    return work
  }
  async checkReserved(row, notify, expected) {
    if (!expected) {
      const priority = this.store.db
        .prepare('SELECT until_at FROM payment_leases WHERE key LIKE ? AND until_at>? LIMIT 1')
        .get(`query-priority:yungouos:${this.provider.mchid}:%`, this.service.now())
      if (priority?.until_at > this.service.now()) fail('PAYMENT_CHECK_BUSY', 503)
    }
    // Merchant-wide cooldown persists across processes and restarts.
    const lease = this.lease(`query:yungouos:${this.provider.mchid}`, 12000)
    if (!lease) {
      if (notify) fail('PAYMENT_CHECK_BUSY', 503)
      return this.result(row.id)
    }
    this.store.db
      .prepare('UPDATE orders SET provider_checked_at=? WHERE id=?')
      .run(this.service.now(), row.id)
    let remote
    try {
      remote = await this.remote(() =>
        this.provider.query({ outTradeNo: row.out_trade_no, amountFen: row.amount_fen })
      )
    } catch (error) {
      if (error.code !== 'PAYMENT_PROVIDER_ORDER_NOT_FOUND') throw error
      this.cancelAbsentReservation(row.id, expected)
      return this.result(row.id)
    }
    this.validate(row, remote)
    if (expected?.transactionId && remote.transactionId !== expected.transactionId)
      fail('PAYMENT_REFERENCE_MISMATCH', 409)
    this.store.db
      .prepare('UPDATE orders SET provider_status=? WHERE id=?')
      .run(remote.status, row.id)
    this.settle(row.id, remote)
    return this.result(row.id)
  }
  cancelAbsentReservation(id, expected) {
    const now = this.service.now()
    return this.store.transaction(() => {
      const row = this.get(id)
      if (
        expected ||
        row.status !== 'pending' ||
        row.testing ||
        row.provider !== 'yungouos' ||
        row.payment_state !== 'creating' ||
        row.qr_code_url ||
        row.payment_reference ||
        row.verified_paid_claim_at != null ||
        !row.expires_at ||
        row.expires_at > now ||
        row.created_at + PAYMENT_WINDOW_MS > now ||
        this.store.db.prepare('SELECT 1 FROM payment_receipts WHERE order_id=?').get(id)
      ) {
        if (row.status === 'pending')
          this.store.db.prepare("UPDATE orders SET provider_status='unknown' WHERE id=?").run(id)
        return false
      }
      // This is a locally cancelled reservation after an authoritative channel
      // absence response, never a fabricated successful closeOrder response.
      this.store.db
        .prepare(
          "UPDATE orders SET status='rejected',payment_state='closed',provider_status='absent' WHERE id=?"
        )
        .run(id)
      this.store.db
        .prepare('DELETE FROM first_support_reservations WHERE user_id=? AND order_id=?')
        .run(row.user_id, id)
      const state = JSON.parse(this.store.user(row.user_id).state)
      state.revision = (state.revision || 0) + 1
      this.store.db
        .prepare('UPDATE users SET state=? WHERE id=?')
        .run(JSON.stringify(state), row.user_id)
      this.store.db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?)').run(
        randomUUID(),
        row.user_id,
        '/v1/payments/yungouos/absent',
        `payment:${id}:absent`,
        now,
        JSON.stringify({
          orderId: id,
          reason: 'channel-order-absent-after-deadline',
          amountFen: row.amount_fen,
          tickets: row.tickets,
          creditedTickets: 0
        })
      )
      return true
    })
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
        if (row.status === 'refunded') fail('PAYMENT_REFUNDED', 409)
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
        let credit = row.tickets
        if (row.plan_id === 'first-support') {
          this.store.db
            .prepare('INSERT OR IGNORE INTO first_support_claims VALUES(?,?,?)')
            .run(row.user_id, id, now)
          const winner = this.store.db
            .prepare('SELECT order_id FROM first_support_claims WHERE user_id=?')
            .get(row.user_id)
          if (winner.order_id !== id) credit = 0
          this.store.db
            .prepare('DELETE FROM first_support_reservations WHERE user_id=? AND order_id=?')
            .run(row.user_id, id)
        }
        this.store.db
          .prepare(
            "UPDATE orders SET status='approved',payment_state=?,payment_reference=?,approved_at=?,support_spent_at_approval=?,credited_tickets=? WHERE id=?"
          )
          .run(
            credit ? 'paid' : 'refund_review',
            remote.transactionId,
            now,
            state.supportSpent,
            credit,
            id
          )
        state.balances.tickets.support += credit
        changed = true
      } else if (remote.status === 'refunded') {
        if (row.status === 'refunded') return
        // A verified channel refund can arrive before the original payment
        // callback. It is still proof of a real paid transaction, so retain its
        // unique receipt/reference and consume first-payment eligibility.
        const receipt = this.store.db
          .prepare('SELECT order_id FROM payment_receipts WHERE provider=? AND transaction_id=?')
          .get('yungouos', remote.transactionId)
        const referenced = this.store.db
          .prepare('SELECT id FROM orders WHERE payment_reference=?')
          .get(remote.transactionId)
        if ((receipt && receipt.order_id !== id) || (referenced && referenced.id !== id))
          fail('PAYMENT_ALREADY_USED', 409)
        if (!receipt)
          this.store.db
            .prepare('INSERT INTO payment_receipts VALUES(?,?,?,?,?)')
            .run('yungouos', remote.transactionId, id, row.amount_fen, now)
        this.store.db
          .prepare('UPDATE orders SET payment_reference=COALESCE(payment_reference,?) WHERE id=?')
          .run(remote.transactionId, id)
        if (row.plan_id === 'first-support') {
          this.store.db
            .prepare('INSERT OR IGNORE INTO first_support_claims VALUES(?,?,?)')
            .run(row.user_id, id, now)
          this.store.db
            .prepare('DELETE FROM first_support_reservations WHERE user_id=? AND order_id=?')
            .run(row.user_id, id)
        }
        const credited = row.credited_tickets ?? row.tickets
        if (
          (remote.refundAmountFen !== undefined && remote.refundAmountFen !== row.amount_fen) ||
          (row.status === 'approved' &&
            credited > 0 &&
            (state.supportSpent !== row.support_spent_at_approval ||
              state.balances.tickets.support < credited))
        ) {
          this.store.db
            .prepare(
              "UPDATE orders SET status='approved',payment_state='refund_review',refunded_at=? WHERE id=?"
            )
            .run(now, id)
          if (row.payment_state === 'refund_review') return
        } else {
          if (row.status === 'approved') state.balances.tickets.support -= credited
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
        this.store.db
          .prepare('DELETE FROM first_support_reservations WHERE user_id=? AND order_id=?')
          .run(row.user_id, id)
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
    this.store.db
      .prepare(
        'UPDATE orders SET verified_paid_claim_at=COALESCE(verified_paid_claim_at,?) WHERE id=?'
      )
      .run(this.service.now(), row.id)
    // An already settled, authenticated duplicate does not need another provider query.
    if (
      ['approved', 'refunded'].includes(row.status) &&
      claimed.status === 'paid' &&
      row.payment_reference === claimed.transactionId &&
      this.store.db
        .prepare(
          'SELECT 1 FROM payment_receipts WHERE provider=? AND transaction_id=? AND order_id=?'
        )
        .get('yungouos', claimed.transactionId, row.id)
    )
      return { ok: true }
    // Only authenticated evidence requiring a fresh query gets priority;
    // settled callback replays cannot indefinitely postpone other closures.
    this.store.db
      .prepare(
        'INSERT INTO payment_leases VALUES(?,?) ON CONFLICT(key) DO UPDATE SET until_at=MAX(until_at,excluded.until_at)'
      )
      .run(
        `query-priority:yungouos:${this.provider.mchid}:${row.id}`,
        this.service.now() + 2 * 60000
      )
    const result = await this.check(row.id, null, { notify: true, expected: claimed })
    const fresh = this.get(row.id)
    if (
      claimed.status === 'paid' &&
      (result.order.status !== 'approved' || fresh.payment_reference !== claimed.transactionId)
    )
      fail('PAYMENT_NOT_CONFIRMED', 409)
    this.store.db
      .prepare('DELETE FROM payment_leases WHERE key=?')
      .run(`query-priority:yungouos:${this.provider.mchid}:${row.id}`)
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
    return this.closeInternal(row, owner)
  }
  async closeInternal(row, owner) {
    if (this.closing.has(row.id)) return this.closing.get(row.id)
    const work = this.closeReserved(row, owner).finally(() => this.closing.delete(row.id))
    this.closing.set(row.id, work)
    return work
  }
  async closeReserved(row, owner) {
    const key = `close:${row.id}`,
      lease = this.lease(key, 30000)
    if (!lease) fail('PAYMENT_CHECK_BUSY', 503)
    try {
      await this.check(row.id, owner, { notify: true })
      if (this.get(row.id).status !== 'pending') return this.result(row.id)
      if (this.get(row.id).provider_status !== 'pending') fail('PAYMENT_NOT_CONFIRMED', 409)
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
        this.store.db
          .prepare('DELETE FROM first_support_reservations WHERE user_id=? AND order_id=?')
          .run(row.user_id, row.id)
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
