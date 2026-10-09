/**
 * 改名之后第一次启动时搬数据（2026-10-09：Qonlang Study 改名 Qonsona）。
 *
 * 数据目录跟着程序包名走，改名后从 %APPDATA%\qonlang-study 换成了 %APPDATA%\qonsona。
 * 新目录里还没有学习数据、旧目录在的时候，把学习数据（备份收的那些，再加窗口位置）拷过来；
 * 旧目录原样留着（装着的旧版照样能用，确认没问题后可以自己删）。Chromium 自己的缓存不拷。
 * 先整个拷到暂存目录，都拷完了再挪进来，中途出错不会只搬一半；拷过一次就在新目录里记一笔，
 * 之后不再拷——哪怕在新版里把数据清空了。
 */
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { BACKUP_ENTRIES } from './backup'

/** 数据目录名 → 改名前的目录名（在同一个上级目录里） */
const LEGACY_DIRS: Record<string, string> = { qonsona: 'qonlang-study' }
/** 搬哪些：备份收的学习数据，再加窗口位置 */
export const MIGRATE_ENTRIES = [...BACKUP_ENTRIES, 'window.json']
const MARK = 'migrated-from.json'
const STAGING = '.migrate-staging'

export interface MigrateResult {
  from: string
  entries: string[]
}

/** 要搬就搬，返回从哪搬了哪些；不用搬是 null。出错时抛出（新目录里不留半截） */
export function migrateLegacyData(userData: string, now = new Date()): MigrateResult | null {
  const legacy = LEGACY_DIRS[basename(userData)]
  if (!legacy) return null
  const from = join(dirname(userData), legacy)
  if (!existsSync(from) || existsSync(join(userData, MARK))) return null
  // 新目录里已经有学习数据：已经在用新版了，不拿旧的盖
  if (MIGRATE_ENTRIES.some((name) => existsSync(join(userData, name)))) return null
  const entries = MIGRATE_ENTRIES.filter((name) => existsSync(join(from, name)))
  if (!entries.length) return null

  const staging = join(userData, STAGING)
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  const moved: string[] = []
  try {
    for (const name of entries)
      cpSync(join(from, name), join(staging, name), { recursive: true, preserveTimestamps: true })
    for (const name of entries) {
      renameSync(join(staging, name), join(userData, name))
      moved.push(name)
    }
  } catch (e) {
    for (const name of moved) rmSync(join(userData, name), { recursive: true, force: true })
    throw e
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
  writeFileSync(
    join(userData, MARK),
    JSON.stringify({ from, at: now.toISOString(), entries }, null, 1)
  )
  return { from, entries }
}
