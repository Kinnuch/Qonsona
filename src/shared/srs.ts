/**
 * 间隔重复的排期（生词本、今日复习）。规则跟同一位作者的 Wordbank（cerf/wordbank）一样，都是用户定过的：
 *
 * - SM-2 为底，只有三档评价：不认识 / 有印象 / 认识 = q 0 / 3 / 5；
 * - 前五次记住走固定阶梯 1 / 2 / 4 / 7 / 15 天，之后才按熟练度系数（ease）拉长；
 * - 「有印象」从不拉长间隔：不管原来排了多远，一律退回阶梯底部 1–2 天；「不认识」清零、本轮过几张再来；
 * - 间隔按词做 ±12% 的确定性抖动（4 天以上才抖），一次加进几百个词不会在同一天全部到期；
 * - 抽查（按词本过闪卡时碰到排了期、还没到期的词）：认识不动排期，有印象照常拉回，不认识照常算遗忘——
 *   同一天把词本刷几遍，不能把间隔刷长。
 */

export const LADDER = [1, 2, 4, 7, 15]
export const DAY = 86_400_000
/** 间隔长到这么多天算「掌握」 */
export const MASTER_DAYS = 60

/** 不认识 / 有印象 / 认识 */
export type Grade = 0 | 3 | 5

export const STATE = { NEW: 0, LEARNING: 1, REVIEW: 2, MASTERED: 3 } as const
export type CardState = (typeof STATE)[keyof typeof STATE]

export interface SrsFields {
  /** 卡的键，也是抖动的种子 */
  key: string
  state: CardState
  /** 到期时间（毫秒） */
  due: number
  /** 现在的间隔（天）；不认识之后是 0 */
  ivl: number
  ease: number
  /** 连着记住了几次 */
  reps: number
  /** 忘了几次 */
  lapses: number
  /** 上次作答的时间 */
  last: number
  /** 一共答过几次 */
  seen: number
  /** 最近 40 次作答：[分钟时间戳, 评价] */
  hist: [number, Grade][]
}

export const newSrs = (key: string): SrsFields => ({
  key,
  state: STATE.NEW,
  due: 0,
  ivl: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  last: 0,
  seen: 0,
  hist: []
})

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** 间隔抖动：同一个词每次抖得一样，别的词错开 */
export function fuzz(key: string, days: number): number {
  if (days < 4) return days
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  const spread = Math.max(1, Math.round(days * 0.12))
  return days + ((Math.abs(h) % (spread * 2 + 1)) - spread)
}

function remember(c: SrsFields, q: Grade, now: number): void {
  c.seen += 1
  c.last = now
  c.hist.push([Math.round(now / 60000), q])
  if (c.hist.length > 40) c.hist = c.hist.slice(-40)
}

/** 答一次：改卡上的排期并返回它 */
export function grade<T extends SrsFields>(
  c: T,
  q: Grade,
  now = Date.now(),
  masterDays = MASTER_DAYS,
  ladder: readonly number[] = LADDER
): T {
  remember(c, q, now)
  if (q === 0) {
    c.lapses += 1
    c.reps = 0
    c.ease = clamp(c.ease - 0.2, 1.3, 2.8)
    c.ivl = 0
    c.state = STATE.LEARNING
    // 本轮过几张再来
    c.due = now
    return c
  }
  // SM-2 的系数调整（只用得到 q = 3、5 两档）
  c.ease = clamp(c.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), 1.3, 2.8)
  let days: number
  if (q === 3) {
    // 有印象：说明原来的间隔长了，退回阶梯底部，而不是从原来的间隔往上加
    c.reps = Math.min(c.reps, 1) + 1
    days = ladder[Math.min(c.reps - 1, ladder.length - 1)]
  } else {
    c.reps += 1
    days =
      c.reps <= ladder.length ? ladder[c.reps - 1] : Math.max(1, Math.round((c.ivl || 1) * c.ease))
  }
  days = Math.max(1, fuzz(c.key, days))
  c.ivl = days
  c.due = now + days * DAY
  c.state = days >= masterDays ? STATE.MASTERED : STATE.REVIEW
  return c
}

/**
 * 抽查：排了期、还没到期的词又被问到。认识只记一次作答、不动排期；有印象、不认识照常算。
 */
export function spotGrade<T extends SrsFields>(
  c: T,
  q: Grade,
  now = Date.now(),
  masterDays = MASTER_DAYS,
  ladder: readonly number[] = LADDER
): T {
  if (q !== 5) return grade(c, q, now, masterDays, ladder)
  remember(c, q, now)
  return c
}

/** 这张卡现在该不该当「抽查」：学过、排了期、今天还不到期 */
export const isSpot = (c: SrsFields, now = Date.now()): boolean =>
  c.state !== STATE.NEW && c.state !== STATE.LEARNING && c.due > endOfDay(now)

/** 三个按钮各会排到几天后（按钮下面的提示）；0 是「稍后重来」 */
export function preview(
  c: SrsFields,
  spot = false,
  now = Date.now(),
  masterDays = MASTER_DAYS,
  ladder: readonly number[] = LADDER
): Record<Grade, number> {
  const snap = (q: Grade): number => {
    const copy = structuredClone(c)
    ;(spot ? spotGrade : grade)(copy, q, now, masterDays, ladder)
    return q === 5 && spot ? Math.max(0, Math.round((copy.due - now) / DAY)) : copy.ivl
  }
  return { 0: 0, 3: snap(3), 5: snap(5) }
}

// ── 日期 ──

/** 本地日期 2026-09-24 */
export function dayKey(ts = Date.now()): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function endOfDay(ts = Date.now()): number {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

// ── 今天的出题队列 ──

export interface QueueCard extends SrsFields {
  /** 加进生词本的先后（新词按它的顺序学） */
  order: number
}

export interface QueueOptions {
  newPerDay: number
  reviewCap: number
  /** seq 按加进来的顺序学新词；random 打乱新词的取用与复习的提问顺序 */
  order: 'seq' | 'random'
  /** 今天已经学过的新词数 */
  learnedToday: number
  now?: number
  /** 测试里给固定的随机数 */
  random?: () => number
}

export function shuffle<T>(list: T[], random: () => number = Math.random): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 今天到期的复习（逾期最久的在前）与还没学的新词 */
export function dueCards<T extends QueueCard>(cards: T[], now = Date.now()): T[] {
  const end = endOfDay(now)
  return cards
    .filter((c) => c.state !== STATE.NEW && c.due <= end)
    .sort((a, b) => a.due - b.due || a.order - b.order)
}

export const newCards = <T extends QueueCard>(cards: T[]): T[] =>
  cards.filter((c) => c.state === STATE.NEW).sort((a, b) => a.order - b.order)

/**
 * 今天的队列（卡的键）：复习一律按到期先后挑（random 只打乱提问顺序，不会把逾期最久的挤出上限），
 * 新词取今天还剩的份额，均匀穿插在复习中间——一口气碰上二十个生词最容易劝退。
 */
export function buildQueue(cards: QueueCard[], o: QueueOptions): string[] {
  const now = o.now ?? Date.now()
  const random = o.random ?? Math.random
  const rand = o.order === 'random'
  const pool = newCards(cards)
  const fresh = (rand ? shuffle(pool, random) : pool)
    .slice(0, Math.max(0, o.newPerDay - o.learnedToday))
    .map((c) => c.key)
  let due = dueCards(cards, now)
    .slice(0, o.reviewCap)
    .map((c) => c.key)
  if (rand) due = shuffle(due, random)
  if (!fresh.length) return due
  if (!due.length) return fresh
  const out: string[] = []
  const step = due.length / fresh.length
  let fi = 0
  for (let i = 0; i < due.length; i++) {
    while (fi < fresh.length && fi * step <= i) out.push(fresh[fi++])
    out.push(due[i])
  }
  while (fi < fresh.length) out.push(fresh[fi++])
  return out
}
