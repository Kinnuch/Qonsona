/**
 * 统计（M7）里跟语言无关的部分：学习时长的记录（每天、每门语言、每个模块几秒）、
 * 哪几天学过、连续学习了几天。纯函数，测试里直接用。
 *
 * 时长只在真的在学时记：窗口在前台、两分钟内动过鼠标键盘（或者正在放视听），每 15 秒记一次，
 * 存在 userData/stats.json（所有语言一个文件）。
 */
import { dayKey } from './srs'

export interface DayActivity {
  /** 学习包 id → 模块 → 秒数 */
  packs: Record<string, Record<string, number>>
}

export interface ActivityLog {
  version: 1
  days: Record<string, DayActivity>
}

export const emptyActivity = (): ActivityLog => ({ version: 1, days: {} })

export function normalizeActivity(raw: unknown): ActivityLog {
  const log = emptyActivity()
  const days = (raw as Partial<ActivityLog> | null)?.days
  if (!days || typeof days !== 'object') return log
  for (const [day, d] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !d || typeof d !== 'object') continue
    const packs: DayActivity['packs'] = {}
    for (const [pack, mods] of Object.entries((d as DayActivity).packs ?? {})) {
      if (!mods || typeof mods !== 'object') continue
      const clean: Record<string, number> = {}
      for (const [m, s] of Object.entries(mods)) if (Number(s) > 0) clean[m] = Number(s)
      if (Object.keys(clean).length) packs[pack] = clean
    }
    log.days[day] = { packs }
  }
  return log
}

/** 记上几秒 */
export function addSeconds(
  log: ActivityLog,
  day: string,
  pack: string,
  module: string,
  seconds: number
): void {
  if (!(seconds > 0)) return
  const d = (log.days[day] ??= { packs: {} })
  const p = (d.packs[pack] ??= {})
  p[module] = Math.round(((p[module] ?? 0) + seconds) * 10) / 10
}

/** 某一天在某门语言上学了几秒（pack 为空是所有语言） */
export function secondsOn(log: ActivityLog, day: string, pack?: string): number {
  const d = log.days[day]
  if (!d) return 0
  const packs = pack ? [d.packs[pack] ?? {}] : Object.values(d.packs)
  return packs.reduce((n, mods) => n + Object.values(mods).reduce((a, b) => a + b, 0), 0)
}

/** 每个模块一共学了几秒（最近 days 天；pack 为空是所有语言） */
export function secondsByModule(
  log: ActivityLog,
  pack: string | undefined,
  days: string[]
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const day of days) {
    const d = log.days[day]
    if (!d) continue
    for (const [p, mods] of Object.entries(d.packs)) {
      if (pack && p !== pack) continue
      for (const [m, s] of Object.entries(mods)) out[m] = (out[m] ?? 0) + s
    }
  }
  return out
}

/** 从今天往前数 n 天的日期（最早的在前） */
export function lastDays(n: number, now = Date.now()): string[] {
  const out: string[] = []
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d)
    x.setDate(d.getDate() - i)
    out.push(dayKey(x.getTime()))
  }
  return out
}

/** 前一天的日期 */
function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const x = new Date(y, m - 1, d, 12)
  x.setDate(x.getDate() - 1)
  return dayKey(x.getTime())
}

/**
 * 连续学习了几天：从今天往前数；今天还没学的话从昨天数（今天学了就接上）。
 * 返回天数和今天学了没有
 */
export function streak(
  studied: ReadonlySet<string>,
  now = Date.now()
): { days: number; today: boolean } {
  const today = dayKey(now)
  const has = studied.has(today)
  let day = has ? today : dayBefore(today)
  let n = 0
  while (studied.has(day)) {
    n++
    day = dayBefore(day)
  }
  return { days: n, today: has }
}

/** 最长连续了几天 */
export function longestStreak(studied: ReadonlySet<string>): number {
  let best = 0
  for (const day of studied) {
    // 只从一段的第一天开始数
    if (studied.has(dayBefore(day))) continue
    let n = 0
    let d = day
    while (studied.has(d)) {
      n++
      const [y, m, dd] = d.split('-').map(Number)
      const x = new Date(y, m - 1, dd, 12)
      x.setDate(x.getDate() + 1)
      d = dayKey(x.getTime())
    }
    best = Math.max(best, n)
  }
  return best
}

/** 学满一分钟才算这一天学过 */
export const MIN_SECONDS = 60
