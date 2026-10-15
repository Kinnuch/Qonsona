import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join, resolve } from 'node:path'
import configuration from '../../server/catalog.json'
import species from '../../server/species.json'
import homeSkins from '../../server/home-skins.json'
import type { AccountCharacter, AccountShopItem } from '../shared/account'
import type {
  GuestCollectionSnapshot,
  GuestCollectionState,
  GuestStarter
} from '../shared/guest-collection'

export const GUEST_COLLECTION_FILE = 'guest-collection.json'
type GuestErrorCode =
  | 'LOGIN_REQUIRED'
  | 'INVALID_STARTER'
  | 'INVALID_GUEST_ACCOUNT'
  | 'GUEST_ALREADY_BOUND'
  | 'GUEST_STATE_INVALID'
  | 'GUEST_STATE_UNAVAILABLE'

export class GuestCollectionError extends Error {
  constructor(
    readonly code: GuestErrorCode,
    options?: ErrorOptions
  ) {
    super(code, options)
    this.name = 'GuestCollectionError'
  }
}

interface StoredGuestCollection {
  version: 1
  starter: GuestStarter | null
}

const catalog = configuration as (AccountCharacter & { introducedAt: string })[]
const initialCharacters = catalog.filter((character) => character.tier === 'A')
const queues = new Map<string, Promise<unknown>>()

function validTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    Number.isFinite(new Date(value).getTime())
  )
}

function validUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validateStored(value: unknown): StoredGuestCollection {
  const invalid = (): never => {
    throw new GuestCollectionError('GUEST_STATE_INVALID')
  }
  if (
    !record(value) ||
    value.version !== 1 ||
    Object.keys(value).some((key) => !['version', 'starter'].includes(key)) ||
    !Object.hasOwn(value, 'starter')
  )
    return invalid()
  if (value.starter === null) return { version: 1, starter: null }
  const starter = value.starter
  if (
    !record(starter) ||
    Object.keys(starter).some((key) => !['characterId', 'claimedAt', 'claimedBy'].includes(key)) ||
    typeof starter.characterId !== 'string' ||
    !initialCharacters.some((character) => character.id === starter.characterId) ||
    !validTimestamp(starter.claimedAt) ||
    (Object.hasOwn(starter, 'claimedBy') && !validUserId(starter.claimedBy))
  )
    return invalid()
  return {
    version: 1,
    starter: {
      characterId: starter.characterId,
      claimedAt: starter.claimedAt,
      ...(typeof starter.claimedBy === 'string' ? { claimedBy: starter.claimedBy } : {})
    }
  }
}

/** 这些仅供离线预览；抽卡结果、余额及成长始终由已登录的服务器负责。 */
function snapshotFor(starter: GuestStarter | null, now: number): GuestCollectionSnapshot {
  const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10)
  const candidates = catalog.filter((character) => ['A', 'R'].includes(character.tier))
  const discountIndex = createHash('sha256')
    .update(`qonsona-discount-v1:${day}`)
    .digest()
    .readUInt32BE(0)
  const discounted = candidates[discountIndex % candidates.length]
  const shop: AccountShopItem[] = [
    { id: 'ticket', price: 240, currency: 'points', type: 'ticket' },
    { id: 'makeup', price: 80, currency: 'points', type: 'makeup' },
    ...candidates.map((character): AccountShopItem => {
      const price = character.tier === 'A' ? 240 : 720
      return {
        id: `character:${character.id}`,
        price: character.id === discounted.id ? price / 2 : price,
        currency: 'points',
        type: 'character',
        characterId: character.id,
        tier: character.tier,
        name: { ...character.name },
        ...(character.id === discounted.id ? { originalPrice: price, discount: 0.5 } : {})
      }
    }),
    {
      id: 'echo-ticket',
      price: 1000,
      currency: 'echoes',
      type: 'ticket',
      name: { zh: '寻访笺', en: 'Learning Ticket' }
    }
  ]
  const available = catalog.filter((character) => character.introducedAt <= day)
  const newest = available.reduce(
    (date, character) => (character.introducedAt > date ? character.introducedAt : date),
    ''
  )
  const recent = available.filter((character) => character.introducedAt === newest)
  const selected = recent.length
    ? recent[createHash('sha256').update(`gallery:${day}`).digest().readUInt32BE(0) % recent.length]
    : catalog[0]
  const discountedItem = shop.find((item) => item.characterId === discounted.id)!
  const currentId = starter?.characterId ?? null
  return {
    version: 1,
    revision: starter ? (starter.claimedBy ? 2 : 1) : 0,
    serverTime: now,
    day,
    balances: { points: 0, tickets: { learning: 0, support: 0 }, echoes: 0 },
    pity: { sinceSSR: 0, sinceHigh: 0 },
    characters: starter
      ? [{ id: starter.characterId, count: 1, firstAt: starter.claimedAt, source: 'guest-starter' }]
      : [],
    legacy: [],
    inventory: { makeup: 0, decorations: [], homeSkins: ['room-placeholder'] },
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
    totals: { seconds: 0, collectionCount: starter ? 1 : 0 },
    catalog: structuredClone(catalog),
    species: species.map(({ id, name }) => ({
      id,
      name: { ...name },
      characterIds: catalog.filter((character) => character.speciesId === id).map((c) => c.id)
    })),
    shop,
    gallery: [
      { type: 'new', characterId: selected.id, date: newest || day },
      {
        type: 'discount',
        characterId: discounted.id,
        date: day,
        price: discountedItem.price,
        originalPrice: discountedItem.originalPrice
      }
    ],
    drawRules: {
      base: { A: 0.7, R: 0.244, SR: 0.05, SSR: 0.006 },
      highPity: 20,
      softSSR: 76,
      softStep: 0.05,
      hardSSR: 90,
      sharedPity: true,
      duplicateEchoes: { A: 1, R: 3, SR: 8, SSR: 20 },
      timePointsPerMinute: 2,
      dailyTimePoints: 120,
      dailyTaskPoints: 60,
      weeklyDays: 5,
      weeklySeconds: 600,
      weeklyPoints: 80
    },
    companion: {
      currentId,
      progress: currentId ? [{ characterId: currentId, xp: 0, gifts: [] }] : [],
      todayAnswers: 0,
      maxDailyAnswers: 200,
      xpPerAnswer: 5,
      milestones: [100, 300, 700, 1500, 3000].map((xp, index) => ({
        xp,
        id: `keepsake-${index + 1}`,
        name: { zh: `伙伴收藏品 ${index + 1}`, en: `Companion Keepsake ${index + 1}` }
      }))
    },
    home: { revision: 0, skinId: 'room-placeholder', placements: [], furniture: [] },
    homeSkins: homeSkins.map((skin) => ({
      ...skin,
      name: { ...skin.name },
      owned: skin.id === 'room-placeholder'
    })),
    history: []
  }
}

/** 主进程唯一的本机体验记录；每次操作重读，损坏文件不会重置免费名额。 */
export class GuestCollection {
  readonly #path: string

  constructor(
    readonly directory: string,
    readonly now: () => number = Date.now
  ) {
    this.#path = resolve(directory, GUEST_COLLECTION_FILE)
  }

  session(): Promise<GuestCollectionState> {
    return this.#serial(async () => this.#state(await this.#read()))
  }

  claim(characterId: unknown): Promise<GuestCollectionState> {
    return this.#serial(async () => {
      const stored = await this.#read()
      if (stored.starter) {
        if (stored.starter.characterId !== characterId)
          throw new GuestCollectionError('LOGIN_REQUIRED')
        return this.#state(stored)
      }
      if (
        typeof characterId !== 'string' ||
        !initialCharacters.some((character) => character.id === characterId)
      )
        throw new GuestCollectionError('INVALID_STARTER')
      const claimedAt = this.now()
      if (!validTimestamp(claimedAt)) throw new GuestCollectionError('GUEST_STATE_UNAVAILABLE')
      const next: StoredGuestCollection = {
        version: 1,
        starter: { characterId, claimedAt }
      }
      await this.#write(next)
      return this.#state(next)
    })
  }

  /** 仅在服务器成功认领后调用；不能把同一本机伙伴重复绑定给另一账号。 */
  bind(userId: unknown): Promise<GuestCollectionState> {
    return this.#serial(async () => {
      if (!validUserId(userId)) throw new GuestCollectionError('INVALID_GUEST_ACCOUNT')
      const stored = await this.#read()
      if (!stored.starter) throw new GuestCollectionError('INVALID_STARTER')
      if (stored.starter.claimedBy) {
        if (stored.starter.claimedBy !== userId)
          throw new GuestCollectionError('GUEST_ALREADY_BOUND')
        return this.#state(stored)
      }
      const next: StoredGuestCollection = {
        version: 1,
        starter: { ...stored.starter, claimedBy: userId }
      }
      await this.#write(next)
      return this.#state(next)
    })
  }

  #state(stored: StoredGuestCollection): GuestCollectionState {
    const now = this.now()
    if (!validTimestamp(now)) throw new GuestCollectionError('GUEST_STATE_UNAVAILABLE')
    return {
      starter: stored.starter ? { ...stored.starter } : null,
      snapshot: snapshotFor(stored.starter, now)
    }
  }

  #serial<T>(work: () => Promise<T>): Promise<T> {
    const previous = queues.get(this.#path) ?? Promise.resolve()
    const job = previous.catch(() => {}).then(work)
    queues.set(this.#path, job)
    void job
      .finally(() => {
        if (queues.get(this.#path) === job) queues.delete(this.#path)
      })
      .catch(() => {})
    return job
  }

  async #read(): Promise<StoredGuestCollection> {
    let content: string
    try {
      content = await fs.readFile(this.#path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, starter: null }
      throw new GuestCollectionError('GUEST_STATE_UNAVAILABLE', { cause: error })
    }
    try {
      if (content.length > 16384) throw new Error('Guest record exceeds its size limit')
      return validateStored(JSON.parse(content))
    } catch (error) {
      if (error instanceof GuestCollectionError) throw error
      throw new GuestCollectionError('GUEST_STATE_INVALID', { cause: error })
    }
  }

  async #write(stored: StoredGuestCollection): Promise<void> {
    const directory = resolve(this.directory)
    const temporary = join(directory, `${GUEST_COLLECTION_FILE}.${randomUUID()}.tmp`)
    try {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 })
      const file = await fs.open(temporary, 'wx', 0o600)
      try {
        await file.writeFile(JSON.stringify(stored) + '\n', 'utf8')
        await file.sync()
      } finally {
        await file.close()
      }
      await fs.rename(temporary, this.#path)
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => {})
      throw new GuestCollectionError('GUEST_STATE_UNAVAILABLE', { cause: error })
    }
  }
}
