/**
 * 词条分级：阿拉伯语没有开放许可的 CEFR 词表（Kelly 项目的阿语表是 CC BY-NC-SA 2.0，SAMER 只许内部研究），
 * 所以按「归到原形上的词频」排名切分（依据与各级词数见 docs/lang/ar.md「分级」）：
 *   - 参加分级的：标准语里常用的词条——专名、字母与符号、词缀、只在方言或古典里用的不参加；
 *   - 排名用 wordfreq 的频率（维基百科、字幕、新闻、网页、推特），再给 Tatoeba 例句里出现的词加一点权重
 *     （日常会话的词在新闻语料里偏少：苹果、厨房、牙刷……）；
 *   - 各级的词数参照 Kelly 项目阿语表（Kilgarriff et al. 2014，专家逐词定级）的规模：
 *     A1 775、A2 1246、B1 1553、B2 1703、C1 1440、C2 2176（累计 775 / 2021 / 3574 / 5277 / 6717 / 8893），
 *     取整成下面的累计名次；只用它的规模，不用它的词。
 */
import type { CefrLevel } from '../../../src/shared/lang/types'

/** CEFR 各级的上限（累计名次） */
export const CEFR_CUTS: [CefrLevel, number][] = [
  ['A1', 750],
  ['A2', 2000],
  ['B1', 3500],
  ['B2', 5300],
  ['C1', 7000],
  ['C2', 9000]
]

/**
 * ACTFL 小级的上限（累计名次）。按 ACTFL 官方的对照（Assigning CEFR Ratings to ACTFL Assessments，2016，
 * 听、读那一张表——词汇量看的是认读）：Novice Low / Mid 在 A1 以下，Novice High = A1.1，
 * Intermediate Low = A1.2，Intermediate Mid = A2，Intermediate High = B1.1，Advanced Low = B1.2，
 * Advanced Mid = B2，Advanced High = C1.1，Superior = C1.2，Distinguished = C2。
 * 所以 A1 的 750 个词再分成四个小级，B1、C1 各分前后两半。
 */
export const ACTFL_CUTS: [string, number][] = [
  ['NL', 100],
  ['NM', 300],
  ['NH', 500],
  ['IL', 750],
  ['IM', 2000],
  ['IH', 2750],
  ['AL', 3500],
  ['AM', 5300],
  ['AH', 6150],
  ['S', 7000],
  ['D', 9000]
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
