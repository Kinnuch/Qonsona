/**
 * 开发用：拿 ELELex（CEFRLex 项目，按教材统计的各级词频，CC BY-NC-SA 4.0）校准分级的切分点。
 * ELELex 只在这里读，结果（六个切分点）写进 levels.ts 的 CUTS；它的数据不进库、不随软件分发。
 *
 * 做法：ELELex 里一个词「首次出现」的级别（至少两本教材用到才算，免得偶然出现一次就算进低级），
 * 对上我们的词（同词头、同大类词性），看它在我们的名次里落在哪里：
 * - 现在的切分点下两边的级别对照表、平均级差；
 * - 按分位数对齐给出的建议切分点：ELELex 里 A1 词占几成，我们就把同样比例的名次切给 A1，依此类推。
 */
import { existsSync, readFileSync } from 'node:fs'
import { LEVELS } from './levels'

/** FreeLing 的词性 → kaikki 的大类 */
const TAG: [RegExp, string][] = [
  [/^NC/, 'noun'],
  [/^NP/, 'name'],
  [/^V/, 'verb'],
  [/^AQ|^AO/, 'adj'],
  [/^RG|^RN/, 'adv'],
  [/^SP/, 'prep'],
  [/^CC|^CS/, 'conj'],
  [/^P/, 'pron'],
  [/^D/, 'det'],
  [/^I/, 'intj'],
  [/^Z/, 'num']
]

export interface CalibInput {
  word: string
  kpos: string
  /** 在能分级的词里的名次（0 = 不分级） */
  rank: number
}

export function calibrate(file: string, items: CalibInput[], cuts: number[]): void {
  if (!existsSync(file)) {
    console.log(`  （没有 ${file}，跳过校准）`)
    return
  }
  const lines = readFileSync(file, 'utf8').split('\n')
  const elelex = new Map<string, number>()
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split('\t').map((s) => s.replace(/^"|"$/g, ''))
    if (c.length < 14) continue
    const word = c[0].replace(/_/g, ' ')
    const kpos = TAG.find(([re]) => re.test(c[1]))?.[1]
    if (!kpos) continue
    const docs = c.slice(8, 13).map(Number)
    const first = docs.findIndex((d) => d >= 2)
    if (first < 0) continue
    const k = `${word}\t${kpos}`
    const prev = elelex.get(k)
    if (prev === undefined || first < prev) elelex.set(k, first)
  }
  const POS_GROUP: Record<string, string> = {
    article: 'det',
    contraction: 'prep',
    prep_phrase: 'prep',
    adv_phrase: 'adv'
  }
  const pairs: { rank: number; lv: number }[] = []
  for (const it of items) {
    if (!it.rank) continue
    const lv = elelex.get(`${it.word}\t${POS_GROUP[it.kpos] ?? it.kpos}`)
    if (lv !== undefined) pairs.push({ rank: it.rank, lv })
  }
  const levelOf = (rank: number): number => {
    for (let i = 0; i < cuts.length; i++) if (rank <= cuts[i]) return i
    return cuts.length
  }
  // 对照表：行 = ELELex（A1–C1），列 = 我们（A1–C2、不分级）
  const table = Array.from({ length: 5 }, () => new Array(7).fill(0))
  let diff = 0
  for (const p of pairs) {
    const ours = levelOf(p.rank)
    table[p.lv][ours]++
    diff += Math.abs(Math.min(ours, 5) - p.lv)
  }
  console.log(
    `  ELELex 校准：两边都有的词 ${pairs.length} 个，平均级差 ${(diff / pairs.length).toFixed(2)}`
  )
  console.log(`    ELELex\\我们  ${[...LEVELS, '—'].join('\t')}`)
  table.forEach((row, i) => console.log(`    ${LEVELS[i]}\t\t${row.join('\t')}`))
  // 分位数对齐
  const ranks = pairs.map((p) => p.rank).sort((a, b) => a - b)
  const share = [0, 1, 2, 3, 4].map((k) => pairs.filter((p) => p.lv <= k).length / pairs.length)
  const suggest = share.map((s) => ranks[Math.min(ranks.length - 1, Math.floor(s * ranks.length))])
  console.log(`    按分位数对齐的建议切分点（A1–C1）：${suggest.join(' / ')}`)
  // 几组候选切分点的平均级差（只看 A1–C1 那几级的边界，C2 以后 ELELex 没有）
  for (const alt of [
    [700, 1800, 3500, 6000, 10000, 16000],
    [800, 2000, 4000, 6500, 10000, 16000],
    [1000, 2500, 4500, 7000, 11000, 18000],
    [1200, 3000, 5500, 8500, 12000, 20000],
    [2148, 5021, 9099, 15831, 25000, 40000]
  ]) {
    const lv = (rank: number): number => {
      for (let i = 0; i < alt.length; i++) if (rank <= alt[i]) return i
      return alt.length
    }
    let d = 0
    let exact = 0
    for (const p of pairs) {
      const o = Math.min(lv(p.rank), 5)
      d += Math.abs(o - p.lv)
      if (o === p.lv) exact++
    }
    console.log(
      `    切分点 ${alt.join('/')}：平均级差 ${(d / pairs.length).toFixed(2)}，同级 ${((exact / pairs.length) * 100).toFixed(0)}%`
    )
  }
  // 各级 ELELex 词在我们名次里的中位数
  const med = [0, 1, 2, 3, 4].map((k) => {
    const r = pairs
      .filter((p) => p.lv === k)
      .map((p) => p.rank)
      .sort((a, b) => a - b)
    return r[Math.floor(r.length / 2)] ?? 0
  })
  console.log(`    ELELex 各级的词在我们名次里的中位数：${med.join(' / ')}`)
}
