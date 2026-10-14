import { afterEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ACCOUNT_API, AccountClient, accountBase } from '../src/main/account-client'
import type { AccountUser, CollectionSnapshot } from '../src/shared/account'

const dirs: string[] = []
afterEach(async () => {
  for (const dir of dirs.splice(0)) await fs.rm(dir, { recursive: true, force: true })
})
const user: AccountUser = {
  id: 'user-one',
  username: 'learner',
  nickname: 'Reader',
  publicId: 'public-one',
  publicTime: false,
  publicCollection: false,
  createdAt: 1
}
const snapshot: CollectionSnapshot = {
  version: 1,
  revision: 0,
  serverTime: 1,
  day: '2026-10-13',
  user,
  balances: { points: 0, tickets: { learning: 100, support: 0 }, echoes: 0 },
  pity: { sinceSSR: 0, sinceHigh: 0 },
  characters: [],
  legacy: [],
  inventory: { makeup: 0 },
  checkins: [],
  today: {
    seconds: 0,
    timePoints: 0,
    taskPoints: 0,
    tasks: 0,
    taskPlan: [],
    planChanges: 0,
    weeklyBonus: 0
  },
  totals: { seconds: 0, collectionCount: 0 },
  catalog: [],
  shop: [],
  drawRules: {}
}
async function fixture(packaged = false, testMode = true, version = '0.4.0') {
  const directory = await fs.mkdtemp(join(tmpdir(), 'qon-account-gateway-'))
  dirs.push(directory)
  let identity: Parameters<ConstructorParameters<typeof AccountClient>[0]['writeIdentity']>[0] =
    null
  const calls: {
    path: string
    method: string
    authorization?: string | null
    version?: string | null
    body?: string | null
    redirect?: string
  }[] = []
  let drawLost: false | 'network' | 'status' | 'body' | 'unauthorized' = false,
    offline = false,
    draws = 0
  let malformed: string | undefined
  let statusOverride: number | undefined
  let meOverride: string | undefined
  let latestVersion = '0.4.0',
    elapsed = 0,
    policyOverride: Record<string, unknown> | undefined
  let policyServerTime = 1
  let policyResponseStatus = 200
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = new URL(String(input)).pathname
    calls.push({
      path,
      method: init?.method ?? 'GET',
      authorization: new Headers(init?.headers).get('Authorization'),
      version: new Headers(init?.headers).get('X-Qon-Version'),
      body: init?.body as string | null,
      redirect: init?.redirect
    })
    if (offline) throw new Error('network')
    if (path.endsWith('/auth/me') && meOverride !== undefined) {
      const body = meOverride
      meOverride = undefined
      return new Response(body)
    }
    const result = path.endsWith('/client-policy')
      ? (policyOverride ?? {
          app: 'qonsona',
          mode: 'exact-latest',
          source: 'github-latest',
          currentVersion: latestVersion,
          checkedAt: 1,
          serverTime: policyServerTime,
          validUntil: 120001,
          releaseUrl: `https://github.com/Kinnuch/Qonsona/releases/tag/v${latestVersion}`
        })
      : path.endsWith('/health')
        ? { status: 'ok', testing: { grantsEnabled: true } }
        : path.endsWith('/auth/login')
          ? { token: 'private-session-token', expiresAt: 123456, user, snapshot }
          : path.endsWith('/auth/me')
            ? { user, snapshot }
            : path.endsWith('/collection')
              ? snapshot
              : path.endsWith('/draw')
                ? {
                    results: Array.from({ length: JSON.parse(String(init?.body)).count }, () => ({
                      id: 'companion-1',
                      tier: 'A',
                      duplicate: true,
                      echoes: 1
                    })),
                    snapshot
                  }
                : { ok: true }
    if (path.endsWith('/draw')) {
      draws++
      if (drawLost) {
        const failure = drawLost
        drawLost = false
        if (failure === 'status')
          return new Response(JSON.stringify({ error: { code: 'INTERNAL' } }), { status: 500 })
        if (failure === 'unauthorized')
          return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })
        if (failure === 'body')
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new Error('response connection closed'))
              }
            })
          )
        throw new Error('lost response')
      }
      if (malformed !== undefined) {
        const body = malformed
        malformed = undefined
        const status = statusOverride ?? 200
        statusOverride = undefined
        return new Response(body, { status })
      }
    }
    return new Response(JSON.stringify(result), {
      status: path.endsWith('/client-policy') ? policyResponseStatus : 200
    })
  })
  const options = {
    version,
    clock: () => elapsed,
    directory,
    packaged,
    testMode,
    base: 'http://127.0.0.1:3782/v1',
    fetcher: fetcher as typeof fetch,
    readIdentity: async () => identity,
    writeIdentity: async (value: typeof identity) => {
      identity = value
    }
  }
  return {
    client: new AccountClient(options),
    options,
    calls,
    fetcher,
    latest: (version: string) => {
      latestVersion = version
    },
    invalidPolicy: (value: Record<string, unknown>, status = 200) => {
      policyOverride = value
      policyResponseStatus = status
    },
    advance: (milliseconds: number) => {
      elapsed += milliseconds
    },
    agePolicy: (serverTime: number) => {
      policyServerTime = serverTime
    },
    loseDraw: (failure: 'network' | 'status' | 'body' | 'unauthorized' = 'network') => {
      drawLost = failure
    },
    malformedDraw: (body: string, status?: number) => {
      malformed = body
      statusOverride = status
    },
    malformedMe: (body: string) => {
      meOverride = body
    },
    setOffline: () => {
      offline = true
    },
    draws: () => draws
  }
}

describe('account main-process gateway', () => {
  it.each([
    { homeSkins: false },
    { homeSkins: 0 },
    { homeSkins: null },
    { home: false },
    { home: null },
    { drawPool: false },
    { drawPool: null },
    {
      drawPool: {
        id: 'pool',
        startAt: 1,
        endAt: 100,
        ssrIds: ['missing'],
        characterIds: ['missing']
      }
    },
    {
      drawPool: {
        id: 'pool',
        startAt: 1,
        endAt: 100,
        ssrIds: ['missing'],
        characterIds: ['missing', 'missing']
      }
    },
    {
      home: {
        revision: 0,
        skinId: 'room-placeholder',
        furniture: [],
        placements: [{ characterId: 'a', x: 1.1, y: 0 }]
      }
    }
  ])(
    'rejects malformed optional gallery data before it reaches the renderer (%j)',
    async (fields) => {
      const f = await fixture()
      await f.client.request('login', { username: 'learner', password: 'long-test-password' })
      f.malformedMe(JSON.stringify({ user, snapshot: { ...snapshot, ...fields } }))
      await expect(f.client.request('me', {})).rejects.toThrow('INVALID_RESPONSE')
    }
  )
  it('recovers a lost home save with the same payload after restart before allowing another mutation', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-test-password' })
    const original = f.fetcher.getMockImplementation()!
    let lost = true
    f.fetcher.mockImplementation(async (input, init) => {
      const value = await original(input, init)
      if (!String(input).endsWith('/home/update')) return value
      if (lost) {
        lost = false
        throw new Error('lost saved home response')
      }
      return new Response(JSON.stringify({ snapshot }))
    })
    const payload = {
      requestId: 'home-save-lost',
      expectedRevision: 0,
      skinId: 'room-placeholder',
      placements: []
    }
    await expect(f.client.request('updateHome', payload)).rejects.toThrow('SERVICE_UNAVAILABLE')
    await expect(
      f.client.request('draw', {
        requestId: 'new-draw-before-home-replay',
        count: 1,
        source: 'learning'
      })
    ).rejects.toThrow('PENDING_RECOVERY')
    expect((await new AccountClient(f.options).session()).server.online).toBe(true)
    const saved = f.calls.filter((c) => c.path.endsWith('/home/update'))
    expect(saved).toHaveLength(2)
    expect(saved[0].body).toBe(JSON.stringify(payload))
    expect(saved[1].body).toBe(saved[0].body)
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toEqual({})
  })
  it('clears a definitive conflicting home revision without replaying it on reconnect', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-test-password' })
    const original = f.fetcher.getMockImplementation()!
    f.fetcher.mockImplementation(async (input, init) => {
      const value = await original(input, init)
      return String(input).endsWith('/home/update')
        ? new Response(JSON.stringify({ error: { code: 'HOME_CHANGED' } }), { status: 409 })
        : value
    })
    await expect(
      f.client.request('updateHome', {
        requestId: 'home-save-stale',
        expectedRevision: 0,
        skinId: 'room-placeholder',
        placements: []
      })
    ).rejects.toThrow('HOME_CHANGED')
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toEqual({})
    await f.client.session()
    expect(f.calls.filter((c) => c.path.endsWith('/home/update'))).toHaveLength(1)
  })
  it('blocks a new state-dependent transaction until the unknown request is recovered', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-test-password' })
    const payload = {
      requestId: 'draw-uncertain-before-select',
      source: 'learning' as const,
      count: 1 as const
    }
    f.loseDraw()
    await expect(f.client.request('draw', payload)).rejects.toThrow('SERVICE_UNAVAILABLE')
    await expect(
      f.client.request('selectCompanion', {
        requestId: 'select-new-after-failed-draw',
        characterId: 'companion-2'
      })
    ).rejects.toThrow('PENDING_RECOVERY')
    expect(f.calls.some((c) => c.path.endsWith('/companion/select'))).toBe(false)
    await f.client.session()
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toEqual({})
  })
  it('clears a definitive daily XP limit instead of replaying it tomorrow', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-test-password' })
    f.malformedDraw(JSON.stringify({ error: { code: 'DAILY_ANSWER_LIMIT' } }), 429)
    await expect(
      f.client.request('draw', { requestId: 'daily-limit-rejected', source: 'learning', count: 1 })
    ).rejects.toThrow('DAILY_ANSWER_LIMIT')
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toEqual({})
    await f.client.session()
    expect(f.calls.filter((c) => c.path.endsWith('/draw'))).toHaveLength(1)
  })
  it.each([401, 429])(
    'preserves pending replay on a %s with an empty error object',
    async (status) => {
      const f = await fixture()
      const credentials = { username: 'learner', password: 'long-test-password' }
      await f.client.request('login', credentials)
      const payload = {
        requestId: 'draw-empty-error-' + status,
        source: 'learning' as const,
        count: 1 as const
      }
      f.loseDraw()
      await expect(f.client.request('draw', payload)).rejects.toThrow('SERVICE_UNAVAILABLE')
      f.malformedDraw('{}', status)
      await expect(f.client.request('draw', payload)).rejects.toThrow(
        status === 401 ? 'UNAUTHORIZED' : 'RATE_LIMITED'
      )
      expect(
        JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
      ).toHaveProperty(payload.requestId)
      if (status === 401) await f.client.request('login', credentials)
      await f.client.session()
      expect(
        JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
      ).toEqual({})
    }
  )
  it('does not let a malformed top-level user replace the authenticated identity', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-test-password' })
    f.malformedMe(JSON.stringify({ user: { ...user, id: 'user-b' }, snapshot }))
    await expect(f.client.request('me', {})).rejects.toThrow('INVALID_RESPONSE')
    f.setOffline()
    const session = await f.client.session()
    expect(session.user?.id).toBe(user.id)
    expect(session.snapshot?.user.id).toBe(user.id)
  })
  it('preserves an unknown transaction when the old session is revoked, then recovers after login', async () => {
    const f = await fixture()
    const credentials = { username: 'learner', password: 'long-test-password' }
    await f.client.request('login', credentials)
    const payload = {
      requestId: 'draw-session-revoked',
      source: 'learning' as const,
      count: 1 as const
    }
    f.loseDraw()
    await expect(f.client.request('draw', payload)).rejects.toThrow('SERVICE_UNAVAILABLE')
    f.loseDraw('unauthorized')
    await expect(f.client.request('draw', payload)).rejects.toThrow('UNAUTHORIZED')
    expect(await f.options.readIdentity()).toBeNull()
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toHaveProperty(payload.requestId)
    await f.client.request('login', credentials)
    await f.client.session()
    expect(f.calls.filter((c) => c.path.endsWith('/draw')).map((c) => c.body)).toEqual([
      JSON.stringify(payload),
      JSON.stringify(payload),
      JSON.stringify(payload)
    ])
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toEqual({})
  })
  it.each([
    'null',
    '{}',
    JSON.stringify({
      snapshot: { ...snapshot, user: { ...user, id: 'someone-else' } },
      results: []
    })
  ])('keeps malformed HTTP 200 results for recovery (%s)', async (body) => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-test-password' })
    const payload = {
      requestId: 'draw-invalid-reply',
      source: 'learning' as const,
      count: 1 as const
    }
    f.malformedDraw(body)
    await expect(f.client.request('draw', payload)).rejects.toThrow('INVALID_RESPONSE')
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toHaveProperty(payload.requestId)
    await new AccountClient(f.options).session()
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toEqual({})
  })
  it('fixes production HTTPS and restricts development destinations', () => {
    expect(accountBase(true, 'http://evil.example/v1')).toBe(ACCOUNT_API)
    expect(accountBase(false, 'http://127.0.0.1:3782/v1')).toBe('http://127.0.0.1:3782/v1')
    for (const url of [
      'http://kinnuch.cn/v1',
      'https://evil.example/v1',
      'https://user:pass@kinnuch.cn/v1',
      'https://kinnuch.cn/v1?token=secret',
      'http://127.0.0.1:3782/admin'
    ])
      expect(() => accountBase(false, url)).toThrow()
  })
  it('holds bearer credentials privately and refuses redirect forwarding', async () => {
    const f = await fixture()
    const login = await f.client.request('login', {
      username: 'learner',
      password: 'long-test-password'
    })
    expect(login).toEqual({ user, snapshot })
    expect(JSON.stringify(login)).not.toContain('private-session-token')
    await f.client.request('collection', {})
    expect(f.calls.at(-1)?.authorization).toBe('Bearer private-session-token')
    expect(f.calls.every((c) => c.redirect === 'error')).toBe(true)
    await f.client.request('logout', {})
    await expect(f.client.request('collection', {})).rejects.toThrow('UNAUTHORIZED')
  })
  it('removes local credentials even when logout cannot reach the service', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-test-password' })
    f.setOffline()
    await expect(f.client.request('logout', {})).resolves.toEqual({ ok: true })
    expect((await f.client.session()).user).toBeNull()
    expect(await f.options.readIdentity()).toBeNull()
  })
  it('disables test grants in a production app regardless of remote testing metadata', async () => {
    const f = await fixture(true)
    await f.client.request('login', { username: 'learner', password: 'long-test-password' })
    expect((await f.client.session()).server.testcap).toBe(false)
    await expect(
      f.client.request('testGrant', { requestId: 'prod-grant-blocked' })
    ).rejects.toThrow('TEST_DISABLED')
    expect(f.calls.some((c) => c.path.endsWith('/test/grant'))).toBe(false)
  })
  it('recovers an uncertain draw across process restart with its original request ID', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-test-password' })
    f.loseDraw()
    const payload = {
      requestId: 'draw-after-restart',
      source: 'learning' as const,
      count: 10 as const
    }
    await expect(f.client.request('draw', payload)).rejects.toThrow('SERVICE_UNAVAILABLE')
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toHaveProperty('draw-after-restart')
    const restarted = new AccountClient(f.options)
    const restored = await restarted.session()
    expect(restored.user?.id).toBe(user.id)
    const requests = f.calls.filter((c) => c.path.endsWith('/draw'))
    expect(requests).toHaveLength(2)
    expect(requests[0].body).toBe(requests[1].body)
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))
    ).toEqual({})
  })
  it.each(['status', 'body'] as const)(
    'keeps an uncertain %s failure durable for replay',
    async (failure) => {
      const f = await fixture()
      await f.client.request('login', { username: 'learner', password: 'long-test-password' })
      f.loseDraw(failure)
      const payload = {
        requestId: 'uncertain-' + failure,
        source: 'learning' as const,
        count: 1 as const
      }
      await expect(f.client.request('draw', payload)).rejects.toThrow('SERVICE_UNAVAILABLE')
      const pending = JSON.parse(
        await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8')
      )
      expect(pending[payload.requestId].payload).toEqual(payload)
      await new AccountClient(f.options).session()
      const draws = f.calls.filter((c) => c.path.endsWith('/draw'))
      expect(draws).toHaveLength(2)
      expect(draws[1].body).toBe(draws[0].body)
    }
  )
})

describe('latest-version account admission', () => {
  it('keeps identity and unknown transactions when an older server returns 401 for the public policy endpoint', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-password' })
    const payload = {
      requestId: 'preserve-old-server',
      source: 'learning' as const,
      count: 1 as const
    }
    f.loseDraw()
    await expect(f.client.request('draw', payload)).rejects.toThrow('SERVICE_UNAVAILABLE')
    f.invalidPolicy({ error: { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' } }, 401)
    const before = f.calls.length
    const session = await f.client.session()
    expect(session.user?.id).toBe(user.id)
    expect(session.version?.status).toBe('unavailable')
    expect(session.server.online).toBe(false)
    expect((await f.options.readIdentity())?.user.id).toBe(user.id)
    expect(
      f.calls
        .slice(before)
        .every((call) => call.path.endsWith('/client-policy') && !call.authorization && !call.body)
    ).toBe(true)
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))[
        payload.requestId
      ].payload
    ).toEqual(payload)
  })
  it('rechecks immediately before authentication even when a current policy was already cached', async () => {
    const f = await fixture()
    expect((await f.client.session()).version?.status).toBe('current')
    f.latest('0.4.1')
    await expect(
      f.client.request('login', { username: 'learner', password: 'not-submitted' })
    ).rejects.toThrow('CLIENT_UPDATE_REQUIRED: 0.4.1')
    expect(f.calls.some((call) => call.path.endsWith('/auth/login'))).toBe(false)
  })
  it.each(['0.3.0', '0.4.1', '0.4.0-beta.1', '0.4.0-local'])(
    'keeps %s offline without sending registration or login credentials',
    async (version) => {
      const f = await fixture(true, false, version)
      const session = await f.client.session()
      expect(session.version).toMatchObject({
        status: 'update-required',
        installedVersion: version,
        latestVersion: '0.4.0'
      })
      expect(session.server.online).toBe(false)
      for (const action of ['login', 'register'] as const)
        await expect(
          f.client.request(action, { username: 'learner', password: 'never-upload-this-password' })
        ).rejects.toThrow('CLIENT_UPDATE_REQUIRED')
      expect(
        f.calls.every(
          (call) => call.path.endsWith('/client-policy') && !call.authorization && !call.body
        )
      ).toBe(true)
    }
  )
  it('verifies the stable version first and sends the actual main-process version header', async () => {
    const f = await fixture(true, false)
    await f.client.request('login', { username: 'learner', password: 'long-enough-password' })
    expect(f.calls[0]).toMatchObject({
      path: '/qon-api/v1/client-policy',
      version: '0.4.0',
      authorization: null
    })
    expect(f.calls.find((call) => call.path.endsWith('/auth/login'))).toMatchObject({
      version: '0.4.0',
      authorization: null
    })
    const session = await f.client.session()
    expect(session.version?.status).toBe('current')
    expect(session.server.online).toBe(true)
  })
  it.each([
    { ok: true },
    { app: 'qonsona', mode: 'exact-latest', source: 'test-override', currentVersion: '0.4.0' }
  ])('does not admit clients with unavailable or unverified policy data', async (value) => {
    const f = await fixture()
    f.invalidPolicy(value)
    await expect(
      f.client.request('login', { username: 'learner', password: 'long-password' })
    ).rejects.toThrow('CLIENT_POLICY_UNAVAILABLE')
    expect(f.calls).toHaveLength(1)
    expect((await f.client.session()).server.online).toBe(false)
  })
  it('does not renew the full cache lifetime when the server returns an aged policy', async () => {
    const f = await fixture()
    f.agePolicy(110001)
    await f.client.request('login', { username: 'learner', password: 'long-password' })
    f.latest('0.4.1')
    f.advance(10001)
    f.agePolicy(1)
    await expect(
      f.client.request('activity', { requestId: 'version-expired', language: 'en', seconds: 10 })
    ).rejects.toThrow('CLIENT_UPDATE_REQUIRED')
    expect(f.calls.filter((call) => call.path.endsWith('/client-policy'))).toHaveLength(2)
    expect(f.calls.some((call) => call.path.endsWith('/reward/activity'))).toBe(false)
  })
  it('keeps unknown transactions while outdated and recovers the same ID after updating', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-password' })
    const payload = {
      requestId: 'pending-before-update',
      source: 'learning' as const,
      count: 1 as const
    }
    f.loseDraw()
    await expect(f.client.request('draw', payload)).rejects.toThrow('SERVICE_UNAVAILABLE')
    f.latest('0.4.1')
    expect((await f.client.session()).version?.status).toBe('update-required')
    expect(f.draws()).toBe(1)
    const journal = join(f.options.directory, 'account-pending.json')
    expect(JSON.parse(await fs.readFile(journal, 'utf8'))[payload.requestId].payload).toEqual(
      payload
    )
    const updated = new AccountClient({ ...f.options, version: '0.4.1' })
    expect((await updated.session()).server.online).toBe(true)
    expect(f.draws()).toBe(2)
    expect(JSON.parse(await fs.readFile(journal, 'utf8'))).toEqual({})
    const draws = f.calls.filter((call) => call.path.endsWith('/draw'))
    expect(draws[1].body).toBe(draws[0].body)
    expect(draws[1].version).toBe('0.4.1')
  })
  it('preserves a journal entry after a release changes between preflight and mutation', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-password' })
    const payload = {
      requestId: 'version-race-draw',
      source: 'learning' as const,
      count: 1 as const
    }
    f.malformedDraw(
      JSON.stringify({
        error: {
          code: 'CLIENT_UPDATE_REQUIRED',
          currentVersion: '0.4.1',
          releaseUrl: 'https://github.com/Kinnuch/Qonsona/releases/tag/v0.4.1'
        }
      }),
      426
    )
    await expect(f.client.request('draw', payload)).rejects.toThrow('CLIENT_UPDATE_REQUIRED')
    expect(
      JSON.parse(await fs.readFile(join(f.options.directory, 'account-pending.json'), 'utf8'))[
        payload.requestId
      ].payload
    ).toEqual(payload)
  })
  it('can sign out locally when version verification or connectivity is unavailable', async () => {
    const f = await fixture()
    await f.client.request('login', { username: 'learner', password: 'long-password' })
    f.setOffline()
    expect((await f.client.session()).server.online).toBe(false)
    expect(await f.client.request('logout', {})).toEqual({ ok: true })
    expect((await f.client.session()).user).toBeNull()
  })
})
