/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Service } from './client-fixture.mjs'
import { activity, taskPlan, newState, dayAt } from '../domain.mjs'

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
  service.handle(method, `/v1/${route}`, body, { token: user.token, ip: user.user.id })
const mutation = (extra = {}) => ({ requestId: randomUUID(), ...extra })
const rejects = (promise, code) => assert.rejects(promise, (error) => error.code === code)

test('daily plan requires distinct designated boards and keeps numeric task count', async () => {
  const f = setup(),
    user = await register(f.service)
  const event = (kind, id) =>
    call(
      f.service,
      user,
      'reward/activity',
      mutation({ language: 'en', seconds: 0, completion: { kind, id } })
    )
  let result
  for (let i = 0; i < 3; i++) result = await event('reading', `article-${i}`)
  assert.equal(result.snapshot.today.taskPoints, 40)
  assert.equal(result.snapshot.today.tasks, 3)
  assert.deepEqual(
    result.snapshot.today.taskPlan.map((t) => t.done),
    [true, true, false]
  )
  result = await event('review', 'review-1')
  assert.equal(result.earned.taskPoints, 20)
  assert.equal(result.snapshot.balances.points, 60)
  assert.equal((await event('review', 'review-2')).earned.taskPoints, 0)
  await rejects(
    call(f.service, user, 'tasks/configure', mutation({ kinds: ['courses', 'practice'] })),
    'TASK_PLAN_LOCKED'
  )
})
test('plan change is once before learning and request replay is idempotent', async () => {
  const f = setup(),
    user = await register(f.service)
  const body = mutation({ kinds: ['practice', 'courses'] })
  const result = await call(f.service, user, 'tasks/configure', body)
  assert.deepEqual(await call(f.service, user, 'tasks/configure', body), result)
  assert.equal(result.snapshot.today.planChanges, 1)
  await rejects(
    call(f.service, user, 'tasks/configure', mutation({ kinds: ['reading', 'review'] })),
    'TASK_PLAN_CHANGE_LIMIT'
  )
  for (const kinds of [['reading', 'reading'], ['bad', 'review'], ['reading'], 'reading'])
    await rejects(
      call(f.service, user, 'tasks/configure', mutation({ kinds })),
      'INVALID_TASK_PLAN'
    )
  const earned = await call(
    f.service,
    user,
    'reward/activity',
    mutation({ language: 'en', seconds: 0, completion: { kind: 'practice', id: 'p' } })
  )
  assert.equal(earned.earned.taskPoints, 40)
  const f2 = setup(),
    u2 = await register(f2.service)
  await call(f2.service, u2, 'reward/activity', mutation({ language: 'en', seconds: 60 }))
  f2.advance(60000)
  await call(f2.service, u2, 'reward/activity', mutation({ language: 'en', seconds: 60 }))
  await rejects(call(f2.service, u2, 'tasks/configure', body), 'TASK_PLAN_LOCKED')
})
test('old day defaults preserve paid task points without awarding beyond cap', () => {
  const state = newState(),
    now = Date.parse('2026-10-12T12:00:00+08:00')
  state.days[dayAt(now)] = {
    seconds: 0,
    timePoints: 0,
    taskPoints: 60,
    tasks: [JSON.stringify(['en', 'reading', 'old'])],
    checkin: 'learning'
  }
  state.balances.points = 60
  const result = activity(
    state,
    {
      requestId: 'test-old',
      language: 'en',
      seconds: 0,
      completion: { kind: 'review', id: 'new' }
    },
    now
  )
  assert.equal(result.earned.taskPoints, 0)
  assert.equal(state.balances.points, 60)
  assert.deepEqual(
    taskPlan(state.days[dayAt(now)]).map((t) => t.done),
    [true, true, true]
  )
})
test('legacy memorials merge earliest across sessions and stay separate from economy and ranks', async () => {
  const f = setup(),
    user = await register(f.service)
  const before = user.snapshot
  const entry = { id: 'companion-1', day: '2026-10-11', at: f.now() - 86400000, minutes: 15 }
  const body = mutation({ unlocks: [entry] })
  const result = await call(f.service, user, 'collection/legacy', body)
  assert.deepEqual(await call(f.service, user, 'collection/legacy', body), result)
  const second = await f.service.handle(
    'POST',
    '/v1/auth/login',
    { username: 'testuser', password: 'correct-password-123' },
    { ip: 'second', app: 'qonsona' }
  )
  const later = await call(
    f.service,
    second,
    'collection/legacy',
    mutation({ unlocks: [{ ...entry, at: entry.at + 1000 }] })
  )
  assert.deepEqual(later.snapshot.legacy, [entry])
  const earlier = { ...entry, at: entry.at - 1000 }
  const merged = await call(f.service, user, 'collection/legacy', mutation({ unlocks: [earlier] }))
  assert.deepEqual(merged.snapshot.legacy, [earlier])
  for (const key of ['balances', 'pity', 'characters', 'totals', 'inventory'])
    assert.deepEqual(merged.snapshot[key], before[key])
  const other = await register(f.service, 'otheruser')
  assert.deepEqual(other.snapshot.legacy, [])
  await call(f.service, other, 'collection/legacy', mutation({ unlocks: [entry] }))
  assert.deepEqual((await call(f.service, user, 'collection', {}, 'GET')).legacy, [earlier])
  await f.service.handle(
    'PATCH',
    '/v1/auth/me',
    { publicCollection: true, publicTime: true },
    { token: user.token, ip: 'profile' }
  )
  for (const kind of ['collection', 'time']) {
    const ranks = await f.service.handle(
      'GET',
      '/v1/leaderboards',
      {},
      { token: user.token, ip: 'ranks', query: { kind } }
    )
    assert.ok(ranks.rows.every((row) => row.value === 0))
  }
})
test('legacy import rejects invalid claims atomically and requires login', async () => {
  const f = setup(),
    user = await register(f.service)
  const entry = { id: 'companion-12', day: '2026-10-11', at: f.now() - 86400000, minutes: 30 }
  const cases = [
    [entry, { ...entry, id: 'companion-13' }],
    [{ ...entry, id: 'companion-13' }],
    [{ ...entry, id: 12 }],
    [{ ...entry, minutes: '30' }],
    [{ ...entry, minutes: 60 }],
    [{ ...entry, day: '2026-02-30' }],
    [{ ...entry, day: '2026-10-13' }],
    [{ ...entry, at: f.now() + 1 }],
    [{ ...entry, at: 'old' }],
    [{ ...entry, at: -1 }],
    [entry, entry],
    Array.from({ length: 13 }, () => entry),
    [{ ...entry, balance: 999 }]
  ]
  for (const unlocks of cases)
    await assert.rejects(
      call(f.service, user, 'collection/legacy', mutation({ unlocks })),
      (error) => error.status === 400
    )
  await assert.rejects(
    call(f.service, user, 'collection/legacy', mutation({ unlocks: [entry], points: 999 })),
    (error) => error.code === 'INVALID_FIELDS'
  )
  await assert.rejects(
    f.service.handle('POST', '/v1/collection/legacy', mutation({ unlocks: [entry] }), {
      ip: 'anonymous'
    }),
    (error) => error.status === 401
  )
  assert.deepEqual((await call(f.service, user, 'collection', {}, 'GET')).legacy, [])
})
