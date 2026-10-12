import { Worker } from 'node:worker_threads'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import type { LangCode, LexAnalysis } from '../../shared/lang/types'

export class AnalysisClient {
  #worker: Worker | null = null
  #seq = 0
  #pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()
  #cache = new Map<string, Promise<unknown>>()
  #inflight = new Map<string, Promise<unknown>>()
  constructor(readonly workerFile = join(__dirname, 'analysis-worker.js')) {}

  #start(): Worker {
    if (this.#worker) return this.#worker
    const worker = new Worker(this.workerFile)
    this.#worker = worker
    worker.unref()
    worker.on('message', (response: { id: number; value?: unknown; error?: string }) => {
      const job = this.#pending.get(response.id)
      if (!job) return
      this.#pending.delete(response.id)
      if (response.error) job.reject(new Error(response.error))
      else job.resolve(response.value)
    })
    const failed = (error: Error): void => {
      if (this.#worker !== worker) return
      this.#worker = null
      for (const job of this.#pending.values()) job.reject(error)
      this.#pending.clear()
      this.#cache.clear()
      this.#inflight.clear()
    }
    worker.on('error', failed)
    worker.on('exit', (code) => failed(new Error(`Analysis worker exited (${code})`)))
    return worker
  }

  request(code: LangCode, file: string, text: string, kind: 'analyze'): Promise<LexAnalysis>
  request(code: LangCode, file: string, text: string, kind: 'level'): Promise<string | null>
  request(code: LangCode, file: string, text: string, kind: 'analyze' | 'level'): Promise<unknown> {
    if (kind === 'level') text = text.slice(0, 12_000)
    const key = `${kind}:${code}:${file}:${createHash('sha256').update(text).digest('hex')}`
    const cached = this.#cache.get(key) ?? this.#inflight.get(key)
    if (cached) return cached
    const job = new Promise<unknown>((resolve, reject) => {
      const id = ++this.#seq
      this.#pending.set(id, { resolve, reject })
      try {
        this.#start().postMessage({ id, code, file, kind, text })
      } catch (error) {
        this.#pending.delete(id)
        reject(error)
      }
    })
    this.#inflight.set(key, job)
    void job
      .finally(() => {
        this.#inflight.delete(key)
      })
      .catch(() => {})
    if (kind === 'level' || text.length <= 30_000) this.#cache.set(key, job)
    while (this.#cache.size > 16) this.#cache.delete(this.#cache.keys().next().value!)
    void job.catch(() => {
      if (this.#cache.get(key) === job) this.#cache.delete(key)
    })
    return job
  }

  dispose(): void {
    const worker = this.#worker
    this.#worker = null
    for (const job of this.#pending.values()) job.reject(new Error('Analysis client closed'))
    this.#pending.clear()
    this.#cache.clear()
    this.#inflight.clear()
    if (worker) void worker.terminate()
  }
}

export const analysisClient = new AnalysisClient()
