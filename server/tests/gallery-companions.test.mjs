/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node server tests. */
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { Service } from '../service.mjs'
import { Store } from '../store.mjs'
import {
  CATALOG,
  catalogFor,
  speciesFor,
  shopFor,
  monthlyCharacter,
  discountedCharacter
} from '../catalog.mjs'
import {
  newState,
  activity,
  companionAnswer,
  selectCompanion,
  monthlyStatus,
  draw
} from '../domain.mjs'

const cleanup = []
afterEach(() => {
  for (const action of cleanup.splice(0)) action()
})
function setup(options = {}) {
  let now = Date.parse('2026-10-13T12:00:00+08:00')
  const service = new Service({
    now: () => now,
    env: { NODE_ENV: 'test', QON_TEST_GRANTS: '1' },
    ...options
  })
  cleanup.push(() => service.close())
  return {
    service,
    time: () => now,
    advance: (ms) => {
      now += ms
    }
  }
}
const register = (service, username) =>
  service.handle(
    'POST',
    '/v1/auth/register',
    { username, password: 'only-a-testing-password' },
    { ip: username }
  )
const mutation = (body = {}) => ({ requestId: randomUUID(), ...body })
const call = (service, user, route, body = {}, method = 'POST', query = {}) =>
  service.handle(method, `/v1/${route}`, body, { token: user.token, ip: user.user.id, query })
const rejection = (promise, code) => assert.rejects(promise, (error) => error.code === code)
function own(service, user, characterId = 'companion-1') {
  const state = JSON.parse(service.store.user(user.user.id).state)
  state.characters[characterId] = { id: characterId, count: 1, source: 'qa-fixture', firstAt: 1 }
  service.store.db
    .prepare('UPDATE users SET state=? WHERE id=?')
    .run(JSON.stringify(state), user.user.id)
}

test('catalog preserves original identifiers, rect boundaries, blank author biographies and monthly exclusivity', () => {
  assert.equal(CATALOG.length, 20)
  assert.equal(new Set(CATALOG.map((character) => character.id)).size, 20)
  for (const tier of ['A', 'R', 'SR', 'SSR'])
    assert.equal(CATALOG.filter((character) => character.tier === tier).length, 5)
  for (const character of CATALOG) {
    assert.deepEqual(character.biography, { introduction: '', traits: '', story: '' })
    if (character.sprite) {
      assert.ok(character.sprite.x + character.sprite.width <= character.sprite.sheetWidth)
      assert.ok(character.sprite.y + character.sprite.height <= character.sprite.sheetHeight)
    }
  }
  assert.equal(CATALOG.filter((character) => character.speciesId === 'cat').length, 6)
  assert.equal(CATALOG.filter((character) => character.speciesId === 'dog').length, 4)
  assert.equal(CATALOG.filter((character) => character.speciesId === 'bird').length, 1)
  assert.equal(CATALOG.filter((character) => character.speciesId === 'frog').length, 2)
  assert.equal(CATALOG.filter((character) => character.speciesId === 'dragon').length, 7)
  const state = newState()
  state.characters['monthly-2026-09'] = { count: 1 }
  const catalog = catalogFor(state, '2026-10-13')
  assert.equal(catalog.filter((character) => character.special === 'monthly').length, 2)
  assert.deepEqual(catalog.find((character) => character.id === 'monthly-2026-10').sprite, {
    x: 337,
    y: 54,
    width: 22,
    height: 18,
    sheetWidth: 393,
    sheetHeight: 160
  })
  assert.ok(shopFor('2026-10-13').every((item) => !item.characterId?.startsWith('monthly-')))
  state.balances.tickets.learning = 10
  assert.ok(
    draw(state, mutation({ count: 10, source: 'learning' }), 1, () => 0).results.every(
      (result) => !result.id.startsWith('monthly-')
    )
  )
})

test('five author-confirmed series classify every partner exactly once, including historical monthly birds', () => {
  const state = newState()
  state.characters['monthly-2026-09'] = { count: 1 }
  const catalog = catalogFor(state, '2026-10-13')
  const expected = {
    cat: [1, 2, 3, 7, 8, 9],
    dog: [4, 5, 10, 11],
    bird: [16],
    frog: [6, 12],
    dragon: [13, 14, 15, 17, 18, 19, 20]
  }
  const groups = speciesFor(catalog)
  assert.deepEqual(groups.map((group) => group.id).sort(), Object.keys(expected).sort())
  for (const [speciesId, ids] of Object.entries(expected)) {
    const actual = groups.find((group) => group.id === speciesId)
    assert.deepEqual(
      actual.characterIds.filter((id) => !id.startsWith('monthly-')),
      ids.map((id) => `companion-${id}`)
    )
  }
  assert.deepEqual(groups.find((group) => group.id === 'bird').characterIds, [
    'companion-16',
    'monthly-2026-09',
    'monthly-2026-10'
  ])
  const memberships = groups.flatMap((group) => group.characterIds)
  assert.equal(new Set(memberships).size, catalog.length)
  assert.equal(memberships.length, catalog.length)
  assert.deepEqual(memberships.toSorted(), catalog.map((character) => character.id).toSorted())
  const suffixes = { cat: '猫', dog: '狗', bird: '鸟', frog: '蛙', dragon: '龙' }
  for (const character of catalog) {
    assert.ok(character.name.zh.endsWith(suffixes[character.speciesId]))
    assert.ok(character.name.en)
  }
  assert.equal(new Set(CATALOG.map((character) => character.name.zh)).size, CATALOG.length)
  assert.equal(monthlyCharacter('2026-09').name.zh, '2026-09 月度·澄空鸟')
})

test('classification update reads legacy ownership, XP, home, balances, pity and receipts without rewriting user state', () => {
  const directory = mkdtempSync(join(tmpdir(), 'qon-partner-classification-'))
  const file = join(directory, 'old.sqlite')
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }))
  const now = Date.parse('2026-10-13T12:00:00+08:00')
  const state = newState()
  state.revision = 42
  state.balances = { points: 1234, tickets: { learning: 56, support: 7 }, echoes: 891 }
  state.pity = { sinceSSR: 41, sinceHigh: 7 }
  for (const id of ['companion-5', 'companion-16', 'companion-19', 'monthly-2026-09'])
    state.characters[id] = { id, count: 3, source: 'draw', firstAt: 1 }
  state.legacy = { 'legacy-fixture': { id: 'legacy-fixture', count: 2 } }
  state.companion = {
    currentId: 'companion-5',
    progress: {
      'companion-5': {
        characterId: 'companion-5',
        xp: 725,
        gifts: ['keepsake-1', 'keepsake-2', 'keepsake-3']
      }
    }
  }
  state.inventory = { makeup: 2, decorations: ['decoration:glow'], homeSkins: ['room-placeholder'] }
  state.home = {
    revision: 8,
    skinId: 'room-placeholder',
    placements: [
      { characterId: 'companion-5', x: 0.2, y: 0.7 },
      { characterId: 'companion-16', x: 0.6, y: 0.8 },
      { characterId: 'monthly-2026-09', x: 0.7, y: 0.5 }
    ],
    furniture: []
  }
  const frozenState = JSON.stringify(state)
  const db = new DatabaseSync(file)
  db.exec(
    'CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,public_id TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,public_collection INTEGER NOT NULL DEFAULT 0,public_time INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,state TEXT NOT NULL)'
  )
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?)').run(
    'old-partner-id',
    'old_partner_user',
    'Old Partner',
    randomUUID(),
    'test-only-hash',
    0,
    0,
    1,
    frozenState
  )
  db.close()
  let store = new Store(file)
  try {
    const receipt = JSON.stringify({ results: [{ id: 'companion-5', tier: 'R' }] })
    store.db
      .prepare('INSERT INTO requests VALUES(?,?,?,?,?)')
      .run('old-partner-id', 'old-request-id', 'fixture-hash', receipt, 1)
    for (let pass = 0; pass < 2; pass++) {
      const snapshot = store.snapshot('old-partner-id', now)
      assert.deepEqual(snapshot.characters, Object.values(state.characters))
      assert.deepEqual(snapshot.legacy, Object.values(state.legacy))
      assert.deepEqual(snapshot.balances, state.balances)
      assert.deepEqual(snapshot.pity, state.pity)
      assert.deepEqual(snapshot.inventory, state.inventory)
      assert.deepEqual(snapshot.home, state.home)
      assert.equal(snapshot.companion.currentId, 'companion-5')
      assert.deepEqual(snapshot.companion.progress, Object.values(state.companion.progress))
      assert.equal(
        snapshot.catalog.find((character) => character.id === 'companion-5').speciesId,
        'dog'
      )
      assert.equal(
        snapshot.catalog.find((character) => character.id === 'companion-16').speciesId,
        'bird'
      )
      assert.equal(
        snapshot.catalog.find((character) => character.id === 'companion-19').speciesId,
        'dragon'
      )
      assert.equal(
        snapshot.catalog.find((character) => character.id === 'monthly-2026-09').speciesId,
        'bird'
      )
      assert.equal(store.user('old-partner-id').state, frozenState)
      assert.equal(
        store.db.prepare('SELECT response FROM requests WHERE request_id=?').get('old-request-id')
          .response,
        receipt
      )
      if (!pass) {
        store.close()
        store = new Store(file)
      }
    }
  } finally {
    store.close()
  }
})

test('one stable daily A/R half-price offer is shared by devices and purchase validates server price atomically', async () => {
  const f = setup(),
    user = await register(f.service, 'discount_user')
  const first = await call(f.service, user, 'collection', {}, 'GET')
  const second = await call(f.service, user, 'collection', {}, 'GET')
  assert.deepEqual(first.shop, second.shop)
  const sale = first.shop.filter((item) => item.discount === 0.5)
  assert.equal(sale.length, 1)
  assert.ok(['A', 'R'].includes(sale[0].tier))
  assert.equal(sale[0].price, sale[0].originalPrice / 2)
  assert.equal(
    first.gallery.find((slide) => slide.type === 'discount').characterId,
    sale[0].characterId
  )
  const row = f.service.store.user(user.user.id),
    state = JSON.parse(row.state)
  state.balances.points = sale[0].price
  f.service.store.db
    .prepare('UPDATE users SET state=? WHERE id=?')
    .run(JSON.stringify(state), user.user.id)
  await rejection(
    call(f.service, user, 'shop/purchase', mutation({ itemId: sale[0].id, price: 1 })),
    'INVALID_FIELDS'
  )
  await rejection(
    call(
      f.service,
      user,
      'shop/purchase',
      mutation({ itemId: sale[0].id, expectedPrice: sale[0].price - 1 })
    ),
    'SHOP_PRICE_CHANGED'
  )
  assert.equal(f.service.store.snapshot(user.user.id, f.time()).balances.points, sale[0].price)
  const purchase = await call(f.service, user, 'shop/purchase', mutation({ itemId: sale[0].id }))
  assert.equal(purchase.cost, sale[0].price)
  assert.equal(purchase.snapshot.balances.points, 0)
  assert.equal(purchase.snapshot.characters[0].id, sale[0].characterId)
  const offers = new Set(
    Array.from(
      { length: 31 },
      (_, index) => discountedCharacter(`2026-10-${String(index + 1).padStart(2, '0')}`).id
    )
  )
  assert.ok(offers.size > 1)
})

test('new accounts participate by default; migration preserves pre-existing explicit opt-outs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'qon-privacy-migration-'))
  const file = join(directory, 'old.sqlite')
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }))
  const db = new DatabaseSync(file)
  db.exec(
    'CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,public_id TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,public_collection INTEGER NOT NULL DEFAULT 0,public_time INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,state TEXT NOT NULL)'
  )
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?)').run(
    'old-id',
    'old_user',
    'Old',
    randomUUID(),
    'test-only-hash',
    0,
    0,
    1,
    JSON.stringify(newState())
  )
  db.close()
  const store = new Store(file)
  try {
    const old = store.snapshot('old-id', Date.now()).user
    assert.equal(old.publicCollection, false)
    assert.equal(old.publicTime, false)
    assert.equal(old.rankVisibility, 'global')
    const current = store.createUser('new_user', 'New', 'test-only-hash', Date.now())
    assert.equal(current.public_collection, 1)
    assert.equal(current.public_time, 1)
  } finally {
    store.close()
  }
})

test('friend invitations are recipient-authorized and accepted/removed symmetrically, with private scopes and companion ranks', async () => {
  const f = setup(),
    a = await register(f.service, 'friend_aaa'),
    b = await register(f.service, 'friend_bbb'),
    stranger = await register(f.service, 'friend_ccc')
  own(f.service, a)
  own(f.service, b, 'companion-2')
  await call(f.service, a, 'companion/select', mutation({ characterId: 'companion-1' }))
  await call(f.service, a, 'auth/me', { rankVisibility: 'friends' }, 'PATCH')
  await rejection(
    call(f.service, a, 'friends/request', mutation({ publicId: a.user.publicId })),
    'CANNOT_FRIEND_SELF'
  )
  const body = mutation({ publicId: b.user.publicId })
  const invitation = await call(f.service, a, 'friends/request', body)
  assert.deepEqual(await call(f.service, a, 'friends/request', body), invitation)
  assert.equal(invitation.friends.outgoing.length, 1)
  assert.equal((await call(f.service, b, 'friends', {}, 'GET')).incoming.length, 1)
  assert.equal((await call(f.service, b, 'friends', {}, 'GET')).friends.length, 0)
  const invitationId = invitation.friends.outgoing[0].id
  await rejection(
    call(f.service, stranger, 'friends/respond', mutation({ invitationId, accept: true })),
    'FRIEND_INVITATION_NOT_FOUND'
  )
  await rejection(
    call(f.service, a, 'friends/respond', mutation({ invitationId, accept: true })),
    'FRIEND_INVITATION_NOT_FOUND'
  )
  await rejection(
    call(f.service, b, 'friends/request', mutation({ publicId: a.user.publicId })),
    'FRIEND_REQUEST_PENDING'
  )
  const responseBody = mutation({ invitationId, accept: true })
  const accepted = await call(f.service, b, 'friends/respond', responseBody)
  assert.deepEqual(await call(f.service, b, 'friends/respond', responseBody), accepted)
  assert.equal(accepted.friends.friends[0].publicId, a.user.publicId)
  assert.equal(
    (await call(f.service, a, 'friends', {}, 'GET')).friends[0].publicId,
    b.user.publicId
  )
  const ranks = (viewer, scope) =>
    call(f.service, viewer, 'leaderboards', {}, 'GET', { kind: 'collection', scope })
  assert.ok((await ranks(stranger, 'global')).rows.every((row) => row.publicId !== a.user.publicId))
  assert.ok(
    (await ranks(stranger, 'friends')).rows.every((row) => row.publicId !== a.user.publicId)
  )
  const row = (await ranks(b, 'friends')).rows.find((entry) => entry.publicId === a.user.publicId)
  assert.equal(row.currentCompanion.id, 'companion-1')
  assert.deepEqual(Object.keys(row).sort(), [
    'currentCompanion',
    'nickname',
    'publicId',
    'rank',
    'value'
  ])
  const removal = mutation({ publicId: a.user.publicId })
  const removed = await call(f.service, b, 'friends/remove', removal)
  assert.deepEqual(await call(f.service, b, 'friends/remove', removal), removed)
  assert.equal(removed.friends.friends.length, 0)
  assert.equal((await call(f.service, a, 'friends', {}, 'GET')).friends.length, 0)
  assert.ok((await ranks(b, 'friends')).rows.every((entry) => entry.publicId !== a.user.publicId))
})

test('answer receipts deduplicate across requests and process replacement without granting unowned characters or economy', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'qon-answer-replay-'))
  const file = join(directory, 'answers.sqlite')
  let service = new Service({ path: file, env: { NODE_ENV: 'test' } })
  cleanup.push(() => {
    service.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const user = await register(service, 'answer_user')
  await rejection(
    call(service, user, 'companion/select', mutation({ characterId: 'companion-1' })),
    'CHARACTER_NOT_OWNED'
  )
  own(service, user)
  await call(service, user, 'companion/select', mutation({ characterId: 'companion-1' }))
  const body = mutation({
    language: 'ar',
    answerId: 'stable-exercise-instance-question-1',
    correct: true
  })
  const results = await Promise.all(
    Array.from({ length: 5 }, () => call(service, user, 'companion/answer', body))
  )
  assert.ok(results.every((result) => JSON.stringify(result) === JSON.stringify(results[0])))
  assert.equal(results[0].snapshot.companion.progress[0].xp, 5)
  assert.deepEqual(results[0].snapshot.balances, user.snapshot.balances)
  assert.equal(
    (await call(service, user, 'companion/answer', { ...body, requestId: randomUUID() })).accepted,
    false
  )
  service.close()
  service = new Service({ path: file, env: { NODE_ENV: 'test' } })
  const afterRestart = await call(service, user, 'companion/answer', {
    ...body,
    requestId: randomUUID()
  })
  assert.equal(afterRestart.accepted, false)
  assert.equal(afterRestart.snapshot.companion.progress[0].xp, 5)
  await rejection(
    call(service, user, 'companion/answer', { ...body, requestId: randomUUID(), correct: false }),
    'INVALID_ANSWER'
  )
  await rejection(
    call(service, user, 'companion/answer', { ...body, requestId: randomUUID(), xp: 9999 }),
    'INVALID_FIELDS'
  )
})

test('cross-device current companion guards reject stale selection and unsubmitted answers atomically', async () => {
  const f = setup(),
    first = await register(f.service, 'guarded_companion')
  const second = await f.service.handle(
    'POST',
    '/v1/auth/login',
    { username: 'guarded_companion', password: 'only-a-testing-password' },
    { ip: 'other-device' }
  )
  own(f.service, first, 'companion-1')
  own(f.service, first, 'companion-2')
  own(f.service, first, 'companion-3')
  await call(
    f.service,
    first,
    'companion/select',
    mutation({ characterId: 'companion-1', expectedCurrentId: null })
  )
  const staleSelection = mutation({ characterId: 'companion-3', expectedCurrentId: 'companion-1' })
  const staleAnswer = mutation({
    language: 'en',
    answerId: 'unsubmitted-on-old-device',
    correct: true,
    characterId: 'companion-1'
  })
  await call(
    f.service,
    second,
    'companion/select',
    mutation({ characterId: 'companion-2', expectedCurrentId: 'companion-1' })
  )
  const before = f.service.store.user(first.user.id).state
  await rejection(call(f.service, first, 'companion/select', staleSelection), 'COMPANION_CHANGED')
  await rejection(call(f.service, first, 'companion/answer', staleAnswer), 'COMPANION_CHANGED')
  assert.equal(f.service.store.user(first.user.id).state, before)
  assert.equal(f.service.store.snapshot(first.user.id, f.time()).companion.currentId, 'companion-2')
  assert.equal(
    f.service.store.db
      .prepare('SELECT COUNT(*) AS count FROM companion_answers WHERE user_id=?')
      .get(first.user.id).count,
    0
  )
  for (const body of [staleSelection, staleAnswer])
    assert.equal(
      f.service.store.db
        .prepare('SELECT COUNT(*) AS count FROM requests WHERE request_id=?')
        .get(body.requestId).count,
      0
    )
})

test('already committed guarded selection and answers replay their original receipt after a device changes selection', async () => {
  const f = setup(),
    first = await register(f.service, 'guarded_replay')
  const second = await f.service.handle(
    'POST',
    '/v1/auth/login',
    { username: 'guarded_replay', password: 'only-a-testing-password' },
    { ip: 'other-device' }
  )
  own(f.service, first, 'companion-1')
  own(f.service, first, 'companion-2')
  const selection = mutation({ characterId: 'companion-1', expectedCurrentId: null })
  const selected = await call(f.service, first, 'companion/select', selection)
  const answer = mutation({
    language: 'en',
    answerId: 'committed-on-old-device',
    correct: true,
    characterId: 'companion-1'
  })
  const answered = await call(f.service, first, 'companion/answer', answer)
  await call(
    f.service,
    second,
    'companion/select',
    mutation({ characterId: 'companion-2', expectedCurrentId: 'companion-1' })
  )
  const before = f.service.store.user(first.user.id).state
  assert.deepEqual(await call(f.service, first, 'companion/select', selection), selected)
  assert.deepEqual(await call(f.service, first, 'companion/answer', answer), answered)
  assert.equal(f.service.store.user(first.user.id).state, before)
  const current = f.service.store.snapshot(first.user.id, f.time()).companion
  assert.equal(current.currentId, 'companion-2')
  assert.equal(current.progress.find((progress) => progress.characterId === 'companion-1').xp, 5)
  assert.equal(current.progress.find((progress) => progress.characterId === 'companion-2').xp, 0)
})

test('XP limits reset daily, five keepsakes unlock once at thresholds and cannot create tickets or points', () => {
  const state = newState(),
    start = Date.parse('2026-10-13T12:00:00+08:00'),
    receipts = new Map()
  state.characters['companion-1'] = { count: 1 }
  selectCompanion(state, mutation({ characterId: 'companion-1' }))
  const seen = (language, id) => receipts.get(`${language}:${id}`)
  const record = (language, id, characterId) =>
    receipts.set(`${language}:${id}`, { character_id: characterId })
  const answer = (id, at) =>
    companionAnswer(
      state,
      mutation({ language: 'en', answerId: id, correct: true }),
      at,
      seen,
      record
    )
  for (let day = 0; day < 3; day++) {
    for (let question = 0; question < 200; question++)
      answer(`instance-${day}-${question}`, start + day * 86400000)
    assert.throws(
      () => answer(`over-limit-${day}`, start + day * 86400000),
      (error) => error.code === 'DAILY_ANSWER_LIMIT'
    )
  }
  assert.equal(state.companion.progress['companion-1'].xp, 3000)
  assert.deepEqual(state.companion.progress['companion-1'].gifts, [
    'keepsake-1',
    'keepsake-2',
    'keepsake-3',
    'keepsake-4',
    'keepsake-5'
  ])
  assert.equal(answer('instance-0-0', start + 4 * 86400000).accepted, false)
  assert.deepEqual(answer('new-final-instance', start + 4 * 86400000).gifts, [])
  assert.equal(state.companion.progress['companion-1'].gifts.length, 5)
  assert.deepEqual(state.balances, newState().balances)
})

test('calendar-month reward requires every day all three tasks, handles leap years, excludes makeup and awards only once', () => {
  const state = newState()
  const date = (day) => Date.parse(`2028-02-${String(day).padStart(2, '0')}T12:00:00+08:00`)
  const complete = (day, kind) =>
    activity(
      state,
      mutation({ language: 'en', seconds: 0, completion: { kind, id: `day-${day}-${kind}` } }),
      date(day)
    )
  for (let day = 1; day <= 29; day++) {
    complete(day, 'reading')
    if (day !== 10) complete(day, 'review')
  }
  assert.equal(monthlyStatus(state, '2028-02-29').requiredDays, 29)
  assert.equal(monthlyStatus(state, '2028-02-29').completedDays.length, 28)
  assert.ok(!state.characters['monthly-2028-02'])
  state.days['2028-02-10'].checkin = 'makeup'
  state.days['2028-02-10'].tasks.push(JSON.stringify(['en', 'review', 'makeup-cannot-qualify']))
  assert.equal(monthlyStatus(state, '2028-02-29').completedDays.length, 28)
  // Fixture replaces the missing day with verified real-task evidence; production has no historical-task route.
  state.days['2028-02-10'].checkin = 'learning'
  const final = complete(29, 'practice')
  assert.equal(final.monthlyReward, 'monthly-2028-02')
  assert.equal(state.characters['monthly-2028-02'].source, 'monthly')
  assert.equal(complete(29, 'practice').monthlyReward, null)
  assert.equal(state.characters['monthly-2028-02'].count, 1)
  assert.equal(state.balances.echoes, 0)
  assert.equal(monthlyCharacter('2028-02').special, 'monthly')
  assert.ok(catalogFor(state, '2028-03-01').some((character) => character.id === 'monthly-2028-02'))
})
