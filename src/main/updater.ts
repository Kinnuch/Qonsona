/**
 * 软件内更新（主进程）：检查 GitHub Release 上有没有新版本，下载安装包（装过的 Windows 版先试增量），装好重开。
 * 做法照千语集（Qonlang 的 src/main/index.ts 里那一段），规则见各函数的说明。
 */
import { app, ipcMain, net, shell, type BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { createReadStream, createWriteStream, existsSync, readdirSync, promises as fs } from 'fs'
import { basename, dirname, join } from 'path'
import type { AppUpdater } from 'electron-updater'
import {
  RELEASE_OWNER,
  RELEASE_REPO,
  REPO_URL,
  installerCandidates,
  newerThan,
  parseLatestYml,
  pickInstaller,
  versionFromReleaseUrl,
  type InstallerTarget,
  type ReleaseAsset
} from './update'
import type { Installer, UpdateCheck, UpdateInfo } from '../shared/update'

const USER_AGENT = 'Qonsona'

/** 上一次问到的 Release 与它的 ETag：没变时 GitHub 回 304（不登录时 304 也照扣匿名额度） */
let releaseCache: { etag: string; info: UpdateInfo } | null = null
/** 接口被限流了：到 GitHub 说的恢复时间之前不再问 */
let apiBlockedUntil = 0
/** 最近一次查到的新版本（下载时按里面的校验值核对） */
let lastInfo: UpdateInfo | null = null

const installerTarget = (): InstallerTarget => ({
  platform: process.platform,
  arch: process.arch === 'arm64' ? 'arm64' : 'x64'
})

/**
 * 问 GitHub 接口最新的 Release（带安装包的校验值与更新说明）。
 * 离线、出错给 null；被限流（403 / 429）时记下恢复时间，沿用上一次问到的
 */
function fetchLatestRelease(): Promise<{ info: UpdateInfo | null; limited?: boolean }> {
  if (Date.now() < apiBlockedUntil)
    return Promise.resolve({ info: releaseCache?.info ?? null, limited: true })
  return new Promise((resolve) => {
    const req = net.request({
      url: `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPO}/releases/latest`,
      redirect: 'follow'
    })
    req.setHeader('User-Agent', USER_AGENT)
    req.setHeader('Accept', 'application/vnd.github+json')
    if (releaseCache) req.setHeader('If-None-Match', releaseCache.etag)
    const timer = setTimeout(() => {
      req.abort()
      resolve({ info: null })
    }, 8000)
    req.on('response', (res) => {
      if (res.statusCode === 304 && releaseCache) {
        clearTimeout(timer)
        return resolve({ info: releaseCache.info })
      }
      if (res.statusCode !== 200) {
        clearTimeout(timer)
        if (res.statusCode === 403 || res.statusCode === 429) {
          const reset = Number([res.headers['x-ratelimit-reset']].flat()[0] ?? 0)
          apiBlockedUntil = reset > 0 ? reset * 1000 : Date.now() + 3600_000
          return resolve({ info: releaseCache?.info ?? null, limited: true })
        }
        return resolve({ info: null })
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        clearTimeout(timer)
        try {
          const j = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            tag_name?: string
            html_url?: string
            body?: string
            assets?: ReleaseAsset[]
          }
          const version = (j.tag_name ?? '').replace(/^v/, '')
          if (!version) return resolve({ info: null })
          const info: UpdateInfo = {
            version,
            url: j.html_url ?? `${REPO_URL}/releases`,
            // 中英两段都留着，提示里按界面语言挑一段（notesForLocale）
            notes: (j.body ?? '').slice(0, 8000),
            installer: pickInstaller(j.assets ?? [], installerTarget())
          }
          const etag = res.headers['etag']
          const tag = Array.isArray(etag) ? etag[0] : etag
          if (tag) releaseCache = { etag: String(tag), info }
          resolve({ info })
        } catch {
          resolve({ info: null })
        }
      })
    })
    req.on('error', () => {
      clearTimeout(timer)
      resolve({ info: null })
    })
    req.end()
  })
}

/** 只看响应头：跳转去了哪、状态码是多少（不收正文，不占接口额度） */
function probe(url: string): Promise<{ status: number; location?: string }> {
  return new Promise((resolve) => {
    const req = net.request({ url, method: 'HEAD', redirect: 'manual' })
    req.setHeader('User-Agent', USER_AGENT)
    const timer = setTimeout(() => {
      req.abort()
      resolve({ status: 0 })
    }, 10000)
    req.on('redirect', (status, _method, redirectUrl) => {
      clearTimeout(timer)
      req.abort()
      resolve({ status, location: redirectUrl })
    })
    req.on('response', (res) => {
      clearTimeout(timer)
      resolve({ status: res.statusCode })
    })
    req.on('error', () => {
      clearTimeout(timer)
      resolve({ status: 0 })
    })
    req.end()
  })
}

/** 取一个小文本文件（latest.yml），跟着跳转走；拿不到给 null */
function fetchText(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = net.request({ url, redirect: 'follow' })
    req.setHeader('User-Agent', USER_AGENT)
    const timer = setTimeout(() => {
      req.abort()
      resolve(null)
    }, 10000)
    req.on('response', (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer)
        return resolve(null)
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        clearTimeout(timer)
        resolve(Buffer.concat(chunks).toString('utf8'))
      })
    })
    req.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
    req.end()
  })
}

/**
 * 接口问不到时，按 Release 的命名规则找本机的安装包：一个个试（跳转到下载地址就是有），
 * Windows 安装包再从 latest.yml 里拿 sha512 与大小。没有更新说明
 */
async function releaseByConvention(version: string): Promise<UpdateInfo> {
  const base = `${REPO_URL}/releases/download/v${version}/`
  let installer: Installer | null = null
  for (const c of installerCandidates(version, installerTarget())) {
    const r = await probe(base + encodeURIComponent(c.name))
    if (r.location || r.status === 200) {
      installer = { url: base + c.name, name: c.name, size: 0, sha256: null, auto: c.auto }
      break
    }
  }
  if (installer && process.platform === 'win32') {
    const yml = await fetchText(base + 'latest.yml')
    const f = yml ? parseLatestYml(yml).files.find((x) => x.url === installer.name) : undefined
    if (f) {
      installer.sha512 = f.sha512
      installer.size = f.size
    }
  }
  return { version, url: `${REPO_URL}/releases/tag/v${version}`, notes: '', installer }
}

/**
 * 检查更新：先问 github.com/…/releases/latest 跳到哪个版本（不占接口额度）；
 * 比当前新才问一次接口拿校验值与说明，接口被限流或连不上就按命名规则找安装包。
 * 跳转也拿不到时退回问接口；都不行就给出失败原因
 */
async function checkUpdate(): Promise<UpdateCheck> {
  const head = await probe(`${REPO_URL}/releases/latest`)
  let latest = head.location ? versionFromReleaseUrl(head.location) : null
  if (!latest) {
    const api = await fetchLatestRelease()
    if (!api.info)
      return {
        status: 'failed',
        error:
          head.status === 429 || api.limited
            ? 'rateLimited'
            : head.status === 404
              ? 'notFound'
              : 'offline'
      }
    latest = api.info.version
    if (!newerThan(latest, app.getVersion())) return { status: 'latest', latest }
    lastInfo = api.info
    return { status: 'newer', latest, info: api.info }
  }
  if (!newerThan(latest, app.getVersion())) return { status: 'latest', latest }
  if (lastInfo?.version === latest && lastInfo.installer)
    return { status: 'newer', latest, info: lastInfo }
  const api = await fetchLatestRelease()
  let info = api.info?.version === latest ? api.info : null
  // 接口没问到，或者那时 Release 上还没有本机的包：按命名规则再找一遍
  if (!info?.installer) {
    const byName = await releaseByConvention(latest)
    if (byName.installer || !info) info = { ...byName, notes: info?.notes ?? '' }
  }
  lastInfo = info
  return { status: 'newer', latest, info }
}

const updateDir = (): string => join(app.getPath('temp'), 'qonsona-update')

/**
 * 这份程序是不是用安装包装的（旁边有卸载程序）；解压直接运行的不算。
 * 卸载程序的名字跟着可执行文件名走（Uninstall Qonsona.exe），认「Uninstall 开头的 exe」
 */
function isInstalled(): boolean {
  try {
    return readdirSync(dirname(process.execPath)).some((f) => /^Uninstall .+\.exe$/i.test(f))
  } catch {
    return false
  }
}

/**
 * 用到时才加载 electron-updater。打出来的主进程是 CommonJS，electron-updater 的 autoUpdater 是个 getter，
 * 动态 import 时拿不到这个具名导出，只挂在 default 上（直接解构会是 undefined）。
 */
async function loadAutoUpdater(): Promise<AppUpdater> {
  const mod = await import('electron-updater')
  return (
    mod.autoUpdater ??
    (mod as unknown as { default: { autoUpdater: AppUpdater } }).default.autoUpdater
  )
}

/**
 * 增量更新，只用在装过的 Windows 版上：electron-updater 拿上次安装时 NSIS 自己存下的安装包
 * （%LOCALAPPDATA%\<名字>-updater\installer.exe）跟新旧两版的 .blockmap 比对，只下载变了的块，
 * 拼出新的安装包。拼好的整个文件按 latest.yml 里的 sha512 校验，对不上或者中间出任何错，
 * electron-updater 会自己改成整包下载（整包同样校验）——所以最后拿到的安装包一定跟 Release 上的一模一样，
 * 增量只影响下载了多少。词典数据（约 94 MB）没变时，这些块都不用再下。这里只借它下载，安装照旧走 installUpdate。
 * 返回 null：这台机器、这个版本走不了（开发版、免安装版、Release 上没有 latest.yml、版本对不上……），由调用方整包下载。
 */
async function downloadWithUpdater(
  version: string,
  win: () => BrowserWindow | null,
  logFile: string
): Promise<string | null> {
  if (process.platform !== 'win32' || !app.isPackaged || !isInstalled()) return null
  if (!existsSync(join(process.resourcesPath, 'app-update.yml'))) return null
  const autoUpdater = await loadAutoUpdater()
  const log: string[] = [`${new Date().toISOString()} ${app.getVersion()} → ${version}`]
  const note = (m: unknown): void => void log.push(String(m))
  autoUpdater.logger = { info: note, warn: note, error: note, debug: () => {} }
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.disableWebInstaller = true
  autoUpdater.allowDowngrade = false
  const onProgress = (p: { transferred: number; total: number }): void =>
    win()?.webContents.send('update:progress', { received: p.transferred, total: p.total })
  autoUpdater.on('download-progress', onProgress)
  try {
    const found = await autoUpdater.checkForUpdates()
    if (!found?.isUpdateAvailable || found.updateInfo.version !== version) {
      note(`skip: latest.yml says ${found?.updateInfo.version ?? 'nothing'}`)
      return null
    }
    const files = await autoUpdater.downloadUpdate()
    const exe = files.find((f) => f.toLowerCase().endsWith('.exe')) ?? null
    note(`done: ${exe}`)
    return exe
  } catch (e) {
    note(`error: ${e}`)
    return null
  } finally {
    autoUpdater.removeListener('download-progress', onProgress)
    await fs.writeFile(logFile, log.join('\n') + '\n', 'utf8').catch(() => {})
  }
}

/** 整个文件的摘要：sha256 用小写十六进制（跟接口的 digest 一样），sha512 用 base64（跟 latest.yml 一样） */
function hashFile(file: string, algo: 'sha256' | 'sha512'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algo)
    createReadStream(file)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve(hash.digest(algo === 'sha256' ? 'hex' : 'base64')))
      .on('error', reject)
  })
}

/** 整包下载：跟着跳转走（GitHub 的下载地址会跳到存储服务），边下边报进度，写到临时文件 */
function downloadTo(
  url: string,
  dest: string,
  onProgress: (received: number, total: number) => void,
  hops = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (hops > 8) return reject(new Error('too many redirects'))
    const req = net.request({ url, redirect: 'manual' })
    req.setHeader('User-Agent', USER_AGENT)
    req.on('redirect', (_status, _method, redirectUrl) => {
      req.abort()
      downloadTo(redirectUrl, dest, onProgress, hops + 1).then(resolve, reject)
    })
    req.on('response', (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) return
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const total = Number(res.headers['content-length'] ?? 0)
      // 边下边写进文件（安装包一百多 MB，不整个攒在内存里）
      const out = createWriteStream(dest)
      let received = 0
      res.on('data', (c: Buffer) => {
        received += c.length
        onProgress(received, total)
      })
      res.on('error', reject)
      out.on('error', reject)
      out.on('finish', () => resolve())
      ;(res as unknown as NodeJS.ReadableStream).pipe(out)
    })
    req.on('error', reject)
    req.end()
  })
}

/**
 * 把安装包下到临时目录；进度推给渲染层。装过的 Windows 版先试增量下载，走不了再整包下。
 * 整包下完按 GitHub 给这个资产算的 sha256 校验（接口没给就按 latest.yml 的 sha512），对不上算下载失败。
 */
async function downloadUpdate(
  url: string,
  name: string,
  version: string | undefined,
  win: () => BrowserWindow | null,
  logFile: string
): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (version) {
    const viaUpdater = await downloadWithUpdater(version, win, logFile)
    if (viaUpdater) return { ok: true, path: viaUpdater }
  }
  await fs.mkdir(updateDir(), { recursive: true })
  const dest = join(updateDir(), basename(name))
  try {
    await downloadTo(url, dest + '.part', (received, total) =>
      win()?.webContents.send('update:progress', { received, total })
    )
    const known = lastInfo?.installer?.name === name ? lastInfo.installer : null
    if (known?.sha256) {
      const got = await hashFile(dest + '.part', 'sha256')
      if (got !== known.sha256) throw new Error(`sha256 mismatch: ${got}`)
    } else if (known?.sha512) {
      const got = await hashFile(dest + '.part', 'sha512')
      if (got !== known.sha512) throw new Error(`sha512 mismatch: ${got}`)
    }
    await fs.rename(dest + '.part', dest)
    return { ok: true, path: dest }
  } catch (e) {
    await fs.rm(dest + '.part', { force: true })
    return { ok: false, error: String(e) }
  }
}

/** 起一个脱离本进程的子进程，等它真的起来（或出错）再返回：起来了给 true，否则给错误信息 */
function spawnDetached(command: string, args: string[]): Promise<true | string> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.once('error', (e) => resolve(String(e)))
    child.once('spawn', () => {
      child.unref()
      resolve(true)
    })
  })
}

/**
 * 装下好的包再重开。
 * Windows：装过的用 NSIS 静默模式（/S）沿用上次的安装目录，--force-run 装完自动拉起；免安装版弹安装向导。
 * 其他系统：打开安装包所在目录，界面上告诉用户自己装（manual）。
 */
async function installUpdate(
  file: string
): Promise<{ ok: boolean; manual?: boolean; error?: string }> {
  if (process.platform === 'win32') {
    // 安装包不见了或者起不来：报回界面，不退出（不接住 error 会弹主进程崩溃框）
    if (!existsSync(file)) return { ok: false, error: `installer not found: ${file}` }
    const args = isInstalled() ? ['--updated', '/S', '--force-run'] : ['--updated']
    const started = await spawnDetached(file, args)
    if (started !== true) return { ok: false, error: started }
    app.quit()
    return { ok: true }
  }
  shell.showItemInFolder(file)
  return { ok: true, manual: true }
}

/** 注册更新相关的 IPC；win 给当前主窗口（推下载进度用） */
export function registerUpdater(win: () => BrowserWindow | null, userData: () => string): void {
  const logFile = (): string => join(userData(), 'update.log')
  ipcMain.handle('app:checkUpdate', () => checkUpdate())
  ipcMain.handle('app:downloadUpdate', (_e, url: string, name: string, version?: string) =>
    downloadUpdate(url, name, version, win, logFile())
  )
  ipcMain.handle('app:installUpdate', (_e, file: string) => installUpdate(file))
}
