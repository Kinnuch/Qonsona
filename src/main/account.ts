import { app, ipcMain, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { AccountClient } from './account-client'
import type { AccountAction, AccountPayloads } from '../shared/account'

/** 登录凭证只在主进程；系统不提供安全存储时仅保留本次内存会话。 */
export function registerAccountIpc(): void {
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
  ipcMain.handle('account:session', () => client.session())
  ipcMain.handle(
    'account:request',
    (_event, action: AccountAction, payload: AccountPayloads[AccountAction]) =>
      client.request(action, payload)
  )
}
