import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { transform } from 'esbuild'
import { compileModule } from 'svelte/compiler'
import { describe, expect, it, vi } from 'vitest'
import type { AccountSession, CollectionSnapshot } from '../src/shared/account'
import { nextProbabilities, makeupDates } from '../src/renderer/src/lib/accounts/collection'
import {
  recordLocalCompletion,
  recordLocalInterval
} from '../src/renderer/src/lib/accounts/local-records'
import { emptyRewards } from '../src/shared/rewards'
import { accountError } from '../src/renderer/src/lib/accounts/errors'
import { ledgerName, orderStatus } from '../src/renderer/src/lib/accounts/presentation'
const require = createRequire(import.meta.url)
const RULES = {
  base: { A: 0.7, R: 0.244, SR: 0.05, SSR: 0.006 },
  highPity: 20,
  softSSR: 76,
  softStep: 0.05,
  hardSSR: 90
}
function snapshot(revision = 0, points = 0): CollectionSnapshot {
  return {
    version: 1,
    revision,
    legacy: [],
    serverTime: 1,
    day: '2026-10-13',
    user: {
      id: 'a',
      username: 'private',
      nickname: 'A',
      publicId: 'public',
      publicTime: false,
      publicCollection: false,
      createdAt: 1
    },
    balances: { points, tickets: { learning: 100, support: 0 }, echoes: 0 },
    pity: { sinceSSR: 0, sinceHigh: 0 },
    characters: [],
    inventory: { makeup: 0 },
    checkins: [],
    today: {
      taskPlan: [],
      planChanges: 0,
      seconds: 0,
      timePoints: 0,
      taskPoints: 0,
      tasks: 0,
      weeklyBonus: 0
    },
    totals: { seconds: 0, collectionCount: 0 },
    catalog: [],
    shop: [],
    drawRules: RULES
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}
async function state() {
  const session: AccountSession = {
    user: snapshot().user,
    server: { baseUrl: 'http://localhost/v1', online: true, testcap: true },
    version: { status: 'current', installedVersion: '0.4.0', latestVersion: '0.4.0' },
    snapshot: snapshot()
  }
  const request = vi.fn(async (action: string) =>
    action === 'collection' ? session.snapshot : { snapshot: session.snapshot }
  )
  const platform = { account: { session: vi.fn(async () => session), request } }
  const source = await transform(
    readFileSync('src/renderer/src/lib/state/account.svelte.ts', 'utf8'),
    { loader: 'ts', target: 'esnext' }
  )
  const compiled = compileModule(source.code, { filename: 'account.svelte.js', generate: 'client' })
    .js.code
  const js = await transform(compiled, { format: 'cjs', target: 'esnext' })
  const module = {
    exports: {} as {
      AccountState: new () => import('../src/renderer/src/lib/state/account.svelte').AccountState
    }
  }
  new Function('require', 'module', 'exports', js.code)(
    (id: string) => (id === '$lib/platform' ? { platform } : require(id)),
    module,
    module.exports
  )
  const account = new module.exports.AccountState()
  await account.ensure()
  return { account, platform, request, session }
}
describe('server-owned frontend account state', () => {
  it('invalidates earlier confirmations and private results when reconnect changes account', async () => {
    const f = await state()
    const previousGeneration = f.account.generation
    f.account.lastDraw = [{ id: 'companion-1', tier: 'A', duplicate: false, echoes: 0 }]
    f.account.lastOrder = {
      id: 'private-order',
      tickets: 1,
      amountFen: 600,
      currency: 'CNY',
      status: 'pending',
      createdAt: 1
    }
    f.session.user = { ...f.session.user!, id: 'account-b' }
    f.session.snapshot = { ...snapshot(4), user: f.session.user }
    await f.account.reconnect()
    expect(f.account.generation).toBeGreaterThan(previousGeneration)
    expect(f.account.snapshot?.user.id).toBe('account-b')
    expect(f.account.lastDraw).toEqual([])
    expect(f.account.lastOrder).toBeNull()
  })
  it('does not restore the authentication response user after the authoritative session revokes it', async () => {
    const f = await state()
    const user = snapshot().user
    f.request.mockResolvedValueOnce({ user, snapshot: snapshot() } as never)
    f.platform.account.session.mockResolvedValueOnce({
      ...f.session,
      user: null,
      snapshot: undefined
    })
    expect(
      await f.account.authenticate('login', { username: 'private', password: 'synthetic-password' })
    ).toBe(false)
    expect(f.account.session?.user).toBeNull()
    expect(f.account.snapshot).toBeNull()
  })
  it('shows the new version immediately and prevents a late success from reopening online features', async () => {
    const f = await state(),
      late = deferred<unknown>()
    f.request.mockImplementation(async (action) =>
      action === 'activity'
        ? (late.promise as never)
        : Promise.reject(new Error('CLIENT_UPDATE_REQUIRED: 0.4.1'))
    )
    const activity = f.account.reportActivity({ language: 'en', seconds: 10 })
    expect(
      await f.account.mutate('purchase', { requestId: 'needs-client-update', itemId: 'ticket' })
    ).toBe(false)
    expect(f.account.session?.version).toMatchObject({
      status: 'update-required',
      installedVersion: '0.4.0',
      latestVersion: '0.4.1'
    })
    expect(f.account.retryable).toBe(false)
    late.resolve({ snapshot: snapshot(20, 120) })
    await activity
    expect(f.account.session?.server.online).toBe(false)
    const before = f.request.mock.calls.length
    expect(
      await f.account.mutate('draw', {
        requestId: 'blocked-new-draw',
        source: 'learning',
        count: 1
      })
    ).toBe(false)
    expect(f.request.mock.calls.length).toBe(before)
  })
  it('login keeps the newest snapshot after main replays pending transactions', async () => {
    const f = await state()
    await f.account.logout()
    f.session.snapshot = snapshot(9, 720)
    f.request.mockResolvedValueOnce({ user: snapshot().user, snapshot: snapshot(3, 960) } as never)
    expect(
      await f.account.authenticate('login', { username: 'private', password: 'long-password' })
    ).toBe(true)
    expect(f.account.snapshot?.revision).toBe(9)
    expect(f.account.snapshot?.balances.points).toBe(720)
  })
  it('rejects older revisions from a delayed activity response, including same server timestamp', async () => {
    const f = await state(),
      old = deferred<unknown>()
    f.request.mockImplementation(async (action) =>
      action === 'activity' ? old.promise : ({ snapshot: snapshot(2, 240) } as never)
    )
    const report = f.account.reportActivity({ language: 'en', seconds: 15 })
    await f.account.mutate('purchase', { requestId: 'same-request', itemId: 'ticket' })
    old.resolve({ snapshot: snapshot(1, 480) })
    await report
    expect(f.account.snapshot?.revision).toBe(2)
    expect(f.account.snapshot?.balances.points).toBe(240)
  })
  it('keeps the original transaction request ID when reconnecting and retrying', async () => {
    const f = await state(),
      payload = { requestId: 'original-id', itemId: 'ticket' }
    f.request.mockRejectedValueOnce(new Error('SERVICE_UNAVAILABLE: network'))
    expect(await f.account.mutate('purchase', payload)).toBe(false)
    expect(f.account.session?.server.online).toBe(false)
    expect(
      await f.account.mutate('draw', { requestId: 'wrong', source: 'learning', count: 1 })
    ).toBe(false)
    await f.account.reconnect()
    f.request.mockResolvedValueOnce({ snapshot: snapshot(1, 0) } as never)
    expect(await f.account.retry()).toBe(true)
    const purchases = f.request.mock.calls.filter(([action]) => action === 'purchase')
    expect(purchases).toHaveLength(2)
    expect(purchases[0][1]).toEqual(purchases[1][1])
  })
  it.each(['INVALID_RESPONSE', 'PENDING_RECOVERY'])(
    'blocks new mutations after uncertain %s until reconnect recovers the journal',
    async (code) => {
      const f = await state()
      f.request.mockRejectedValueOnce(new Error(`${code}: uncertain server result`))
      expect(
        await f.account.mutate('draw', {
          requestId: 'uncertain-draw',
          source: 'learning',
          count: 1
        })
      ).toBe(false)
      expect(f.account.session?.server.online).toBe(false)
      f.request.mockClear()
      expect(
        await f.account.mutate('purchase', { requestId: 'next-purchase', itemId: 'ticket' })
      ).toBe(false)
      expect(f.request).not.toHaveBeenCalled()
      await f.account.reconnect()
      expect(f.account.session?.server.online).toBe(true)
      expect(await f.account.retry()).toBe(true)
      expect(f.request).toHaveBeenCalledWith('draw', {
        requestId: 'uncertain-draw',
        source: 'learning',
        count: 1
      })
    }
  )
  it.each(['SERVICE_UNAVAILABLE', 'INVALID_RESPONSE', 'PENDING_RECOVERY'])(
    'does not let a delayed successful activity unlock %s recovery before explicit reconnect',
    async (code) => {
      const f = await state(),
        lateActivity = deferred<unknown>()
      f.request.mockImplementation(async (action) => {
        if (action === 'activity') return lateActivity.promise as never
        if (action === 'draw') throw new Error(`${code}: result is uncertain`)
        return { snapshot: f.session.snapshot } as never
      })
      const report = f.account.reportActivity({ language: 'en', seconds: 15 })
      expect(
        await f.account.mutate('draw', { requestId: 'pending-draw', source: 'learning', count: 1 })
      ).toBe(false)
      lateActivity.resolve({ snapshot: snapshot(5, 240) })
      await report
      expect(f.account.snapshot?.revision).toBe(5)
      expect(f.account.snapshot?.balances.points).toBe(240)
      expect(f.account.session?.server.online).toBe(false)
      f.request.mockClear()
      expect(await f.account.mutate('purchase', { requestId: 'new-spend', itemId: 'ticket' })).toBe(
        false
      )
      expect(f.request).not.toHaveBeenCalled()
      f.session.snapshot = snapshot(6, 0)
      await f.account.reconnect()
      expect(f.account.session?.server.online).toBe(true)
      expect(f.account.snapshot?.revision).toBe(6)
      expect(
        await f.account.mutate('purchase', { requestId: 'post-recovery', itemId: 'ticket' })
      ).toBe(true)
    }
  )
  it('does not restore stale wallet data after logout and login to the same account', async () => {
    const f = await state(),
      old = deferred<unknown>()
    f.request.mockImplementation(async (action) =>
      action === 'activity'
        ? old.promise
        : action === 'login'
          ? { user: snapshot().user, snapshot: snapshot(3) }
          : ({ ok: true } as never)
    )
    const report = f.account.reportActivity({ language: 'sjn', seconds: 15 })
    await f.account.logout()
    await f.account.authenticate('login', { username: 'private', password: 'long-password' })
    old.resolve({ snapshot: snapshot(90, 999) })
    await report
    expect(f.account.snapshot?.revision).toBe(3)
    expect(f.account.snapshot?.balances.points).toBe(0)
  })
  it('requires a live signed-in session for mutations and never sends offline learning', async () => {
    const f = await state()
    await f.account.logout()
    f.request.mockClear()
    expect(await f.account.mutate('testGrant', {})).toBe(false)
    await f.account.reportActivity({ language: 'qya', seconds: 15 })
    expect(f.request).not.toHaveBeenCalled()
  })
})
describe('collection display rules, never client-side outcome selection', () => {
  it('renders bilingual ledger and order labels without raw API routes', () => {
    expect(ledgerName('/v1/shop/purchase', 'zh')).toBe('商店兑换')
    expect(ledgerName('/v1/collection/legacy', 'en')).toBe('Earlier memorials synced')
    expect(ledgerName('/private/unrecognized', 'en')).toBe('Account record')
    expect(orderStatus('pending', 'zh')).toBe('待人工核验')
    expect(orderStatus('internal-secret', 'en')).toBe('Processing')
  })
  it('records local learning without minting new old companions and retains earlier memorials', () => {
    const at = Date.parse('2026-10-13T12:00:00+08:00'),
      r = emptyRewards(at)
    r.unlocked['companion-1'] = { at: at - 86400000, day: '2026-10-12', minutes: 5 }
    const before = structuredClone(r.unlocked)
    recordLocalInterval(r, at, at + 3600000)
    recordLocalCompletion(r, 'reading', 'article', 'sjn', at + 3600000)
    recordLocalCompletion(r, 'reading', 'article', 'sjn', at + 3600001)
    expect(r.unlocked).toEqual(before)
    expect(Object.values(r.days)[0].seconds).toBe(3600)
    expect(Object.values(r.days)[0].completions).toHaveLength(1)
    expect(Object.values(r.days)[0].claimed).toEqual([])
  })
  it('does not display raw IPC paths or unknown internal messages', () => {
    const raw =
      "Error invoking remote method 'account:request': SERVICE_UNAVAILABLE: private path C:/secret"
    expect(accountError(raw, 'zh')).toContain('账号服务器')
    expect(accountError(raw, 'en')).not.toContain('account:request')
    expect(accountError('unknown private path', 'en')).not.toContain('private')
  })
  it('matches all 90 SSR positions and 20 high-tier positions with normalized probabilities', () => {
    for (let sinceSSR = 0; sinceSSR < 90; sinceSSR++)
      for (let sinceHigh = 0; sinceHigh < 20; sinceHigh++) {
        const p = nextProbabilities({ pity: { sinceSSR, sinceHigh }, drawRules: RULES })
        expect(Object.values(p).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
        expect(p.SSR).toBeCloseTo(
          sinceSSR === 89 ? 1 : sinceSSR >= 75 ? 0.006 + (sinceSSR - 74) * 0.05 : 0.006,
          12
        )
        if (sinceHigh === 19) {
          expect(p.A).toBe(0)
          expect(p.R).toBe(0)
        }
      }
  })
  it('uses the server calendar and excludes already checked dates, including month boundaries', () => {
    expect(
      makeupDates({
        day: '2026-03-02',
        checkins: [
          { day: '2026-03-01', kind: 'learning' },
          { day: '2026-02-28', kind: 'makeup' }
        ]
      })
    ).toEqual(['2026-02-27', '2026-02-26', '2026-02-25', '2026-02-24', '2026-02-23'])
    expect(makeupDates({ day: 'invalid', checkins: [] })).toEqual([])
  })
})
