import { LADDER, MASTER_DAYS } from './srs'

export const REVIEW_KINDS = [
  'flashcard',
  'word-meaning',
  'meaning-word',
  'spelling',
  'reading',
  'listening',
  'context'
] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]
export interface ReviewSettings {
  newPerDay: number
  reviewCap: number
  order: 'seq' | 'random'
  ladder: number[]
  masterDays: number
  weights: Record<ReviewKind, number>
}
export interface NotebookReviewSettings {
  language?: ReviewSettings
  lists: Record<string, ReviewSettings>
  updatedAt: number
}
export const defaultReviewSettings = (fallback: Partial<ReviewSettings> = {}): ReviewSettings => ({
  newPerDay: fallback.newPerDay ?? 20,
  reviewCap: fallback.reviewCap ?? 200,
  order: fallback.order ?? 'seq',
  ladder: [...LADDER],
  masterDays: MASTER_DAYS,
  weights: {
    flashcard: 1,
    'word-meaning': 0,
    'meaning-word': 0,
    spelling: 0,
    reading: 0,
    listening: 0,
    context: 0
  }
})
/** 导入时可严格拒绝坏数据；读旧文件时 normalize 使用相同约束并安全回退。 */
export function isReviewSettings(raw: unknown): raw is ReviewSettings {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as ReviewSettings
  return (
    Number.isInteger(r.newPerDay) &&
    r.newPerDay >= 0 &&
    r.newPerDay <= 10000 &&
    Number.isInteger(r.reviewCap) &&
    r.reviewCap >= 0 &&
    r.reviewCap <= 10000 &&
    ['seq', 'random'].includes(r.order) &&
    Array.isArray(r.ladder) &&
    r.ladder.length >= 2 &&
    r.ladder.length <= 20 &&
    r.ladder.every(
      (x, i) => Number.isInteger(x) && x >= 1 && x <= 3650 && (i === 0 || x > r.ladder[i - 1])
    ) &&
    Number.isInteger(r.masterDays) &&
    r.masterDays >= 1 &&
    r.masterDays <= 36500 &&
    !!r.weights &&
    typeof r.weights === 'object' &&
    REVIEW_KINDS.every(
      (k) => Number.isFinite(r.weights[k]) && r.weights[k] >= 0 && r.weights[k] <= 100
    )
  )
}
export function normalizeReviewSettings(
  raw: unknown,
  fallback: Partial<ReviewSettings> = {}
): ReviewSettings {
  if (!isReviewSettings(raw)) return defaultReviewSettings(fallback)
  return { ...raw, ladder: [...raw.ladder], weights: { ...raw.weights } }
}
export function isNotebookReviewSettings(raw: unknown): raw is NotebookReviewSettings {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as NotebookReviewSettings
  return (
    (r.language === undefined || isReviewSettings(r.language)) &&
    !!r.lists &&
    typeof r.lists === 'object' &&
    !Array.isArray(r.lists) &&
    Object.values(r.lists).every(isReviewSettings) &&
    Number.isFinite(r.updatedAt) &&
    r.updatedAt >= 0
  )
}
export function normalizeNotebookReviewSettings(raw: unknown): NotebookReviewSettings | undefined {
  if (!isNotebookReviewSettings(raw)) return undefined
  const r = raw as NotebookReviewSettings
  return {
    ...(r.language ? { language: normalizeReviewSettings(r.language) } : {}),
    lists: Object.fromEntries(
      Object.entries(r.lists).map(([id, s]) => [id, normalizeReviewSettings(s)])
    ),
    updatedAt: r.updatedAt
  }
}
