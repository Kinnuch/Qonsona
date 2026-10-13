/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node server tests. */
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Service } from '../service.mjs'
import { Store } from '../store.mjs'
import { CATALOG, shopFor } from '../catalog.mjs'
import { POOL_EPOCH, POOL_DURATION } from '../draw-pools.mjs'

const cleanup = []
afterEach(() => {
  for (const action of cleanup.splice(0)) action()
})
const mutation = (body = {}) => ({ requestId: randomUUID(), ...body })
function setup(options = {}) {
  let now = POOL_EPOCH + 86400000
  const service = new Service({
    now: () => now,
    env: { NODE_ENV: 'test', QON_TEST_GRANTS: '1' },
    ...options
  })
  cleanup.push(() => service.close())
  return { service, time: () => now, setTime: (value) => (now = value) }
}
const register = (service, username) =>
  service.handle(
    'POST',
    '/v1/auth/register',
    { username, password: 'only-a-testing-password' },
    { ip: username }
  )
const call = (service, user, route, body = {}, method = 'POST') =>
  service.handle(method, `/v1/${route}`, body, { token: user.token, ip: user.user.id })
const rejection = (promise, code) => assert.rejects(promise, (error) => error.code === code)
function editState(service, user, change) {
  const state = JSON.parse(service.store.user(user.user.id).state)
  change(state)
  service.store.db
    .prepare('UPDATE users SET state=? WHERE id=?')
    .run(JSON.stringify(state), user.user.id)
}
function own(service, user, id = 'companion-1') {
  editState(service, user, (state) => {
    state.characters[id] = { id, count: 1, source: 'qa-fixture', firstAt: 1 }
  })
}

test('weekly SSR permutations exhaust each full cycle, never repeat across boundaries and retain the complete lower-tier pool', () => {
  const store = new Store(':memory:')
  cleanup.push(() => store.close())
  const ssrs = CATALOG.filter((character) => character.tier === 'SSR')
    .map((character) => character.id)
    .sort()
  const lower = CATALOG.filter((character) => character.tier !== 'SSR')
    .map((character) => character.id)
    .sort()
  const periods = Array.from({ length: ssrs.length * 6 }, (_, index) =>
    store.drawPool(POOL_EPOCH + index * POOL_DURATION)
  )
  for (let cycle = 0; cycle < 6; cycle++) {
    const group = periods.slice(cycle * ssrs.length, (cycle + 1) * ssrs.length)
    assert.deepEqual(group.map((pool) => pool.ssrIds[0]).sort(), ssrs)
  }
  for (let index = 0; index < periods.length; index++) {
    const pool = periods[index]
    assert.equal(pool.startAt, POOL_EPOCH + index * POOL_DURATION)
    assert.equal(pool.endAt - pool.startAt, POOL_DURATION)
    assert.equal(pool.ssrIds.length, 1)
    assert.deepEqual(pool.characterIds.filter((id) => !pool.ssrIds.includes(id)).sort(), lower)
    assert.ok(pool.characterIds.every((id) => !id.startsWith('monthly-')))
    assert.deepEqual(Object.keys(pool).sort(), ['characterIds', 'endAt', 'id', 'ssrIds', 'startAt'])
    if (index) assert.notEqual(pool.ssrIds[0], periods[index - 1].ssrIds[0])
  }
  assert.deepEqual(store.drawPool(periods[0].endAt - 1), periods[0])
  assert.deepEqual(store.drawPool(periods[0].endAt), periods[1])
  // Looking up an old week after a future week cannot reroll its SSR.
  assert.deepEqual(store.drawPool(POOL_EPOCH), periods[0])
})

test('global seed, cycle and weekly pool receipts survive process replacement and simultaneous database connections', () => {
  const directory = mkdtempSync(join(tmpdir(), 'qon-weekly-pool-'))
  const file = join(directory, 'pool.sqlite')
  let first = new Store(file)
  const second = new Store(file)
  cleanup.push(() => {
    first.close()
    second.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const pools = Array.from({ length: 13 }, (_, index) =>
    first.drawPool(POOL_EPOCH + index * POOL_DURATION)
  )
  for (let index = 0; index < pools.length; index++)
    assert.deepEqual(second.drawPool(POOL_EPOCH + index * POOL_DURATION), pools[index])
  first.close()
  first = new Store(file)
  for (let index = pools.length - 1; index >= 0; index--)
    assert.deepEqual(first.drawPool(POOL_EPOCH + index * POOL_DURATION), pools[index])
  assert.equal(first.db.prepare('SELECT COUNT(*) AS n FROM service_settings').get().n, 1)
  assert.equal(first.db.prepare('SELECT COUNT(*) AS n FROM draw_pools').get().n, 13)
})

test('adding a regular SSR preserves an already started cycle and admits the new spirit on the next cycle', () => {
  const store = new Store(':memory:')
  cleanup.push(() => store.close())
  const originalLength = CATALOG.filter((character) => character.tier === 'SSR').length
  const first = store.drawPool(POOL_EPOCH)
  const order = JSON.parse(
    store.db.prepare('SELECT ssr_order FROM draw_pool_cycles WHERE start_slot=0').get().ssr_order
  )
  const added = { ...CATALOG.find((character) => character.tier === 'SSR'), id: 'qa-new-ssr' }
  CATALOG.push(added)
  try {
    assert.deepEqual(store.drawPool(POOL_EPOCH), first)
    for (let index = 0; index < originalLength; index++)
      assert.equal(store.drawPool(POOL_EPOCH + index * POOL_DURATION).ssrIds[0], order[index])
    const next = Array.from(
      { length: originalLength + 1 },
      (_, index) => store.drawPool(POOL_EPOCH + (originalLength + index) * POOL_DURATION).ssrIds[0]
    )
    assert.equal(new Set(next).size, originalLength + 1)
    assert.ok(next.includes(added.id))
    assert.notEqual(next[0], order.at(-1))
  } finally {
    CATALOG.pop()
  }
})

test('draws obey the active SSR, preserve original pool history on replay and reject stale new confirmations atomically', async () => {
  const f = setup({ random: () => 0 }),
    user = await register(f.service, 'weekly_draw')
  await call(f.service, user, 'test/grant', mutation())
  const first = await call(f.service, user, 'collection', {}, 'GET')
  const body = mutation({ count: 1, source: 'learning', expectedPoolId: first.drawPool.id })
  const drawn = await call(f.service, user, 'draw', body)
  assert.equal(drawn.results[0].id, first.drawPool.ssrIds[0])
  assert.equal(drawn.poolId, first.drawPool.id)
  assert.equal(
    drawn.snapshot.history.find((entry) => entry.kind === '/v1/draw').detail.poolId,
    drawn.poolId
  )
  f.setTime(first.drawPool.endAt)
  const next = await call(f.service, user, 'collection', {}, 'GET')
  assert.notEqual(next.drawPool.ssrIds[0], first.drawPool.ssrIds[0])
  const before = f.service.store.user(user.user.id).state
  assert.deepEqual(await call(f.service, user, 'draw', body), drawn)
  await rejection(
    call(f.service, user, 'draw', { ...body, requestId: randomUUID() }),
    'DRAW_POOL_CHANGED'
  )
  assert.equal(f.service.store.user(user.user.id).state, before)
  assert.equal(
    f.service.store.db
      .prepare("SELECT COUNT(*) AS n FROM ledger WHERE user_id=? AND kind='/v1/draw'")
      .get(user.user.id).n,
    1
  )
  const fresh = await call(
    f.service,
    user,
    'draw',
    mutation({ count: 1, source: 'learning', expectedPoolId: next.drawPool.id })
  )
  assert.equal(fresh.results[0].id, next.drawPool.ssrIds[0])
  assert.equal(fresh.snapshot.balances.tickets.learning, 98)
  assert.equal(fresh.snapshot.pity.sinceSSR, 0)
  assert.deepEqual(fresh.snapshot.drawRules.base, { A: 0.7, R: 0.244, SR: 0.05, SSR: 0.006 })
})

test('echoes exchange costs exactly 1000 per learning ticket, retries deduct once, and old decorations remain owned but unsold', async () => {
  const f = setup(),
    user = await register(f.service, 'echo_exchange')
  editState(f.service, user, (state) => {
    state.balances.points = 77
    state.balances.echoes = 2500
    state.inventory.decorations = ['decoration:glow']
  })
  const item = shopFor('2026-10-13').find((entry) => entry.id === 'echo-ticket')
  assert.deepEqual(
    { price: item.price, currency: item.currency, type: item.type },
    { price: 1000, currency: 'echoes', type: 'ticket' }
  )
  assert.ok(shopFor('2026-10-13').every((entry) => entry.type !== 'decoration'))
  const body = mutation({ itemId: item.id, quantity: 2, expectedPrice: 1000 })
  const results = await Promise.all(
    Array.from({ length: 3 }, () => call(f.service, user, 'shop/purchase', body))
  )
  assert.ok(results.every((result) => JSON.stringify(result) === JSON.stringify(results[0])))
  const snapshot = results[0].snapshot
  assert.equal(results[0].cost, 2000)
  assert.deepEqual(snapshot.balances, {
    points: 77,
    tickets: { learning: 2, support: 0 },
    echoes: 500
  })
  assert.deepEqual(snapshot.inventory.decorations, ['decoration:glow'])
  const before = f.service.store.user(user.user.id).state
  await rejection(
    call(f.service, user, 'shop/purchase', mutation({ itemId: item.id })),
    'INSUFFICIENT_POINTS'
  )
  await rejection(
    call(f.service, user, 'shop/purchase', mutation({ itemId: item.id, expectedPrice: 1 })),
    'SHOP_PRICE_CHANGED'
  )
  await rejection(
    call(f.service, user, 'shop/purchase', mutation({ itemId: 'decoration:glow' })),
    'UNKNOWN_SHOP_ITEM'
  )
  assert.equal(f.service.store.user(user.user.id).state, before)
})

test('legacy state receives an empty placeholder home while preserving balances, decorations and existing ledger receipts', async () => {
  const f = setup(),
    user = await register(f.service, 'legacy_home')
  editState(f.service, user, (state) => {
    delete state.home
    delete state.inventory.homeSkins
    state.inventory.decorations = ['decoration:glow']
    state.balances.echoes = 123
  })
  f.service.store.db
    .prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?)')
    .run(
      randomUUID(),
      user.user.id,
      '/v1/draw',
      randomUUID(),
      1,
      JSON.stringify({ results: [{ id: 'companion-1', tier: 'A' }] })
    )
  const snapshot = await call(f.service, user, 'collection', {}, 'GET')
  assert.deepEqual(snapshot.home, {
    revision: 0,
    skinId: 'room-placeholder',
    placements: [],
    furniture: []
  })
  assert.deepEqual(snapshot.homeSkins, [
    {
      id: 'room-placeholder',
      name: { zh: '像素小屋 · 占位', en: 'Pixel Room · Placeholder' },
      owned: true
    }
  ])
  assert.equal(snapshot.balances.echoes, 123)
  assert.deepEqual(snapshot.inventory.decorations, ['decoration:glow'])
  assert.equal(snapshot.history[0].detail.results[0].id, 'companion-1')
})

test('home placement sync survives restart, uses owned monthly spirits and idempotent replay cannot roll back newer layouts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'qon-home-sync-'))
  const file = join(directory, 'home.sqlite')
  let service = new Service({
    path: file,
    now: () => POOL_EPOCH + 86400000,
    env: { NODE_ENV: 'test' }
  })
  cleanup.push(() => {
    service.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const user = await register(service, 'home_sync')
  own(service, user)
  own(service, user, 'monthly-2026-09')
  const body = mutation({
    expectedRevision: 0,
    skinId: 'room-placeholder',
    placements: [
      { characterId: 'companion-1', x: 0.25, y: 0.75 },
      { characterId: 'monthly-2026-09', x: 1, y: 0 }
    ]
  })
  const saved = await call(service, user, 'home/update', body)
  assert.equal(saved.snapshot.home.revision, 1)
  assert.deepEqual(saved.snapshot.home.placements, body.placements)
  service.close()
  service = new Service({ path: file, now: () => POOL_EPOCH + 86400000, env: { NODE_ENV: 'test' } })
  assert.deepEqual((await call(service, user, 'collection', {}, 'GET')).home, saved.snapshot.home)
  const newer = await call(
    service,
    user,
    'home/update',
    mutation({ expectedRevision: 1, skinId: 'room-placeholder', placements: [] })
  )
  assert.equal(newer.snapshot.home.revision, 2)
  assert.deepEqual(await call(service, user, 'home/update', body), saved)
  await rejection(
    call(service, user, 'home/update', { ...body, requestId: randomUUID() }),
    'HOME_CHANGED'
  )
  assert.deepEqual((await call(service, user, 'collection', {}, 'GET')).home.placements, [])
})

test('home updates reject unowned spirits/skins, duplicate or oversized layouts, nonfinite coordinates and forged fields without writes', async () => {
  const f = setup(),
    user = await register(f.service, 'home_validation')
  own(f.service, user)
  const valid = {
    expectedRevision: 0,
    skinId: 'room-placeholder',
    placements: [{ characterId: 'companion-1', x: 0.5, y: 0.5 }]
  }
  const cases = [
    [{ ...valid, expectedRevision: undefined }, 'INVALID_NUMBER'],
    [{ ...valid, skinId: 'paid-room-forged' }, 'INVALID_HOME_SKIN'],
    [{ ...valid, furniture: ['forged-free-furniture'] }, 'INVALID_FIELDS'],
    [{ ...valid, placements: [{ characterId: 'companion-2', x: 0, y: 0 }] }, 'CHARACTER_NOT_OWNED'],
    [
      { ...valid, placements: [valid.placements[0], valid.placements[0]] },
      'DUPLICATE_HOME_CHARACTER'
    ],
    [
      { ...valid, placements: Array.from({ length: 31 }, () => valid.placements[0]) },
      'INVALID_HOME_PLACEMENTS'
    ],
    [{ ...valid, placements: {} }, 'INVALID_HOME_PLACEMENTS'],
    [{ ...valid, placements: [null] }, 'INVALID_BODY'],
    ...[-0.1, 1.1, NaN, Infinity, '0.5', null].map((x) => [
      { ...valid, placements: [{ characterId: 'companion-1', x, y: 0.5 }] },
      'INVALID_HOME_POSITION'
    ]),
    [
      { ...valid, placements: [{ characterId: 'companion-1', x: 0.5, y: 0.5, xp: 100 }] },
      'INVALID_FIELDS'
    ]
  ]
  const before = f.service.store.user(user.user.id).state
  for (const [body, code] of cases) {
    await rejection(call(f.service, user, 'home/update', mutation(body)), code)
    assert.equal(f.service.store.user(user.user.id).state, before)
  }
  assert.equal(
    f.service.store.db
      .prepare("SELECT COUNT(*) AS n FROM ledger WHERE kind='/v1/home/update'")
      .get().n,
    0
  )
  await rejection(f.service.handle('POST', '/v1/home/update', mutation(valid)), 'UNAUTHORIZED')
})

test('two devices cannot overwrite the same home revision even through separate SQLite connections', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'qon-home-concurrency-'))
  const path = join(directory, 'home.sqlite')
  const first = new Service({ path, env: { NODE_ENV: 'test' } })
  const second = new Service({ path, env: { NODE_ENV: 'test' } })
  cleanup.push(() => {
    first.close()
    second.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const user = await register(first, 'home_two_devices')
  own(first, user)
  const body = {
    expectedRevision: 0,
    skinId: 'room-placeholder',
    placements: [{ characterId: 'companion-1', x: 0.2, y: 0.3 }]
  }
  const results = await Promise.allSettled([
    call(first, user, 'home/update', mutation(body)),
    call(second, user, 'home/update', mutation({ ...body, placements: [] }))
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = results.find((result) => result.status === 'rejected')
  assert.equal(rejected.reason.code, 'HOME_CHANGED')
  assert.equal((await call(first, user, 'collection', {}, 'GET')).home.revision, 1)
})
