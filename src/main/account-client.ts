import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type {
  AccountAction,
  AccountPayloads,
  AccountResponses,
  AccountSession,
  AccountUser,
  CollectionSnapshot
} from '../shared/account'

export const ACCOUNT_API = 'https://kinnuch.cn/qon-api/v1'
const DURABLE = new Set<AccountAction>([
  'purchase',
  'draw',
  'useItem',
  'createSupportOrder',
  'configureTasks',
  'importLegacy',
  'testGrant',
  'selectCompanion',
  'companionAnswer',
  'requestFriend',
  'respondFriend',
  'removeFriend'
])
const ROUTES: Record<AccountAction, [string, string]> = {
  register: ['POST', '/auth/register'],
  login: ['POST', '/auth/login'],
  logout: ['POST', '/auth/logout'],
  me: ['GET', '/auth/me'],
  updateProfile: ['PATCH', '/auth/me'],
  collection: ['GET', '/collection'],
  activity: ['POST', '/reward/activity'],
  purchase: ['POST', '/shop/purchase'],
  draw: ['POST', '/draw'],
  useItem: ['POST', '/inventory/use'],
  leaderboards: ['GET', '/leaderboards'],
  createSupportOrder: ['POST', '/support/orders'],
  supportOrders: ['GET', '/support/orders'],
  configureTasks: ['POST', '/tasks/configure'],
  importLegacy: ['POST', '/collection/legacy'],
  friends: ['GET', '/friends'],
  requestFriend: ['POST', '/friends/request'],
  respondFriend: ['POST', '/friends/respond'],
  removeFriend: ['POST', '/friends/remove'],
  selectCompanion: ['POST', '/companion/select'],
  companionAnswer: ['POST', '/companion/answer'],
  testGrant: ['POST', '/test/grant']
}

interface Identity {
  token: string
  expiresAt: string | number
  user: AccountUser
}
interface Pending {
  userId: string
  base: string
  action: AccountAction
  payload: unknown
}
interface Options {
  base?: string
  packaged: boolean
  testMode: boolean
  directory: string
  readIdentity: () => Promise<Identity | null>
  writeIdentity: (identity: Identity | null) => Promise<void>
  fetcher?: typeof fetch
}

function uncertain(error: unknown): boolean {
  return (
    error instanceof Error &&
    /SERVICE_UNAVAILABLE|INVALID_RESPONSE|UNAUTHORIZED|SESSION_EXPIRED|RATE_LIMITED|AUTH_BUSY/.test(
      error.message
    )
  )
}

function validSnapshot(value: unknown, userId: string): value is CollectionSnapshot {
  if (!value || typeof value !== 'object') return false
  const s = value as CollectionSnapshot
  const natural = (v: unknown): boolean => Number.isSafeInteger(v) && Number(v) >= 0
  return (
    s.version === 1 &&
    s.user?.id === userId &&
    natural(s.revision) &&
    natural(s.balances?.points) &&
    natural(s.balances?.echoes) &&
    natural(s.balances?.tickets?.learning) &&
    natural(s.balances?.tickets?.support) &&
    natural(s.pity?.sinceSSR) &&
    natural(s.pity?.sinceHigh) &&
    Array.isArray(s.characters) &&
    Array.isArray(s.legacy) &&
    Array.isArray(s.catalog) &&
    Array.isArray(s.shop) &&
    Array.isArray(s.checkins) &&
    natural(s.inventory?.makeup) &&
    natural(s.today?.tasks) &&
    Array.isArray(s.today?.taskPlan)
  )
}

/** 正式版固定 HTTPS；本机测试不能把凭证发往任意 HTTP 主机。 */
export function accountBase(packaged: boolean, configured?: string): string {
  if (packaged || !configured) return ACCOUNT_API
  const url = new URL(configured)
  if (url.username || url.password || url.search || url.hash) throw new Error('INVALID_API_BASE')
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (!(
    (url.protocol === 'http:' && local) ||
    (url.protocol === 'https:' && url.hostname === 'kinnuch.cn')
  ))
    throw new Error('INVALID_API_BASE')
  if (!url.pathname.endsWith('/v1')) throw new Error('INVALID_API_BASE')
  return url.href.replace(/\/$/, '')
}

export class AccountClient {
  readonly base: string
  #identity: Identity | null = null
  #loaded = false
  #queue: Promise<unknown> = Promise.resolve()
  #pending: Record<string, Pending> = {}
  #snapshot: CollectionSnapshot | undefined
  constructor(private readonly options: Options) {
    this.base = accountBase(options.packaged, options.base)
  }
  async #load(): Promise<void> {
    if (this.#loaded) return
    this.#identity = await this.options.readIdentity()
    try {
      const data = JSON.parse(
        await fs.readFile(join(this.options.directory, 'account-pending.json'), 'utf8')
      )
      if (data && typeof data === 'object' && !Array.isArray(data)) this.#pending = data
    } catch {
      /* 新档案没有待恢复交易。 */
    }
    this.#loaded = true
  }
  async #savePending(): Promise<void> {
    await fs.mkdir(this.options.directory, { recursive: true })
    const path = join(this.options.directory, 'account-pending.json')
    await fs.writeFile(path + '.tmp', JSON.stringify(this.#pending), { mode: 0o600 })
    await fs.rename(path + '.tmp', path)
  }
  async #identityChanged(identity: Identity | null): Promise<void> {
    if (identity?.user.id !== this.#identity?.user.id) this.#snapshot = undefined
    this.#identity = identity
    if (!identity) this.#snapshot = undefined
    await this.options.writeIdentity(identity)
  }
  async #http(method: string, path: string, payload?: unknown): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Qon-App': 'qonsona' }
    if (this.#identity) headers.Authorization = `Bearer ${this.#identity.token}`
    if (method !== 'GET') headers['Content-Type'] = 'application/json'
    let response: Response
    try {
      response = await (this.options.fetcher ?? fetch)(this.base + path, {
        method,
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        ...(method !== 'GET' ? { body: JSON.stringify(payload ?? {}) } : {})
      })
    } catch {
      throw new Error('SERVICE_UNAVAILABLE: Account service is unavailable')
    }
    if (response.status === 401) await this.#identityChanged(null)
    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      if (reader) {
        for (;;) {
          const next = await reader.read()
          if (next.done) break
          size += next.value.byteLength
          if (size > 512 * 1024) {
            await reader.cancel()
            throw new Error('INVALID_RESPONSE: Response too large')
          }
          chunks.push(next.value)
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('INVALID_RESPONSE')) throw error
      throw new Error('SERVICE_UNAVAILABLE: Account response was interrupted')
    }
    let data: Record<string, unknown>
    try {
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      throw new Error('INVALID_RESPONSE: Invalid account response')
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('INVALID_RESPONSE: Account response must be an object')
    if (!response.ok) {
      const error = data.error as { code?: string; message?: string } | undefined
      if (response.status === 401 && !path.startsWith('/auth/login'))
        throw new Error('UNAUTHORIZED: Please sign in again')
      if (response.status === 429) {
        if (error?.code === 'DAILY_ANSWER_LIMIT' || error?.code === 'DAILY_EVENT_LIMIT')
          throw new Error(`${error.code}: Daily learning reward limit reached`)
        throw new Error('RATE_LIMITED: Please retry later')
      }
      if (response.status >= 500)
        throw new Error(`SERVICE_UNAVAILABLE: ${error?.code ?? 'Account service error'}`)
      if (!error || typeof error.code !== 'string' || !/^[A-Z][A-Z0-9_]+$/.test(error.code))
        throw new Error('INVALID_RESPONSE: Invalid account error')
      throw new Error(
        `${error?.code ?? 'ACCOUNT_ERROR'}: ${error?.message ?? 'Account request failed'}`
      )
    }
    return data
  }
  #serial<T>(run: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(run, run)
    this.#queue = result.catch(() => undefined)
    return result
  }
  async #action(action: AccountAction, payload: unknown): Promise<Record<string, unknown>> {
    if (!Object.hasOwn(ROUTES, action)) throw new Error('INVALID_ACTION')
    const route = ROUTES[action]
    if (!route) throw new Error('INVALID_ACTION')
    if (action === 'testGrant' && (this.options.packaged || !this.options.testMode))
      throw new Error('TEST_DISABLED: Test grants are unavailable')
    if (action !== 'login' && action !== 'register' && !this.#identity)
      throw new Error('UNAUTHORIZED: Please sign in')
    let path = route[1]
    if (action === 'leaderboards') {
      const value = payload as AccountPayloads['leaderboards']
      const query = new URLSearchParams({ kind: value.kind, limit: String(value.limit ?? 20) })
      if (value.language) query.set('language', value.language)
      if (value.scope) query.set('scope', value.scope)
      path += '?' + query.toString()
    }
    const data = await this.#http(route[0], path, payload)
    const loggingIn = action === 'register' || action === 'login'
    const responseUser = data.user as AccountUser | undefined
    const expectedId = loggingIn ? responseUser?.id : this.#identity?.user.id
    if (
      (loggingIn || action === 'me' || action === 'updateProfile' || data.user !== undefined) &&
      (!responseUser ||
        typeof responseUser.id !== 'string' ||
        !responseUser.id ||
        responseUser.id !== expectedId ||
        typeof responseUser.username !== 'string' ||
        typeof responseUser.nickname !== 'string')
    )
      throw new Error('INVALID_RESPONSE: Invalid account identity')
    const snapshotValue = data.snapshot ?? (action === 'collection' ? data : undefined)
    if (
      ((loggingIn ||
        action === 'me' ||
        action === 'updateProfile' ||
        action === 'collection' ||
        action === 'activity' ||
        action === 'testGrant' ||
        DURABLE.has(action)) &&
        !snapshotValue) ||
      (snapshotValue !== undefined && (!expectedId || !validSnapshot(snapshotValue, expectedId)))
    )
      throw new Error('INVALID_RESPONSE: Invalid account snapshot')
    if (action === 'draw') {
      const results = data.results as Record<string, unknown>[] | undefined
      if (
        !Array.isArray(results) ||
        results.length !== (payload as AccountPayloads['draw']).count ||
        results.some(
          (r) =>
            !r ||
            typeof r.id !== 'string' ||
            !['A', 'R', 'SR', 'SSR'].includes(String(r.tier)) ||
            typeof r.duplicate !== 'boolean' ||
            !Number.isSafeInteger(r.echoes) ||
            Number(r.echoes) < 0
        )
      )
        throw new Error('INVALID_RESPONSE: Invalid draw results')
    }
    if (action === 'createSupportOrder') {
      const order = data.order as Record<string, unknown> | undefined
      if (!order || typeof order.id !== 'string' || !Number.isSafeInteger(order.amountFen))
        throw new Error('INVALID_RESPONSE: Invalid support order')
    }
    if (action === 'register' || action === 'login') {
      if (typeof data.token !== 'string' || !data.user) throw new Error('INVALID_RESPONSE')
      await this.#identityChanged({
        token: data.token,
        expiresAt: data.expiresAt as string | number,
        user: data.user as AccountUser
      })
      delete data.token
      delete data.expiresAt
    }
    if (data.user && this.#identity) this.#identity.user = data.user as AccountUser
    const snapshot = (data.snapshot ?? (action === 'collection' ? data : undefined)) as
      CollectionSnapshot | undefined
    if (
      snapshot &&
      snapshot.user?.id === this.#identity?.user.id &&
      (!this.#snapshot || snapshot.revision >= this.#snapshot.revision)
    )
      this.#snapshot = snapshot
    if (action === 'logout') await this.#identityChanged(null)
    return data
  }
  request<A extends AccountAction>(
    action: A,
    payload: AccountPayloads[A]
  ): Promise<AccountResponses[A]> {
    return this.#serial(async () => {
      await this.#load()
      if (
        !Object.hasOwn(ROUTES, action) ||
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload)
      )
        throw new Error('INVALID_ACTION')
      if (action === 'logout') {
        try {
          await this.#action(action, payload)
        } catch {
          /* 离线时仍可退出本机账号。 */
        }
        await this.#identityChanged(null)
        return { ok: true } as AccountResponses[A]
      }
      const economic = DURABLE.has(action)
      const id = (payload as { requestId?: unknown }).requestId
      if (economic) {
        if (!this.#identity) throw new Error('UNAUTHORIZED: Please sign in')
        if (typeof id !== 'string' || !/^[a-zA-Z0-9:_-]{8,120}$/.test(id))
          throw new Error('INVALID_REQUEST_ID')
        if (
          Object.entries(this.#pending).some(
            ([pendingId, pending]) =>
              pendingId !== id &&
              pending.userId === this.#identity!.user.id &&
              pending.base === this.base
          )
        )
          throw new Error('PENDING_RECOVERY: Reconnect to recover the previous transaction first')
        const existing = this.#pending[id]
        if (
          existing &&
          (existing.userId !== this.#identity.user.id ||
            existing.base !== this.base ||
            existing.action !== action ||
            JSON.stringify(existing.payload) !== JSON.stringify(payload))
        )
          throw new Error('IDEMPOTENCY_CONFLICT')
        this.#pending[id] = { userId: this.#identity.user.id, base: this.base, action, payload }
        await this.#savePending()
      }
      try {
        const result = await this.#action(action, payload)
        if (economic && typeof id === 'string') {
          delete this.#pending[id]
          await this.#savePending()
        }
        return result as unknown as AccountResponses[A]
      } catch (error) {
        // 无法判断服务端是否已保存时，保留原请求，重启后恢复同一结果。
        if (economic && typeof id === 'string' && !uncertain(error)) {
          delete this.#pending[id]
          await this.#savePending()
        }
        throw error
      }
    })
  }
  session(): Promise<AccountSession> {
    return this.#serial(async () => {
      await this.#load()
      let online = false,
        testcap = false
      try {
        const health = await this.#http('GET', '/health')
        online = true
        const testing = health.testing as { grantsEnabled?: boolean } | undefined
        testcap = !this.options.packaged && this.options.testMode && testing?.grantsEnabled === true
        if (this.#identity) {
          await this.#action('me', {})
          for (const [id, pending] of Object.entries(this.#pending)) {
            if (
              !this.#identity ||
              pending.userId !== this.#identity.user.id ||
              pending.base !== this.base
            )
              continue
            try {
              await this.#action(pending.action, pending.payload)
              delete this.#pending[id]
              await this.#savePending()
            } catch (error) {
              if (uncertain(error)) throw error
              delete this.#pending[id]
              await this.#savePending()
            }
          }
          if (this.#identity) await this.#action('me', {})
        }
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('UNAUTHORIZED')) online = false
      }
      return {
        user: this.#identity?.user ?? null,
        server: { baseUrl: this.base, online, testcap },
        ...(this.#snapshot ? { snapshot: this.#snapshot } : {})
      }
    })
  }
}
