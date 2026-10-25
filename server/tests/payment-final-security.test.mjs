/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Independent HTTP payment-security regression tests. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { Service } from '../service.mjs'
import { createApi } from '../index.mjs'
import { YunGouOSProvider } from '../yungouos.mjs'
import { releaseFixture } from './client-fixture.mjs'

const VERSION = '0.4.4'
const KEY = 'isolated-fake-merchant-key-no-real-credential'
const MERCHANT = '1234567890'
const ADMIN = 'isolated-fake-admin-key-no-real-credential'
const NOW = Date.parse('2026-10-25T06:00:00Z')
const fieldsToSign = ['code', 'orderNo', 'outTradeNo', 'payNo', 'money', 'mchId']
const signed = (fields) => ({
  ...fields,
  sign: createHash('md5')
    .update(
      fieldsToSign
        .slice()
        .sort()
        .map((name) => `${name}=${fields[name]}`)
        .concat(`key=${KEY}`)
        .join('&')
    )
    .digest('hex')
    .toUpperCase()
})

async function fixture(t, extraEnv = {}, { sharedDatabase = false } = {}) {
  let clock = NOW
  const directory = sharedDatabase
    ? mkdtempSync(join(tmpdir(), 'qon-final-payment-security-'))
    : null
  const path = directory ? join(directory, 'payments.sqlite') : ':memory:'
  const extraServices = []
  const calls = []
  const remote = new Map()
  let createUnavailable = false
  const provider = new YunGouOSProvider({
    mchId: MERCHANT,
    payKey: KEY,
    notifyUrl: 'https://example.test/qon-api/v1/payments/yungouos/notify',
    now: () => clock,
    fetchImpl: async (address, options) => {
      const url = new URL(address)
      assert.equal(url.origin, 'https://api.pay.yungouos.com')
      assert.equal(options.redirect, 'error')
      const form = new URLSearchParams(options.body || url.search)
      calls.push({ path: url.pathname, method: options.method, form })
      const number = form.get('out_trade_no')
      if (url.pathname.endsWith('/nativePay')) {
        assert.equal(form.get('auto'), '0')
        if (createUnavailable) throw new Error('synthetic lost create response')
        remote.set(number, {
          outTradeNo: number,
          mchId: MERCHANT,
          orderNo: `YG_${number}`,
          money: form.get('total_fee'),
          payStatus: 0,
          payNo: `WX_${number}`
        })
        return Response.json({ code: 0, data: 'weixin://wxpay/bizpayurl?pr=SECURITY_LOCAL_ONLY' })
      }
      if (url.pathname.endsWith('/getPayOrderInfo'))
        return Response.json({ code: 0, data: remote.get(number) })
      if (url.pathname.endsWith('/closeOrder')) return Response.json({ code: 0, data: number })
      throw new Error('Unexpected test-only provider endpoint')
    }
  })
  const service = new Service({
    path,
    now: () => clock,
    paymentProvider: provider,
    policyFetch: async () => Response.json(releaseFixture(VERSION)),
    env: {
      NODE_ENV: 'production',
      QON_PAYMENTS_ENABLED: '1',
      QON_TEST_GRANTS: '1',
      QON_ADMIN_KEY: ADMIN,
      ...extraEnv
    }
  })
  const server = createApi({ service, production: true, trustProxy: true })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    for (const peer of extraServices) peer.close()
    service.close()
    if (directory) {
      assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
      assert.ok(basename(directory).startsWith('qon-final-payment-security-'))
      rmSync(directory, { recursive: true, force: true })
    }
  })
  const address = `http://127.0.0.1:${server.address().port}`
  const makeUser = () => {
    const row = service.store.createUser(
      `u_${randomUUID().replaceAll('-', '').slice(0, 28)}`,
      'Synthetic local security test',
      'not-a-real-password-hash',
      clock
    )
    return service.session(row, 'qonsona', clock)
  }
  const alice = makeUser(),
    bob = makeUser()
  const request = async (
    path,
    { body = {}, token = alice.token, headers = {}, method = 'POST' } = {}
  ) => {
    const result = await fetch(`${address}${path}`, {
      method,
      headers: {
        'X-Forwarded-Proto': 'https',
        'X-Qon-Version': VERSION,
        'X-Qon-Payment-Protocol': 'yungouos-wechat-v2',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
    })
    return { status: result.status, body: await result.json() }
  }
  const create = (
    body = { requestId: randomUUID(), planId: 'custom', amountFen: 60 },
    token = alice.token
  ) => request('/v1/support/orders', { body, token })
  const row = (order) => service.store.db.prepare('SELECT * FROM orders WHERE id=?').get(order.id)
  const callback = async (body) => {
    const result = await fetch(`${address}/v1/payments/yungouos/notify`, {
      method: 'POST',
      headers: {
        'X-Forwarded-Proto': 'https',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Qon-Version': 'obsolete-client-version'
      },
      body: new URLSearchParams(body).toString()
    })
    return { status: result.status, body: await result.text() }
  }
  const notification = (order) => {
    const record = remote.get(row(order).out_trade_no)
    return signed({
      code: '1',
      orderNo: record.orderNo,
      outTradeNo: record.outTradeNo,
      payNo: record.payNo,
      money: record.money,
      mchId: record.mchId
    })
  }
  return {
    service,
    calls,
    alice,
    bob,
    request,
    create,
    callback,
    notification,
    remote,
    row,
    advance: () => (clock += 12001),
    unavailable: () => (createUnavailable = true),
    balance: (id = alice.user.id) => service.store.snapshot(id, clock).balances.tickets.support,
    peer: () => {
      const peer = new Service({
        path,
        now: () => clock,
        paymentProvider: provider,
        policyFetch: async () => Response.json(releaseFixture(VERSION)),
        env: { NODE_ENV: 'production', QON_PAYMENTS_ENABLED: '1' }
      })
      extraServices.push(peer)
      return peer
    }
  }
}

test('production HTTP requires HTTPS proxy context, authentication and the exact current client before reserving money', async (t) => {
  const f = await fixture(t)
  for (const [options, expectedStatus, code] of [
    [{ headers: { 'X-Forwarded-Proto': 'http' } }, 403, 'HTTPS_REQUIRED'],
    [{ token: null }, 401, 'UNAUTHORIZED'],
    [{ token: 'forged'.repeat(7) }, 401, 'UNAUTHORIZED'],
    [{ headers: { 'X-Qon-Version': '0.4.3' } }, 426, 'CLIENT_UPDATE_REQUIRED'],
    [{ headers: { 'X-Qon-Payment-Protocol': 'legacy' } }, 409, 'PAYMENT_CLIENT_UPDATE_REQUIRED']
  ]) {
    const result = await f.request('/v1/support/orders', {
      body: { requestId: randomUUID(), planId: 'custom', amountFen: 60 },
      ...options
    })
    assert.equal(result.status, expectedStatus)
    assert.equal(result.body.error.code, code)
  }
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0)
  assert.equal(f.calls.length, 0)
})

test('client cannot supply amount, currency, recipient, owner or fractional/negative ticket quantities', async (t) => {
  const f = await fixture(t)
  for (const field of [
    'amountFen',
    'currency',
    'mchid',
    'merchantId',
    'userId',
    'payment_reference'
  ]) {
    const result = await f.create({
      requestId: randomUUID(),
      planId: 'support-6',
      [field]: 'attacker-value'
    })
    assert.equal(result.status, 400, field)
    assert.equal(result.body.error.code, 'INVALID_FIELDS')
  }
  for (const tickets of [0, -1, 1.01, 1e20, '1', true, null]) {
    const result = await f.create({ requestId: randomUUID(), tickets })
    assert.equal(result.status, 400, String(tickets))
    assert.equal(result.body.error.code, 'INVALID_FIELDS')
  }
  const created = await f.create()
  assert.equal(created.status, 200)
  assert.equal(created.body.order.amountFen, 60)
  assert.equal(created.body.order.currency, 'CNY')
  assert.equal(f.calls[0].form.get('total_fee'), '0.60')
  assert.equal(f.calls[0].form.get('mch_id'), MERCHANT)
  assert.equal(f.balance(), 0)
})

test('another authenticated account cannot query, close or enumerate an owners payment order', async (t) => {
  const f = await fixture(t)
  const { order } = (await f.create()).body
  for (const suffix of ['check', 'close']) {
    const response = await f.request(`/v1/support/orders/${order.id}/${suffix}`, {
      token: f.bob.token,
      body: suffix === 'close' ? { requestId: randomUUID() } : {}
    })
    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'ORDER_NOT_FOUND')
  }
  const listed = await f.request('/v1/support/orders', { method: 'GET', token: f.bob.token })
  assert.deepEqual(listed.body.orders, [])
  assert.equal(f.calls.length, 1)
  assert.equal(f.row(order).status, 'pending')
  assert.equal(f.balance(), 0)
  assert.equal(f.balance(f.bob.user.id), 0)
})

test('mutating any signed callback field is rejected before query and cannot mint assets', async (t) => {
  const f = await fixture(t)
  const { order } = (await f.create()).body
  const original = f.notification(order)
  for (const field of fieldsToSign) {
    const result = await f.callback({ ...original, [field]: `${original[field]}_tampered` })
    assert.equal(result.status, 503, field)
    assert.equal(result.body, 'FAIL')
  }
  const noSign = { ...original }
  delete noSign.sign
  assert.equal((await f.callback(noSign)).status, 503)
  assert.equal(f.calls.length, 1)
  assert.equal(f.balance(), 0)
  assert.equal(f.row(order).status, 'pending')
})

test('even a correctly signed paid notification requires an independently matching paid query', async (t) => {
  const f = await fixture(t)
  const { order } = (await f.create()).body
  const claim = f.notification(order)
  assert.deepEqual(await f.callback(claim), { status: 409, body: 'FAIL' })
  assert.equal(f.balance(), 0)
  f.advance()
  const record = f.remote.get(f.row(order).out_trade_no)
  record.payStatus = 1
  record.money = '0.01'
  const mismatch = await f.callback(claim)
  assert.equal(mismatch.status, 503)
  assert.equal(f.balance(), 0)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 0)
})

test('paid callback replays after logout still acknowledge exactly once without leaking signing keys', async (t) => {
  const f = await fixture(t)
  const { order } = (await f.create()).body
  f.remote.get(f.row(order).out_trade_no).payStatus = 1
  const claim = f.notification(order)
  assert.deepEqual(await f.callback(claim), { status: 200, body: 'SUCCESS' })
  assert.equal(f.balance(), 1)
  const revision = f.service.store.snapshot(f.alice.user.id, NOW).revision
  await f.request('/v1/auth/logout')
  for (let attempt = 0; attempt < 3; attempt++)
    assert.deepEqual(await f.callback(claim), { status: 200, body: 'SUCCESS' })
  assert.equal(f.balance(), 1)
  assert.equal(f.service.store.snapshot(f.alice.user.id, NOW).revision, revision)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 1)
  const persisted = JSON.stringify(f.row(order))
  assert.equal(persisted.includes(KEY), false)
  assert.equal(persisted.includes(claim.sign), false)
  assert.equal(persisted.includes(f.alice.token), false)
  const denied = await f.request(`/v1/support/orders/${order.id}/check`)
  assert.equal(denied.status, 401)
  assert.equal(JSON.stringify(denied).includes(KEY), false)
})

test('unknown create returns only its reserved order; replay cannot resend a payment request or change ticket quantity', async (t) => {
  const f = await fixture(t)
  f.unavailable()
  const body = { requestId: randomUUID(), planId: 'custom', amountFen: 60 }
  const first = await f.create(body)
  assert.equal(first.status, 200)
  assert.equal(first.body.order.payment.state, 'creating')
  assert.equal(first.body.order.payment.qrCodeUrl, undefined)
  assert.equal(first.body.snapshot.balances.tickets.support, 0)
  const retry = await f.create(body)
  assert.equal(retry.status, 200)
  assert.equal(retry.body.order.id, first.body.order.id)
  assert.equal(f.calls.length, 1)
  const changed = await f.create({ ...body, amountFen: 120 })
  assert.equal(changed.status, 409)
  assert.equal(changed.body.error.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(f.calls.length, 1)
  assert.equal(f.balance(), 0)
})

test('genuine signed callbacks on two independent SQLite connections cannot credit twice or reuse a receipt for another owner', async (t) => {
  const f = await fixture(t, {}, { sharedDatabase: true })
  const { order } = (await f.create()).body
  const peer = f.peer()
  const record = f.remote.get(f.row(order).out_trade_no)
  record.payStatus = 1
  const claim = f.notification(order)
  const outcomes = await Promise.allSettled([
    f.service.handle('POST', '/v1/payments/yungouos/notify', claim),
    peer.handle('POST', '/v1/payments/yungouos/notify', claim)
  ])
  assert.ok(outcomes.some((result) => result.status === 'fulfilled'))
  assert.equal(f.balance(), 1)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 1)
  assert.deepEqual(await f.callback(claim), { status: 200, body: 'SUCCESS' })
  assert.equal(f.balance(), 1)

  const second = (
    await f.create({ requestId: randomUUID(), planId: 'custom', amountFen: 60 }, f.bob.token)
  ).body.order
  f.advance()
  const secondRecord = f.remote.get(f.row(second).out_trade_no)
  secondRecord.payStatus = 1
  secondRecord.payNo = record.payNo
  const reused = await f.callback(f.notification(second))
  assert.equal(reused.status, 409)
  assert.equal(f.balance(), 1)
  assert.equal(f.balance(f.bob.user.id), 0)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n, 1)
})

test('production cannot enable the test grant or simulation and ordinary user tokens cannot impersonate payment administration', async (t) => {
  const f = await fixture(t)
  const health = await f.request('/v1/health', { method: 'GET' })
  assert.equal(health.body.testing.grantsEnabled, false)
  assert.equal(health.body.payments.simulation, false)
  const grant = await f.request('/v1/test/grant', { body: { requestId: randomUUID() } })
  assert.equal(grant.status, 404)
  const { order } = (await f.create()).body
  const result = await f.request(`/v1/admin/support/orders/${order.id}/approve`, {
    body: {
      requestId: randomUUID(),
      paymentReference: 'claimed-without-provider-evidence',
      amountFen: 600,
      adultVerified: true
    }
  })
  assert.equal(result.status, 401)
  assert.equal(result.body.error.code, 'ADMIN_UNAUTHORIZED')
  assert.equal(f.balance(), 0)
  const privileged = await f.request(`/v1/admin/support/orders/${order.id}/approve`, {
    token: ADMIN,
    body: {
      requestId: randomUUID(),
      paymentReference: 'claimed-without-provider-evidence',
      amountFen: 600,
      adultVerified: true
    }
  })
  assert.equal(privileged.status, 409)
  assert.equal(privileged.body.error.code, 'PAYMENT_PROVIDER_VERIFICATION_REQUIRED')
  assert.equal(f.balance(), 0)
})
