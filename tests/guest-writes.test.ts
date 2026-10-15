import { describe, expect, it } from 'vitest'
import { trackGuestWrite } from '../src/main/guest-writes'
import { GuestCollectionError } from '../src/main/guest-collection'
import { pendingWrites } from '../src/main/pending-writes'

describe('guest writes in the close barrier', () => {
  it('does not retain expected claim refusals as failed saves that prevent closing', async () => {
    for (const code of [
      'LOGIN_REQUIRED',
      'INVALID_STARTER',
      'GUEST_ALREADY_BOUND',
      'GUEST_STATE_INVALID'
    ] as const) {
      await expect(
        trackGuestWrite('semantic-' + code, async () => {
          throw new GuestCollectionError(code)
        })
      ).rejects.toThrow(code)
      await expect(pendingWrites.drain({ retryFailed: true })).resolves.toBeUndefined()
    }
  })
  it('waits for an actual delayed write before allowing close', async () => {
    let finish!: () => void
    const barrier = new Promise<void>((resolve) => {
      finish = resolve
    })
    const operation = trackGuestWrite('delayed-claim', async () => {
      await barrier
      return 'saved'
    })
    let drained = false
    const closing = pendingWrites.drain().then(() => {
      drained = true
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(drained).toBe(false)
    finish()
    expect(await operation).toBe('saved')
    await closing
    expect(drained).toBe(true)
  })
  it('retains and retries a real persistence failure', async () => {
    let attempts = 0
    await expect(
      trackGuestWrite('retry-claim', async () => {
        if (++attempts === 1) throw new GuestCollectionError('GUEST_STATE_UNAVAILABLE')
        return 'saved'
      })
    ).rejects.toThrow('GUEST_STATE_UNAVAILABLE')
    await expect(pendingWrites.drain({ retryFailed: true })).resolves.toBeUndefined()
    expect(attempts).toBe(2)
  })
})
