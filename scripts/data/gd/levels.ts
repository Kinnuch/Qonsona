/**
 * 词分到 CEFR 各级（盖尔语没有公开的分级词表，SQA 也不发词表）：
 *
 * - A1：手挑的基础词表（data/gd/core-a1.txt，按 CLAG A1 清单与入门课的主题挑的）＋最常用的虚词
 *   （限定词、介词、代词、小品词、连词里词频前 150 的）。
 * - A2–C2：其余的词按合并词频（freq.ts）排，累计切到下面的词数。专名、词缀、字母、短语、谚语不按词频分级
 *   （核心词表里的除外）；只有古旧、已废义项的词最低放到 C1。
 *
 * 累计词数参照常见的 CEFR 词汇量估计（A1 约 500–600、A2 约 1,200–1,500、B1 约 2,500、B2 约 4,000），
 * 盖尔语的语料小（三份合起来约 290 万词），语料里出现过的词条只有五千多个，所以 B2 以上切得紧一些，
 * C2 是语料里出现过、但最不常见的那些词；语料里没出现过的词不分级。实际各级多少词见 docs/lang/gd.md。
 */
import { readFileSync } from 'node:fs'
import type { CefrLevel } from '../../../src/shared/lang/types'
import type { GdEntry } from './kaikki'
import type { FormIndex } from './freq'

/** 累计到这个词数为止是这一级（A1 另算） */
export const CUTOFFS: [CefrLevel, number][] = [
  ['A2', 1300],
  ['B1', 2500],
  ['B2', 3800],
  ['C1', 4800]
]
/** 自动进 A1 的虚词：这些词性里词频前多少名 */
export const FUNCTION_POS = new Set(['det', 'adp', 'pron', 'part', 'cconj', 'sconj'])
export const FUNCTION_TOP = 150

export interface Theme {
  id: string
  title: { zh: string; en: string }
  words: { word: string; pos?: string }[]
}

export function readCore(file: string): Theme[] {
  const themes: Theme[] = []
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const head = /^\[([\w-]+)\]\s*(.+?)\s*\|\s*(.+)$/.exec(line)
    if (head) {
      themes.push({ id: head[1], title: { zh: head[2], en: head[3] }, words: [] })
      continue
    }
    const [word, pos] = raw.split('\t').map((s) => s.trim())
    themes[themes.length - 1]?.words.push(pos ? { word, pos } : { word })
  }
  return themes
}

/**
 * 核心词表的一个词对上的词条：先按词头（与词性），再按变形表（dìnnear → dinnear）；
 * 同形的几个词条只取最常用的一个（daor「贵」进 A1，daor「奴隶」不跟着进）
 */
export function resolveCore(
  w: { word: string; pos?: string },
  index: FormIndex,
  rank: (number | null)[]
): number[] {
  const ids = index.resolve(w.word, w.pos ? [w.pos] : undefined)
  if (ids.length <= 1) return ids
  const best = [...ids].sort((a, b) => (rank[a] ?? 1e9) - (rank[b] ?? 1e9))[0]
  return [best]
}

const NO_FREQ_LEVEL = new Set(['propn', 'affix', 'symbol', 'phrase', 'proverb', 'idiom', 'other'])
const OLD = new Set(['archaic', 'obsolete', 'dated', 'historical'])

export interface LevelResult {
  level: (CefrLevel | null)[]
  counts: Record<string, number>
  coreMissing: string[]
}

export function assignLevels(
  entries: GdEntry[],
  rank: (number | null)[],
  themes: Theme[],
  index: FormIndex
): LevelResult {
  const level: (CefrLevel | null)[] = entries.map(() => null)
  const coreMissing: string[] = []
  for (const th of themes)
    for (const w of th.words) {
      const ids = resolveCore(w, index, rank)
      if (!ids.length) coreMissing.push(w.word)
      for (const i of ids) level[i] = 'A1'
    }
  entries.forEach((e, i) => {
    if (level[i] || rank[i] === null) return
    if (FUNCTION_POS.has(e.data.p[0]) && rank[i]! <= FUNCTION_TOP) level[i] = 'A1'
  })
  const order = entries
    .map((e, i) => ({ e, i, r: rank[i] }))
    .filter((x) => x.r !== null && !level[x.i] && !NO_FREQ_LEVEL.has(x.e.data.p[0]))
    .sort((a, b) => a.r! - b.r!)
  let total = level.filter(Boolean).length
  const old = (e: GdEntry): boolean => e.data.s.every((s) => s.t?.some((t) => OLD.has(t)))
  for (const { e, i } of order) {
    total++
    let lv: CefrLevel = 'C2'
    for (const [l, upTo] of CUTOFFS)
      if (total <= upTo) {
        lv = l
        break
      }
    if (old(e) && (lv === 'A2' || lv === 'B1' || lv === 'B2')) lv = 'C1'
    level[i] = lv
  }
  const counts: Record<string, number> = {}
  for (const l of level) if (l) counts[l] = (counts[l] ?? 0) + 1
  return { level, counts, coreMissing }
}
