/**
 * 生词本：每门语言（学习包）一本，存在 userData/notebook/<包 id>.json。
 *
 * - 卡（card）按条目键记：日语是 ja-<JMdict 词条号>，千语集的语言是 lexeme-<id> / phrase-<id>
 *   （跟录音键同一套，项目重新导入后进度还在）。卡上存一份卡面（词、读音、释义），查不到原数据时也能显示。
 * - 词本（list）只记卡的键；一张卡可以在几个词本里。「我的生词」是默认词本，删不掉；
 *   卡从最后一个词本里移出时，连同学习记录一起删掉。
 * - 每天的计数（学了几个新词、复习了几个、答对几个）按本地日期记。
 */
import {
  STATE,
  dayKey,
  endOfDay,
  grade,
  isSpot,
  newCards,
  newSrs,
  spotGrade,
  type Grade,
  type QueueCard
} from './srs'

/** 多语言文字（{ zh, en }），按界面语言挑 */
export type Texts = Record<string, string>

/** 加进生词本时给的：卡的键与卡面 */
export interface CardInput {
  key: string
  /** 正面：词头 / 短语原文 */
  front: string
  /** 读音：假名、IPA */
  reading: string
  meaning: Texts
}

export interface NoteCard extends QueueCard, CardInput {
  /** 加进来的时间 */
  added: number
}

export interface NoteList {
  id: string
  /** 名字；「我的生词」的名字按界面语言显示，这里是空串 */
  name: string
  keys: string[]
  /** 从哪来的：jlpt-5、level-L1、lesson-<id>、article-<id>……；自己建的没有 */
  source?: string
  createdAt: number
}

export interface DayStat {
  /** 学了几个新词 */
  learned: number
  /** 复习了几个 */
  reviewed: number
  /** 答了几次、答「认识」几次 */
  total: number
  correct: number
}

export interface Notebook {
  version: 1
  cards: Record<string, NoteCard>
  lists: NoteList[]
  days: Record<string, DayStat>
  /** 下一张卡的顺序号 */
  seq: number
}

export const MINE = 'mine'

export function emptyNotebook(now = Date.now()): Notebook {
  return {
    version: 1,
    cards: {},
    lists: [{ id: MINE, name: '', keys: [], createdAt: now }],
    days: {},
    seq: 0
  }
}

/** 读回来的生词本：缺的补上，认不出的当没有 */
export function normalizeNotebook(raw: unknown, now = Date.now()): Notebook {
  const nb = emptyNotebook(now)
  if (!raw || typeof raw !== 'object') return nb
  const r = raw as Partial<Notebook>
  if (r.cards && typeof r.cards === 'object') nb.cards = r.cards as Notebook['cards']
  if (Array.isArray(r.lists)) {
    nb.lists = r.lists.filter((l) => l && typeof l.id === 'string' && Array.isArray(l.keys))
    if (!nb.lists.some((l) => l.id === MINE))
      nb.lists.unshift({ id: MINE, name: '', keys: [], createdAt: now })
  }
  if (r.days && typeof r.days === 'object') nb.days = r.days as Notebook['days']
  nb.seq = Number(r.seq) || 0
  for (const c of Object.values(nb.cards)) nb.seq = Math.max(nb.seq, (Number(c.order) || 0) + 1)
  // 词本里指着不存在的卡的键去掉
  for (const l of nb.lists) l.keys = l.keys.filter((k) => k in nb.cards)
  return nb
}

export const listOf = (nb: Notebook, id: string): NoteList | undefined =>
  nb.lists.find((l) => l.id === id)

export function createList(
  nb: Notebook,
  name: string,
  source?: string,
  now = Date.now()
): NoteList {
  const list: NoteList = {
    id: `l${now.toString(36)}${nb.lists.length}`,
    name,
    keys: [],
    ...(source && { source }),
    createdAt: now
  }
  nb.lists.push(list)
  return list
}

/**
 * 把几张卡加进一个词本：没有的卡新建（新词），已有的更新卡面；返回这个词本里新加了几张。
 */
export function addCards(
  nb: Notebook,
  listId: string,
  inputs: CardInput[],
  now = Date.now()
): number {
  const list = listOf(nb, listId)
  if (!list) return 0
  const inList = new Set(list.keys)
  let added = 0
  for (const x of inputs) {
    const card = nb.cards[x.key]
    if (card) Object.assign(card, { front: x.front, reading: x.reading, meaning: x.meaning })
    else nb.cards[x.key] = { ...newSrs(x.key), ...x, key: x.key, added: now, order: nb.seq++ }
    if (!inList.has(x.key)) {
      list.keys.push(x.key)
      inList.add(x.key)
      added++
    }
  }
  return added
}

/** 卡还在哪些词本里 */
export const listsWith = (nb: Notebook, key: string): NoteList[] =>
  nb.lists.filter((l) => l.keys.includes(key))

/** 从词本里移出；不在任何词本里的卡连同学习记录删掉。返回删掉了几张卡 */
export function removeFromList(nb: Notebook, listId: string, keys: string[]): number {
  const list = listOf(nb, listId)
  if (!list) return 0
  const drop = new Set(keys)
  list.keys = list.keys.filter((k) => !drop.has(k))
  let deleted = 0
  for (const k of drop)
    if (nb.cards[k] && !listsWith(nb, k).length) {
      delete nb.cards[k]
      deleted++
    }
  return deleted
}

/** 这个词本删掉时，会连带删掉几张卡（只在这个词本里的） */
export const orphansOf = (nb: Notebook, listId: string): number =>
  (listOf(nb, listId)?.keys ?? []).filter((k) => listsWith(nb, k).length === 1).length

/** 删词本（「我的生词」删不掉）；返回删掉了几张卡 */
export function removeList(nb: Notebook, listId: string): number {
  if (listId === MINE) return 0
  const list = listOf(nb, listId)
  if (!list) return 0
  const deleted = removeFromList(nb, listId, list.keys)
  nb.lists = nb.lists.filter((l) => l.id !== listId)
  return deleted
}

/** 一张卡现在的状态：没学过的是新词；学过的看最近一次答的是不认识 / 有印象 / 认识 */
export type CardStatus = 'new' | 'forgot' | 'unsure' | 'known'

export function statusOf(c: NoteCard): CardStatus {
  if (c.state === STATE.NEW || !c.hist.length) return 'new'
  const q = c.hist[c.hist.length - 1][1]
  return q === 0 ? 'forgot' : q === 3 ? 'unsure' : 'known'
}

export function countStatuses(cards: NoteCard[]): Record<CardStatus, number> {
  const out: Record<CardStatus, number> = { new: 0, forgot: 0, unsure: 0, known: 0 }
  for (const c of cards) out[statusOf(c)]++
  return out
}

export const cardsOf = (nb: Notebook, list: NoteList): NoteCard[] =>
  list.keys.map((k) => nb.cards[k]).filter(Boolean)

export function today(nb: Notebook, now = Date.now()): DayStat {
  return nb.days[dayKey(now)] ?? { learned: 0, reviewed: 0, total: 0, correct: 0 }
}

/** 首页上的「今天要复习多少」：到期的复习（受上限）与今天还能学的新词 */
export function todayCounts(
  nb: Notebook,
  o: { newPerDay: number; reviewCap: number },
  now = Date.now()
): { due: number; fresh: number } {
  const cards = Object.values(nb.cards)
  const end = endOfDay(now)
  const due = cards.filter((c) => c.state !== STATE.NEW && c.due <= end).length
  const left = Math.max(0, o.newPerDay - today(nb, now).learned)
  return { due: Math.min(due, o.reviewCap), fresh: Math.min(left, newCards(cards).length) }
}

/**
 * 答一张卡：记进排期与今天的计数。drill 是按词本过闪卡——排了期、还没到期的卡当抽查。
 */
export function answer(nb: Notebook, key: string, q: Grade, now = Date.now(), drill = false): void {
  const c = nb.cards[key]
  if (!c) return
  const wasNew = c.state === STATE.NEW
  if (drill && isSpot(c, now)) spotGrade(c, q, now)
  else grade(c, q, now)
  const k = dayKey(now)
  const d = (nb.days[k] ??= { learned: 0, reviewed: 0, total: 0, correct: 0 })
  if (wasNew) d.learned++
  else d.reviewed++
  d.total++
  if (q === 5) d.correct++
}
