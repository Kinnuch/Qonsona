import { describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron'
import { accountBase, ACCOUNT_API } from '../src/main/account-client'
import {
  guardIpcHandlers,
  rendererEntryUrl,
  safeExternalUrl,
  secureRendererContents,
  trustedIpcSender,
  trustedRendererUrl
} from '../src/main/renderer-security'
import { IPC_EVENT_CHANNELS, IPC_INVOKE_CHANNELS } from '../src/shared/ipc-security'
import { mdToHtml } from '../src/renderer/src/vendor/qonlang/core/markdown'

const entry = 'file:///C:/synthetic-app/out/renderer/index.html'
function sourceContents() {
  const frame = { url: entry }
  const listeners = new Map<string, (event: unknown) => void>()
  const contents = {
    mainFrame: frame,
    isDestroyed: vi.fn(() => false),
    on: vi.fn((event: string, listener: (event: unknown) => void) =>
      listeners.set(event, listener)
    ),
    setWindowOpenHandler: vi.fn()
  }
  const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent
  return { contents: contents as unknown as WebContents, frame, event, listeners }
}

describe('payment client final security boundaries', () => {
  it('pins packaged account traffic to the fixed HTTPS API regardless of environment overrides', () => {
    for (const value of [
      'http://attacker.invalid/v1',
      'https://attacker.invalid/v1',
      'http://127.0.0.1:1/v1'
    ])
      expect(accountBase(true, value)).toBe(ACCOUNT_API)
    for (const value of [
      'http://kinnuch.cn/v1',
      'https://kinnuch.cn.attacker.invalid/v1',
      'https://kinnuch.cn@attacker.invalid/v1'
    ])
      expect(() => accountBase(false, value)).toThrow('INVALID_API_BASE')
  })

  it('requires the exact renderer entry, permits app hashes, and rejects same-origin sibling files and query changes', () => {
    expect(rendererEntryUrl(entry)).toBe(entry)
    expect(rendererEntryUrl(entry, 'http://127.0.0.1:5173/')).toBe('http://127.0.0.1:5173/')
    for (const value of [
      'https://attacker.invalid/',
      'http://localhost.attacker.invalid/',
      'http://user@localhost:5173/',
      'file:///tmp/attacker.html'
    ])
      expect(() => rendererEntryUrl(entry, value)).toThrow('INVALID_RENDERER_ENTRY')
    expect(trustedRendererUrl(entry + '#collection', entry)).toBe(true)
    for (const value of [
      entry + '?changed=1',
      entry.replace('index.html', 'attacker.html'),
      'about:blank',
      'data:text/html,hello',
      'https://attacker.invalid/'
    ])
      expect(trustedRendererUrl(value, entry)).toBe(false)
  })

  it('requires the current main window, its main frame, and the trusted frame URL before and after IPC work', async () => {
    const f = sourceContents()
    expect(trustedIpcSender(f.event, f.contents, entry)).toBe(true)
    const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
    const ipc = {
      handle: (name: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) =>
        handlers.set(name, handler)
    } as Pick<IpcMain, 'handle'>
    guardIpcHandlers(ipc, () => f.contents, entry)
    const work = vi.fn(async () => ({ user: { id: 'synthetic' } }))
    ipc.handle('account:session', work)
    const invoke = handlers.get('account:session')!
    await expect(invoke(f.event)).resolves.toEqual({ user: { id: 'synthetic' } })
    const attempts = [
      { ...f.event, sender: sourceContents().contents },
      { ...f.event, senderFrame: { url: entry } },
      { ...f.event, senderFrame: null }
    ]
    for (const event of attempts)
      await expect(invoke(event as IpcMainInvokeEvent)).rejects.toThrow('UNTRUSTED_IPC_SENDER')
    f.frame.url = 'https://attacker.invalid/'
    await expect(invoke(f.event)).rejects.toThrow('UNTRUSTED_IPC_SENDER')
    expect(work).toHaveBeenCalledTimes(1)
    f.frame.url = entry
    work.mockImplementationOnce(async () => {
      f.frame.url = 'https://attacker.invalid/'
      return { user: { id: 'synthetic' } }
    })
    await expect(invoke(f.event)).rejects.toThrow('UNTRUSTED_IPC_SENDER')
    expect(() => ipc.handle('new:unreviewed', work)).toThrow('INVALID_IPC_CHANNEL')
  })

  it('blocks top-level navigation, remote or local subframes, and webviews while retaining app hash navigation', () => {
    const f = sourceContents()
    secureRendererContents(
      f.contents,
      entry,
      vi.fn(async () => {})
    )
    for (const name of ['will-navigate', 'will-redirect', 'will-frame-navigate']) {
      const preventDefault = vi.fn()
      f.listeners.get(name)!({
        url: 'https://attacker.invalid/',
        isMainFrame: true,
        preventDefault
      })
      expect(preventDefault).toHaveBeenCalledOnce()
      preventDefault.mockClear()
      f.listeners.get(name)!({ url: entry + '#collection', isMainFrame: true, preventDefault })
      expect(preventDefault).not.toHaveBeenCalled()
    }
    const preventDefault = vi.fn()
    f.listeners.get('will-frame-navigate')!({ url: entry, isMainFrame: false, preventDefault })
    f.listeners.get('will-attach-webview')!({ preventDefault })
    expect(preventDefault).toHaveBeenCalledTimes(2)
  })

  it('allows ordinary web links but never invokes arbitrary OS protocols, credentials, or control characters', () => {
    expect(safeExternalUrl('https://github.com/Kinnuch/Qonsona')).toBe(
      'https://github.com/Kinnuch/Qonsona'
    )
    for (const value of [
      'file:///C:/Windows/System32/calc.exe',
      'javascript:alert(1)',
      'data:text/html,x',
      'weixin://x',
      'ms-msdt:/x',
      'mailto:unreviewed@example.invalid',
      'https://user:password@example.invalid/',
      'https://example.invalid/\nanything'
    ])
      expect(safeExternalUrl(value)).toBeNull()
  })

  it('escapes markdown link attribute quotes so imported lessons cannot replace target or add attributes', () => {
    const html = mdToHtml('[Open](https://attacker.invalid/"target="_self)')
    expect(html).toContain('href="https://attacker.invalid/&quot;target=&quot;_self"')
    expect(html).toContain('target="_blank" rel="noopener noreferrer"')
    expect(html).not.toContain('"target="_self')
    expect(mdToHtml('<script>window.qstudy.invoke("account:session")</script>')).not.toContain(
      '<script>'
    )
    expect(mdToHtml('[Open](javascript:alert)')).not.toContain('<a ')
  })

  it('keeps every registered application IPC channel in the preload allowlist, including channels outside platform wrappers', () => {
    const channels = new Set([
      'course:load',
      'course:save',
      'notebook:load',
      'notebook:save',
      'practice:load',
      'practice:save'
    ])
    for (const file of readdirSync('src/main', { recursive: true }).filter((file) =>
      String(file).endsWith('.ts')
    )) {
      const source = readFileSync(join('src/main', String(file)), 'utf8')
      for (const match of source.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)) channels.add(match[1])
    }
    expect([...channels].filter((channel) => !IPC_INVOKE_CHANNELS.has(channel))).toEqual([])
    expect(IPC_INVOKE_CHANNELS.has('articleQuiz:save')).toBe(true)
    expect(IPC_EVENT_CHANNELS.has('account:request')).toBe(false)
    expect(IPC_INVOKE_CHANNELS.has('app:flush-before-close')).toBe(false)
  })
})
