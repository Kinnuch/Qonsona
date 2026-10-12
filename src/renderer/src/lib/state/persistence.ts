/** Serialize writes to each data file and expose a real completion barrier for exports/imports. */
export class SerializedWrites {
  #pending = new Map<string, Promise<void>>()
  #failures = new Map<string, unknown>()

  enqueue(key: string, write: () => Promise<unknown>): Promise<void> {
    const previous = this.#pending.get(key) ?? Promise.resolve()
    const job = previous
      .catch(() => {})
      .then(async () => {
        await write()
      })
    this.#pending.set(key, job)
    void job
      .then(
        () => {
          this.#failures.delete(key)
        },
        (error) => {
          this.#failures.set(key, error)
        }
      )
      .finally(() => {
        if (this.#pending.get(key) === job) this.#pending.delete(key)
      })
    return job
  }

  async drain(): Promise<void> {
    while (this.#pending.size) await Promise.allSettled([...this.#pending.values()])
    if (this.#failures.size)
      throw new AggregateError([...this.#failures.values()], 'Saving learning data failed')
  }

  /** Wait before reading a file that may still have a newer version queued. */
  async wait(key: string): Promise<void> {
    while (this.#pending.has(key)) await this.#pending.get(key)
    if (this.#failures.has(key)) throw this.#failures.get(key)
  }
}

export const serializedWrites = new SerializedWrites()
