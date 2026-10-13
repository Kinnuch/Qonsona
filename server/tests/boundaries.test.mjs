/* eslint @typescript-eslint/explicit-function-return-type: "off" -- Plain JavaScript runs directly on Node24 without a TypeScript build. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { Service } from '../service.mjs'
import { activity, newState, dayAt } from '../domain.mjs'

test('last ticket cannot be double spent across separate SQLite connections; request outcome survives process replacement', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qon-ledger-connections-')),
    path = join(dir, 'db.sqlite')
  let a = new Service({ path, env: { NODE_ENV: 'test' } }),
    b
  try {
    const user = await a.handle('POST', '/v1/auth/register', {
      username: 'atomic_user',
      password: 'password-12345'
    })
    const row = a.store.user(user.user.id),
      state = JSON.parse(row.state)
    state.balances.tickets.learning = 1
    a.store.db
      .prepare('UPDATE users SET state=? WHERE id=?')
      .run(JSON.stringify(state), user.user.id)
    b = new Service({ path, env: { NODE_ENV: 'test' } })
    const context = { token: user.token },
      body = { requestId: randomUUID(), source: 'learning', count: 1 }
    const outcomes = await Promise.allSettled([
      a.handle('POST', '/v1/draw', body, context),
      b.handle('POST', '/v1/draw', { ...body, requestId: randomUUID() }, context)
    ])
    assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1)
    assert.equal(outcomes.find((o) => o.status === 'rejected').reason.code, 'INSUFFICIENT_TICKETS')
    const original = outcomes[0].value
    assert.equal(original.snapshot.balances.tickets.learning, 0)
    a.close()
    a = new Service({ path, env: { NODE_ENV: 'test' } })
    assert.deepEqual(await a.handle('POST', '/v1/draw', body, context), original)
    assert.equal(
      a.store.db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE kind='/v1/draw'").get().n,
      1
    )
  } finally {
    a.close()
    b?.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('completion-only does not consume heartbeat elapsed time; midnight credits only current-day overlap', () => {
  const state = newState(),
    at = Date.parse('2026-10-12T23:59:50+08:00')
  const event = { requestId: 'a-long-id', language: 'ar', seconds: 0 }
  activity(state, event, at)
  activity(state, { ...event, completion: { kind: 'courses', id: 'lesson-1' } }, at + 5000)
  assert.equal(state.lastActivityAt, at)
  const result = activity(state, { ...event, seconds: 15 }, at + 15000)
  assert.equal(result.acceptedSeconds, 5)
  assert.equal(state.days['2026-10-13'].seconds, 5)
  assert.equal(state.days['2026-10-12'].seconds, 0)
  assert.equal(state.days['2026-10-13'].checkin, null)
  const before = state.lastActivityAt
  activity(state, { ...event, completion: { kind: 'review', id: 'session' } }, at + 20000)
  assert.equal(state.lastActivityAt, before)
  assert.equal(activity(state, { ...event, seconds: 15 }, at + 30000).acceptedSeconds, 15)
})

test('invalid mutation fully rolls back clock, balance, receipt and idempotency; same-millisecond snapshots have monotonic revisions', async () => {
  const service = new Service({
    now: () => Date.parse('2026-10-12T09:00:00+08:00'),
    env: { NODE_ENV: 'test', QON_TEST_GRANTS: '1' }
  })
  try {
    const user = await service.handle('POST', '/v1/auth/register', {
      username: 'rollback_user',
      password: 'password-12345'
    })
    const context = { token: user.token },
      id = user.user.id
    const first = await service.handle('POST', '/v1/test/grant', {}, context)
    const second = await service.handle('PATCH', '/v1/auth/me', { nickname: 'Updated' }, context)
    assert.ok(second.snapshot.revision > first.snapshot.revision)
    assert.equal(first.snapshot.serverTime, second.snapshot.serverTime)
    const original = service.store.user(id).state
    const requestId = randomUUID()
    await assert.rejects(
      service.handle(
        'POST',
        '/v1/reward/activity',
        { requestId, language: 'ja', seconds: 60, completion: { kind: 'opened', id: 'x' } },
        context
      ),
      (e) => e.code === 'INVALID_COMPLETION'
    )
    assert.equal(service.store.user(id).state, original)
    assert.equal(
      service.store.db
        .prepare('SELECT COUNT(*) AS n FROM requests WHERE request_id=?')
        .get(requestId).n,
      0
    )
    await assert.rejects(
      service.handle('POST', '/v1/draw', null, context),
      (e) => e.code === 'INVALID_BODY'
    )
    await assert.rejects(
      service.handle(
        'POST',
        '/v1/reward/activity',
        { requestId, language: 'ja', seconds: 60, balance: 100 },
        context
      ),
      (e) => e.code === 'INVALID_FIELDS'
    )
  } finally {
    service.close()
  }
})

test('reward request replay never increments time/tasks or revision, conflicting task payload cannot reuse its identifier', async () => {
  let now = Date.parse('2026-10-12T10:00:00+08:00')
  const service = new Service({ now: () => now, env: { NODE_ENV: 'test' } })
  try {
    const user = await service.handle('POST', '/v1/auth/register', {
      username: 'replay_user',
      password: 'password-12345'
    })
    const context = { token: user.token },
      body = {
        requestId: randomUUID(),
        language: 'qonlang:pack-en',
        seconds: 0,
        completion: { kind: 'practice', id: 'completed-run' }
      }
    const original = await service.handle('POST', '/v1/reward/activity', body, context)
    now += 60000
    assert.deepEqual(await service.handle('POST', '/v1/reward/activity', body, context), original)
    const next = await service.handle(
      'POST',
      '/v1/reward/activity',
      { ...body, requestId: randomUUID(), seconds: 60 },
      context
    )
    assert.equal(next.snapshot.today.tasks, 1)
    assert.equal(next.snapshot.today.taskPoints, 20)
    assert.equal(next.snapshot.today.timePoints, 2)
    await assert.rejects(
      service.handle('POST', '/v1/reward/activity', { ...body, language: 'en' }, context),
      (e) => e.code === 'IDEMPOTENCY_CONFLICT'
    )
    assert.equal(dayAt(now), next.snapshot.day)
  } finally {
    service.close()
  }
})
