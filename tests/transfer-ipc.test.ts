import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emptyNotebook, addCards } from '../src/shared/notebook'
import { registerTransferIpc, applyPendingTransfer } from '../src/main/transfer'
import { pendingWrites } from '../src/main/pending-writes'
import type { TransferBundle } from '../src/shared/transfer'

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  root: '',
  file: '',
  exit: vi.fn(),
  relaunch: vi.fn()
}))
vi.mock('electron', () => ({
  app: {
    getPath: (kind: string) => (kind === 'userData' ? mocked.root : mocked.root),
    getVersion: () => 'test',
    exit: mocked.exit,
    relaunch: mocked.relaunch
  },
  ipcMain: {
    handle: (name: string, fn: (...args: unknown[]) => unknown) => mocked.handlers.set(name, fn)
  },
  BrowserWindow: { fromWebContents: () => null },
  dialog: {
    showOpenDialog: async () => ({ canceled: false, filePaths: [mocked.file] }),
    showSaveDialog: async () => ({ canceled: false, filePath: mocked.file })
  }
}))
const event = (id = 10) => ({ sender: { id } })
const call = (name: string, ...args: unknown[]) =>
  Promise.resolve(mocked.handlers.get(name)!(...args))
const nb = () => {
  const n = emptyNotebook(10)
  addCards(
    n,
    'mine',
    [{ key: 'ja-1', front: '本', reading: 'ほん', meaning: { zh: '书', en: 'book' } }],
    10
  )
  return n
}
const bundle = (): TransferBundle => ({
  app: 'qonsona-transfer',
  format: 1,
  scope: 'notebook',
  appVersion: 'test',
  createdAt: '2026-10-12T00:00:00Z',
  packs: [{ id: 'ja', name: 'Japanese', kind: 'builtin' }],
  files: [{ path: 'notebook/ja.json', content: nb() }]
})
beforeEach(async () => {
  mocked.root = await fs.mkdtemp(join(tmpdir(), 'qonsona-transfer-ipc-'))
  mocked.file = join(mocked.root, 'import.json')
  mocked.handlers.clear()
  vi.clearAllMocks()
  await fs.writeFile(mocked.file, JSON.stringify(bundle()))
  await registerTransferIpc()
})
afterEach(async () => {
  await fs.rm(mocked.root, { recursive: true, force: true })
})

describe('transfer IPC and preview tokens', () => {
  it('waits for in-flight main-process user writes before exporting', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const write = pendingWrites.run('transfer-test:notebook', async () => {
      await gate
      const content = nb()
      content.cards['ja-1'].front = 'Latest pending write'
      await fs.mkdir(join(mocked.root, 'notebook'), { recursive: true })
      await fs.writeFile(join(mocked.root, 'notebook/ja.json'), JSON.stringify(content))
    })
    let completed = false
    const exporting = call('transfer:export', event(), 'notebook', 'ja').then((result) => {
      completed = true
      return result
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(completed).toBe(false)
    release()
    await write
    await exporting
    const exported = JSON.parse(await fs.readFile(mocked.file, 'utf8'))
    expect(exported.files[0].content.cards['ja-1'].front).toBe('Latest pending write')
  })
  it('rejects a notebook for a different active language', async () => {
    await expect(call('transfer:pick', event(), 'notebook', 'es')).rejects.toThrow(/language/)
    expect(mocked.exit).not.toHaveBeenCalled()
  })
  it('does not mutate local data during preview and rejects another sender', async () => {
    const preview = (await call('transfer:pick', event(), 'notebook', 'ja')) as { token: string }
    await expect(fs.access(join(mocked.root, 'notebook/ja.json'))).rejects.toThrow()
    await expect(call('transfer:apply', event(20), preview.token)).rejects.toThrow(/expired/)
    expect(mocked.exit).not.toHaveBeenCalled()
  })
  it('rejects a file modified after its preview', async () => {
    const preview = (await call('transfer:pick', event(), 'notebook', 'ja')) as { token: string }
    await fs.appendFile(mocked.file, '\n')
    await expect(call('transfer:apply', event(), preview.token)).rejects.toThrow(/changed/)
    expect(mocked.relaunch).not.toHaveBeenCalled()
  })
  it('cancelled tokens cannot be applied', async () => {
    const preview = (await call('transfer:pick', event(), 'notebook', 'ja')) as { token: string }
    await call('transfer:cancel', event(), preview.token)
    await expect(call('transfer:apply', event(), preview.token)).rejects.toThrow(/expired/)
  })
  it('confirmation stages data and relaunches; data takes effect on startup', async () => {
    const preview = (await call('transfer:pick', event(), 'notebook', 'ja')) as { token: string }
    await call('transfer:apply', event(), preview.token)
    expect(mocked.relaunch).toHaveBeenCalledOnce()
    expect(mocked.exit).toHaveBeenCalledWith(0)
    await expect(fs.access(join(mocked.root, 'notebook/ja.json'))).rejects.toThrow()
    expect(await applyPendingTransfer(mocked.root)).toMatchObject({ files: 1 })
    expect(
      JSON.parse(await fs.readFile(join(mocked.root, 'notebook/ja.json'), 'utf8')).cards['ja-1']
        .front
    ).toBe('本')
    await expect(call('transfer:apply', event(), preview.token)).rejects.toThrow(/expired/)
  })
})
