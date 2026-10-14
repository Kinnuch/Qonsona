/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain Node server tests. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Service } from './client-fixture.mjs'

const register = (service, username) =>
  service.handle(
    'POST',
    '/v1/auth/register',
    { username, nickname: 'Public nickname', password: 'only-a-testing-password' },
    { ip: username }
  )
const mutation = (body = {}) => ({ requestId: randomUUID(), ...body })
const call = (service, user, route, body = {}, method = 'POST', query = {}) =>
  service.handle(method, `/v1/${route}`, body, { token: user.token, ip: user.user.id, query })
const rejection = (promise, code) => assert.rejects(promise, (error) => error.code === code)

test('repeatable grants and answers remain atomic through two live SQLite connections', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qon-social-concurrency-')),
    path = join(dir, 'state.sqlite')
  const options = { path, env: { NODE_ENV: 'test', QON_TEST_GRANTS: '1' } }
  const a = new Service(options),
    b = new Service(options)
  try {
    const user = await register(a, 'concurrent_social')
    const body = mutation()
    const gifts = await Promise.all([
      call(a, user, 'test/grant', body),
      call(b, user, 'test/grant', body)
    ])
    assert.deepEqual(gifts[0], gifts[1])
    await Promise.all([
      call(a, user, 'test/grant', mutation()),
      call(b, user, 'test/grant', mutation())
    ])
    assert.equal(a.store.snapshot(user.user.id, Date.now()).balances.tickets.learning, 300)
    const state = JSON.parse(a.store.user(user.user.id).state)
    state.characters['companion-1'] = {
      id: 'companion-1',
      count: 1,
      firstAt: 1,
      source: 'qa-fixture'
    }
    a.store.db
      .prepare('UPDATE users SET state=? WHERE id=?')
      .run(JSON.stringify(state), user.user.id)
    await call(a, user, 'companion/select', mutation({ characterId: 'companion-1' }))
    const answer = { language: 'en', answerId: 'stable-answer-concurrent', correct: true }
    const answers = await Promise.all([
      call(a, user, 'companion/answer', mutation(answer)),
      call(b, user, 'companion/answer', mutation(answer))
    ])
    assert.equal(answers.filter((result) => result.accepted).length, 1)
    assert.equal(a.store.snapshot(user.user.id, Date.now()).companion.progress[0].xp, 5)
    assert.equal(
      a.store.db.prepare('SELECT COUNT(*) AS count FROM companion_answers').get().count,
      1
    )
  } finally {
    a.close()
    b.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('friend cap rejects acceptance atomically and a rejected invitation cannot be accepted later', async () => {
  const service = new Service({ env: { NODE_ENV: 'test' } })
  try {
    const a = await register(service, 'limit_sender'),
      b = await register(service, 'limit_recipient')
    const invitation = await call(
      service,
      a,
      'friends/request',
      mutation({ publicId: b.user.publicId })
    )
    const invitationId = invitation.friends.outgoing[0].id
    for (let index = 0; index < 200; index++) {
      const fixture = service.store.createUser(
        `fixture_${index}`,
        `Fixture ${index}`,
        'test-only-hash',
        1
      )
      service.store.db
        .prepare('INSERT INTO friend_edges VALUES(?,?,?)')
        .run(b.user.id, fixture.id, 1)
    }
    const before = service.store.user(b.user.id).state
    await rejection(
      call(service, b, 'friends/respond', mutation({ invitationId, accept: true })),
      'FRIEND_LIMIT'
    )
    assert.equal(service.store.user(b.user.id).state, before)
    assert.equal(
      service.store.db
        .prepare('SELECT COUNT(*) AS count FROM friend_edges WHERE user_id=? AND friend_id=?')
        .get(a.user.id, b.user.id).count,
      0
    )
    assert.equal(
      service.store.db.prepare('SELECT status FROM friend_requests WHERE id=?').get(invitationId)
        .status,
      'pending'
    )
    await call(service, b, 'friends/respond', mutation({ invitationId, accept: false }))
    await rejection(
      call(service, b, 'friends/respond', mutation({ invitationId, accept: true })),
      'FRIEND_INVITATION_HANDLED'
    )
  } finally {
    service.close()
  }
})

test('SSR popularity counts owners rather than duplicates; friend time ranks use exact language and honor opt-outs', async () => {
  const service = new Service({ env: { NODE_ENV: 'test' } })
  try {
    const a = await register(service, 'popular_a'),
      b = await register(service, 'popular_b'),
      c = await register(service, 'popular_c')
    for (const [user, id, count] of [
      [a, 'companion-10', 99],
      [b, 'companion-11', 1],
      [c, 'companion-11', 1]
    ]) {
      const state = JSON.parse(service.store.user(user.user.id).state)
      state.characters[id] = { id, count, firstAt: 1, source: 'qa-fixture' }
      state.languageSeconds =
        user === a ? { en: 10, ru: 20 } : user === b ? { en: 30 } : { en: 100 }
      service.store.db
        .prepare('UPDATE users SET state=? WHERE id=?')
        .run(JSON.stringify(state), user.user.id)
    }
    const slide = service.store
      .snapshot(a.user.id, Date.now())
      .gallery.find((entry) => entry.type === 'popular')
    assert.equal(slide.characterId, 'companion-11')
    assert.equal(slide.ownerCount, 2)
    const invite = await call(
      service,
      a,
      'friends/request',
      mutation({ publicId: b.user.publicId })
    )
    await call(
      service,
      b,
      'friends/respond',
      mutation({ invitationId: invite.friends.outgoing[0].id, accept: true })
    )
    const rank = (language) =>
      call(service, a, 'leaderboards', {}, 'GET', { kind: 'time', scope: 'friends', language })
    assert.deepEqual(
      (await rank('en')).rows.map((row) => row.value),
      [30, 10]
    )
    assert.deepEqual(
      (await rank('ru')).rows.map((row) => row.value),
      [20]
    )
    await call(service, b, 'auth/me', { publicTime: false }, 'PATCH')
    assert.deepEqual(
      (await rank('en')).rows.map((row) => row.value),
      [10]
    )
    await rejection(
      call(service, a, 'leaderboards', {}, 'GET', { scope: 'strangers' }),
      'INVALID_LEADERBOARD_SCOPE'
    )
    assert.ok(!JSON.stringify(await rank('en')).includes('popular_a'))
  } finally {
    service.close()
  }
})
