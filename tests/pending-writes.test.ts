import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PendingWrites, articleMutationKey } from '../src/main/pending-writes'
import { LangArticleStore } from '../src/main/lang/articles'

const deferred = <T = void>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('main-process user mutation close/export barrier', () => {
  it('does not allow close before an already-started write finishes', async () => {
    const writes = new PendingWrites(),
      disk = deferred()
    const job = writes.run('translation', () => disk.promise)
    let closed = false
    const closing = writes.drain().then(() => {
      closed = true
    })
    await Promise.resolve()
    expect(closed).toBe(false)
    disk.resolve()
    await job
    await closing
    expect(closed).toBe(true)
  })
  it('also waits for user mutations started while a preceding write is draining', async () => {
    const writes = new PendingWrites(),
      first = deferred(),
      second = deferred()
    const one = writes.run('one', () => first.promise)
    let done = false
    const drain = writes.drain().then(() => {
      done = true
    })
    const two = writes.run('two', () => second.promise)
    first.resolve()
    await one
    expect(done).toBe(false)
    second.resolve()
    await two
    await drain
    expect(done).toBe(true)
  })
  it('reports failure and makes the next close retry the failed mutation', async () => {
    const writes = new PendingWrites()
    let attempts = 0
    await expect(
      writes.run('read-mark', async () => {
        if (++attempts === 1) throw new Error('disk full')
        return 'saved'
      })
    ).rejects.toThrow('disk full')
    await expect(writes.drain()).rejects.toThrow('Saving articles failed')
    await writes.drain({ retryFailed: true })
    expect(attempts).toBe(2)
    await writes.drain()
  })
  it('a failure during this close is not silently retried or discarded', async () => {
    const writes = new PendingWrites(),
      disk = deferred()
    const job = writes.run('article', () => disk.promise)
    const caught = job.catch(() => {})
    const closing = writes.drain({ retryFailed: true })
    disk.reject(new Error('rename failed'))
    await caught
    await expect(closing).rejects.toThrow('Saving articles failed')
  })
  it('serialises mutations of the same target and keeps the newer intent', async () => {
    const writes = new PendingWrites(),
      first = deferred()
    const order: string[] = []
    const one = writes.run('translation', async () => {
      order.push('old')
      await first.promise
      throw new Error('old failed')
    })
    const caught = one.catch(() => {})
    const two = writes.run('translation', async () => {
      order.push('new')
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual(['old'])
    first.resolve()
    await caught
    await two
    await writes.drain({ retryFailed: true })
    expect(order).toEqual(['old', 'new'])
  })
  it('different imported texts cannot conceal a previous failed import', async () => {
    const writes = new PendingWrites()
    const first = articleMutationKey('en', 'save', { body: 'first' })
    const second = articleMutationKey('en', 'save', { body: 'second' })
    expect(first).not.toBe(second)
    await expect(
      writes.run(first, async () => {
        throw new Error('first failed')
      })
    ).rejects.toThrow()
    await writes.run(second, async () => 'second saved')
    await expect(writes.drain()).rejects.toThrow('Saving articles failed')
  })
  it('unregistered reads or background analysis do not block the user-write barrier', async () => {
    const writes = new PendingWrites(),
      analysis = deferred()
    let finished = false
    void analysis.promise.then(() => {
      finished = true
    })
    await writes.run('user', async () => {})
    await writes.drain()
    expect(finished).toBe(false)
    analysis.resolve()
  })
  it('commits imported prose even when the optional analyser never resolves', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qonsona-article-barrier-'))
    const level = deferred<string | null>()
    let requested = false
    const store = new LangArticleStore('en', dir, [], [], () => {
      requested = true
      return level.promise
    })
    try {
      const saved = await store.save({
        title: 'Keep this prose',
        body: 'The original text must survive closing the application.'
      })
      expect(requested).toBe(false)
      expect(saved.level).toBeNull()
      const disk = JSON.parse(await readFile(join(dir, 'user', `${saved.id}.json`), 'utf8'))
      expect(disk.body).toBe('The original text must survive closing the application.')
      expect((await readdir(join(dir, 'user'))).filter((x) => x.endsWith('.tmp'))).toEqual([])
    } finally {
      level.resolve('A1')
      await rm(dir, { recursive: true, force: true })
    }
  })
  it('concurrent distinct imports cannot share an ID or overwrite the same temporary file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qonsona-concurrent-import-'))
    const store = new LangArticleStore('en', dir, [], [], () => null)
    try {
      const imported = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          store.save({ title: `Text ${i}`, body: `Distinct original text ${i}.` })
        )
      )
      expect(new Set(imported.map((x) => x.id)).size).toBe(12)
      expect((await readdir(join(dir, 'user'))).filter((x) => x.endsWith('.json'))).toHaveLength(12)
      for (const [i, item] of imported.entries()) {
        const actual = JSON.parse(await readFile(join(dir, 'user', `${item.id}.json`), 'utf8'))
        expect(actual.body).toBe(`Distinct original text ${i}.`)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
  it('get exposes the level later cached by list without delaying the original import', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qonsona-lazy-import-level-'))
    const store = new LangArticleStore('en', dir, [], [], () => 'B1')
    try {
      const imported = await store.save({
        title: 'Later profiling',
        body: 'Read and classify this safely saved text.'
      })
      expect(imported.level).toBeNull()
      expect((await store.list()).find((x) => x.id === imported.id)?.level).toBe('B1')
      expect((await store.get(imported.id))?.level).toBe('B1')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
