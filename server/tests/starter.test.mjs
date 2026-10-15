/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node test module. */
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Service } from '../service.mjs'
import { fixtureFetch, CLIENT_VERSION } from './client-fixture.mjs'
import { CATALOG, newState, claimStarter } from '../domain.mjs'
import { createApi } from '../index.mjs'

const fixtures = []
const now = Date.parse('2026-10-15T12:00:00+08:00')
const starters = CATALOG.filter((character) => character.tier === 'A' && !character.special)
afterEach(() => {
  for (const f of fixtures.splice(0).reverse()) {
    f.service.close()
    if (f.directory) rmSync(f.directory, { recursive: true, force: true })
  }
})
function setup(persistent = false) {
  const directory = persistent ? mkdtempSync(join(tmpdir(), 'qon-starter-test-')) : null
  const options = {
    path: directory ? join(directory, 'test.sqlite') : ':memory:',
    now: () => now,
    env: { NODE_ENV: 'test' },
    policyFetch: fixtureFetch
  }
  const service = new Service(options)
  const row = service.store.createUser('starter_test', 'Starter Test', 'synthetic-test-hash', now)
  const f = { directory, options, service, account: service.session(row, 'qonsona', now) }
  fixtures.push(f)
  return f
}
function claim(f, characterId = starters[0].id, extra = {}, context = {}) {
  return f.service.handle(
    'POST',
    '/v1/collection/starter',
    { requestId: randomUUID(), characterId, ...extra },
    { token: f.account.token, clientVersion: CLIENT_VERSION, ...context }
  )
}
const rejects = (request, code) => assert.rejects(request, (error) => error.code === code)

test('a starter grants one regular A companion, zero economy or XP, and selects an empty companion slot', async () => {
  const f = setup()
  const result = await claim(f)
  assert.equal(result.characterId, starters[0].id)
  assert.deepEqual(result.snapshot.starter, {
    characterId: starters[0].id,
    claimedAt: now,
    source: 'guest-starter'
  })
  assert.deepEqual(result.snapshot.characters, [
    { id: starters[0].id, count: 1, firstAt: now, source: 'guest-starter' }
  ])
  assert.deepEqual(result.snapshot.balances, f.account.snapshot.balances)
  assert.deepEqual(result.snapshot.pity, f.account.snapshot.pity)
  assert.deepEqual(result.snapshot.checkins, [])
  assert.equal(result.snapshot.totals.seconds, 0)
  assert.equal(result.snapshot.totals.collectionCount, 1)
  assert.equal(result.snapshot.companion.currentId, starters[0].id)
  assert.deepEqual(result.snapshot.companion.progress, [
    { characterId: starters[0].id, xp: 0, gifts: [] }
  ])
})

test('each whitelisted A companion can be the first choice', () => {
  assert.equal(starters.length, 5)
  for (const character of starters) {
    const state = newState()
    const result = claimStarter(state, { requestId: randomUUID(), characterId: character.id }, now)
    assert.equal(result.characterId, character.id)
    assert.equal(Object.keys(state.characters).length, 1)
  }
})

test('same request replays exactly; fresh requests and concurrent choices return the original starter', async () => {
  const f = setup()
  const requestId = randomUUID()
  const first = await claim(f, starters[0].id, { requestId })
  assert.deepEqual(await claim(f, starters[0].id, { requestId }), first)
  await rejects(claim(f, starters[1].id, { requestId }), 'IDEMPOTENCY_CONFLICT')
  const results = await Promise.all([claim(f, starters[1].id), claim(f, starters[2].id)])
  for (const result of results) {
    assert.equal(result.characterId, starters[0].id)
    assert.equal(result.snapshot.characters.length, 1)
    assert.equal(result.snapshot.characters[0].count, 1)
    assert.deepEqual(result.snapshot.balances, first.snapshot.balances)
    assert.deepEqual(result.snapshot.starter, first.snapshot.starter)
  }
})

test('simultaneous first requests never issue a second companion', async () => {
  const f = setup()
  const results = await Promise.all([claim(f, starters[0].id), claim(f, starters[1].id)])
  assert.equal(results[0].characterId, results[1].characterId)
  const snapshot = f.service.store.snapshot(f.account.user.id, now)
  assert.equal(snapshot.characters.length, 1)
  assert.equal(snapshot.characters[0].count, 1)
  assert.equal(snapshot.balances.echoes, 0)
})

test('separate SQLite connections share the account-wide one-starter limit', async () => {
  const f = setup(true)
  const other = new Service(f.options)
  fixtures.push({ service: other })
  const results = await Promise.all([
    claim(f, starters[0].id),
    claim({ ...f, service: other }, starters[1].id)
  ])
  assert.equal(results[0].characterId, results[1].characterId)
  for (const service of [f.service, other]) {
    const snapshot = service.store.snapshot(f.account.user.id, now)
    assert.equal(snapshot.starter.characterId, results[0].characterId)
    assert.equal(snapshot.characters.length, 1)
    assert.equal(snapshot.characters[0].count, 1)
    assert.equal(snapshot.balances.echoes, 0)
  }
})

test('R, SR, SSR, monthly, unknown IDs and client economic fields are rejected without mutations', async () => {
  const f = setup()
  const original = f.service.store.user(f.account.user.id).state
  for (const id of [
    ...CATALOG.filter((character) => character.tier !== 'A').map((character) => character.id),
    'monthly-2026-10',
    'unknown-companion'
  ])
    await rejects(claim(f, id), 'INVALID_STARTER_CHARACTER')
  for (const extra of [{ points: 99999 }, { xp: 500 }, { count: 2 }, { source: 'support' }])
    await rejects(claim(f, starters[0].id, extra), 'INVALID_FIELDS')
  assert.equal(f.service.store.user(f.account.user.id).state, original)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS count FROM requests').get().count, 0)
  assert.equal(f.service.store.db.prepare('SELECT COUNT(*) AS count FROM ledger').get().count, 0)
})

test('existing ownership keeps count, source, timestamp and active companion with no duplicate reward', async () => {
  const f = setup()
  const state = newState()
  delete state.starter
  state.characters[starters[0].id] = {
    id: starters[0].id,
    count: 3,
    firstAt: 123,
    source: 'learning'
  }
  state.characters[starters[1].id] = { id: starters[1].id, count: 1, firstAt: 456, source: 'shop' }
  state.companion = {
    currentId: starters[1].id,
    progress: { [starters[1].id]: { characterId: starters[1].id, xp: 700, gifts: ['keepsake-1'] } }
  }
  state.balances = { points: 900, tickets: { learning: 5, support: 7 }, echoes: 42 }
  state.pity = { sinceSSR: 55, sinceHigh: 15 }
  f.service.store.db
    .prepare('UPDATE users SET state=? WHERE id=?')
    .run(JSON.stringify(state), f.account.user.id)
  const result = await claim(f)
  assert.deepEqual(result.snapshot.characters, Object.values(state.characters))
  assert.deepEqual(result.snapshot.balances, state.balances)
  assert.deepEqual(result.snapshot.pity, state.pity)
  assert.equal(result.snapshot.companion.currentId, state.companion.currentId)
  assert.deepEqual(result.snapshot.companion.progress, Object.values(state.companion.progress))
  assert.equal(result.snapshot.starter.characterId, starters[0].id)
})

test('old accounts are unchanged on reads and the starter receipt survives service restart and another session', async () => {
  const f = setup(true)
  const state = JSON.parse(f.service.store.user(f.account.user.id).state)
  delete state.starter
  f.service.store.db
    .prepare('UPDATE users SET state=? WHERE id=?')
    .run(JSON.stringify(state), f.account.user.id)
  const original = f.service.store.user(f.account.user.id).state
  assert.equal(f.service.store.snapshot(f.account.user.id, now).starter, undefined)
  assert.equal(f.service.store.user(f.account.user.id).state, original)
  const requestId = randomUUID()
  const first = await claim(f, starters[0].id, { requestId })
  f.service.close()
  f.service = new Service(f.options)
  const current = f.service.store.user(f.account.user.id)
  f.account = f.service.session(current, 'qonsona', now)
  assert.deepEqual(f.account.snapshot.starter, first.snapshot.starter)
  assert.deepEqual(await claim(f, starters[0].id, { requestId }), first)
  assert.equal((await claim(f, starters[1].id)).characterId, starters[0].id)
  assert.equal(f.service.store.snapshot(current.id, now).characters.length, 1)
})

test('starter requires authentication, matching product and the exact latest version', async () => {
  const f = setup()
  await rejects(claim(f, starters[0].id, {}, { token: undefined }), 'UNAUTHORIZED')
  for (const clientVersion of [undefined, '0.3.0', '99.0.0', '0.4.0-beta.1'])
    await rejects(claim(f, starters[0].id, {}, { clientVersion }), 'CLIENT_UPDATE_REQUIRED')
  const lang = f.service.session(f.service.store.user(f.account.user.id), 'qonlang', now)
  await rejects(
    claim(f, starters[0].id, {}, { token: lang.token, app: 'qonsona' }),
    'CLIENT_APP_MISMATCH'
  )
  await rejects(
    claim(f, starters[0].id, {}, { token: lang.token, app: 'qonlang' }),
    'CLIENT_ROUTE_UNAVAILABLE'
  )
  assert.equal(f.service.store.snapshot(f.account.user.id, now).characters.length, 0)
})

test('HTTP starter route enforces admission and returns the authenticated account snapshot', async () => {
  const f = setup()
  const server = createApi({ service: f.service })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}/v1/collection/starter`
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${f.account.token}`,
      'X-Qon-App': 'qonsona',
      'X-Qon-Version': CLIENT_VERSION
    }
    const body = JSON.stringify({ requestId: randomUUID(), characterId: starters[0].id })
    const unauthenticated = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })
    assert.equal(unauthenticated.status, 401)
    const outdated = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, 'X-Qon-Version': '0.3.0' },
      body
    })
    assert.equal(outdated.status, 426)
    const response = await fetch(endpoint, { method: 'POST', headers, body })
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.characterId, starters[0].id)
    assert.equal(result.snapshot.user.id, f.account.user.id)
    assert.equal(result.snapshot.starter.characterId, starters[0].id)
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
