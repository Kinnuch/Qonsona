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

/** 每一级的最后一个名次（levels-check.ts 按 FLELex 各级词数算出） */
export const CUTS: Record<CefrLevel, number> = {
  A1: 1300,
  A2: 2600,
  B1: 5500,
  B2: 12500,
  C1: 20000,
  C2: 32000
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
