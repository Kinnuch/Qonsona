import { afterEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { LangArticleStore } from '../../src/main/lang/articles'

const deferred = <T = void>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const directories: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  for (const dir of directories.splice(0)) await fs.rm(dir, { recursive: true, force: true })
})
const setup = async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'qonsona-article-state-'))
  directories.push(dir)
  return {
    dir,
    file: join(dir, 'state.json'),
    store: new LangArticleStore('en', dir, [], [], () => 'B1')
  }
}

describe('article state concurrency and atomic commits', () => {
  it('a late first-load response cannot overwrite read marks already added to the first state object', async () => {
    const { store, file } = await setup()
    const original = JSON.stringify({ read: { existing: '2026-10-01T00:00:00.000Z' }, levels: {} })
    await fs.writeFile(file, original)
    const firstRead = deferred<string>(),
      secondRead = deferred<string>()
    const readFile = fs.readFile.bind(fs)
    let reads = 0
    vi.spyOn(fs, 'readFile').mockImplementation((path, options) => {
      if (String(path) === file)
        return (++reads === 1 ? firstRead.promise : secondRead.promise) as ReturnType<
          typeof fs.readFile
        >
      return readFile(path, options)
    })
    const first = store.markRead('first', true)
    const second = store.markRead('second', true)
    expect(reads).toBe(2)
    firstRead.resolve(original)
    await first
    secondRead.resolve(original)
    await second
    const state = JSON.parse(await readFile(file, 'utf8'))
    expect(Object.keys(state.read).sort()).toEqual(['existing', 'first', 'second'])
  })

  it('a later state snapshot waits for the earlier disk write and wins on disk', async () => {
    const { store, file, dir } = await setup()
    await store.markRead('existing', true)
    const firstDiskWrite = deferred(),
      started = deferred()
    const writeFile = fs.writeFile.bind(fs),
      mkdir = fs.mkdir.bind(fs)
    let secondStarted = false
    vi.spyOn(fs, 'mkdir').mockImplementation((path, options) => {
      if (String(path) === dir) return Promise.resolve(undefined) as ReturnType<typeof fs.mkdir>
      return mkdir(path, options)
    })
    vi.spyOn(fs, 'writeFile').mockImplementation(async (path, data, options) => {
      if (String(path) === file || String(path) === file + '.tmp') {
        const text = String(data)
        if (text.includes('"first"') && !text.includes('"second"')) {
          started.resolve()
          await firstDiskWrite.promise
        }
        if (text.includes('"second"')) secondStarted = true
      }
      await writeFile(path, data, options)
    })
    const first = store.markRead('first', true)
    await started.promise
    const second = store.markRead('second', true)
    // Drain microtasks without relying on filesystem speed or a wall-clock sleep.
    for (let i = 0; i < 8; i++) await Promise.resolve()
    expect(secondStarted).toBe(false)
    firstDiskWrite.resolve()
    await Promise.all([first, second])
    expect(secondStarted).toBe(true)
    const state = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(Object.keys(state.read).sort()).toEqual(['existing', 'first', 'second'])
    expect((await fs.readdir(dir)).filter((x) => x.endsWith('.tmp'))).toEqual([])
  })

  it('a failed commit leaves valid old JSON and does not poison later state writes', async () => {
    const { store, file } = await setup()
    await store.markRead('existing', true)
    const before = await fs.readFile(file, 'utf8')
    const writeFile = fs.writeFile.bind(fs)
    let fail = true
    vi.spyOn(fs, 'writeFile').mockImplementation(async (path, data, options) => {
      if (String(path) === file + '.tmp' && fail) {
        fail = false
        throw new Error('temporary write failed')
      }
      await writeFile(path, data, options)
    })
    await expect(store.markRead('first', true)).rejects.toThrow('temporary write failed')
    expect(await fs.readFile(file, 'utf8')).toBe(before)
    await store.markRead('second', true)
    const state = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(Object.keys(state.read).sort()).toEqual(['existing', 'first', 'second'])
  })

  it('a delayed lexical profile preserves a read mark saved while analysis is pending', async () => {
    const { dir, file } = await setup()
    const started = deferred(),
      profile = deferred<string | null>()
    const store = new LangArticleStore('en', dir, [], [], () => {
      started.resolve()
      return profile.promise
    })
    const item = await store.save({
      title: 'Concurrent profile',
      body: 'This original text is safely saved before profiling.'
    })
    const listing = store.list()
    await started.promise
    await store.markRead(item.id, true)
    profile.resolve('B1')
    await listing
    const state = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(state.read[item.id]).toBeTruthy()
    expect(state.levels[item.id]).toBe('B1')
    expect((await store.get(item.id))?.readAt).toBe(state.read[item.id])
  })
})
