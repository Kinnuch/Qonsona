/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Service } from './client-fixture.mjs'

test('production support orders/credit are explicitly disabled by default, independent of test flags', async () => {
  const service = new Service({
    env: { NODE_ENV: 'production', QON_TEST_GRANTS: '1', QON_ADMIN_KEY: 'a'.repeat(48) }
  })
  try {
    const user = await service.handle('POST', '/v1/auth/register', {
      username: 'adultuser',
      password: 'password-12345'
    })
    const context = { token: user.token }
    const health = await service.handle('GET', '/v1/health')
    assert.equal(health.testing.grantsEnabled, false)
    assert.deepEqual(health.payments, { enabled: false, simulation: false })
    await assert.rejects(
      service.handle(
        'POST',
        '/v1/support/orders',
        { requestId: randomUUID(), tickets: 1 },
        context
      ),
      (e) => e.code === 'PAYMENTS_DISABLED'
    )
    assert.equal(service.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0)
  } finally {
    service.close()
  }
})

test('test-only support orders visibly simulated, require synthetic QA reference and explicit adult operator verification', async () => {
  const service = new Service({ env: { NODE_ENV: 'test', QON_ADMIN_KEY: 'a'.repeat(48) } })
  try {
    const user = await service.handle('POST', '/v1/auth/register', {
      username: 'testinguser',
      password: 'password-12345'
    })
    const order = (
      await service.handle(
        'POST',
        '/v1/support/orders',
        { requestId: randomUUID(), tickets: 1 },
        { token: user.token }
      )
    ).order
    assert.equal(order.testing, true)
    const path = `/v1/admin/support/orders/${order.id}/approve`,
      admin = { token: 'a'.repeat(48) }
    const body = { requestId: randomUUID(), amountFen: 600, paymentReference: 'QA-simulation' }
    await assert.rejects(
      service.handle('POST', path, body, admin),
      (e) => e.code === 'INVALID_FIELDS'
    )
    await assert.rejects(
      service.handle('POST', path, { ...body, adultVerified: false }, admin),
      (e) => e.code === 'ADULT_VERIFICATION_REQUIRED'
    )
    await assert.rejects(
      service.handle(
        'POST',
        path,
        { ...body, adultVerified: true, paymentReference: 'actual-looking-receipt' },
        admin
      ),
      (e) => e.code === 'TEST_REFERENCE_REQUIRED'
    )
    const credit = await service.handle('POST', path, { ...body, adultVerified: true }, admin)
    assert.equal(credit.order.testing, true)
    assert.equal(credit.snapshot.balances.tickets.support, 1)
    assert.equal(
      service.store.db.prepare('SELECT adult_verified FROM orders WHERE id=?').get(order.id)
        .adult_verified,
      1
    )
  } finally {
    service.close()
  }
})

test('production explicitly enabled support still needs independent adult verification; old test orders cannot become real credit', async () => {
  const service = new Service({
    env: { NODE_ENV: 'production', QON_PAYMENTS_ENABLED: '1', QON_ADMIN_KEY: 'a'.repeat(48) }
  })
  try {
    const user = await service.handle('POST', '/v1/auth/register', {
      username: 'enableduser',
      password: 'password-12345'
    })
    const order = (
      await service.handle(
        'POST',
        '/v1/support/orders',
        { requestId: randomUUID(), tickets: 1 },
        { token: user.token }
      )
    ).order
    assert.equal(order.testing, false)
    const body = {
      requestId: randomUUID(),
      amountFen: 600,
      paymentReference: 'verified-reference',
      adultVerified: false
    }
    const path = `/v1/admin/support/orders/${order.id}/approve`,
      admin = { token: 'a'.repeat(48) }
    await assert.rejects(
      service.handle('POST', path, body, admin),
      (e) => e.code === 'ADULT_VERIFICATION_REQUIRED'
    )
    service.store.db.prepare('UPDATE orders SET testing=1 WHERE id=?').run(order.id)
    await assert.rejects(
      service.handle('POST', path, { ...body, adultVerified: true }, admin),
      (e) => e.code === 'ORDER_MODE_MISMATCH'
    )
  } finally {
    service.close()
  }
})
