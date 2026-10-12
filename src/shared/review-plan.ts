import { cardsOf, listOf, today, type DayStat, type Notebook, type NoteCard } from './notebook'
import { buildQueue, dayKey, endOfDay, STATE } from './srs'
import {
  defaultReviewSettings,
  normalizeReviewSettings,
  type ReviewSettings
} from './review-settings'

export function settingsFor(
  nb: Notebook,
  listId: string | null = null,
  fallback: Partial<ReviewSettings> = {}
): ReviewSettings {
  return normalizeReviewSettings(
    (listId && nb.review?.lists[listId]) || nb.review?.language || defaultReviewSettings(fallback),
    fallback
  )
}
/** 卡片可属于多个词本；全语言复习选择最早建立的有专属计划词本，保证每张只出现一次。 */
export function scopeForCard(nb: Notebook, key: string): string | null {
  return (
    nb.lists
      .filter((l) => nb.review?.lists[l.id] && l.keys.includes(key))
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0]?.id ?? null
  )
}
export function scopedToday(nb: Notebook, listId: string | null, now = Date.now()): DayStat {
  const scope = listId ? `list:${listId}` : 'language'
  const stored = nb.reviewDays?.[scope]?.[dayKey(now)]
  if (stored) return stored
  if (!listId) return today(nb, now)
  const list = listOf(nb, listId)
  const out: DayStat = { learned: 0, reviewed: 0, total: 0, correct: 0 }
  for (const c of list ? cardsOf(nb, list) : []) {
    const hist = c.hist.filter(([m]) => dayKey(m * 60000) === dayKey(now))
    out.total += hist.length
    out.correct += hist.filter(([, q]) => q === 5).length
    const fresh = c.seen <= 40 && c.hist.length > 0 && dayKey(c.hist[0][0] * 60000) === dayKey(now)
    if (fresh && hist.length) out.learned++
    out.reviewed += hist.length - (fresh && hist.length ? 1 : 0)
  }
  return out
}
export function buildReviewPlan(
  nb: Notebook,
  listId: string | null,
  fallback: Partial<ReviewSettings> = {},
  now = Date.now(),
  shuffle = true
): { queue: string[]; settings: Record<string, ReviewSettings>; scopes: Record<string, string> } {
  const settings: Record<string, ReviewSettings> = {}
  const scopes: Record<string, string> = {}
  const groups = new Map<string | null, NoteCard[]>()
  const selected = listId ? (listOf(nb, listId)?.keys ?? []) : Object.keys(nb.cards)
  const preferred = new Map<string, string>()
  if (!listId)
    for (const list of nb.lists
      .filter((l) => nb.review?.lists[l.id])
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)))
      for (const key of list.keys) if (!preferred.has(key)) preferred.set(key, list.id)
  const plans = new Map<string | null, ReviewSettings>()
  for (const key of selected) {
    const c = nb.cards[key]
    if (!c) continue
    const scope = listId ?? preferred.get(key) ?? null
    const pool = groups.get(scope) ?? []
    pool.push(c)
    groups.set(scope, pool)
    if (!plans.has(scope)) plans.set(scope, settingsFor(nb, scope, fallback))
    settings[key] = plans.get(scope)!
    scopes[key] = scope ? `list:${scope}` : 'language'
  }
  const queue: string[] = []
  for (const [id, pool] of groups) {
    const plan = settingsFor(nb, id, fallback)
    const stats = scopedToday(nb, id, now)
    // 无专属设置的旧 notebook 保留「每轮上限」；用户保存计划后复习上限成为每日额度。
    const configured = !!(id ? nb.review?.lists[id] || nb.review?.language : nb.review?.language)
    queue.push(
      ...buildQueue(pool, {
        newPerDay: plan.newPerDay,
        reviewCap: Math.max(0, plan.reviewCap - (configured ? stats.reviewed : 0)),
        order: shuffle ? plan.order : 'seq',
        learnedToday: stats.learned,
        now
      })
    )
  }
  return { queue, settings, scopes }
}
export function saveReviewSettings(
  nb: Notebook,
  listId: string | null,
  settings: ReviewSettings,
  now = Date.now()
): void {
  const scope = listId ? `list:${listId}` : 'language'
  const stats = { ...scopedToday(nb, listId, now) }
  nb.review ??= { lists: {}, updatedAt: now }
  if (listId) nb.review.lists[listId] = normalizeReviewSettings(settings)
  else nb.review.language = normalizeReviewSettings(settings)
  nb.review.updatedAt = now
  nb.reviewDays ??= {}
  nb.reviewDays[scope] ??= {}
  nb.reviewDays[scope][dayKey(now)] ??= stats
  const pool = listId ? (listOf(nb, listId)?.keys ?? []) : Object.keys(nb.cards)
  for (const key of pool) {
    const c = nb.cards[key]
    if (c && c.state !== STATE.NEW && c.state !== STATE.LEARNING)
      c.state = c.ivl >= settings.masterDays ? STATE.MASTERED : STATE.REVIEW
  }
}
/** 只改到期日期，不清空历史、不重置间隔与熟练度。新词保持未学习。 */
export function rescheduleReview(
  nb: Notebook,
  listId: string | null,
  date: string,
  mode: 'due' | 'scheduled',
  now = Date.now()
): number {
  const start = new Date(`${date}T09:00:00`).getTime()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start) || dayKey(start) !== date)
    throw new Error('Invalid review date')
  const keys = listId ? (listOf(nb, listId)?.keys ?? []) : Object.keys(nb.cards)
  const cards = keys
    .map((k) => nb.cards[k])
    .filter((c) => c && c.state !== STATE.NEW && (mode === 'scheduled' || c.due <= endOfDay(now)))
    .sort((a, b) => a.due - b.due || a.order - b.order)
  const cap = Math.max(1, settingsFor(nb, listId).reviewCap)
  cards.forEach((c, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + Math.floor(i / cap))
    c.due = d.getTime()
  })
  return cards.length
}
