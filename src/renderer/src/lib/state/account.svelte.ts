import { platform } from '$lib/platform'
import type {
  AccountAction,
  AccountPayloads,
  AccountResponses,
  AccountSession,
  AccountUser,
  CollectionSnapshot,
  DrawResult,
  SupportOrder
} from '$shared/account'

function snapshotOf(value: unknown): CollectionSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const response = value as { snapshot?: CollectionSnapshot; version?: number }
  return response.snapshot ?? (response.version === 1 ? (value as CollectionSnapshot) : null)
}
export class AccountState {
  session = $state.raw<AccountSession | null>(null)
  snapshot = $state.raw<CollectionSnapshot | null>(null)
  loaded = $state(false)
  loading = $state(false)
  busy = $state(false)
  error = $state('')
  lastDraw = $state.raw<DrawResult[]>([])
  lastOrder = $state.raw<SupportOrder | null>(null)
  retryable = $state(false)
  #epoch = 0
  #retry: (() => Promise<boolean>) | null = null
  #loading: Promise<void> | null = null
  #needsRecovery = false
  get generation(): number {
    return this.#epoch
  }

  #current(epoch: number, id?: string): boolean {
    return epoch === this.#epoch && (!id || this.session?.user?.id === id)
  }
  #apply(value: unknown): void {
    const snapshot = snapshotOf(value)
    if (
      snapshot &&
      snapshot.user.id === this.session?.user?.id &&
      (!this.snapshot || snapshot.revision >= this.snapshot.revision)
    ) {
      this.snapshot = snapshot
      this.session = {
        ...this.session!,
        user: snapshot.user,
        server: {
          ...this.session!.server,
          online: this.session!.server.online && !this.#needsRecovery
        }
      }
    }
  }
  #failure(error: unknown): void {
    this.error = String(error instanceof Error ? error.message : error)
    if (/CLIENT_UPDATE_REQUIRED|CLIENT_POLICY_UNAVAILABLE/.test(this.error)) {
      const latestVersion = /CLIENT_UPDATE_REQUIRED:\s*(\d+\.\d+\.\d+)(?![\w.-])/.exec(
        this.error
      )?.[1]
      this.#needsRecovery = true
      this.retryable = false
      if (this.session)
        this.session = {
          ...this.session,
          server: {
            ...this.session.server,
            online: false,
            testcap: false,
            error: this.error.split(':')[0]
          },
          version: {
            status: this.error.includes('CLIENT_UPDATE_REQUIRED')
              ? 'update-required'
              : 'unavailable',
            installedVersion: this.session.version?.installedVersion ?? '',
            ...(latestVersion
              ? {
                  latestVersion,
                  releaseUrl: `https://github.com/Kinnuch/Qonsona/releases/tag/v${latestVersion}`
                }
              : {})
          }
        }
    } else if (/UNAUTHORIZED|SESSION_EXPIRED|AUTH_REQUIRED/.test(this.error)) {
      this.#epoch++
      this.session = this.session ? { ...this.session, user: null } : null
      this.snapshot = null
      this.lastDraw = []
      this.lastOrder = null
      this.#retry = null
      this.retryable = false
    } else if (
      /offline|network|fetch|ECONN|timeout|unavailable|INVALID_RESPONSE|PENDING_RECOVERY/i.test(
        this.error
      )
    ) {
      this.#needsRecovery = true
      if (this.session)
        this.session = { ...this.session, server: { ...this.session.server, online: false } }
    }
  }
  async ensure(): Promise<void> {
    if (this.loaded) return
    if (!this.#loading)
      this.#loading = this.reconnect().finally(() => {
        this.#loading = null
      })
    await this.#loading
  }
  async reconnect(): Promise<void> {
    let epoch = this.#epoch
    this.loading = true
    try {
      const session = await platform.account.session()
      if (!this.#current(epoch)) return
      if (session.server.online) this.#needsRecovery = false
      const previous = this.session?.user?.id
      this.session = session
      if (previous !== session.user?.id) {
        epoch = ++this.#epoch
        this.snapshot = null
        this.lastDraw = []
        this.lastOrder = null
        this.#retry = null
        this.retryable = false
      }
      if (session.snapshot) this.#apply(session.snapshot)
      if (session.user && session.server.online) {
        const snapshot = await platform.account.request('collection', {})
        if (this.#current(epoch, session.user.id)) this.#apply(snapshot)
      }
      if (this.#current(epoch)) this.error = session.server.error ?? ''
    } catch (error) {
      if (this.#current(epoch)) this.#failure(error)
    } finally {
      if (this.#current(epoch) || !this.session?.user) {
        this.loading = false
        this.loaded = true
      }
    }
  }
  async authenticate(
    mode: 'login' | 'register',
    input: { username: string; password: string; nickname?: string }
  ): Promise<boolean> {
    if (this.busy) return false
    const epoch = ++this.#epoch
    this.#needsRecovery = false
    this.busy = true
    this.error = ''
    this.#retry = null
    this.retryable = false
    this.lastDraw = []
    this.lastOrder = null
    try {
      const response =
        mode === 'register'
          ? await platform.account.request('register', input)
          : await platform.account.request('login', {
              username: input.username,
              password: input.password
            })
      if (!this.#current(epoch)) return false
      const session = await platform.account.session()
      if (!this.#current(epoch)) return false
      if (session.server.online) this.#needsRecovery = false
      this.session = session
      this.snapshot = null
      if (session.user?.id === response.user.id) this.#apply(response.snapshot)
      this.#apply(session.snapshot)
      this.loaded = true
      if (session.user?.id !== response.user.id) {
        this.error = 'UNAUTHORIZED'
        return false
      }
      return true
    } catch (error) {
      if (this.#current(epoch)) this.#failure(error)
      return false
    } finally {
      this.busy = false
    }
  }
  async logout(): Promise<void> {
    if (this.busy) return
    this.#epoch++
    this.#needsRecovery = false
    this.busy = true
    try {
      await platform.account.request('logout', {})
    } catch (error) {
      this.error = String(error)
    } finally {
      this.session = this.session ? { ...this.session, user: null } : null
      this.snapshot = null
      this.lastDraw = []
      this.lastOrder = null
      this.#retry = null
      this.retryable = false
      this.busy = false
    }
  }
  async refresh(): Promise<void> {
    const id = this.session?.user?.id,
      epoch = this.#epoch
    if (!id) return this.ensure()
    try {
      const response = await platform.account.request('collection', {})
      if (this.#current(epoch, id)) {
        this.#apply(response)
        this.error = ''
      }
    } catch (error) {
      if (this.#current(epoch, id)) this.#failure(error)
    }
  }
  async mutate<A extends AccountAction>(action: A, payload: AccountPayloads[A]): Promise<boolean> {
    const id = this.session?.user?.id,
      epoch = this.#epoch
    if (this.busy || !id || !this.session?.server.online) return false
    this.busy = true
    this.error = ''
    this.#retry = () => this.mutate(action, payload)
    this.retryable = false
    try {
      const response: AccountResponses[A] = await platform.account.request(action, payload)
      if (!this.#current(epoch, id)) return false
      this.#apply(response)
      if (action === 'updateProfile')
        this.session = { ...this.session!, user: (response as { user: AccountUser }).user }
      if (action === 'draw') this.lastDraw = (response as AccountResponses['draw']).results
      if (action === 'createSupportOrder')
        this.lastOrder = (response as AccountResponses['createSupportOrder']).order
      this.#retry = null
      this.retryable = false
      return true
    } catch (error) {
      if (this.#current(epoch, id)) {
        this.#failure(error)
        this.retryable =
          !!this.#retry && !/CLIENT_UPDATE_REQUIRED|CLIENT_POLICY_UNAVAILABLE/.test(this.error)
      }
      return false
    } finally {
      if (this.#current(epoch, id)) this.busy = false
      else if (!this.session?.user) this.busy = false
    }
  }
  async retry(): Promise<boolean> {
    return this.#retry ? this.#retry() : false
  }
  /** A full room layout is saved against its server revision to protect another device's edits. */
  async saveHome(payload: AccountPayloads['updateHome']): Promise<boolean> {
    return this.mutate('updateHome', payload)
  }
  /** Foreground evidence is bounded again by the server; offline learning remains local. */
  async reportCompanionAnswer(
    payload: AccountPayloads['companionAnswer']
  ): Promise<AccountResponses['companionAnswer'] | null> {
    const id = this.session?.user?.id,
      epoch = this.#epoch
    if (!id || !this.session?.server.online) return null
    try {
      const result = await platform.account.request('companionAnswer', payload)
      if (!this.#current(epoch, id)) return null
      this.#apply(result)
      return result
    } catch (error) {
      if (this.#current(epoch, id)) this.#failure(error)
      return null
    }
  }

  async reportActivity(payload: Omit<AccountPayloads['activity'], 'requestId'>): Promise<void> {
    const id = this.session?.user?.id,
      epoch = this.#epoch
    if (!id || !this.session?.server.online) return
    try {
      const result = await platform.account.request('activity', {
        ...payload,
        requestId: crypto.randomUUID()
      })
      if (this.#current(epoch, id)) this.#apply(result)
    } catch (error) {
      if (this.#current(epoch, id)) this.#failure(error)
    }
  }
}
export const account = new AccountState()
