import { dayKey } from './srs'
export type CompletionKind = 'reading' | 'practice' | 'courses' | 'review'
export const REWARD_MINUTES = [5, 15, 30] as const
export const REWARD_MODULES = new Set([
  'reading',
  'practice',
  'courses',
  'notebook',
  'dictionary',
  'media'
])
/** Clip to genuine recent interaction; playback alone, idle and non-learning pages do not qualify. */
export function rewardIntervalEnd(
  section: string,
  start: number,
  end: number,
  lastInput: number,
  active: boolean,
  idle = 120000
): number | null {
  if (!active || !REWARD_MODULES.has(section) || !(lastInput > 0)) return null
  const stop = Math.min(end, lastInput + idle)
  return stop > start ? stop : null
}
export const COLLECTIBLES = Array.from({ length: 12 }, (_, i) => ({
  id: `companion-${i + 1}`,
  sheet: Math.floor(i / 6),
  cell: i % 6,
  name: {
    zh: ['晨光', '墨羽', '金砂', '银芽', '月影', '星团'][i % 6],
    en: ['Dawn', 'Inkwing', 'Goldsand', 'Silverbud', 'Moonshade', 'Starcluster'][i % 6]
  }
}))
export interface Completion {
  kind: CompletionKind
  id: string
  packId: string
  at: number
}
export interface RewardDay {
  seconds: number
  completions: Completion[]
  claimed: number[]
}
export interface RewardUnlock {
  day: string
  at: number
  minutes: number
}
export interface Rewards {
  version: 1
  startedAt: number
  days: Record<string, RewardDay>
  unlocked: Record<string, RewardUnlock>
}
export const emptyRewards = (now = Date.now()): Rewards => ({
  version: 1,
  startedAt: now,
  days: {},
  unlocked: {}
})
const isObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x)
const finite = (x: unknown, max = 1e15): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max
const validDay = (s: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s
const kinds = new Set(['reading', 'practice', 'courses', 'review'])
const completionKey = (c: Completion): string => JSON.stringify([c.packId, c.kind, c.id])
/** Import rejects malformed reward progress; old stats without this optional field remain valid. */
export function isRewards(x: unknown): x is Rewards {
  if (
    !isObject(x) ||
    x.version !== 1 ||
    !finite(x.startedAt) ||
    !isObject(x.days) ||
    !isObject(x.unlocked)
  )
    return false
  try {
    for (const [day, value] of Object.entries(x.days)) {
      if (
        !validDay(day) ||
        !isObject(value) ||
        !finite(value.seconds, 86400) ||
        !Array.isArray(value.completions) ||
        !Array.isArray(value.claimed) ||
        value.completions.length > 100000
      )
        return false
      if (
        value.claimed.some(
          (n) =>
            !REWARD_MINUTES.includes(n) ||
            (value.seconds as number) < n * 60 ||
            !(value.completions as unknown[]).length
        ) ||
        new Set(value.claimed).size !== value.claimed.length
      )
        return false
      const seen = new Set<string>()
      for (const c of value.completions) {
        if (
          !isObject(c) ||
          !kinds.has(String(c.kind)) ||
          typeof c.id !== 'string' ||
          !c.id.trim() ||
          c.id.length > 4096 ||
          typeof c.packId !== 'string' ||
          !c.packId.trim() ||
          c.packId.length > 512 ||
          !finite(c.at)
        )
          return false
        const key = completionKey(c as unknown as Completion)
        if (seen.has(key)) return false
        seen.add(key)
      }
    }
    for (const [id, value] of Object.entries(x.unlocked))
      if (
        !COLLECTIBLES.some((c) => c.id === id) ||
        !isObject(value) ||
        typeof value.day !== 'string' ||
        !validDay(value.day) ||
        !finite(value.at) ||
        !REWARD_MINUTES.includes(value.minutes as 5 | 15 | 30) ||
        !isObject(x.days[value.day]) ||
        !(x.days[value.day] as unknown as RewardDay).claimed.includes(value.minutes as number)
      )
        return false
  } catch {
    return false
  }
  return true
}
function rewardDay(r: Rewards, day: string): RewardDay {
  return (r.days[day] ??= { seconds: 0, completions: [], claimed: [] })
}
/** First actual completion checks in; time is accumulated independently but needs check-in to unlock. */
export function completeReward(
  r: Rewards,
  kind: CompletionKind,
  id: string,
  packId: string,
  now = Date.now()
): string[] {
  if (!kinds.has(kind) || !id.trim() || id.length > 4096 || !packId.trim() || packId.length > 512)
    return []
  const d = rewardDay(r, dayKey(now))
  const c = { kind, id, packId, at: now }
  if (!d.completions.some((old) => completionKey(old) === completionKey(c))) d.completions.push(c)
  return claimRewards(r, dayKey(now), now)
}
export function claimRewards(r: Rewards, day: string, now: number): string[] {
  const d = rewardDay(r, day),
    added: string[] = []
  if (!d.completions.length) return added
  for (const minutes of REWARD_MINUTES) {
    if (d.seconds < minutes * 60 || d.claimed.includes(minutes)) continue
    d.claimed.push(minutes)
    const next = COLLECTIBLES.find((c) => !r.unlocked[c.id])
    if (next) {
      r.unlocked[next.id] = { day, at: now, minutes }
      added.push(next.id)
    }
  }
  return added
}
/** Split an eligible foreground interval at local midnight; no credit for the previous stats history. */
export function addRewardInterval(r: Rewards, start: number, end: number): string[] {
  const added: string[] = []
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return added
  let at = start
  while (at < end) {
    const date = new Date(at)
    date.setHours(24, 0, 0, 0)
    const stop = Math.min(end, date.getTime())
    const day = dayKey(at)
    const d = rewardDay(r, day)
    d.seconds = Math.min(86400, d.seconds + (stop - at) / 1000)
    added.push(...claimRewards(r, day, stop - 1))
    at = stop
  }
  return added
}
/** Conservative snapshot merge: union check-ins/unlocks, max time, no additive farming or new grants. */
export function mergeRewards(a: Rewards, b: Rewards): Rewards {
  const out = structuredClone(a)
  out.startedAt = Math.min(a.startedAt, b.startedAt)
  for (const [day, value] of Object.entries(b.days)) {
    const d = rewardDay(out, day)
    d.seconds = Math.max(d.seconds, value.seconds)
    d.claimed = [...new Set([...d.claimed, ...value.claimed])].sort((x, y) => x - y)
    const seen = new Set(d.completions.map(completionKey))
    for (const c of value.completions)
      if (!seen.has(completionKey(c))) {
        d.completions.push(structuredClone(c))
        seen.add(completionKey(c))
      }
  }
  for (const [id, value] of Object.entries(b.unlocked)) {
    const old = out.unlocked[id]
    if (!old || value.at < old.at) out.unlocked[id] = structuredClone(value)
  }
  return out
}
