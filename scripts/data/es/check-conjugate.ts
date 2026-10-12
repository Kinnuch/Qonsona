/**
 * 开发用：拿词典库里维基词典的变位表核对 src/shared/lang/es/conjugate.ts 按规则推出来的表。
 *   node scripts/data/run-ts.mjs scripts/data/es/check-conjugate.ts [--show 20]
 * 只核对规则动词与有变位类别的动词（标了 irregular 的不比）；按类别列出整表全对的比例，再列几个错的格子。
 */
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { unpackEntry } from '../../../src/main/lang/lexdb-schema'
import { conjugate } from '../../../src/shared/lang/es/conjugate'
import { dataDir } from '../../lang/lexdb-writer'

const show = Number(process.argv[process.argv.indexOf('--show') + 1]) || 15
const only = process.argv.includes('--class')
  ? process.argv[process.argv.indexOf('--class') + 1]
  : null
const db = new DatabaseSync(join(dataDir('es'), 'dict.sqlite'), { readOnly: true })
const byClass = new Map<string, { verbs: number; perfect: number; cells: number; wrong: number }>()
const samples: string[] = []
for (const r of db.prepare("SELECT w, data FROM entry WHERE p = 'verb'").all() as {
  w: string
  data: Uint8Array
}[]) {
  const d = unpackEntry(r.data)
  // 带 -se 的代词式动词：表里是代词式的形式（quejándose、quéjate），推的是不带代词的，不比
  if (!d.f?.length || d.cls?.includes('irregular') || d.w.includes(' ') || /se$/.test(d.w)) continue
  const classes = (d.cls ?? []).filter((c) => !c.startsWith('-'))
  const want = new Map<string, string>()
  for (const [form, ...tags] of d.f)
    if (!tags.includes('alternative') && !tags.includes('obsolete'))
      want.set([...tags].sort().join(' '), form)
  const got = new Map(conjugate(d.w, classes).map(([f, ...t]) => [t.join(' '), f]))
  const key = classes.join('+') || '（规则）'
  if (only && key !== only) continue
  const s = byClass.get(key) ?? { verbs: 0, perfect: 0, cells: 0, wrong: 0 }
  s.verbs++
  let bad = 0
  for (const [tags, form] of want) {
    s.cells++
    if (got.get(tags) !== form) {
      bad++
      s.wrong++
      if (samples.length < show)
        samples.push(`${d.w} [${key}] ${tags}: 表里 ${form}，推出 ${got.get(tags) ?? '（没有）'}`)
    }
  }
  if (!bad) s.perfect++
  byClass.set(key, s)
}
let verbs = 0
let perfect = 0
for (const [k, s] of [...byClass].sort((a, b) => b[1].verbs - a[1].verbs)) {
  verbs += s.verbs
  perfect += s.perfect
  console.log(
    `${k.padEnd(14)} 动词 ${String(s.verbs).padStart(5)}，整表全对 ${((s.perfect / s.verbs) * 100).toFixed(1)}%，格子错 ${s.wrong}/${s.cells}`
  )
}
console.log(`合计 ${verbs} 个动词，整表全对 ${((perfect / verbs) * 100).toFixed(1)}%`)
for (const x of samples) console.log('  ' + x)
