import { createHash } from 'node:crypto'

/** Only user mutations belong here; background reads, analysis and news downloads never block shutdown. */
export class PendingWrites {
  #seq = 0
  #pending = new Map<number, Promise<unknown>>()
  #tails = new Map<string, Promise<unknown>>()
  #latest = new Map<string, number>()
  #failed = new Map<string, { id: number; work: () => Promise<unknown>; error: unknown }>()

  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const id = ++this.#seq
    const previous = this.#tails.get(key) ?? Promise.resolve()
    const job = previous.catch(() => {}).then(work)
    this.#latest.set(key, id)
    this.#pending.set(id, job)
    this.#tails.set(key, job)
    void job
      .then(
        () => {
          if (this.#latest.get(key) === id) this.#failed.delete(key)
        },
        (error) => {
          if (this.#latest.get(key) === id) this.#failed.set(key, { id, work, error })
        }
      )
      .finally(() => {
        this.#pending.delete(id)
        if (this.#tails.get(key) === job) this.#tails.delete(key)
      })
    return job
  }

  async drain(options: { retryFailed?: boolean } = {}): Promise<void> {
    // Retry only failures already known at this attempt's start. A fresh failure is reported,
    // rather than looping indefinitely or closing a window after silently discarding a write.
    if (options.retryFailed)
      for (const [key, failed] of [...this.#failed]) {
        if (this.#latest.get(key) === failed.id && !this.#tails.has(key))
          void this.run(key, failed.work).catch(() => {})
      }
    while (this.#pending.size) await Promise.allSettled([...this.#pending.values()])
    if (this.#failed.size)
      throw new AggregateError(
        [...this.#failed.values()].map((x) => x.error),
        'Saving articles failed; the window remains open. Retry the save or close again.'
      )
  }
}

/** Identical retries share an identity; different imported bodies must never hide an earlier failure. */
export function articleMutationKey(code: string, operation: string, input: unknown): string {
  return `articles:${code}:${operation}:${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`
}

export const pendingWrites = new PendingWrites()
