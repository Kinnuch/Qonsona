import { describe, expect, it } from 'vitest'
import { SerializedWrites } from '../src/renderer/src/lib/state/persistence'

describe('Learning data write barrier', () => {
  it('waits for a target file before reloading it, without waiting for unrelated files', async () => {
    const queue = new SerializedWrites()
    let release!: () => void
    let releaseOther!: () => void
    const saved = queue.enqueue(
      'courses:en',
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    const other = queue.enqueue(
      'courses:fr',
      () =>
        new Promise<void>((resolve) => {
          releaseOther = resolve
        })
    )
    let loaded = false
    const load = queue.wait('courses:en').then(() => {
      loaded = true
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(loaded).toBe(false)
    release()
    await load
    expect(loaded).toBe(true)
    releaseOther()
    await Promise.all([saved, other])
  })
  it('serializes successive versions of the same file and waits for completion', async () => {
    const queue = new SerializedWrites()
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const versions: number[] = []
    const first = queue.enqueue('notebook:en', async () => {
      await gate
      versions.push(1)
    })
    const second = queue.enqueue('notebook:en', async () => {
      versions.push(2)
    })
    let complete = false
    const barrier = queue.drain().then(() => {
      complete = true
    })
    await Promise.resolve()
    expect(complete).toBe(false)
    expect(versions).toEqual([])
    release()
    await Promise.all([first, second, barrier])
    expect(versions).toEqual([1, 2])
    expect(complete).toBe(true)
  })

  it('allows unrelated files to save concurrently and reports failed writes until a successful retry', async () => {
    const queue = new SerializedWrites()
    const failed = queue.enqueue('stats', async () => {
      throw new Error('disk full')
    })
    await expect(failed).rejects.toThrow('disk full')
    await expect(queue.drain()).rejects.toThrow('Saving learning data failed')
    let saved = false
    await queue.enqueue('courses:fr', async () => {
      saved = true
    })
    expect(saved).toBe(true)
    await queue.enqueue('stats', async () => {})
    await expect(queue.drain()).resolves.toBeUndefined()
  })
})
