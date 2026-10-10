/**
 * 法语词典的统计（写文档、汇报用）：各级词数与中文覆盖、各来源的贡献、录音与读音、例句。
 *   node scripts/data/run-ts.mjs scripts/data/fr/stats.ts
 */
import { DatabaseSync } from 'node:sqlite'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { unpackEntry } from '../../../src/main/lang/lexdb-schema'
import { dataDir } from '../../lang/lexdb-writer'

const file = process.argv[2] ?? join(dataDir('fr'), 'dict.sqlite')
const db = new DatabaseSync(file, { readOnly: true })
const rows = db.prepare('SELECT fr, lv, data FROM entry').all() as {
  fr: number | null
  lv: string | null
  data: Uint8Array
}[]
const lv = new Map<string, { n: number; zh: number; ipa: number; au: number }>()
const zs = new Map<string, number>()
const pos = new Map<string, number>()
let senses = 0
let monoEntries = 0
let fiEntries = 0
let audio = 0
let ipa = 0
for (const r of rows) {
  const d = unpackEntry(r.data)
  const k = r.lv ?? '无'
  const o = lv.get(k) ?? { n: 0, zh: 0, ipa: 0, au: 0 }
  o.n++
  if (d.s.some((s) => s.zh?.length)) o.zh++
  if (d.ipa?.length) o.ipa++
  if (d.au?.length) o.au++
  lv.set(k, o)
  pos.set(d.p[0], (pos.get(d.p[0]) ?? 0) + 1)
  for (const s of d.s) {
    senses++
    if (s.zs) zs.set(s.zs, (zs.get(s.zs) ?? 0) + 1)
  }
  if (d.s.some((s) => s.mono?.length)) monoEntries++
  if (d.fi) fiEntries++
  if (d.au?.length) audio++
  if (d.ipa?.length) ipa++
}
const pct = (a: number, b: number): string => `${Math.round((a / b) * 100)}%`
console.log(
  `${file}  ${(statSync(file).size / 1048576).toFixed(1)} MB，词条 ${rows.length}，义项 ${senses}`
)
console.log('各级（词数 / 有中文 / 有 IPA / 有录音）：')
for (const l of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', '无']) {
  const o = lv.get(l)
  if (o) console.log(`  ${l} ${o.n} / ${pct(o.zh, o.n)} / ${pct(o.ipa, o.n)} / ${pct(o.au, o.n)}`)
}
console.log('中文释义的来源（义项数）：' + [...zs].map(([k, n]) => `${k} ${n}`).join('，'))
console.log(`有法语释义 ${monoEntries}，有变形读音 ${fiEntries}，有录音 ${audio}，有 IPA ${ipa}`)
console.log(
  '词性：' +
    [...pos]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join('，')
)
const ex = db
  .prepare(
    'SELECT src, COUNT(*) n, SUM(zh IS NOT NULL) zh, SUM(en IS NOT NULL) en FROM example GROUP BY src'
  )
  .all()
console.log('例句：' + JSON.stringify(ex))
console.log(
  '查词键：' + JSON.stringify(db.prepare('SELECT loose, COUNT(*) n FROM form GROUP BY loose').all())
)
