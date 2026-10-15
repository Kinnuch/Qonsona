import { app, ipcMain, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { AccountClient } from './account-client'
import { GuestCollection } from './guest-collection'
import { syncGuestStarter } from './guest-starter-sync'
import { trackGuestWrite } from './guest-writes'
import type { AccountAction, AccountPayloads } from '../shared/account'

/** 登录凭证只在主进程；系统不提供安全存储时仅保留本次内存会话。 */
export function registerAccountIpc(): void {
  const guest = new GuestCollection(app.getPath('userData'))
  const guestForSync = {
    session: () => guest.session(),
    bind: (userId: string) => trackGuestWrite('guest-starter:bind', () => guest.bind(userId))
  }
  const directory = join(app.getPath('userData'), 'account')
  const path = join(directory, 'session.bin')
  const encrypted = (): boolean =>
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')
  const client = new AccountClient({
    version: app.getVersion(),
    packaged: app.isPackaged,
    testMode: process.env.QON_TEST_MODE === '1',
    base: process.env.QON_ACCOUNT_API_BASE,
    directory,
    readIdentity: async () => {
      if (!encrypted()) return null
      try {
        return JSON.parse(safeStorage.decryptString(await fs.readFile(path)))
      } catch {
        return null
      }
    },
    writeIdentity: async (identity) => {
      if (!identity || !encrypted()) {
        await fs.rm(path, { force: true })
        return
      }
      await fs.mkdir(directory, { recursive: true })
      await fs.writeFile(path + '.tmp', safeStorage.encryptString(JSON.stringify(identity)), {
        mode: 0o600
      })
      await fs.rename(path + '.tmp', path)
    }
  })
  // 包住身份读取、云端领取和本机绑定，防止两个窗口切账号时交叉认领。
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const operation = queue.then(work, work)
    queue = operation.catch(() => {})
    return operation
  }
  ipcMain.handle('guest-collection:session', () => guest.session())
  ipcMain.handle('guest-collection:claim', (_event, id: unknown) => {
    if (typeof id !== 'string') throw new Error('INVALID_STARTER')
    return trackGuestWrite('guest-starter:claim', () => guest.claim(id))
  })
  ipcMain.handle('account:session', () =>
    serial(async () => syncGuestStarter(client, guestForSync, await client.session()))
  )
  ipcMain.handle(
    'account:request',
    (_event, action: AccountAction, payload: AccountPayloads[AccountAction]) =>
      serial(async () => {
        const response = await client.request(action, payload)
        if (action === 'login' || action === 'register') {
          // session() 会恢复未知交易；返回最新版本的快照交给渲染层。
          const session = await syncGuestStarter(client, guestForSync, await client.session())
          if (!session.user) throw new Error('UNAUTHORIZED: Please sign in again')
          if (session.user && session.snapshot)
            return { ...response, user: session.user, snapshot: session.snapshot }
        }
        return response
      })
  )
}
