/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node server tests. */
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { ClientPolicy, POLICY_TTL, POLICY_TIMEOUT, POLICY_RETRY } from '../client-policy.mjs'
import { Service } from '../service.mjs'
import { createApi } from '../index.mjs'
import { hash } from '../store.mjs'
import { CLIENT_VERSION, fixtureFetch, releaseFixture } from './client-fixture.mjs'

const cleanup = []
afterEach(async () => {
  for (const action of cleanup.splice(0)) await action()
})
const response = (version = CLIENT_VERSION, extra = {}) =>
  new Response(JSON.stringify(releaseFixture(version, extra)))
const reject = (promise, code, status) =>
  assert.rejects(promise, (error) => error.code === code && error.status === status)
const credentials = { username: 'policy_user', password: 'fixture-password-123' }
const current = { clientVersion: CLIENT_VERSION }
function setup(options = {}) {
  let now = Date.parse('2026-10-14T12:00:00+08:00')
  const service = new Service({
    now: () => now,
    env: { NODE_ENV: 'test', QON_TEST_GRANTS: '1' },
    policyFetch: fixtureFetch,
    ...options
  })
  cleanup.push(() => service.close())
  return { service, time: () => now, advance: (ms) => (now += ms) }
}

test('latest lookup uses the fixed GitHub HTTPS endpoint without credentials or redirects and returns bounded policy metadata', async () => {
  let calls = 0
  const now = Date.parse('2026-10-14T12:00:00+08:00')
  const policy = new ClientPolicy({
    now: () => now,
    fetch: async (url, options) => {
      calls++
      assert.equal(url, 'https://api.github.com/repos/Kinnuch/Qonsona/releases/latest')
      assert.equal(options.redirect, 'error')
      assert.ok(options.signal instanceof AbortSignal)
      assert.equal(options.headers.Authorization, undefined)
      return response()
    },
    env: { NODE_ENV: 'production', QON_CLIENT_POLICY_URL: 'http://untrusted.invalid/latest' }
  })
  const result = await policy.get()
  assert.deepEqual(result, {
    app: 'qonsona',
    mode: 'exact-latest',
    currentVersion: '0.4.0',
    source: 'github-latest',
    checkedAt: now,
    serverTime: now,
    validUntil: now + POLICY_TTL,
    releaseUrl: 'https://github.com/Kinnuch/Qonsona/releases/tag/v0.4.0'
  })
  assert.equal(calls, 1)
  assert.equal(Object.isFrozen(result), true)
})

test('concurrent requests share one fetch and cached serverTime cannot extend the original two-minute authorization', async () => {
  let now = 1000000
  let finish
  let calls = 0
  let version = '0.4.0'
  const policy = new ClientPolicy({
    now: () => now,
    fetch: async () => {
      calls++
      if (calls === 1) await new Promise((resolve) => (finish = resolve))
      return response(version)
    }
  })
  const waiting = Array.from({ length: 8 }, () => policy.get())
  await Promise.resolve()
  finish()
  const results = await Promise.all(waiting)
  assert.equal(calls, 1)
  assert.ok(results.every((value) => value.checkedAt === 1000000))
  now += POLICY_TTL - 1
  const almostExpired = await policy.get()
  assert.equal(almostExpired.validUntil - almostExpired.serverTime, 1)
  assert.equal(almostExpired.checkedAt, 1000000)
  assert.equal(calls, 1)
  version = '0.4.1'
  now++
  const updated = await policy.get()
  assert.equal(updated.currentVersion, version)
  assert.equal(updated.checkedAt, now)
  assert.equal(calls, 2)
})

test('an expired success fails closed during GitHub failure and retry backoff, then accepts a fresh recovery', async () => {
  let now = 1000000
  let offline = false
  let calls = 0
  const policy = new ClientPolicy({
    now: () => now,
    fetch: async () => {
      calls++
      if (offline) throw new Error('fixture upstream unavailable')
      return response(offline ? '0.4.0' : '0.4.1')
    }
  })
  assert.equal((await policy.get()).currentVersion, '0.4.1')
  now += POLICY_TTL
  offline = true
  for (const task of [policy.get(), policy.get(), policy.get()])
    await reject(task, 'CLIENT_POLICY_UNAVAILABLE', 503)
  assert.equal(calls, 2)
  assert.equal(policy.cached, null)
  now += POLICY_RETRY - 1
  await reject(policy.require('qonsona', '0.4.1'), 'CLIENT_POLICY_UNAVAILABLE', 503)
  assert.equal(calls, 2)
  now++
  offline = false
  assert.equal((await policy.require('qonsona', '0.4.1')).currentVersion, '0.4.1')
  assert.equal(calls, 3)
})

test('a hung injected upstream times out and aborts even if the fetch implementation ignores cancellation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signal
  const policy = new ClientPolicy({
    fetch: async (_url, options) => {
      signal = options.signal
      return new Promise(() => {})
    }
  })
  const rejected = reject(policy.get(), 'CLIENT_POLICY_UNAVAILABLE', 503)
  await Promise.resolve()
  t.mock.timers.tick(POLICY_TIMEOUT)
  await rejected
  assert.equal(signal.aborted, true)
  assert.equal(policy.cached, null)
})

test('drafts, prereleases, malformed versions, unpublished releases and wrong repository URLs cannot authorize clients', async () => {
  const invalid = [
    { draft: true },
    { draft: undefined },
    { prerelease: true },
    { tag_name: 'v0.4.0-beta.1' },
    { tag_name: 'v00.4.0' },
    { tag_name: '0.4.0' },
    { id: 0 },
    { published_at: null },
    { published_at: 'bad date' },
    { html_url: 'https://github.com/Kinnuch/Qonlang/releases/tag/v0.4.0' },
    { html_url: 'https://github.com.example.invalid/Kinnuch/Qonsona/releases/tag/v0.4.0' },
    { html_url: 'http://github.com/Kinnuch/Qonsona/releases/tag/v0.4.0' },
    { html_url: 'https://github.com/Kinnuch/Qonsona/releases/tag/v0.4.1' }
  ]
  for (const extra of invalid) {
    const policy = new ClientPolicy({ fetch: async () => response('0.4.0', extra) })
    await reject(policy.get(), 'CLIENT_POLICY_UNAVAILABLE', 503)
    assert.equal(policy.cached, null)
  }
})

test('redirects, excessive release metadata and non-200 responses are rejected without following another origin', async () => {
  for (const fixture of [
    new Response('', { status: 302, headers: { Location: 'https://untrusted.invalid' } }),
    new Response('[]', { status: 429 }),
    new Response('x'.repeat(512001)),
    new Response('{}', { headers: { 'Content-Length': '512001' } }),
    { status: 200, redirected: true },
    { status: 200, redirected: false, url: 'https://untrusted.invalid/latest' }
  ]) {
    let calls = 0
    const policy = new ClientPolicy({
      fetch: async (_url, options) => {
        calls++
        assert.equal(options.redirect, 'error')
        return fixture
      }
    })
    await reject(policy.get(), 'CLIENT_POLICY_UNAVAILABLE', 503)
    assert.equal(calls, 1)
  }
})

test('only an explicit nonproduction override is accepted; production ignores it and obtains the actual upstream version', async () => {
  let calls = 0
  const fetch = async () => {
    calls++
    return response('0.4.0')
  }
  const testing = new ClientPolicy({
    env: { NODE_ENV: 'test', QON_TEST_CLIENT_VERSION: '0.4.1' },
    fetch
  })
  assert.equal((await testing.require('qonsona', '0.4.1')).source, 'test-override')
  assert.equal(calls, 0)
  const production = new ClientPolicy({
    env: { NODE_ENV: 'production', QON_TEST_CLIENT_VERSION: '0.4.1' },
    fetch
  })
  await reject(production.require('qonsona', '0.4.1'), 'CLIENT_UPDATE_REQUIRED', 426)
  assert.equal((await production.require('qonsona', '0.4.0')).source, 'github-latest')
  assert.equal(calls, 1)
  assert.throws(
    () => new ClientPolicy({ env: { NODE_ENV: 'test', QON_TEST_CLIENT_VERSION: '0.4.1-beta.1' } }),
    /Invalid QON_TEST_CLIENT_VERSION/
  )
})

test('missing, older, future and prerelease versions cannot register or log in, while the exact current version can', async () => {
  const { service } = setup()
  for (const clientVersion of [undefined, '0.3.0', '0.4.1', '0.4.0-beta.1', 'v0.4.0', ['0.4.0']]) {
    for (const route of ['register', 'login'])
      await reject(
        service.handle('POST', `/v1/auth/${route}`, credentials, { clientVersion }),
        'CLIENT_UPDATE_REQUIRED',
        426
      )
  }
  assert.equal(service.store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0)
  assert.equal(service.passwordJobs, 0)
  const user = await service.handle('POST', '/v1/auth/register', credentials, current)
  const login = await service.handle('POST', '/v1/auth/login', credentials, current)
  assert.equal(user.user.id, login.user.id)
  assert.equal(service.store.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 2)
})

test('every authenticated Qonsona online route requires the current version without deleting sessions or changing assets', async () => {
  let version = '0.4.0'
  const f = setup({ policyFetch: async () => response(version) })
  const user = await f.service.handle('POST', '/v1/auth/register', credentials, current)
  await f.service.handle(
    'POST',
    '/v1/test/grant',
    { requestId: randomUUID() },
    { ...current, token: user.token }
  )
  const frozen = f.service.store.user(user.user.id).state
  const receipts = f.service.store.db.prepare('SELECT COUNT(*) AS n FROM requests').get().n
  version = '0.4.1'
  f.advance(POLICY_TTL)
  for (const [method, path, body] of [
    ['GET', '/v1/auth/me', {}],
    ['PATCH', '/v1/auth/me', { nickname: 'Changed' }],
    ['GET', '/v1/collection', {}],
    ['GET', '/v1/friends', {}],
    ['GET', '/v1/leaderboards', {}],
    ['GET', '/v1/support/orders', {}],
    ['POST', '/v1/draw', { requestId: randomUUID(), count: 1, source: 'learning' }],
    ['POST', '/v1/test/grant', { requestId: randomUUID() }],
    ['POST', '/v1/shop/purchase', { requestId: randomUUID(), itemId: 'ticket' }],
    ['POST', '/v1/reward/activity', { requestId: randomUUID(), language: 'en', seconds: 60 }],
    ['POST', '/v1/tasks/configure', { requestId: randomUUID(), kinds: ['courses', 'practice'] }],
    ['POST', '/v1/collection/legacy', { requestId: randomUUID(), unlocks: [] }],
    ['POST', '/v1/home/update', { requestId: randomUUID() }],
    ['POST', '/v1/companion/select', { requestId: randomUUID(), characterId: 'companion-1' }],
    ['POST', '/v1/companion/answer', { requestId: randomUUID() }],
    ['POST', '/v1/friends/request', { requestId: randomUUID() }],
    ['POST', '/v1/friends/respond', { requestId: randomUUID() }],
    ['POST', '/v1/friends/remove', { requestId: randomUUID() }],
    ['POST', '/v1/inventory/use', { requestId: randomUUID() }],
    ['POST', '/v1/support/orders', { requestId: randomUUID(), tickets: 1 }]
  ])
    await reject(
      f.service.handle(method, path, body, { ...current, token: user.token }),
      'CLIENT_UPDATE_REQUIRED',
      426
    )
  assert.equal(f.service.store.user(user.user.id).state, frozen)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM requests').get().n, receipts)
  assert.ok(
    f.service.store.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash(user.token))
  )
  const snapshot = await f.service.handle(
    'GET',
    '/v1/collection',
    {},
    { clientVersion: version, token: user.token }
  )
  assert.equal(snapshot.balances.tickets.learning, 100)
  assert.equal(snapshot.user.nickname, user.user.nickname)
})

test('Qonlang preserves five basic account routes, but cannot access collection economy or disguise another product session', async () => {
  const { service } = setup()
  const qlang = await service.handle('POST', '/v1/auth/register', credentials, { app: 'qonlang' })
  const qsona = await service.handle('POST', '/v1/auth/login', credentials, current)
  assert.equal(qlang.user.id, qsona.user.id)
  const legacy = { app: 'qonlang', token: qlang.token }
  await service.handle('GET', '/v1/auth/me', {}, legacy)
  await service.handle('PATCH', '/v1/auth/me', { nickname: 'Compatible' }, legacy)
  const policy = await service.handle('GET', '/v1/client-policy', {}, { query: { app: 'qonlang' } })
  assert.equal(policy.mode, 'legacy-auth-only')
  assert.equal(policy.currentVersion, null)
  const frozen = service.store.user(qlang.user.id).state
  for (const [method, path] of [
    ['GET', '/v1/collection'],
    ['GET', '/v1/friends'],
    ['GET', '/v1/leaderboards'],
    ['POST', '/v1/draw'],
    ['POST', '/v1/shop/purchase'],
    ['POST', '/v1/reward/activity'],
    ['POST', '/v1/home/update'],
    ['POST', '/v1/companion/answer']
  ])
    await reject(service.handle(method, path, {}, legacy), 'CLIENT_ROUTE_UNAVAILABLE', 403)
  await reject(
    service.handle('GET', '/v1/collection', {}, { ...current, token: qlang.token }),
    'CLIENT_APP_MISMATCH',
    403
  )
  await reject(
    service.handle('GET', '/v1/collection', {}, { app: 'qonlang', token: qsona.token }),
    'CLIENT_APP_MISMATCH',
    403
  )
  assert.equal(service.store.user(qlang.user.id).state, frozen)
  await service.handle('POST', '/v1/auth/logout', {}, legacy)
  await service.handle('GET', '/v1/auth/me', {}, { ...current, token: qsona.token })
})

test('version-policy failures block login and mutations but permit logout and never erase account assets or other sessions', async () => {
  let offline = false
  const f = setup({
    policyFetch: async () => {
      if (offline) throw new Error('fixture offline')
      return response()
    }
  })
  const first = await f.service.handle('POST', '/v1/auth/register', credentials, current)
  const second = await f.service.handle('POST', '/v1/auth/login', credentials, current)
  const frozen = f.service.store.user(first.user.id).state
  offline = true
  f.advance(POLICY_TTL)
  await reject(
    f.service.handle('POST', '/v1/auth/login', credentials, current),
    'CLIENT_POLICY_UNAVAILABLE',
    503
  )
  await reject(
    f.service.handle(
      'POST',
      '/v1/test/grant',
      { requestId: randomUUID() },
      { ...current, token: first.token }
    ),
    'CLIENT_POLICY_UNAVAILABLE',
    503
  )
  assert.equal(f.service.store.user(first.user.id).state, frozen)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 2)
  assert.deepEqual(await f.service.handle('POST', '/v1/auth/logout', {}, { token: first.token }), {
    ok: true
  })
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1)
  assert.ok(
    f.service.store.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash(second.token))
  )
  assert.equal((await f.service.handle('GET', '/v1/health')).status, 'ok')
})

test('real HTTP exposes the policy, reads X-Qon-Version and sends only public update metadata on 426', async () => {
  const { service } = setup()
  const server = createApi({ service })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  cleanup.unshift(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/v1`
  const policyResponse = await fetch(`${base}/client-policy?app=qonsona`)
  assert.equal(policyResponse.status, 200)
  const policy = await policyResponse.json()
  assert.equal(policy.currentVersion, '0.4.0')
  assert.equal(Number.isSafeInteger(policy.serverTime), true)
  const blocked = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  })
  assert.equal(blocked.status, 426)
  assert.deepEqual(await blocked.json(), {
    error: {
      code: 'CLIENT_UPDATE_REQUIRED',
      message: 'CLIENT_UPDATE_REQUIRED',
      currentVersion: '0.4.0',
      releaseUrl: 'https://github.com/Kinnuch/Qonsona/releases/tag/v0.4.0'
    }
  })
  const registered = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Qon-App': 'qonsona',
      'X-Qon-Version': '0.4.0'
    },
    body: JSON.stringify(credentials)
  })
  assert.equal(registered.status, 200)
  const user = await registered.json()
  const token = user.token
  const missing = await fetch(`${base}/collection`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  assert.equal(missing.status, 426)
  const logout = await fetch(`${base}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{}'
  })
  assert.equal(logout.status, 200)
})
