/**
 * 框架里各语言的主进程接口（lang:*）：词典数据在哪、查词、词条、例句、词表、来源，
 * 以及维基共享资源等处的真人录音（下载后缓存在 userData/audio-cache/，界面的 CSP 不许直接放外网音频）。
 */
import { app, ipcMain, net } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { isLangCode } from '../../shared/lang/registry'
import type { LangCode, SourceRef } from '../../shared/lang/types'
import type { LexStatus } from '../../shared/lang/views'
import { LexDb } from './lexdb'

/**
 * 一门语言的数据文件：先看数据目录里下载的（userData/data/<代码>/），再看随程序带的
 * （打包后 resources/data/<代码>/，开发时仓库的 resources/data/<代码>/）
 */
export function langDataFile(code: LangCode, name = 'dict.sqlite'): string | null {
  const candidates = [
    join(app.getPath('userData'), 'data', code, name),
    app.isPackaged
      ? join(process.resourcesPath, 'data', code, name)
      : join(app.getAppPath(), 'resources', 'data', code, name)
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

const dbs = new Map<LangCode, LexDb | null>()

/** 打开（并缓存）一门语言的词典；没有数据或结构版本不对时是 null */
export function lexDb(code: string): LexDb | null {
  if (!isLangCode(code)) return null
  if (dbs.has(code)) return dbs.get(code)!
  const file = langDataFile(code)
  let db: LexDb | null = null
  if (file) {
    try {
      db = new LexDb(code, file)
      if (!db.ok) {
        db.close()
        db = null
      }
    } catch (e) {
      console.error(`open ${code} dictionary failed`, e)
      db = null
    }
  }
  dbs.set(code, db)
  return db
}

/** 录音只从这几处取 */
const AUDIO_HOSTS = ['upload.wikimedia.org', 'commons.wikimedia.org', 'lingualibre.org']
const AUDIO_MIME: Record<string, string> = {
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  webm: 'audio/webm'
}

async function fetchAudio(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || !AUDIO_HOSTS.includes(u.hostname)) return null
  const ext = (u.pathname.split('.').pop() ?? '').toLowerCase()
  const mime = AUDIO_MIME[ext] ?? 'audio/ogg'
  const dir = join(app.getPath('userData'), 'audio-cache')
  const file = join(
    dir,
    createHash('sha1').update(url).digest('hex') + '.' + (AUDIO_MIME[ext] ? ext : 'ogg')
  )
  if (existsSync(file)) return { bytes: new Uint8Array(await fs.readFile(file)), mime }
  const res = await net.fetch(url, {
    headers: { 'User-Agent': 'Qonsona (https://github.com/Kinnuch/Qonsona)' }
  })
  if (!res.ok) return null
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > 5 * 1024 * 1024) return null
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(file, bytes)
  return { bytes, mime }
}

export function registerLangIpc(): void {
  ipcMain.handle('lang:status', (_e, codes: string[]) =>
    codes.map(
      (code): LexStatus =>
        lexDb(code)?.status() ?? {
          code,
          available: false,
          entries: 0,
          examples: 0,
          bytes: 0,
          builtAt: null
        }
    )
  )
  ipcMain.handle(
    'lang:search',
    (_e, code: string, q: string) => lexDb(code)?.search(String(q)) ?? null
  )
  ipcMain.handle(
    'lang:entry',
    (_e, code: string, id: number) => lexDb(code)?.entry(Number(id)) ?? null
  )
  ipcMain.handle(
    'lang:examples',
    (_e, code: string, q: string) => lexDb(code)?.examples(String(q)) ?? []
  )
  ipcMain.handle('lang:sources', (_e, code: string): SourceRef[] => lexDb(code)?.sources() ?? [])
  ipcMain.handle(
    'lang:list',
    (_e, code: string, name: string, limit?: number) =>
      lexDb(code)?.list(String(name), Number(limit) || 5000) ?? []
  )
  ipcMain.handle('lang:listCounts', (_e, code: string) => lexDb(code)?.listCounts() ?? {})
  ipcMain.handle('lang:levelCounts', (_e, code: string) => lexDb(code)?.levelCounts() ?? {})
  ipcMain.handle(
    'lang:items',
    (_e, code: string, ids: number[]) =>
      lexDb(code)?.items((Array.isArray(ids) ? ids : []).map(Number).slice(0, 5000)) ?? []
  )
  ipcMain.handle('lang:audio', (_e, url: string) => fetchAudio(String(url)).catch(() => null))
}
