/**
 * 词条分级：阿拉伯语没有开放许可的 CEFR 词表（Kelly 项目的阿语表是 CC BY-NC-SA，SAMER 只许内部研究），
 * 所以按「归到原形上的词频」排名切分（依据与各级词数见 docs/lang/ar.md「分级」）：
 *   - 参加分级的：标准语里常用的词条——专名、字母与符号、词缀、只在方言或古典里用的不参加；
 *   - 排名用 wordfreq 的频率（维基百科、字幕、新闻、网页、推特），再给 Tatoeba 例句里出现的词加一点权重
 *     （日常会话的词在新闻语料里偏少：苹果、厨房、牙刷……）；
 *   - 按名次切成 CEFR 六级；ACTFL 的十一个小级在 CEFR 各级里再按名次细分（对应关系见 spec.ts）。
 */
import type { CefrLevel } from '../../../src/shared/lang/types'

/** CEFR 各级的上限（累计名次）：A1 前 700 个，A2 到 1700…… */
export const CEFR_CUTS: [CefrLevel, number][] = [
  ['A1', 700],
  ['A2', 1700],
  ['B1', 3300],
  ['B2', 5500],
  ['C1', 8500],
  ['C2', 13000]
]

/**
 * ACTFL 小级的上限（累计名次）。跟 CEFR 的对应按 ACTFL 官方的对照（见 spec.ts 的 cefr 字段）：
 * Novice 三级在 A1 里，Intermediate Low / Mid 在 A2，Intermediate High 在 B1 前半，Advanced Low 在 B1 后半，
 * Advanced Mid / High 在 B2，Superior 在 C1，Distinguished 在 C2。
 */
export const ACTFL_CUTS: [string, number][] = [
  ['NL', 150],
  ['NM', 400],
  ['NH', 700],
  ['IL', 1150],
  ['IM', 1700],
  ['IH', 2500],
  ['AL', 3300],
  ['AM', 4300],
  ['AH', 5500],
  ['S', 8500],
  ['D', 13000]
]

const levelAt = <T extends string>(cuts: [T, number][], rank: number): T | undefined =>
  cuts.find(([, max]) => rank <= max)?.[0]

export const cefrOf = (rank: number): CefrLevel | undefined => levelAt(CEFR_CUTS, rank)
export const actflOf = (rank: number): string | undefined => levelAt(ACTFL_CUTS, rank)

export interface Leveled {
  cefr: CefrLevel
  actfl: string
  /** 参加分级的词条里的名次 */
  rank: number
}

/**
 * 给参加分级的词条排名、分级。score 越大越常用；eligible 为假的不参加。
 * 返回 词条下标 → 等级
 */
export function assignLevels(
  score: Float64Array,
  eligible: (i: number) => boolean
): Map<number, Leveled> {
  const order = [...score.keys()]
    .filter((i) => score[i] > 0 && eligible(i))
    .sort((a, b) => score[b] - score[a])
  const out = new Map<number, Leveled>()
  order.forEach((i, k) => {
    const rank = k + 1
    const cefr = cefrOf(rank)
    const actfl = actflOf(rank)
    if (cefr && actfl) out.set(i, { cefr, actfl, rank })
  })
  return out
}
