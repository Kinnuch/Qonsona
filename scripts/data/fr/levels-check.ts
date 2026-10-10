/**
 * 拿 FLELex（Beacco 版，CC BY-NC-SA 4.0，只在本机核对、不进库）核对法语词典的分级：
 *   node scripts/data/run-ts.mjs scripts/data/fr/levels-check.ts [库文件]
 * 1. 切点：在我们的词频名次里找位置，使位置之前的 FLELex 词数正好等于 FLELex 到这一级为止的词数
 *    （levels.ts 的 CUTS 就是照这个定的）；
 * 2. 一致率：库里的等级跟 FLELex 的等级同级、差一级以内的比例，以及分级混淆表。
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CefrLevel, LexEntryData, PosTag } from '../../../src/shared/lang/types'
import { CEFR_LEVELS } from '../../../src/shared/lang/types'
import { frKey } from '../../../src/shared/lang/fr/rules'
import { unpackEntry } from '../../../src/main/lang/lexdb-schema'
import { dataDir } from '../../lang/lexdb-writer'
import { fetchFile } from './fetch'
import { DOWNLOADS } from './sources'

const file = process.argv[2] ?? join(dataDir('fr'), 'dict.sqlite')
const flelex = await fetchFile(DOWNLOADS.flelexBeacco.url, DOWNLOADS.flelexBeacco.file)

/** TreeTagger 的词类 → UPOS */
const TAG: Record<string, PosTag> = {
  NOM: 'noun',
  VER: 'verb',
  ADJ: 'adj',
  ADV: 'adv',
  PRP: 'adp',
  KON: 'sconj',
  PRO: 'pron',
  DET: 'det',
  NUM: 'num',
  INT: 'intj'
}

const gold = new Map<string, CefrLevel>()
for (const line of readFileSync(flelex, 'utf8').split(/\r?\n/).slice(1)) {
  const c = line.split('\t')
  const level = c[9]?.trim() as CefrLevel
  if (!CEFR_LEVELS.includes(level)) continue
  const pos = TAG[(c[1] ?? '').split(':')[0]]
  const key = `${frKey(c[0])}|${pos ?? ''}`
  if (!gold.has(key)) gold.set(key, level)
}

const db = new DatabaseSync(file, { readOnly: true })
const rows = db.prepare('SELECT w, p, fr, lv, data FROM entry').all() as {
  w: string
  p: string
  fr: number | null
  lv: string | null
  data: Uint8Array
}[]
interface Row {
  key: string
  rank: number | null
  lv: CefrLevel | null
  gold: CefrLevel
}
const matched: Row[] = []
const seen = new Set<string>()
for (const r of rows) {
  const d: LexEntryData = unpackEntry(r.data)
  const pos = d.p[0] === 'cconj' ? 'sconj' : d.p[0]
  const key = `${frKey(d.w)}|${pos}`
  const g = gold.get(key)
  if (!g || seen.has(key)) continue
  seen.add(key)
  matched.push({ key, rank: r.fr, lv: (r.lv as CefrLevel) ?? null, gold: g })
}
console.log(`FLELex/Beacco ${gold.size} 个原形，库里对上 ${matched.length} 个`)

// 1. 切点
const ranked = matched.filter((m) => m.rank).sort((a, b) => a.rank! - b.rank!)
let cum = 0
const cuts: string[] = []
for (const l of CEFR_LEVELS) {
  cum += ranked.filter((m) => m.gold === l).length
  const at = ranked[Math.min(cum, ranked.length) - 1]
  cuts.push(`${l}: ${at?.rank ?? '-'}（FLELex 累计 ${cum}）`)
}
console.log('按 FLELex 各级词数定的切点（名次）：\n  ' + cuts.join('\n  '))

// 2. 一致率
const idx = (l: CefrLevel | null): number => (l ? CEFR_LEVELS.indexOf(l) : 6)
const withLv = matched.filter((m) => m.lv)
const exact = withLv.filter((m) => m.lv === m.gold).length
const near = withLv.filter((m) => Math.abs(idx(m.lv) - idx(m.gold)) <= 1).length
console.log(
  `库里的等级 vs FLELex（${withLv.length} 个两边都有级的词）：同级 ${((exact / withLv.length) * 100).toFixed(1)}%，差一级以内 ${((near / withLv.length) * 100).toFixed(1)}%`
)
const head = ['', ...CEFR_LEVELS, '无'].map((x) => x.padStart(6)).join('')
console.log('混淆表（行：FLELex，列：库里）\n' + head)
for (const g of CEFR_LEVELS) {
  const cells = [...CEFR_LEVELS, null].map((l) =>
    String(matched.filter((m) => m.gold === g && m.lv === l).length).padStart(6)
  )
  console.log(g.padStart(6) + cells.join(''))
}
