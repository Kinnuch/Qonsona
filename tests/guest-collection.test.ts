import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { GuestCollection, GUEST_COLLECTION_FILE } from '../src/main/guest-collection'
import { CATALOG, shopFor, speciesFor } from '../server/catalog.mjs'
import { COMPANION_MILESTONES, RULES } from '../server/domain.mjs'

const root = await fs.mkdtemp(join(tmpdir(), 'qonsona-guest-store-test-'))
const now = Date.parse('2026-10-15T15:59:59Z')
let sequence = 0
const directory = (): string => join(root, String(++sequence))
const pathFor = (directory: string): string => join(directory, GUEST_COLLECTION_FILE)
const fresh = (): GuestCollection => new GuestCollection(directory(), () => now)
const write = async (directory: string, value: unknown): Promise<void> => {
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(pathFor(directory), JSON.stringify(value))
}
afterEach(() => vi.restoreAllMocks())
afterAll(async () => fs.rm(root, { recursive: true, force: true }))

describe('访客收藏', () => {
  it('无需身份或联网即可读取公开图鉴，没有虚构余额、当前奖池或全球人气', async () => {
    const store = fresh()
    const session = await store.session()
    expect(session.starter).toBeNull()
    expect(session.snapshot).not.toHaveProperty('user')
    expect(session.snapshot).not.toHaveProperty('drawPool')
    expect(session.snapshot.gallery?.map((item) => item.type)).toEqual(['new', 'discount'])
    expect(session.snapshot.balances).toEqual({
      points: 0,
      tickets: { learning: 0, support: 0 },
      echoes: 0
    })
    expect(session.snapshot.catalog).toEqual(CATALOG)
    expect(session.snapshot.species).toEqual(speciesFor(CATALOG))
    expect(session.snapshot.characters).toEqual([])
    expect(session.snapshot.companion?.currentId).toBeNull()
    await expect(fs.stat(store.directory)).rejects.toHaveProperty('code', 'ENOENT')
  })

  it('使用服务器同样的北京时间日界、原价、每日折扣及展示规则', async () => {
    const store = fresh()
    const snapshot = (await store.session()).snapshot
    expect(snapshot.day).toBe('2026-10-15')
    expect(snapshot.shop).toEqual(shopFor(snapshot.day))
    expect(snapshot.drawRules).toEqual(RULES)
    expect(snapshot.companion?.milestones).toEqual(COMPANION_MILESTONES)
    const afterMidnight = new GuestCollection(store.directory, () => now + 1000)
    const next = (await afterMidnight.session()).snapshot
    expect(next.day).toBe('2026-10-16')
    expect(next.shop).toEqual(shopFor(next.day))
  })

  it.each(['companion-1', 'companion-2', 'companion-3'])(
    '可以任选初识伙伴 %s，免费领取后默认养成，重启仍保留',
    async (characterId) => {
      const store = fresh()
      const result = await store.claim(characterId)
      expect(result.starter).toEqual({ characterId, claimedAt: now })
      expect(result.snapshot.characters).toEqual([
        { id: characterId, count: 1, firstAt: now, source: 'guest-starter' }
      ])
      expect(result.snapshot.companion?.currentId).toBe(characterId)
      expect(result.snapshot.companion?.progress).toEqual([{ characterId, xp: 0, gifts: [] }])
      expect(result.snapshot.totals.collectionCount).toBe(1)
      expect(result.snapshot.balances.points).toBe(0)
      expect(await new GuestCollection(store.directory, () => now).session()).toEqual(result)
      const serialized = JSON.parse(await fs.readFile(pathFor(store.directory), 'utf8'))
      expect(serialized).toEqual({ version: 1, starter: { characterId, claimedAt: now } })
    }
  )

  it('相同伙伴的重试幂等，不能选择第二只，也不消耗原领取时间', async () => {
    const store = fresh()
    const first = await store.claim('companion-2')
    const retry = new GuestCollection(store.directory, () => now + 60000)
    expect((await retry.claim('companion-2')).starter).toEqual(first.starter)
    await expect(retry.claim('companion-1')).rejects.toHaveProperty('code', 'LOGIN_REQUIRED')
    expect((await store.session()).snapshot.characters).toHaveLength(1)
  })

  it('并发首次选择及同目录的多个实例不能领取两只，失败后队列继续工作', async () => {
    const store = fresh()
    const another = new GuestCollection(store.directory, () => now + 1)
    const results = await Promise.allSettled([
      store.claim('companion-1'),
      another.claim('companion-2'),
      store.claim('companion-1')
    ])
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
    expect(results[1]).toMatchObject({ reason: { code: 'LOGIN_REQUIRED' } })
    expect((await another.session()).starter?.characterId).toBe('companion-1')
    expect((await another.session()).snapshot.characters).toHaveLength(1)
  })

  it.each(['companion-4', 'companion-10', 'monthly-2026-10', 'unknown', '', null, 1, {}])(
    '初次领取拒绝非初识或无效选择 %j，并保持未领取',
    async (characterId) => {
      const store = fresh()
      await expect(store.claim(characterId)).rejects.toHaveProperty('code', 'INVALID_STARTER')
      expect((await store.session()).starter).toBeNull()
      await expect(fs.stat(store.directory)).rejects.toHaveProperty('code', 'ENOENT')
    }
  )

  it('读取、领取和绑定均不会把损坏的 JSON 重置成新的免费名额', async () => {
    const store = fresh()
    await fs.mkdir(store.directory, { recursive: true })
    const corrupt = '{"version":1,"starter":'
    await fs.writeFile(pathFor(store.directory), corrupt)
    await expect(store.session()).rejects.toHaveProperty('code', 'GUEST_STATE_INVALID')
    await expect(store.claim('companion-1')).rejects.toHaveProperty('code', 'GUEST_STATE_INVALID')
    await expect(store.bind('account-1')).rejects.toHaveProperty('code', 'GUEST_STATE_INVALID')
    expect(await fs.readFile(pathFor(store.directory), 'utf8')).toBe(corrupt)
  })

  it.each([
    null,
    [],
    {},
    { version: 2, starter: null },
    { version: 1, starter: null, balances: { points: 999 } },
    { version: 1, starter: { characterId: 'companion-4', claimedAt: now } },
    { version: 1, starter: { characterId: 'companion-1', claimedAt: 0 } },
    { version: 1, starter: { characterId: 'companion-1', claimedAt: 0.1 } },
    { version: 1, starter: { characterId: 'companion-1', claimedAt: Number.MAX_SAFE_INTEGER } },
    { version: 1, starter: { characterId: 'companion-1', claimedAt: now, claimedBy: '' } },
    { version: 1, starter: { characterId: 'companion-1', claimedAt: now, count: 2 } }
  ])('拒绝无效本机结构或篡改字段 %j，不覆盖文件', async (value) => {
    const store = fresh()
    await write(store.directory, value)
    const before = await fs.readFile(pathFor(store.directory), 'utf8')
    await expect(store.claim('companion-1')).rejects.toHaveProperty('code', 'GUEST_STATE_INVALID')
    expect(await fs.readFile(pathFor(store.directory), 'utf8')).toBe(before)
  })

  it('在原有实例外修改磁盘记录后也重新验证，不能使用旧的有效内存状态', async () => {
    const store = fresh()
    await store.claim('companion-1')
    await fs.writeFile(pathFor(store.directory), 'broken')
    await expect(store.session()).rejects.toHaveProperty('code', 'GUEST_STATE_INVALID')
    await expect(store.claim('companion-1')).rejects.toHaveProperty('code', 'GUEST_STATE_INVALID')
  })

  it('首次原子写入失败不领取，临时文件清理后可以重新选择', async () => {
    const store = fresh()
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(
      Object.assign(new Error('denied'), { code: 'EACCES' })
    )
    await expect(store.claim('companion-1')).rejects.toHaveProperty(
      'code',
      'GUEST_STATE_UNAVAILABLE'
    )
    expect((await store.session()).starter).toBeNull()
    expect(await fs.readdir(store.directory)).toEqual([])
    expect((await store.claim('companion-2')).starter?.characterId).toBe('companion-2')
  })

  it('绑定写入失败保留原记录，不提前绑定，之后可以重试', async () => {
    const store = fresh()
    await store.claim('companion-1')
    const before = await fs.readFile(pathFor(store.directory), 'utf8')
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('disk error'))
    await expect(store.bind('account-1')).rejects.toHaveProperty('code', 'GUEST_STATE_UNAVAILABLE')
    expect(await fs.readFile(pathFor(store.directory), 'utf8')).toBe(before)
    expect((await store.session()).starter).toEqual({ characterId: 'companion-1', claimedAt: now })
    expect(await fs.readdir(store.directory)).toEqual([GUEST_COLLECTION_FILE])
    expect((await store.bind('account-1')).starter?.claimedBy).toBe('account-1')
  })

  it('首次绑定成功后同账号重试幂等，重启或并发都不能再绑定另一账号', async () => {
    const store = fresh()
    await store.claim('companion-1')
    const restarted = new GuestCollection(store.directory, () => now)
    const result = await Promise.allSettled([store.bind('account-1'), restarted.bind('account-2')])
    expect(result.map((item) => item.status)).toEqual(['fulfilled', 'rejected'])
    expect(result[1]).toMatchObject({ reason: { code: 'GUEST_ALREADY_BOUND' } })
    const first = await restarted.session()
    expect(first.starter?.claimedBy).toBe('account-1')
    expect(await store.bind('account-1')).toEqual(first)
    await expect(restarted.bind('account-2')).rejects.toHaveProperty('code', 'GUEST_ALREADY_BOUND')
    await expect(restarted.claim('companion-2')).rejects.toHaveProperty('code', 'LOGIN_REQUIRED')
  })

  it('没有伙伴不能绑定，非法账号 ID 不写入', async () => {
    const store = fresh()
    await expect(store.bind('account-1')).rejects.toHaveProperty('code', 'INVALID_STARTER')
    await store.claim('companion-1')
    for (const userId of ['', ' ', '../../bad', null, {}, 'x'.repeat(129)])
      await expect(store.bind(userId)).rejects.toHaveProperty('code', 'INVALID_GUEST_ACCOUNT')
    expect((await store.session()).starter?.claimedBy).toBeUndefined()
  })

  it('调用方修改返回的快照和领取记录不会影响下一次读取', async () => {
    const store = fresh()
    const result = await store.claim('companion-1')
    result.starter!.characterId = 'companion-2'
    result.snapshot.catalog[0].name.zh = 'changed'
    result.snapshot.shop.find((item) => item.characterId === 'companion-1')!.name!.zh = 'changed'
    result.snapshot.characters.push({ id: 'companion-2', count: 100, firstAt: now, source: 'bad' })
    const next = await store.session()
    expect(next.starter?.characterId).toBe('companion-1')
    expect(next.snapshot.catalog[0].name.zh).not.toBe('changed')
    expect(
      next.snapshot.shop.find((item) => item.characterId === 'companion-1')!.name!.zh
    ).not.toBe('changed')
    expect(next.snapshot.characters).toHaveLength(1)
  })
})
