import { afterEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AccountClient } from '../src/main/account-client'
import type { AccountUser, CollectionSnapshot } from '../src/shared/account'

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0))
    await fs.rm(directory, { recursive: true, force: true })
})
const user: AccountUser = {
  id: 'starter-user',
  username: 'starter',
  nickname: 'Starter',
  publicId: 'starter-public',
  publicCollection: true,
  publicTime: true,
  createdAt: 1
}
const empty: CollectionSnapshot = {
  version: 1,
  revision: 0,
  serverTime: 1,
  day: '2026-10-15',
  user,
  balances: { points: 0, tickets: { learning: 0, support: 0 }, echoes: 0 },
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
  catalog: [
    { id: 'companion-1', tier: 'A', sheet: 0, cell: 0, name: { zh: '测试伙伴一', en: 'Test One' } },
    { id: 'companion-2', tier: 'A', sheet: 0, cell: 1, name: { zh: '测试伙伴二', en: 'Test Two' } }
  ],
  shop: [],
  drawRules: {}
}
function claimed(characterId = 'companion-1'): CollectionSnapshot {
  return {
    ...structuredClone(empty),
    revision: 1,
    starter: { characterId, claimedAt: 1, source: 'guest-starter' },
    characters: [{ id: characterId, count: 1, firstAt: 1, source: 'guest-starter' }],
    totals: { seconds: 0, collectionCount: 1 }
  }
}
async function fixture() {
  const directory = await fs.mkdtemp(join(tmpdir(), 'qon-starter-gateway-'))
  directories.push(directory)
  let identity: Parameters<ConstructorParameters<typeof AccountClient>[0]['writeIdentity']>[0] =
    null
  let snapshot = structuredClone(empty)
  let response: (() => Response | Promise<Response>) | undefined
  const requests: { path: string; body?: string | null; authorization: string | null }[] = []
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname
    requests.push({
      path,
      body: init?.body as string | null,
      authorization: new Headers(init?.headers).get('Authorization')
    })
    if (path.endsWith('/client-policy'))
      return new Response(
        JSON.stringify({
          app: 'qonsona',
          mode: 'exact-latest',
          source: 'github-latest',
          currentVersion: '0.4.1',
          checkedAt: 1,
          serverTime: 1,
          validUntil: 120001,
          releaseUrl: 'https://github.com/Kinnuch/Qonsona/releases/tag/v0.4.1'
        })
      )
    if (path.endsWith('/auth/login'))
      return new Response(
        JSON.stringify({ token: 'private-starter-token', expiresAt: 999999, user, snapshot })
      )
    if (path.endsWith('/health')) return new Response(JSON.stringify({ status: 'ok' }))
    if (path.endsWith('/auth/me')) return new Response(JSON.stringify({ user, snapshot }))
    if (path.endsWith('/collection/starter')) {
      if (response) return response()
      snapshot = claimed(snapshot.starter?.characterId)
      return new Response(JSON.stringify({ characterId: snapshot.starter!.characterId, snapshot }))
    }
    return new Response(JSON.stringify({ snapshot }))
  })
  const options = {
    version: '0.4.1',
    packaged: false,
    testMode: true,
    directory,
    clock: () => 0,
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
    requests,
    reply: (callback: typeof response) => {
      response = callback
    },
    setSnapshot: (value: CollectionSnapshot) => {
      snapshot = value
    },
    pending: async () =>
      JSON.parse(await fs.readFile(join(directory, 'account-pending.json'), 'utf8'))
  }
}
const credentials = { username: 'starter', password: 'synthetic-test-password' }
const payload = { requestId: 'guest-starter:123:companion-1', characterId: 'companion-1' }

describe('durable starter claim gateway', () => {
  it('uses the private authenticated route and accepts the existing account starter even when its ID differs', async () => {
    const f = await fixture()
    f.setSnapshot(claimed('companion-2'))
    await f.client.request('login', credentials)
    const result = await f.client.request('claimStarter', payload)
    expect(result.characterId).toBe('companion-2')
    expect(result.snapshot.starter?.characterId).toBe('companion-2')
    expect(
      f.requests.find((request) => request.path.endsWith('/collection/starter'))
    ).toMatchObject({
      body: JSON.stringify(payload),
      authorization: 'Bearer private-starter-token'
    })
    expect(await f.pending()).toEqual({})
    expect(JSON.stringify(result)).not.toContain('private-starter-token')
  })

  it('requires login before creating any starter journal or sending its route', async () => {
    const f = await fixture()
    await expect(f.client.request('claimStarter', payload)).rejects.toThrow('UNAUTHORIZED')
    expect(f.requests.some((request) => request.path.endsWith('/collection/starter'))).toBe(false)
    await expect(f.pending()).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retains a lost claim, blocks new mutations, then replays the exact request after restart', async () => {
    const f = await fixture()
    await f.client.request('login', credentials)
    f.reply(() => {
      f.setSnapshot(claimed())
      throw new Error('lost committed starter reply')
    })
    await expect(f.client.request('claimStarter', payload)).rejects.toThrow('SERVICE_UNAVAILABLE')
    expect((await f.pending())[payload.requestId].payload).toEqual(payload)
    await expect(
      f.client.request('purchase', {
        requestId: 'purchase-before-starter-recovery',
        itemId: 'ticket'
      })
    ).rejects.toThrow('PENDING_RECOVERY')
    f.reply(undefined)
    const session = await new AccountClient(f.options).session()
    expect(session.server.online).toBe(true)
    expect(session.snapshot?.starter?.characterId).toBe(payload.characterId)
    expect(await f.pending()).toEqual({})
    const claims = f.requests.filter((request) => request.path.endsWith('/collection/starter'))
    expect(claims).toHaveLength(2)
    expect(claims[0].body).toBe(claims[1].body)
  })

  it.each([401, 429, 503])('keeps a %s unknown claim for same-account recovery', async (status) => {
    const f = await fixture()
    await f.client.request('login', credentials)
    f.reply(
      () =>
        new Response(
          JSON.stringify({
            error: {
              code:
                status === 401 ? 'UNAUTHORIZED' : status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR'
            }
          }),
          { status }
        )
    )
    await expect(f.client.request('claimStarter', payload)).rejects.toThrow(
      status === 401 ? 'UNAUTHORIZED' : status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE'
    )
    expect((await f.pending())[payload.requestId].payload).toEqual(payload)
    f.reply(undefined)
    if (status === 401) await f.client.request('login', credentials)
    expect((await new AccountClient(f.options).session()).server.online).toBe(true)
    expect(await f.pending()).toEqual({})
  })

  it('clears a definite invalid starter rejection without replaying it', async () => {
    const f = await fixture()
    await f.client.request('login', credentials)
    f.reply(
      () =>
        new Response(JSON.stringify({ error: { code: 'INVALID_STARTER_CHARACTER' } }), {
          status: 400
        })
    )
    await expect(f.client.request('claimStarter', payload)).rejects.toThrow(
      'INVALID_STARTER_CHARACTER'
    )
    expect(await f.pending()).toEqual({})
    await f.client.session()
    expect(
      f.requests.filter((request) => request.path.endsWith('/collection/starter'))
    ).toHaveLength(1)
  })

  it.each([
    'missing',
    'mismatch',
    'unowned',
    'tier',
    'timestamp',
    'null-catalog',
    'null-owned'
  ] as const)('keeps a malformed %s HTTP 200 claim for recovery', async (malformation) => {
    const f = await fixture()
    await f.client.request('login', credentials)
    const snapshot = claimed()
    let characterId = payload.characterId
    if (malformation === 'missing') delete snapshot.starter
    if (malformation === 'mismatch') characterId = 'companion-2'
    if (malformation === 'unowned') snapshot.characters = []
    if (malformation === 'tier') snapshot.catalog[0].tier = 'SSR'
    if (malformation === 'timestamp') snapshot.starter!.claimedAt = -1
    if (malformation === 'null-catalog') Reflect.set(snapshot.catalog, 0, null)
    if (malformation === 'null-owned') Reflect.set(snapshot.characters, 0, null)
    f.reply(() => new Response(JSON.stringify({ characterId, snapshot })))
    await expect(f.client.request('claimStarter', payload)).rejects.toThrow('INVALID_RESPONSE')
    expect((await f.pending())[payload.requestId].payload).toEqual(payload)
    f.reply(undefined)
    expect((await new AccountClient(f.options).session()).server.online).toBe(true)
    expect(await f.pending()).toEqual({})
  })
})
