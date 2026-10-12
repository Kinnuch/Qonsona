import type { NoteCard } from './notebook'
import { REVIEW_KINDS, type ReviewKind, type ReviewSettings } from './review-settings'

export interface ReviewExample {
  text: string
  answer: string
  start: number
  end: number
  translation?: string
}
export interface ReviewData {
  locale: string
  canListen: boolean
  examples: ReviewExample[]
  forms?: string[]
}
export interface ReviewQuestion {
  kind: Exclude<ReviewKind, 'flashcard'>
  cardKey: string
  prompt: string
  choices: string[]
  answer: string
  accepted: string[]
  example?: ReviewExample
}
export interface ReviewQuestionResult {
  question: ReviewQuestion | null
  fallback: boolean
  unavailable: ReviewKind[]
  fallbackReason?: 'disabled' | 'missing-data'
}
const plain = (s: string): string =>
  s.normalize('NFC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
const meaning = (c: NoteCard, locale: string): string =>
  c.meaning[locale] || c.meaning.en || c.meaning.zh || Object.values(c.meaning).find(Boolean) || ''
const uniq = (xs: string[]): string[] => [
  ...new Map(xs.filter((x) => x.trim()).map((x) => [plain(x), x])).values()
]
const validExamples = (card: NoteCard, data: ReviewData): ReviewExample[] =>
  data.examples.filter(
    (ex) =>
      [card.front, ...(data.forms ?? [])].some((form) => plain(form) === plain(ex.answer)) &&
      ex.text.slice(ex.start, ex.end) === ex.answer &&
      ex.answer.trim()
  )
function mix<T>(xs: T[], rand: () => number): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
/** 按已出题次数/权重选择最欠配额的可用类型，避免短轮次纯随机严重偏斜；0 完全禁用。 */
export function chooseReviewKind(
  weights: ReviewSettings['weights'],
  available: ReviewKind[],
  counts: Partial<Record<ReviewKind, number>>
): ReviewKind | null {
  const eligible = REVIEW_KINDS.filter((k) => available.includes(k) && weights[k] > 0)
  return (
    eligible.sort(
      (a, b) =>
        ((counts[a] ?? 0) + 1) / weights[a] - ((counts[b] ?? 0) + 1) / weights[b] ||
        REVIEW_KINDS.indexOf(a) - REVIEW_KINDS.indexOf(b)
    )[0] ?? null
  )
}
export function reviewCapabilities(
  card: NoteCard,
  pool: NoteCard[],
  data: ReviewData
): ReviewKind[] {
  const other = pool.filter((c) => c.key !== card.key && plain(c.front) !== plain(card.front))
  const differentMeaning = other.filter(
    (c) => plain(meaning(c, data.locale)) !== plain(meaning(card, data.locale))
  )
  const words = uniq(differentMeaning.map((c) => c.front)).filter(
    (x) => plain(x) !== plain(card.front)
  )
  const meanings = uniq(other.map((c) => meaning(c, data.locale))).filter(
    (x) => plain(x) !== plain(meaning(card, data.locale))
  )
  const readings = uniq(other.map((c) => c.reading)).filter((x) => plain(x) !== plain(card.reading))
  const out: ReviewKind[] = ['flashcard']
  if (card.front.trim() && meaning(card, data.locale)) out.push('spelling')
  if (meaning(card, data.locale) && meanings.length >= 3) out.push('word-meaning')
  if (meaning(card, data.locale) && words.length >= 3) out.push('meaning-word')
  if (card.reading.trim() && card.reading !== card.front && readings.length >= 3)
    out.push('reading')
  if (
    data.canListen &&
    uniq(
      other
        .filter((c) => !card.reading || plain(c.reading) !== plain(card.reading))
        .map((c) => c.front)
    ).length >= 3
  )
    out.push('listening')
  if (validExamples(card, data).length && words.length >= 3) out.push('context')
  return out
}
export function makeReviewQuestion(
  card: NoteCard,
  pool: NoteCard[],
  settings: ReviewSettings,
  data: ReviewData,
  counts: Partial<Record<ReviewKind, number>> = {},
  rand: () => number = Math.random
): ReviewQuestionResult {
  const available = reviewCapabilities(card, pool, data)
  const kind = chooseReviewKind(settings.weights, available, counts)
  const unavailable = REVIEW_KINDS.filter((k) => settings.weights[k] > 0 && !available.includes(k))
  if (!kind || kind === 'flashcard')
    return {
      question: null,
      fallback: !kind || unavailable.length > 0,
      unavailable,
      ...(!kind || unavailable.length
        ? {
            fallbackReason: REVIEW_KINDS.every((k) => settings.weights[k] === 0)
              ? ('disabled' as const)
              : ('missing-data' as const)
          }
        : {})
    }
  const other = pool.filter(
    (c) =>
      c.key !== card.key &&
      plain(c.front) !== plain(card.front) &&
      (kind === 'listening'
        ? !card.reading || plain(c.reading) !== plain(card.reading)
        : ['meaning-word', 'context'].includes(kind)
          ? plain(meaning(c, data.locale)) !== plain(meaning(card, data.locale))
          : true)
  )
  let answer = card.front
  let prompt = card.front
  let alternatives: string[] = []
  let example: ReviewExample | undefined
  if (kind === 'word-meaning') {
    answer = meaning(card, data.locale)
    alternatives = other.map((c) => meaning(c, data.locale))
  } else if (kind === 'reading') {
    answer = card.reading
    alternatives = other.map((c) => c.reading)
  } else if (kind === 'meaning-word' || kind === 'spelling') {
    prompt = meaning(card, data.locale)
    alternatives = other.map((c) => c.front)
  } else if (kind === 'context') {
    const original = validExamples(card, data)[0]
    example = { ...original, translation: original.translation || meaning(card, data.locale) }
    answer = example.answer
    prompt = example.text.slice(0, example.start) + '____' + example.text.slice(example.end)
    alternatives = other.map((c) => c.front)
  } else {
    prompt = ''
    alternatives = other.map((c) => c.front)
  }
  const wrong = uniq(alternatives).filter((x) => plain(x) !== plain(answer))
  const choices = kind === 'spelling' ? [] : mix([answer, ...mix(wrong, rand).slice(0, 3)], rand)
  return {
    question: {
      kind,
      cardKey: card.key,
      prompt,
      choices,
      answer,
      accepted: [answer],
      ...(example ? { example } : {})
    },
    fallback: false,
    unavailable
  }
}
export const reviewAnswerCorrect = (q: ReviewQuestion, value: string): boolean =>
  q.accepted.some((a) => plain(a) === plain(value))
/** 必须是当前词的真实例句；文字边界避免 cat 匹配到 concatenate。 */
export function reviewExample(
  text: string,
  forms: string[],
  translation?: string
): ReviewExample | null {
  for (const form of forms.filter(Boolean).sort((a, b) => b.length - a.length)) {
    let at = text.indexOf(form)
    while (at >= 0) {
      const before = text.slice(0, at).slice(-1)
      const after = text.slice(at + form.length).slice(0, 1)
      const unspaced =
        /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+$/u.test(form)
      if (unspaced || (!/[\p{L}\p{M}]/u.test(before) && !/[\p{L}\p{M}]/u.test(after)))
        return { text, answer: form, start: at, end: at + form.length, translation }
      at = text.indexOf(form, at + form.length)
    }
  }
  return null
}
