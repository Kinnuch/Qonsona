import { describe, expect, it, vi } from 'vitest'
import { syncGuestStarter } from '../src/main/guest-starter-sync'
import type { AccountClient } from '../src/main/account-client'
import type { GuestCollection } from '../src/main/guest-collection'
import type { AccountSession } from '../src/shared/account'
import type { GuestCollectionState } from '../src/shared/guest-collection'

function fixture() {
  const session: AccountSession = {
    user: {
      id: 'account-a',
      username: 'a',
      nickname: 'A',
      publicId: 'public-a',
      publicCollection: true,
      publicTime: true,
      createdAt: 1
    },
    server: { baseUrl: 'http://127.0.0.1/v1', online: true, testcap: false }
  }
  const starter = { characterId: 'companion-1', claimedAt: 1800000000000 }
  const guest = {
    session: vi.fn(async () => ({ starter }) as GuestCollectionState),
    bind: vi.fn(async () => ({ starter }) as GuestCollectionState)
  }
  const latest = { ...session, snapshot: { revision: 8 } }
  const client = {
    request: vi.fn(async () => ({ characterId: starter.characterId })),
    session: vi.fn(async () => latest)
  }
  const sync = (value = session) =>
    syncGuestStarter(
      client as unknown as Pick<AccountClient, 'request' | 'session'>,
      guest as Pick<GuestCollection, 'session' | 'bind'>,
      value
    )
  return { session, starter, guest, client, latest, sync }
}
describe('first companion account handoff', () => {
  it('binds only after a confirmed cloud response and returns the newest snapshot', async () => {
    const f = fixture()
    expect(await f.sync()).toBe(f.latest)
    expect(f.client.request).toHaveBeenCalledWith('claimStarter', {
      requestId: 'guest-starter:1800000000000:companion-1',
      characterId: 'companion-1'
    })
    expect(f.guest.bind).toHaveBeenCalledWith('account-a')
    expect(f.client.request.mock.invocationCallOrder[0]).toBeLessThan(
      f.guest.bind.mock.invocationCallOrder[0]
    )
  })
  it('does not bind an unknown transaction and retries with the same request identity', async () => {
    const f = fixture()
    f.client.request.mockRejectedValueOnce(new Error('SERVICE_UNAVAILABLE'))
    const failed = await f.sync()
    expect(failed.user).toBe(f.session.user)
    expect(failed.starterSync).toBe('pending')
    expect(failed.server.online).toBe(false)
    expect(f.guest.bind).not.toHaveBeenCalled()
    await f.sync()
    expect(f.client.request.mock.calls[0]).toEqual(f.client.request.mock.calls[1])
    expect(f.guest.bind).toHaveBeenCalledTimes(1)
  })
  it('keeps a local binding failure recoverable without failing login', async () => {
    const f = fixture()
    f.guest.bind.mockRejectedValueOnce(new Error('GUEST_STATE_UNAVAILABLE'))
    const failed = await f.sync()
    expect(failed.starterSync).toBe('pending')
    expect(failed.user?.id).toBe('account-a')
    await f.sync()
    expect(f.client.request.mock.calls[0]).toEqual(f.client.request.mock.calls[1])
  })
  it('does not transfer a local starter already bound to another account', async () => {
    const f = fixture()
    f.guest.session.mockResolvedValueOnce({
      starter: { ...f.starter, claimedBy: 'account-b' }
    } as GuestCollectionState)
    expect(await f.sync()).toBe(f.session)
    expect(f.client.request).not.toHaveBeenCalled()
    expect(f.guest.bind).not.toHaveBeenCalled()
  })
  it('does not resurrect a revoked identity if the cloud claim returns unauthorized', async () => {
    const f = fixture()
    f.client.request.mockRejectedValueOnce(new Error('UNAUTHORIZED: Session expired'))
    f.client.session.mockResolvedValueOnce({ ...f.session, user: null } as never)
    const current = await f.sync()
    expect(current.user).toBeNull()
    expect(current.starterSync).toBeUndefined()
    expect(f.guest.bind).not.toHaveBeenCalled()
  })
  it('performs no cloud claim for a signed-out or offline session', async () => {
    const f = fixture()
    await f.sync({ ...f.session, user: null })
    await f.sync({ ...f.session, server: { ...f.session.server, online: false } })
    expect(f.guest.session).not.toHaveBeenCalled()
    expect(f.client.request).not.toHaveBeenCalled()
  })
  it('leaves a new local profile unbound until a first companion exists', async () => {
    const f = fixture()
    f.guest.session.mockResolvedValueOnce({ starter: null } as GuestCollectionState)
    expect(await f.sync()).toBe(f.session)
    expect(f.client.request).not.toHaveBeenCalled()
  })
})
