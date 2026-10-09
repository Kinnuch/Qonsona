/**
 * 备份与恢复（M7）：学习数据整个打成一个 zip（偏好、学时、学习包、生词本、课程进度、练习记录、录音、
 * 自己导入的文章、视听的媒体库与字幕）。缓存、窗口位置、Chromium 自己的目录不放。
 *
 * 恢复不在软件开着的时候做（界面随时可能在存东西）：先记下要用哪个备份、重新启动，
 * 启动时在开窗口之前换数据——先整个解到暂存目录，都没问题了再把现在的数据挪到
 * backup-before-restore-<时间>/，最后把暂存的挪进来。
 */
import { promises as fs, existsSync } from 'fs'
import { join, relative, sep } from 'path'
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'

/** 备份里放的：userData 下这些文件和目录 */
export const BACKUP_ENTRIES = [
  'prefs.json',
  'stats.json',
  'packs',
  'notebook',
  'courses',
  'practice',
  'recordings',
  'articles',
  'media'
]

const MANIFEST = 'qonsona-backup.json'
/** 改名（原名 Qonlang Study）之前做的备份：清单是这个名字、app 写 qonlang-study，照样能恢复 */
const LEGACY_MANIFEST = 'qonlang-study-backup.json'
const APPS = ['qonsona', 'qonlang-study']
const PENDING = 'restore-pending.json'
const STAGING = '.restore-staging'

export interface BackupManifest {
  app: 'qonsona' | 'qonlang-study'
  format: 1
  appVersion: string
  createdAt: string
  files: number
}

async function walk(dir: string, out: string[]): Promise<void> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walk(p, out)
    else if (e.isFile() && !e.name.endsWith('.tmp')) out.push(p)
  }
}

/** 已经压过的（音频、视频字幕以外的二进制）不再压 */
const STORED = /\.(webm|ogg|opus|mp3|m4a|flac|wav|png|jpe?g|woff2?|zip)$/i

/** 把 userData 里的学习数据打成 zip 写到 file；返回文件数与大小 */
export async function createBackup(
  userData: string,
  file: string,
  appVersion: string
): Promise<{ files: number; bytes: number }> {
  const paths: string[] = []
  for (const name of BACKUP_ENTRIES) {
    const p = join(userData, name)
    if (!existsSync(p)) continue
    if ((await fs.stat(p)).isDirectory()) await walk(p, paths)
    else paths.push(p)
  }
  const zip: Zippable = {}
  for (const p of paths) {
    const rel = relative(userData, p).split(sep).join('/')
    zip[`data/${rel}`] = [new Uint8Array(await fs.readFile(p)), { level: STORED.test(p) ? 0 : 6 }]
  }
  const manifest: BackupManifest = {
    app: 'qonsona',
    format: 1,
    appVersion,
    createdAt: new Date().toISOString(),
    files: paths.length
  }
  zip[MANIFEST] = strToU8(JSON.stringify(manifest, null, 1))
  const bytes = zipSync(zip)
  await fs.writeFile(file + '.tmp', bytes)
  await fs.rename(file + '.tmp', file)
  return { files: paths.length, bytes: bytes.length }
}

/** 备份里的一个路径能不能放进 userData：只认 data/ 下、上面列出的那几项，不许 .. */
function safeTarget(name: string): string | null {
  if (!name.startsWith('data/') || name.endsWith('/')) return null
  const rel = name.slice(5)
  const parts = rel.split('/')
  if (parts.some((x) => !x || x === '.' || x === '..' || /[<>:"|?*\\]/.test(x))) return null
  return BACKUP_ENTRIES.includes(parts[0]) ? rel : null
}

export type BackupInfo =
  | { ok: true; manifest: BackupManifest; files: Record<string, Uint8Array> }
  | { ok: false; reason: 'unreadable' | 'not-backup' | 'newer' }

/** 读一个备份：是不是本软件的备份、里面有哪些文件（只留能放回去的） */
export async function readBackup(file: string): Promise<BackupInfo> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await fs.readFile(file)))
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(strFromU8(entries[MANIFEST] ?? entries[LEGACY_MANIFEST]))
  } catch {
    return { ok: false, reason: 'not-backup' }
  }
  if (!APPS.includes(manifest?.app)) return { ok: false, reason: 'not-backup' }
  if (manifest.format > 1) return { ok: false, reason: 'newer' }
  const files: Record<string, Uint8Array> = {}
  for (const [name, bytes] of Object.entries(entries)) {
    const rel = safeTarget(name)
    if (rel) files[rel] = bytes
  }
  return { ok: true, manifest, files }
}

/** 记下下次启动时用哪个备份恢复 */
export async function scheduleRestore(userData: string, file: string): Promise<void> {
  await fs.writeFile(join(userData, PENDING), JSON.stringify({ file }))
}

/**
 * 启动时（开窗口之前）：有要恢复的备份就换数据。返回做了什么；没有要恢复的是 null。
 * 出错时现在的数据原样留着
 */
export async function applyPendingRestore(
  userData: string
): Promise<{ ok: true; files: number; saved: string } | { ok: false; reason: string } | null> {
  const pending = join(userData, PENDING)
  if (!existsSync(pending)) return null
  let file = ''
  try {
    file = JSON.parse(await fs.readFile(pending, 'utf8')).file
  } catch {
    // 坏了的记录
  }
  // 先删记录：恢复失败也不会每次启动都再试
  await fs.rm(pending, { force: true })
  if (!file) return { ok: false, reason: 'unreadable' }
  const info = await readBackup(file)
  if (!info.ok) return { ok: false, reason: info.reason }

  // 1. 整个解到暂存目录
  const staging = join(userData, STAGING)
  await fs.rm(staging, { recursive: true, force: true })
  for (const [rel, bytes] of Object.entries(info.files)) {
    const target = join(staging, ...rel.split('/'))
    await fs.mkdir(join(target, '..'), { recursive: true })
    await fs.writeFile(target, bytes)
  }
  // 2. 现在的数据挪到一边
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const saved = join(userData, `backup-before-restore-${stamp}`)
  await fs.mkdir(saved, { recursive: true })
  for (const name of BACKUP_ENTRIES) {
    const p = join(userData, name)
    if (existsSync(p)) await fs.rename(p, join(saved, name))
  }
  // 3. 暂存的挪进来
  for (const name of BACKUP_ENTRIES) {
    const p = join(staging, name)
    if (existsSync(p)) await fs.rename(p, join(userData, name))
  }
  await fs.rm(staging, { recursive: true, force: true })
  return { ok: true, files: Object.keys(info.files).length, saved }
}
