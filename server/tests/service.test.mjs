/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Service } from './client-fixture.mjs'
import {
  probabilities,
  chooseTier,
  activity,
  draw,
  purchase,
  makeup,
  newState,
  dayAt,
  weekAt
} from '../domain.mjs'
import { createApi } from '../index.mjs'

const fixtures = []
afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.service?.close()
    if (fixture.dir) rmSync(fixture.dir, { recursive: true, force: true })
  }
})
const setup = (options = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'qon-account-test-'))
  let clock = Date.parse('2026-10-12T12:00:00+08:00')
  const service = new Service({
    path: join(dir, 'test.sqlite'),
    now: () => clock,
    env: {
      NODE_ENV: 'test',
      QON_TEST_GRANTS: '1',
      QON_TEST_EPOCH: 'test-1',
      QON_ADMIN_KEY: 'a'.repeat(48)
    },
    ...options
  })
  const fixture = {
    dir,
    service,
    now: () => clock,
    advance: (ms) => {
      clock += ms
    }
  }
  fixtures.push(fixture)
  return fixture
}
const register = (service, name = 'testuser', app = 'qonsona') =>
  service.handle(
    'POST',
    '/v1/auth/register',
    { username: name, nickname: `Name ${name}`, password: 'correct-password-123' },
    { ip: name, app }
  )
const call = (service, user, route, body = {}, method = 'POST') =>
  service.handle(
    method,
    `/v1/${route}`,
    route === 'test/grant' && !body.requestId ? mutation() : body,
    { token: user.token, ip: user.user.id }
  )
const mutation = (extra = {}) => ({ requestId: randomUUID(), ...extra })
const rejects = (promise, code) => assert.rejects(promise, (error) => error.code === code)

test('scrypt hashes and opaque tokens persist; account namespace shared between apps, logout revokes only its session', async () => {
  const f = setup(),
    first = await register(f.service, 'MixedCase', 'qonlang')
  assert.equal(first.user.username, 'mixedcase')
  assert.equal(typeof first.expiresAt, 'number')
  assert.equal(first.user.publicCollection, true)
  const row = f.service.store.user(first.user.id)
  assert.ok(row.password_hash.startsWith('scrypt-v1$'))
  assert.ok(!row.password_hash.includes('correct-password'))
  const stored = f.service.store.db.prepare('SELECT token_hash,app FROM sessions').get()
  assert.notEqual(stored.token_hash, first.token)
  assert.equal(stored.app, 'qonlang')
  await rejects(register(f.service, 'mixedcase'), 'USERNAME_TAKEN')
  await rejects(
    f.service.handle(
      'POST',
      '/v1/auth/login',
      { username: 'mixedcase', password: 'wrong-password-123' },
      { ip: 'other' }
    ),
    'INVALID_CREDENTIALS'
  )
  const second = await f.service.handle(
    'POST',
    '/v1/auth/login',
    { username: 'MIXEDCASE', password: 'correct-password-123' },
    { app: 'qonsona', ip: 'new' }
  )
  assert.equal(second.user.id, first.user.id)
  const path = f.service.store.db.location()
  f.service.close()
  f.service = new Service({ path, now: f.now, env: { NODE_ENV: 'test' } })
  await call(f.service, first, 'auth/me', {}, 'GET')
  await call(f.service, first, 'auth/logout')
  await rejects(call(f.service, first, 'collection', {}, 'GET'), 'UNAUTHORIZED')
  await call(f.service, second, 'auth/me', {}, 'GET')
  f.advance(31 * 86400000)
  await rejects(call(f.service, second, 'collection', {}, 'GET'), 'UNAUTHORIZED')
})

test('authorization, unknown fields, privilege escalation and per-IP/account authentication rate limits', async () => {
  const f = setup()
  await rejects(f.service.handle('GET', '/v1/collection'), 'UNAUTHORIZED')
  await rejects(
    f.service.handle('POST', '/v1/auth/register', { username: 'valid', password: 'short' }),
    'INVALID_PASSWORD'
  )
  await rejects(
    f.service.handle('POST', '/v1/auth/register', {
      username: 'valid',
      password: 'password-1234',
      role: 'admin'
    }),
    'INVALID_FIELDS'
  )
  const u = await register(f.service)
  await rejects(call(f.service, u, 'auth/me', { publicTime: 'yes' }, 'PATCH'), 'INVALID_PRIVACY')
  await rejects(call(f.service, u, 'admin/support/orders', {}, 'GET'), 'ADMIN_UNAUTHORIZED')
  for (let i = 0; i < 6; i++)
    await rejects(
      f.service.handle(
        'POST',
        '/v1/auth/login',
        { username: 'absent', password: 'password-1234' },
        { ip: `different${i}` }
      ),
      'INVALID_CREDENTIALS'
    )
  await rejects(
    f.service.handle(
      'POST',
      '/v1/auth/login',
      { username: 'absent', password: 'password-1234' },
      { ip: 'different7' }
    ),
    'RATE_LIMITED'
  )
})

test('test grant is authenticated, repeatable with different identifiers, learning-only and disabled in production', async () => {
  const f = setup(),
    u = await register(f.service)
  await rejects(f.service.handle('POST', '/v1/test/grant'), 'UNAUTHORIZED')
  const body = mutation()
  const grant = await call(f.service, u, 'test/grant', body)
  assert.equal(grant.snapshot.balances.tickets.learning, 100)
  assert.equal(grant.snapshot.balances.tickets.support, 0)
  assert.deepEqual(await call(f.service, u, 'test/grant', body), grant)
  assert.equal((await call(f.service, u, 'test/grant')).snapshot.balances.tickets.learning, 200)
  const production = setup({
    env: { NODE_ENV: 'production', QON_TEST_GRANTS: '1', QON_TEST_EPOCH: 'prod' }
  })
  const p = await register(production.service, 'produser')
  await rejects(call(production.service, p, 'test/grant'), 'NOT_FOUND')
  assert.equal((await production.service.handle('GET', '/v1/health')).testing.grantsEnabled, false)
})

test('every pity state normalizes probabilities, shared SSR soft schedule and high guarantee obey precedence', () => {
  for (let ssr = 0; ssr < 90; ssr++)
    for (let high = 0; high < 20; high++) {
      const p = probabilities({ sinceSSR: ssr, sinceHigh: high })
      assert.ok(Object.values(p).every((value) => value >= 0 && value <= 1))
      assert.ok(Math.abs(Object.values(p).reduce((a, b) => a + b, 0) - 1) < 1e-12)
      if (ssr === 89) assert.equal(p.SSR, 1)
      if (high === 19) assert.equal(p.A + p.R, 0)
    }
  assert.ok(Math.abs(probabilities({ sinceSSR: 75, sinceHigh: 0 }).SSR - 0.056) < 1e-12)
  assert.ok(Math.abs(probabilities({ sinceSSR: 88, sinceHigh: 0 }).SSR - 0.706) < 1e-12)
  assert.equal(
    chooseTier({ sinceSSR: 89, sinceHigh: 19 }, () => 0.999),
    'SSR'
  )
  assert.equal(
    chooseTier({ sinceSSR: 1, sinceHigh: 19 }, () => 0.9),
    'SR'
  )
  const state = newState()
  state.balances.tickets = { learning: 1, support: 1 }
  state.pity.sinceHigh = 18
  draw(state, { requestId: 'learning-test', count: 1, source: 'learning' }, 1, () => 0.99)
  const result = draw(
    state,
    { requestId: 'support-test', count: 1, source: 'support' },
    2,
    () => 0.99
  )
  assert.equal(result.results[0].tier, 'SR')
  assert.equal(state.pity.sinceHigh, 0)
  assert.equal(state.pity.sinceSSR, 2)
})

test('deterministic boundary samples preserve base tier mass and duplicate echoes never mint tickets or points', () => {
  const counts = { A: 0, R: 0, SR: 0, SSR: 0 }
  for (let i = 0; i < 10000; i++)
    counts[chooseTier({ sinceSSR: 0, sinceHigh: 0 }, () => (i + 0.5) / 10000)]++
  assert.deepEqual(counts, { A: 7000, R: 2440, SR: 500, SSR: 60 })
  const state = newState()
  state.balances.tickets.learning = 2
  draw(state, { requestId: randomUUID(), source: 'learning', count: 1 }, 1, () => 0)
  const result = draw(state, { requestId: randomUUID(), source: 'learning', count: 1 }, 2, () => 0)
  assert.equal(result.results[0].tier, 'SSR')
  assert.equal(result.results[0].echoes, 20)
  assert.equal(state.balances.tickets.learning, 0)
  assert.equal(state.balances.points, 0)
  assert.equal(state.balances.echoes, 20)
})

test('concurrent/repeated draw requests deduct once, mismatched payload conflicts, user assets remain isolated', async () => {
  const f = setup({ random: () => 0.99 }),
    a = await register(f.service, 'useraaa'),
    b = await register(f.service, 'userbbb')
  await call(f.service, a, 'test/grant')
  const body = mutation({ source: 'learning', count: 10 })
  const results = await Promise.all(
    Array.from({ length: 8 }, () => call(f.service, a, 'draw', body))
  )
  assert.ok(results.every((result) => JSON.stringify(result) === JSON.stringify(results[0])))
  assert.equal((await call(f.service, a, 'collection', {}, 'GET')).balances.tickets.learning, 90)
  assert.equal((await call(f.service, b, 'collection', {}, 'GET')).characters.length, 0)
  await rejects(call(f.service, a, 'draw', { ...body, count: 1 }), 'IDEMPOTENCY_CONFLICT')
  assert.ok(results[0].snapshot.history.some((entry) => entry.kind === '/v1/draw'))
  for (let i = 0; i < 9; i++)
    await call(f.service, a, 'draw', mutation({ source: 'learning', count: 10 }))
  await rejects(
    call(f.service, a, 'draw', mutation({ source: 'learning', count: 1 })),
    'INSUFFICIENT_TICKETS'
  )
})

test('wall-clock capped activity cannot count opening, offline gaps or parallel devices; task points cap and duplicate evidence', () => {
  const state = newState(),
    start = Date.parse('2026-10-12T09:00:00+08:00')
  const event = (seconds, completion) => ({
    requestId: 'test-event',
    language: 'ja',
    seconds,
    ...(completion ? { completion } : {})
  })
  assert.equal(activity(state, event(60), start).acceptedSeconds, 0)
  assert.equal(state.days[dayAt(start)].checkin, null)
  assert.equal(activity(state, event(60), start + 3600000).acceptedSeconds, 60)
  assert.equal(activity(state, event(60), start + 3600000).acceptedSeconds, 0)
  for (let i = 1; i <= 150; i++) activity(state, event(60), start + 3600000 + i * 60000)
  const d = state.days[dayAt(start)]
  assert.equal(d.seconds, 7200)
  assert.equal(d.timePoints, 120)
  for (let i = 0; i < 5; i++)
    activity(state, event(0, { kind: 'practice', id: `task-${i}` }), start + 150 * 60000 + 3600000)
  assert.equal(d.taskPoints, 20)
  assert.equal(state.balances.points, 140)
  activity(state, event(0, { kind: 'practice', id: 'task-0' }), start + 151 * 60000 + 3600000)
  assert.equal(d.tasks.length, 5)
  assert.equal(state.balances.points, 140)
})

test('weekly bonus requires five real qualifying days, stays in its natural week, makeup cannot qualify', () => {
  const state = newState(),
    monday = Date.parse('2026-10-12T12:00:00+08:00')
  for (let day = 0; day < 5; day++) {
    const at = monday + day * 86400000
    activity(
      state,
      {
        requestId: `start-${day}`,
        language: 'en',
        seconds: 0,
        completion: { kind: 'reading', id: 'article' }
      },
      at
    )
    for (let minute = 1; minute <= 10; minute++)
      activity(
        state,
        { requestId: `time-${day}-${minute}`, language: 'en', seconds: 60 },
        at + minute * 60000
      )
  }
  assert.deepEqual(state.weeklyClaims, ['2026-10-12'])
  assert.equal(state.balances.points, 5 * (20 + 40) + 80)
  activity(
    state,
    { requestId: 'again', language: 'en', seconds: 0 },
    monday + 4 * 86400000 + 11 * 60000
  )
  assert.equal(state.balances.points, 380)
  assert.equal(weekAt('2026-10-18'), '2026-10-12')
  assert.equal(weekAt('2026-10-19'), '2026-10-19')
  const fake = newState()
  fake.inventory.makeup = 2
  makeup(fake, { requestId: randomUUID(), itemId: 'makeup', day: '2026-10-11' }, monday)
  assert.equal(fake.days['2026-10-11'].seconds, 0)
  assert.equal(fake.days['2026-10-11'].tasks.length, 0)
  assert.equal(fake.weeklyClaims.length, 0)
})

test('store purchases enforce exact prices, rollback insufficient balance and makeup bounds/month limits without changing stats', () => {
  const state = newState(),
    now = Date.parse('2026-10-15T10:00:00+08:00')
  state.balances.points = 1360
  purchase(state, { requestId: randomUUID(), itemId: 'character:companion-1' }, now)
  purchase(state, { requestId: randomUUID(), itemId: 'character:companion-4' }, now)
  purchase(state, { requestId: randomUUID(), itemId: 'ticket' }, now)
  purchase(state, { requestId: randomUUID(), itemId: 'makeup', quantity: 2 }, now)
  assert.equal(state.balances.points, 0)
  assert.equal(state.balances.tickets.learning, 1)
  assert.equal(state.characters['companion-4'].count, 1)
  assert.throws(
    () => purchase(state, { requestId: randomUUID(), itemId: 'ticket' }, now),
    (e) => e.code === 'INSUFFICIENT_POINTS'
  )
  const oldTotal = JSON.stringify(state.languageSeconds)
  makeup(state, { requestId: randomUUID(), itemId: 'makeup', day: '2026-10-14' }, now)
  assert.throws(
    () => makeup(state, { requestId: randomUUID(), itemId: 'makeup', day: '2026-10-14' }, now),
    (e) => e.code === 'ALREADY_CHECKED_IN'
  )
  makeup(state, { requestId: randomUUID(), itemId: 'makeup', day: '2026-10-13' }, now)
  state.inventory.makeup++
  assert.throws(
    () => makeup(state, { requestId: randomUUID(), itemId: 'makeup', day: '2026-10-12' }, now),
    (e) => e.code === 'MAKEUP_MONTH_LIMIT'
  )
  assert.throws(
    () => makeup(state, { requestId: randomUUID(), itemId: 'makeup', day: '2026-10-15' }, now),
    (e) => e.code === 'MAKEUP_DAY_OUT_OF_RANGE'
  )
  assert.throws(
    () => makeup(state, { requestId: randomUUID(), itemId: 'makeup', day: '2026-10-06' }, now),
    (e) => e.code === 'MAKEUP_DAY_OUT_OF_RANGE'
  )
  assert.equal(JSON.stringify(state.languageSeconds), oldTotal)
})

test('manual payment does not credit automatically; admin amount/reference/idempotency/month cap and refund boundaries', async () => {
  const f = setup(),
    a = await register(f.service, 'payeraaa'),
    b = await register(f.service, 'payerbbb')
  const pending = await call(f.service, a, 'support/orders', mutation({ tickets: 2 }))
  assert.equal(pending.order.amountFen, 1200)
  assert.equal(pending.snapshot.balances.tickets.support, 0)
  assert.equal((await call(f.service, b, 'support/orders', {}, 'GET')).orders.length, 0)
  const approve = `/v1/admin/support/orders/${pending.order.id}/approve`
  await rejects(
    f.service.handle(
      'POST',
      approve,
      mutation({ adultVerified: true, amountFen: 1200, paymentReference: 'QA-receipt-1' }),
      { token: a.token }
    ),
    'ADMIN_UNAUTHORIZED'
  )
  await rejects(
    f.service.handle(
      'POST',
      approve,
      mutation({ adultVerified: true, amountFen: 600, paymentReference: 'QA-receipt-1' }),
      {
        token: 'a'.repeat(48)
      }
    ),
    'PAYMENT_AMOUNT_MISMATCH'
  )
  const body = mutation({ adultVerified: true, amountFen: 1200, paymentReference: 'QA-receipt-1' })
  const credit = await f.service.handle('POST', approve, body, { token: 'a'.repeat(48) })
  assert.equal(credit.snapshot.balances.tickets.support, 2)
  assert.deepEqual(await f.service.handle('POST', approve, body, { token: 'a'.repeat(48) }), credit)
  await rejects(
    f.service.handle(
      'POST',
      approve,
      mutation({ adultVerified: true, amountFen: 1200, paymentReference: 'QA-receipt-2' }),
      { token: 'a'.repeat(48) }
    ),
    'ORDER_NOT_PENDING'
  )
  const next = await call(f.service, b, 'support/orders', mutation({ tickets: 1 }))
  await rejects(
    f.service.handle(
      'POST',
      `/v1/admin/support/orders/${next.order.id}/approve`,
      mutation({ adultVerified: true, amountFen: 600, paymentReference: 'QA-receipt-1' }),
      { token: 'a'.repeat(48) }
    ),
    'PAYMENT_ALREADY_USED'
  )
  await rejects(
    call(f.service, a, 'support/orders', mutation({ tickets: 9 })),
    'SUPPORT_MONTH_LIMIT'
  )
  const refund = await f.service.handle(
    'POST',
    `/v1/admin/support/orders/${pending.order.id}/refund`,
    mutation(),
    { token: 'a'.repeat(48) }
  )
  assert.equal(refund.snapshot.balances.tickets.support, 0)
  assert.equal(refund.order.status, 'refunded')
  const used = await call(f.service, a, 'support/orders', mutation({ tickets: 1 }))
  await f.service.handle(
    'POST',
    `/v1/admin/support/orders/${used.order.id}/approve`,
    mutation({ adultVerified: true, amountFen: 600, paymentReference: 'QA-receipt-3' }),
    { token: 'a'.repeat(48) }
  )
  await call(f.service, a, 'draw', mutation({ source: 'support', count: 1 }))
  await rejects(
    f.service.handle('POST', `/v1/admin/support/orders/${used.order.id}/refund`, mutation(), {
      token: 'a'.repeat(48)
    }),
    'REFUND_REQUIRES_MANUAL_REVIEW'
  )
})

test('leaderboards opt-in, total versus exact language and no account or paid data disclosure', async () => {
  const f = setup(),
    a = await register(f.service, 'leaderaa'),
    b = await register(f.service, 'leaderbb')
  await call(f.service, a, 'test/grant')
  await call(f.service, a, 'draw', mutation({ source: 'learning', count: 1 }))
  await call(f.service, a, 'reward/activity', mutation({ language: 'en', seconds: 0 }))
  f.advance(60000)
  await call(f.service, a, 'reward/activity', mutation({ language: 'en', seconds: 60 }))
  f.advance(60000)
  await call(f.service, a, 'reward/activity', mutation({ language: 'fr', seconds: 60 }))
  const rank = (query) => f.service.handle('GET', '/v1/leaderboards', {}, { token: b.token, query })
  assert.equal((await rank({ kind: 'collection' })).rows.length, 1)
  await call(f.service, a, 'auth/me', { publicCollection: false, publicTime: false }, 'PATCH')
  assert.equal((await rank({ kind: 'collection' })).rows.length, 0)
  await call(f.service, a, 'auth/me', { publicCollection: true, publicTime: true }, 'PATCH')
  const total = await rank({ kind: 'time' })
  assert.equal(total.rows[0].value, 120)
  assert.equal((await rank({ kind: 'time', language: 'en' })).rows[0].value, 60)
  assert.equal((await rank({ kind: 'time', language: 'qonlang:en' })).rows.length, 0)
  await rejects(rank({ kind: 'time', language: 'English' }), 'INVALID_LANGUAGE')
  assert.deepEqual(Object.keys(total.rows[0]).sort(), [
    'currentCompanion',
    'nickname',
    'publicId',
    'rank',
    'value'
  ])
  await call(f.service, a, 'auth/me', { publicTime: false }, 'PATCH')
  assert.equal((await rank({ kind: 'time' })).rows.length, 0)
})

test('real HTTP API enforces body/content-type/TLS and returns stable errors without secrets', async () => {
  const f = setup(),
    server = createApi({ service: f.service })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(`${base}/v1/health`)).status, 200)
    const response = await fetch(`${base}/v1/collection`)
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED')
    assert.equal((await fetch(`${base}/v1/auth/login`, { method: 'POST', body: '{}' })).status, 415)
    const tooLarge = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: 'a'.repeat(33000) })
    })
    assert.equal(tooLarge.status, 413)
    const bad = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    })
    assert.equal((await bad.json()).error.code, 'INVALID_JSON')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  const prod = createApi({ service: f.service, production: true, trustProxy: true })
  await new Promise((resolve) => prod.listen(0, '127.0.0.1', resolve))
  try {
    assert.equal((await fetch(`http://127.0.0.1:${prod.address().port}/v1/health`)).status, 403)
    assert.equal(
      (
        await fetch(`http://127.0.0.1:${prod.address().port}/v1/health`, {
          headers: { 'X-Forwarded-Proto': 'https' }
        })
      ).status,
      200
    )
  } finally {
    await new Promise((resolve) => prod.close(resolve))
  }
})
