import type { CardInput } from './notebook'
export type DailyText = Record<string, string>
export interface DailyWord {
  id: string
  entryId?: number
  front: string
  reading: string
  meaning: DailyText
  level: string | null
  card: CardInput
}
export interface DailySentence {
  id: string
  text: string
  meaning: DailyText
  level: string | null
  source?: string
  lang?: string
  audioKey?: string
}
export interface DailyGrammar {
  id: string
  title: DailyText
  meaning: DailyText
  level: string | null
  example?: string
  docId?: string
  lessonId?: string
}
export interface DailyPool {
  words: DailyWord[]
  sentences: DailySentence[]
  grammar: DailyGrammar[]
  levels: Record<string, DailyText>
  database: boolean
}
export interface DictionaryDaily {
  packId: string
  date: string
  words: DailyWord[]
  sentences: DailySentence[]
  grammar: DailyGrammar[]
  levels: Record<string, DailyText>
  empty: Record<'words' | 'sentences' | 'grammar', 'missing-db' | 'empty' | null>
}
/** 切语言、日期或开始查询都会使旧请求失效，包含 A→B→A 回切。 */
export class DailyRequestGate {
  #epoch = 0
  #packId = ''
  #date = ''
  begin(packId: string, date: string): number {
    this.#packId = packId
    this.#date = date
    return ++this.#epoch
  }
  accepts(token: number, bundle: DictionaryDaily): boolean {
    return token === this.#epoch && bundle.packId === this.#packId && bundle.date === this.#date
  }
  current(token: number): boolean {
    return token === this.#epoch
  }
  cancel(): void {
    this.#epoch++
  }
}

export function dailyDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export function dailyOrdinal(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid daily date')
  const [y, m, d] = date.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d)
    throw new Error('Invalid daily date')
  return Math.floor(utc.getTime() / 86400000)
}
/** 不用 Math.random；固定池中的推荐在同日稳定，并按日期依次遍历全部候选。 */
export function dailyHash(text: string): number {
  let h = 2166136261
  for (const ch of text) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
/** 大型本机项目只展开固定、可重现的有界候选；哈希每个id一次，避免在排序比较中重复工作。 */
export function dailyCandidates<T extends { id: string }>(items: readonly T[], limit = 512): T[] {
  return items
    .map((item) => ({ item, rank: dailyHash(item.id) }))
    .sort((a, b) => a.rank - b.rank || a.item.id.localeCompare(b.item.id))
    .slice(0, limit)
    .map((x) => x.item)
}
export function selectDaily<T extends { id: string }>(
  items: readonly T[],
  packId: string,
  date: string,
  section: string,
  n: number
): T[] {
  const day = dailyOrdinal(date)
  const pool = [...new Map(items.map((item) => [item.id, item])).values()].sort(
    (a, b) =>
      dailyHash(`${packId}/${section}/${a.id}`) - dailyHash(`${packId}/${section}/${b.id}`) ||
      a.id.localeCompare(b.id)
  )
  if (!pool.length || n <= 0) return []
  let step = Math.max(1, Math.min(Math.floor(n), pool.length - 1))
  while (gcd(step, pool.length) !== 1) step++
  const start =
    (((day * step + dailyHash(`${packId}/${section}`)) % pool.length) + pool.length) % pool.length
  return Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(start + i) % pool.length])
}
export function makeDaily(packId: string, date: string, pool: DailyPool): DictionaryDaily {
  dailyOrdinal(date)
  const words = selectDaily(
    pool.words.filter((w) => w.front.trim() && Object.values(w.meaning).some((x) => x.trim())),
    packId,
    date,
    'words',
    3
  )
  const sentences = selectDaily(
    pool.sentences.filter((s) => s.text.trim()),
    packId,
    date,
    'sentences',
    2
  )
  const grammar = selectDaily(
    pool.grammar.filter(
      (g) => Object.values(g.title).some(Boolean) && Object.values(g.meaning).some(Boolean)
    ),
    packId,
    date,
    'grammar',
    1
  )
  return {
    packId,
    date,
    words,
    sentences,
    grammar,
    levels: pool.levels,
    empty: {
      words: words.length ? null : pool.database ? 'empty' : 'missing-db',
      sentences: sentences.length ? null : pool.database ? 'empty' : 'missing-db',
      grammar: grammar.length ? null : 'empty'
    }
  }
}
