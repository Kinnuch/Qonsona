/**
 * 法语词的 CEFR 等级与词频段。
 *
 * 1. 按词频名次切（名次来自 Lexique 字幕 + 书籍的合成词频，见 lexique.ts）。切点 CUTS 是这样定的：
 *    拿 FLELex/Beacco 版（按 FLE 教材统计、对照 Beacco 等的《法语参考水平》定级的 1.4 万个原形）当参照，
 *    在我们的名次里找一个位置，使这个位置之前的 FLELex 词数正好等于 FLELex 到这一级为止的词数
 *    （scripts/data/fr/levels-check.ts 算，结果抄在这里）。FLELex 是 CC BY-NC-SA，只用来定这六个数和核对，
 *    词表本身不进库。
 * 2. 手挑的 A1、A2 核心词（data/fr/core.txt）：取两者里容易的那个。
 * 3. 语体：义项全是粗俗、冒犯的至少 B2，全是口语、俚语的至少 B1，全是古旧、书面、罕用的至少 C1。
 * 没有词频、也不在核心词里的（冷僻词、专名）不分级。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CefrLevel, PosTag } from '../../../src/shared/lang/types'
import { CEFR_LEVELS } from '../../../src/shared/lang/types'
import { frKey } from '../../../src/shared/lang/fr/rules'
import { FREQ_BANDS } from '../../../src/shared/lang/fr/spec'

/**
 * 每一级的最后一个名次。A1–C1 是 levels-check.ts 按 FLELex/Beacco 各级的词数算出的切点（取整）：
 * 1387、2132、4164、12477、22793；C2 照算是 51545，但 4 万名以后多是专业词、FLELex 里也只剩零星几个，
 * 定在 40000，再往后的不分级
 */
export const CUTS: Record<CefrLevel, number> = {
  A1: 1400,
  A2: 2150,
  B1: 4200,
  B2: 12500,
  C1: 22800,
  C2: 40000
}

export function levelOfRank(rank: number | undefined): CefrLevel | undefined {
  if (!rank) return undefined
  for (const l of CEFR_LEVELS) if (rank <= CUTS[l]) return l
  return undefined
}

export function bandOfRank(rank: number | undefined): string | undefined {
  if (!rank) return undefined
  for (const [id, upTo] of FREQ_BANDS) if (rank <= upTo) return id
  return undefined
}

const idx = (l: CefrLevel): number => CEFR_LEVELS.indexOf(l)
export const easier = (
  a: CefrLevel | undefined,
  b: CefrLevel | undefined
): CefrLevel | undefined => (!a ? b : !b ? a : idx(a) <= idx(b) ? a : b)
export const harder = (
  a: CefrLevel | undefined,
  b: CefrLevel | undefined
): CefrLevel | undefined => (!a ? b : !b ? a : idx(a) >= idx(b) ? a : b)

const VULGAR = new Set(['vulgar', 'offensive', 'derogatory', 'pejorative', 'very-familiar'])
const COLLOQ = new Set(['colloquial', 'informal', 'slang', 'familiar', 'Verlan', ...VULGAR])
const OLD = new Set(['archaic', 'obsolete', 'dated', 'literary', 'poetic', 'rare'])

/** 语体定的下限：每个义项都带这类标签才算 */
export function registerFloor(senseTags: string[][]): CefrLevel | undefined {
  if (!senseTags.length) return undefined
  const all = (set: Set<string>): boolean => senseTags.every((t) => t.some((x) => set.has(x)))
  if (all(VULGAR)) return 'B2'
  if (all(OLD)) return 'C1'
  if (all(COLLOQ)) return 'B1'
  return undefined
}

export interface CoreWord {
  lv: CefrLevel
  /** 指定的词性；* 不管 */
  pos: PosTag | '*'
  g?: 'm' | 'f'
}

/** data/fr/core.txt：键（frKey）→ 等级与词性 */
export function loadCore(root: string): Map<string, CoreWord[]> {
  const out = new Map<string, CoreWord[]>()
  const text = readFileSync(join(root, 'data', 'fr', 'core.txt'), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const [lv, pos, words] = line.split('|').map((s) => s.trim())
    if (!CEFR_LEVELS.includes(lv as CefrLevel) || !words)
      throw new Error(`core.txt 这行不对：${line}`)
    for (const raw of words.split(',')) {
      const m = /^(.+?)\s*(?:\((m|f)\))?$/.exec(raw.trim())
      if (!m) continue
      const k = frKey(m[1])
      const list = out.get(k) ?? []
      list.push({
        lv: lv as CefrLevel,
        pos: pos as PosTag | '*',
        ...(m[2] ? { g: m[2] as 'm' | 'f' } : {})
      })
      out.set(k, list)
    }
  }
  return out
}

/** 一个词条在核心词表里的等级（词性、性对得上才算；* 的不管词性，但专名只认写了 propn 的） */
export function coreLevel(
  core: Map<string, CoreWord[]>,
  key: string,
  pos: PosTag,
  g?: string
): CefrLevel | undefined {
  let best: CefrLevel | undefined
  for (const c of core.get(key) ?? []) {
    if (c.pos === '*' ? pos === 'propn' : c.pos !== pos) continue
    if (c.g && g && g !== 'mf' && c.g !== g) continue
    best = easier(best, c.lv)
  }
  return best
}

export interface CoreGloss {
  /** 英文义项的开头（小写） */
  sense: string
  zh: string[]
  /** 建库时有没有对上 */
  used?: boolean
}

/** data/fr/zh-core.txt：「键|词性」→ 各义项手写的中文 */
export function loadZhCore(root: string): Map<string, CoreGloss[]> {
  const out = new Map<string, CoreGloss[]>()
  const text = readFileSync(join(root, 'data', 'fr', 'zh-core.txt'), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const parts = line.split(' | ').map((x) => x.trim())
    if (parts.length !== 4 || !parts[3]) throw new Error(`zh-core.txt 这行不对：${line}`)
    const [w, pos, sense, zh] = parts
    const k = `${frKey(w)}|${pos}`
    const list = out.get(k) ?? []
    list.push({
      sense: sense.toLowerCase(),
      zh: zh
        .split('；')
        .map((x) => x.trim())
        .filter(Boolean)
    })
    out.set(k, list)
  }
  return out
}

/** data/fr/phrases.txt：感叹词、短语里要留的多词说法；别的词性里不收的多词词条（键|词性） */
export function loadPhraseRules(root: string): { keep: Set<string>; drop: Set<string> } {
  const keep = new Set<string>()
  const drop = new Set<string>()
  const text = readFileSync(join(root, 'data', 'fr', 'phrases.txt'), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const [kind, w, pos] = line.split(' | ').map((x) => x.trim())
    if (kind === 'keep' && w) keep.add(frKey(w))
    else if (kind === 'drop' && w && pos) drop.add(`${frKey(w)}|${pos}`)
    else throw new Error(`phrases.txt 这行不对：${line}`)
  }
  return { keep, drop }
}

export interface ExtraSense {
  pos: PosTag
  newPos?: PosTag
  en: string
  zh: string[]
}

/** data/fr/senses-extra.txt：维基词典漏了的常用义项（「键|词性」→ 义项） */
export function loadExtraSenses(root: string): Map<string, ExtraSense> {
  const out = new Map<string, ExtraSense>()
  const text = readFileSync(join(root, 'data', 'fr', 'senses-extra.txt'), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const [w, pos, newPos, en, zh] = line.split(' | ').map((x) => x.trim())
    if (!zh) throw new Error(`senses-extra.txt 这行不对：${line}`)
    out.set(`${frKey(w)}|${pos}`, {
      pos: pos as PosTag,
      ...(newPos && newPos !== '-' ? { newPos: newPos as PosTag } : {}),
      en,
      zh: zh.split('；').map((x) => x.trim())
    })
  }
  return out
}
