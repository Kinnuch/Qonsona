import { describe, expect, it, vi } from 'vitest'
import { UpdateShutdown } from '../src/main/update-shutdown'
import { PendingWrites } from '../src/main/pending-writes'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function fixture(timeout = 45_000) {
  const writes = new PendingWrites()
  const order: string[] = []
  const tokens: string[] = []
  const window = {}
  const closing = new Set<object>()
  const shutdown = new UpdateShutdown<object>(
    {
      requestSave: (_window, token) => {
        tokens.push(token)
        order.push('renderer-request')
      },
      cancelSave: (_window, token) => {
        order.push(`cancel:${token}`)
      },
      drainWrites: async () => {
        order.push('main-drain')
        await writes.drain({ retryFailed: true })
        order.push('main-saved')
      },
      allowClose: (window) => {
        closing.add(window)
        order.push('allow-close')
      },
      disallowClose: (window) => {
        closing.delete(window)
      },
      quit: () => {
        order.push('quit')
      }
    },
    timeout
  )
  return { shutdown, writes, window, closing, order, tokens }
}

describe('saved update shutdown', () => {
  it('keeps the application open through both renderer and real main-write barriers, and until handoff commit', async () => {
    const { shutdown, writes, window, closing, order, tokens } = fixture()
    const disk = deferred()
    const writing = writes.run('article', () => disk.promise)
    const preparing = shutdown.prepare(window)
    let ready = false
    void preparing.then(() => {
      ready = true
    })
    await Promise.resolve()
    expect(order).toEqual(['renderer-request'])
    const acknowledged = shutdown.saved(window, tokens[0], true)
    await Promise.resolve()
    expect(order).toEqual(['renderer-request', 'main-drain'])
    expect(ready).toBe(false)
    expect(closing.has(window)).toBe(false)
    disk.resolve()
    await writing
    const permit = await preparing
    expect(order).toEqual(['renderer-request', 'main-drain', 'main-saved'])
    expect(closing.has(window)).toBe(false)
    permit.quit()
    await acknowledged
    expect(order.slice(-2)).toEqual(['allow-close', 'quit'])
  })

  it('does not authorize a helper when renderer saving fails or is canceled', async () => {
    const { shutdown, window, order, tokens } = fixture()
    const preparing = shutdown.prepare(window)
    await shutdown.saved(window, tokens[0], false)
    await expect(preparing).rejects.toThrow('canceled or failed')
    expect(order).toEqual(['renderer-request', `cancel:${tokens[0]}`])
    expect(shutdown.pending(window)).toBe(false)
  })

  it('a new disk failure leaves the window and failed mutation intact', async () => {
    const { shutdown, writes, window, closing, tokens } = fixture()
    const disk = deferred()
    const job = writes.run('article', async () => {
      await disk.promise
      throw new Error('disk full')
    })
    void job.catch(() => {})
    const preparing = shutdown.prepare(window)
    const acknowledged = shutdown.saved(window, tokens[0], true)
    disk.resolve()
    await expect(preparing).rejects.toThrow('Saving articles failed')
    await expect(acknowledged).rejects.toThrow('Saving articles failed')
    await expect(writes.drain()).rejects.toThrow('Saving articles failed')
    expect(closing.has(window)).toBe(false)
  })

  it('helper failure rejects the waiting close-ready response and allows a fresh retry', async () => {
    const { shutdown, window, closing, tokens } = fixture()
    const first = shutdown.prepare(window)
    const acknowledged = shutdown.saved(window, tokens[0], true)
    const permit = await first
    permit.abort(new Error('PowerShell unavailable'))
    await expect(acknowledged).rejects.toThrow('PowerShell unavailable')
    expect(closing.has(window)).toBe(false)
    const next = shutdown.prepare(window)
    expect(tokens[1]).not.toBe(tokens[0])
    await shutdown.saved(window, tokens[0], true)
    await shutdown.saved({}, tokens[1], true)
    expect(shutdown.pending(window)).toBe(true)
    await shutdown.saved(window, tokens[1], false)
    await expect(next).rejects.toThrow('canceled')
  })

  it('a canceled request late disk failure cannot cancel a newer save and successful quit', async () => {
    const { shutdown, writes, window, closing, order, tokens } = fixture()
    const disk = deferred()
    let attempts = 0
    const writing = writes.run('article', async () => {
      if (++attempts === 1) await disk.promise
    })
    const diskRejected = expect(writing).rejects.toThrow('old disk write failed')
    const first = shutdown.prepare(window)
    const firstRejected = expect(first).rejects.toThrow('first update canceled')
    const firstAcknowledged = shutdown.saved(window, tokens[0], true)
    const firstAckRejected = expect(firstAcknowledged).rejects.toThrow('first update canceled')
    await Promise.resolve()
    expect(order).toContain('main-drain')

    shutdown.cancel(window, new Error('first update canceled'))
    const second = shutdown.prepare(window)
    expect(shutdown.pending(window)).toBe(true)
    disk.reject(new Error('old disk write failed'))
    await diskRejected
    await firstRejected
    await firstAckRejected

    expect(shutdown.pending(window)).toBe(true)
    expect(order.filter((event) => event.startsWith('cancel:'))).toEqual([`cancel:${tokens[0]}`])
    const secondAcknowledged = shutdown.saved(window, tokens[1], true)
    const permit = await second
    expect(attempts).toBe(2)
    permit.quit()
    await secondAcknowledged
    expect(closing.has(window)).toBe(true)
    expect(order.slice(-2)).toEqual(['allow-close', 'quit'])
  })

  it('concurrent requests cannot create a second save transaction or accept a stale reply', async () => {
    const { shutdown, window, tokens } = fixture()
    const first = shutdown.prepare(window)
    await expect(shutdown.prepare(window)).rejects.toThrow('already being prepared')
    expect(tokens).toHaveLength(1)
    await shutdown.saved(window, 'old-token', true)
    expect(shutdown.pending(window)).toBe(true)
    await shutdown.saved(window, tokens[0], false)
    await expect(first).rejects.toThrow('canceled')
  })

  it('bounds an unresponsive save without closing the app, and ignores the late acknowledgment', async () => {
    vi.useFakeTimers()
    try {
      const { shutdown, window, order, tokens } = fixture(100)
      const first = shutdown.prepare(window)
      const failed = expect(first).rejects.toThrow('timed out')
      await vi.advanceTimersByTimeAsync(100)
      await failed
      await shutdown.saved(window, tokens[0], true)
      expect(order).toEqual(['renderer-request', `cancel:${tokens[0]}`])
      const retry = shutdown.prepare(window)
      await shutdown.saved(window, tokens[0], true)
      await shutdown.saved(window, tokens[1], false)
      await expect(retry).rejects.toThrow('canceled')
    } finally {
      vi.useRealTimers()
    }
  })
})
