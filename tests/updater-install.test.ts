import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  helper: vi.fn(),
  quit: vi.fn()
}))
vi.mock('electron', () => ({
  app: { quit: mocked.quit },
  ipcMain: {
    handle: (name: string, handler: (...args: unknown[]) => Promise<unknown>) =>
      mocked.handlers.set(name, handler)
  },
  net: {},
  shell: { showItemInFolder: vi.fn() }
}))
vi.mock('../src/main/update-handoff', () => ({ prepareWindowsInstaller: mocked.helper }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

let dir: string
let installer: string
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!
beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  mocked.handlers.clear()
  Object.defineProperty(process, 'platform', { ...platform, value: 'win32' })
  dir = await mkdtemp(join(tmpdir(), 'qonsona-install-test-'))
  installer = join(dir, 'installer.exe')
  await writeFile(installer, 'test')
})
afterEach(async () => {
  Object.defineProperty(process, 'platform', platform)
  await rm(dir, { recursive: true, force: true })
})

describe('application update handoff ordering', () => {
  it('starts one helper only after saving, and quits only after its commit acknowledgment', async () => {
    const saved = deferred<{ quit(): void; abort(error: Error): void }>()
    const ready = deferred<{ commit(): Promise<void>; cancel(): void }>()
    const armed = deferred<void>()
    const permit = { quit: vi.fn(), abort: vi.fn() }
    const helper = { commit: vi.fn(() => armed.promise), cancel: vi.fn() }
    mocked.helper.mockReturnValue(ready.promise)
    const prepare = vi.fn(() => saved.promise)
    const { registerUpdater } = await import('../src/main/updater')
    registerUpdater(
      () => null,
      () => dir,
      prepare
    )
    const install = mocked.handlers.get('app:installUpdate')!
    const first = install({}, installer)
    const duplicate = install({}, installer)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(mocked.helper).not.toHaveBeenCalled()
    expect(await install({}, join(dir, 'another.exe'))).toMatchObject({ ok: false })
    saved.resolve(permit)
    await Promise.resolve()
    expect(mocked.helper).toHaveBeenCalledTimes(1)
    expect(permit.quit).not.toHaveBeenCalled()
    ready.resolve(helper)
    await Promise.resolve()
    expect(helper.commit).toHaveBeenCalledTimes(1)
    expect(permit.quit).not.toHaveBeenCalled()
    armed.resolve()
    expect(await first).toEqual({ ok: true })
    expect(await duplicate).toEqual({ ok: true })
    expect(permit.quit).toHaveBeenCalledTimes(1)
    expect(mocked.quit).not.toHaveBeenCalled()
  })

  it('save failure does not launch a helper or close the app', async () => {
    const { registerUpdater } = await import('../src/main/updater')
    registerUpdater(
      () => null,
      () => dir,
      () => Promise.reject(new Error('notebook save failed'))
    )
    expect(await mocked.handlers.get('app:installUpdate')!({}, installer)).toEqual({
      ok: false,
      error: 'notebook save failed'
    })
    expect(mocked.helper).not.toHaveBeenCalled()
    expect(mocked.quit).not.toHaveBeenCalled()
  })

  it('a missing helper aborts the close handshake and makes retry possible', async () => {
    const permit = { quit: vi.fn(), abort: vi.fn() }
    mocked.helper.mockRejectedValueOnce(new Error('system helper unavailable'))
    const helper = { commit: vi.fn(async () => {}), cancel: vi.fn() }
    mocked.helper.mockResolvedValueOnce(helper)
    const { registerUpdater } = await import('../src/main/updater')
    registerUpdater(
      () => null,
      () => dir,
      async () => permit
    )
    const install = mocked.handlers.get('app:installUpdate')!
    expect(await install({}, installer)).toMatchObject({
      ok: false,
      error: 'system helper unavailable'
    })
    expect(permit.abort).toHaveBeenCalledTimes(1)
    expect(permit.quit).not.toHaveBeenCalled()
    expect(await install({}, installer)).toEqual({ ok: true })
    expect(permit.quit).toHaveBeenCalledTimes(1)
  })

  it('failed commit cancels the external helper before preserving the app', async () => {
    const permit = { quit: vi.fn(), abort: vi.fn() }
    const helper = {
      commit: vi.fn(async () => {
        throw new Error('acknowledgment timed out')
      }),
      cancel: vi.fn()
    }
    mocked.helper.mockResolvedValue(helper)
    const { registerUpdater } = await import('../src/main/updater')
    registerUpdater(
      () => null,
      () => dir,
      async () => permit
    )
    expect(await mocked.handlers.get('app:installUpdate')!({}, installer)).toMatchObject({
      ok: false,
      error: 'acknowledgment timed out'
    })
    expect(helper.cancel).toHaveBeenCalledTimes(1)
    expect(permit.abort).toHaveBeenCalledTimes(1)
    expect(permit.quit).not.toHaveBeenCalled()
  })
})
