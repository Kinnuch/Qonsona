import { platform } from '$lib/platform'
import type { GuestCollectionState as GuestResult } from '$shared/guest-collection'

/** 本机初次相遇与账号余额分开；只有主进程可以保存领取结果。 */
export class GuestCollectionState {
  snapshot = $state.raw<GuestResult['snapshot'] | null>(null)
  starter = $state.raw<GuestResult['starter']>(null)
  loaded = $state(false)
  loading = $state(false)
  busy = $state(false)
  error = $state('')
  #generation = $state(0)
  #loading: Promise<void> | null = null
  get generation(): number {
    return this.#generation
  }
  #apply(result: GuestResult): void {
    this.snapshot = result.snapshot
    this.starter = result.starter
    this.#generation++
  }
  async ensure(): Promise<void> {
    if (this.loaded) return
    await this.refresh()
  }
  async refresh(): Promise<void> {
    if (this.#loading) return this.#loading
    const generation = this.#generation
    this.loading = true
    this.#loading = (async () => {
      try {
        const result = await platform.guestCollection.session()
        if (generation !== this.#generation) return
        this.#apply(result)
        this.error = ''
        this.loaded = true
      } catch (error) {
        if (generation === this.#generation)
          this.error = String(error instanceof Error ? error.message : error)
      } finally {
        this.loading = false
        this.#loading = null
      }
    })()
    return this.#loading
  }
  async claim(characterId: string): Promise<boolean> {
    if (this.busy) return false
    this.busy = true
    this.error = ''
    try {
      this.#apply(await platform.guestCollection.claim(characterId))
      this.loaded = true
      return true
    } catch (error) {
      this.error = String(error instanceof Error ? error.message : error)
      return false
    } finally {
      this.busy = false
    }
  }
}
export const guestCollection = new GuestCollectionState()
