import { randomUUID } from 'node:crypto'

export interface SavedUpdateQuit {
  quit(): void
  abort(error: Error): void
}

interface ShutdownHooks<W> {
  requestSave(window: W, token: string): void
  cancelSave(window: W, token: string): void
  drainWrites(): Promise<void>
  allowClose(window: W): void
  disallowClose(window: W): void
  quit(): void
}

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: Error): void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  // A canceled request may precede the renderer's reply. Its reply still receives the error.
  void promise.catch(() => {})
  return { promise, resolve, reject }
}

/** Save first; leave the window open until the external installer handoff is acknowledged. */
export class UpdateShutdown<W> {
  #active: {
    window: W
    token: string
    saving: boolean
    ready: ReturnType<typeof deferred<SavedUpdateQuit>>
    finish: ReturnType<typeof deferred<void>>
    timer: ReturnType<typeof setTimeout>
  } | null = null

  constructor(
    private readonly hooks: ShutdownHooks<W>,
    private readonly timeoutMs = 45_000
  ) {}

  pending(window: W): boolean {
    return this.#active?.window === window
  }

  prepare(window: W): Promise<SavedUpdateQuit> {
    if (this.#active) return Promise.reject(new Error('An update is already being prepared.'))
    const ready = deferred<SavedUpdateQuit>()
    const finish = deferred<void>()
    const request = {
      window,
      token: randomUUID(),
      saving: false,
      ready,
      finish,
      timer: setTimeout(() => {
        this.cancel(
          window,
          new Error(
            'Saving before the update timed out. The application remains open; retry after saving.'
          )
        )
      }, this.timeoutMs)
    }
    this.#active = request
    try {
      this.hooks.requestSave(window, request.token)
    } catch (error) {
      this.cancel(window, error instanceof Error ? error : new Error(String(error)))
    }
    return ready.promise
  }

  /** An unrelated window or an old reply can never authorize a newer update. */
  async saved(window: W, token: string, saved: boolean): Promise<void> {
    const request = this.#active
    if (!request || request.window !== window || request.token !== token) return
    if (!saved) {
      this.cancel(window, new Error('Saving was canceled or failed. The application remains open.'))
      return
    }
    if (!request.saving) {
      request.saving = true
      try {
        await this.hooks.drainWrites()
        if (this.#active !== request) return
        const permit: SavedUpdateQuit = {
          quit: () => {
            if (this.#active !== request) throw new Error('The update was canceled before closing.')
            clearTimeout(request.timer)
            this.hooks.allowClose(window)
            request.finish.resolve()
            this.#active = null
            this.hooks.quit()
          },
          abort: (error) => {
            if (this.#active === request) this.cancel(window, error)
            else {
              // A later quit veto / helper timeout must also unlock the surviving window.
              this.hooks.disallowClose(window)
              this.hooks.cancelSave(window, request.token)
            }
          }
        }
        request.ready.resolve(permit)
      } catch (error) {
        if (this.#active === request)
          this.cancel(window, error instanceof Error ? error : new Error(String(error)))
      }
    }
    await request.finish.promise
  }

  cancel(window: W, error: Error): void {
    const request = this.#active
    if (!request || request.window !== window) return
    clearTimeout(request.timer)
    this.#active = null
    this.hooks.disallowClose(window)
    request.ready.reject(error)
    request.finish.reject(error)
    this.hooks.cancelSave(window, request.token)
  }
}
