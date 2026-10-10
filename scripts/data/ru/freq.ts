/**
 * 词频：几份开放的词形频率表 → 每个词条（词元）的频率，再合成一个分数排名。
 *
 * - 词形对到词条用词典自己的变形表（form 表的键）；一个词形对上几个词条时（стали：сталь 的属格 / стать 的过去时）
 *   按各词条的总频率比例分（迭代几轮，开始时平分）。
 * - 来源：OpenSubtitles 2018 字幕（口语）、Tatoeba 的俄语句子（给学习者写的日常句子）、俄语维基百科（书面），
 *   再加 OpenRussian 的词元排名（按 Zipf 换成每百万次）。
 * - 合成：各来源每百万次的对数加权平均（字幕 0.3、Tatoeba 0.3、OpenRussian 0.25、维基百科 0.15）；
 *   某个来源里没有的按这个来源能表示的最小频率的一半算。维基百科权重低，免得「область、район、сезон」这类
 *   百科常用词排得太前；口语、日常句子权重高，学习者先要的是这些。
 */

/** 词形（rules.key 规整过）→ 可能的词条下标 */
export type FormIndex = Map<string, number[]>

export interface Source {
  name: string
  /** 词形 → 次数 */
  counts: Map<string, number>
  /** 全部词次（含对不上词条的） */
  total: number
}

/** 一份来源的词形次数分到词条上 */
export function lemmaCounts(
  src: Source,
  strict: FormIndex,
  loose: FormIndex,
  looseKey: (s: string) => string,
  n: number,
  /** 一个词形对上几个词条时挑哪些参与分（专名、字母、缩写不跟普通词分） */
  pick?: (cands: number[], form: string) => number[]
): Float64Array {
  const pairs: [number[], number][] = []
  for (const [form, c] of src.counts) {
    let cands = strict.get(form) ?? loose.get(looseKey(form))
    if (!cands) continue
    if (pick) cands = pick(cands, form)
    if (cands.length) pairs.push([cands, c])
  }
  let weight = new Float64Array(n).fill(1)
  let totals = new Float64Array(n)
  for (let iter = 0; iter < 4; iter++) {
    totals = new Float64Array(n)
    for (const [cands, c] of pairs) {
      if (cands.length === 1) {
        totals[cands[0]] += c
        continue
      }
      let sum = 0
      for (const i of cands) sum += weight[i]
      for (const i of cands) totals[i] += (c * weight[i]) / sum
    }
    weight = totals.map((x) => x + 0.5)
  }
  return totals
}

export interface Combined {
  /** 合成分数（每百万次的对数） */
  score: Float64Array
  /** 至少在一份来源里出现过 */
  seen: Uint8Array
}

/** 几份来源的词元频率合成一个分数 */
export function combine(
  parts: { counts: Float64Array; total: number; weight: number; floor?: number }[],
  n: number
): Combined {
  const score = new Float64Array(n)
  const seen = new Uint8Array(n)
  const wsum = parts.reduce((a, p) => a + p.weight, 0)
  for (const p of parts) {
    const scale = 1e6 / p.total
    // 这份来源能表示的最小频率的一半（没出现的按它算）
    const floor = p.floor ?? 0.5 * scale
    for (let i = 0; i < n; i++) {
      const ipm = p.counts[i] * scale
      if (p.counts[i] > 0) seen[i] = 1
      score[i] += (p.weight / wsum) * Math.log10(Math.max(ipm, floor))
    }
  }
  return { score, seen }
}

/** 词元排名 → 近似的每百万次（Zipf：第 r 名约 C / (r + 10)） */
export function rankToCounts(ranks: (number | null)[], total = 1e6): Float64Array {
  const out = new Float64Array(ranks.length)
  ranks.forEach((r, i) => {
    if (r && r > 0) out[i] = (440000 / (r + 10)) * (total / 1e6)
  })
  return out
}

/** 俄语词的切分（统计词频用，比 Intl.Segmenter 快）：字母、连字符连着的词 */
export const WORD_RE = /[\u{300}\u{301}А-Яа-яЁё]+(?:-[\u{300}\u{301}А-Яа-яЁё]+)*/gu
