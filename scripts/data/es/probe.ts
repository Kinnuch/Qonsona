/**
 * 开发用：用软件自己的读库代码（src/main/lang/lexdb.ts 的 LexDb）看西语词典查得怎么样。
 *   node scripts/data/run-ts.mjs scripts/data/es/probe.ts dámelo hablábamos casas         阅读器查词（lookup）
 *   node scripts/data/run-ts.mjs scripts/data/es/probe.ts --search 猫                      词典搜索（search）
 *   node scripts/data/run-ts.mjs scripts/data/es/probe.ts --entry casa                     词条全文
 *   node scripts/data/run-ts.mjs scripts/data/es/probe.ts --list cefr:A1 --n 80            词表
 *   node scripts/data/run-ts.mjs scripts/data/es/probe.ts --text "¿Dónde está la estación?" 整句切词与对词
 * --db <文件> 换一个库（默认 resources/data/es/dict.sqlite）。
 */
import { join } from 'node:path'
import { LexDb } from '../../../src/main/lang/lexdb'
import { rules } from '../../../src/shared/lang/es/rules'
import { dataDir } from '../../lang/lexdb-writer'

const args = process.argv.slice(2)
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name)
  if (i < 0) return undefined
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const file = opt('--db') ?? join(dataDir('es'), 'dict.sqlite')
const search = opt('--search')
const entry = opt('--entry')
const list = opt('--list')
const text = opt('--text')
const n = Number(opt('--n') ?? 40)
const db = new LexDb('es', file)

const show = (w: string): void => {
  const h = db.lookup(w)
  console.log(
    h
      ? `${w} → ${h.lemma}（${h.pos}${h.lv ? ' ' + h.lv : ''}）${h.tags.length ? '[' + h.tags.join(' ') + '] ' : ''}${h.zh || h.en}`
      : `${w} → （查不到）`
  )
}

if (search) {
  for (const h of db.search(search, n).hits)
    console.log(
      `${h.match}\t${h.w}\t${h.p.join(',')}${h.g ? ' ' + h.g : ''}\t${h.lv ?? ''}\t${h.zh ?? ''}\t${h.en ?? ''}`
    )
} else if (entry) {
  // 同一个词头的几个词条（词性、阴阳性不同）都列出来；--full 打出整个 JSON
  const full = args.includes('--full')
  for (const hit of db.search(entry, 20).hits.filter((h) => h.match === 'exact')) {
    const v = db.entry(hit.id)
    if (!v) continue
    if (full) {
      console.log(JSON.stringify(v, null, 1))
      continue
    }
    const lv = v.levels.map((l) => `${l.system}:${l.levels.map((x) => x.id).join('/')}`).join(' ')
    console.log(
      `== ${v.w}（${v.p.join(',')}${v.g ? ' ' + v.g : ''}）${lv} 名次 ${v.freq ?? '-'}  IPA ${v.ipa.join(' ')}` +
        `${v.x.ipaV ? ' ' + JSON.stringify(v.x.ipaV) : ''}  录音 ${v.au.length}  变形 ${v.forms.length}` +
        `${v.cls.length ? '  ' + v.cls.join(',') : ''}`
    )
    for (const s of v.senses.slice(0, 8))
      console.log(
        `   - ${s.en.slice(0, 3).join('; ')}${s.tags.length ? ' {' + s.tags.join(',') + '}' : ''}` +
          `${s.zh.length ? `  〔${s.zhSource?.id}〕${s.zh.join('；')}` : ''}${s.mono.length ? `  «${s.mono[0].slice(0, 70)}»` : ''}`
      )
    for (const e of v.examples.slice(0, 3))
      console.log(
        `   ex ${e.lv ?? '--'} ${e.text} / ${e.zh ?? ''}${e.zs ? `〔${e.zs}〕` : ''} / ${e.en ?? ''}`
      )
  }
} else if (list) {
  for (const it of db.list(list, n))
    console.log(
      `${it.lv ?? ''}\t${it.w}\t${it.p.join(',')}${it.g ? ' ' + it.g : ''}\t${it.zh || it.en}`
    )
} else if (text) {
  for (const t of rules.tokenize!(text)) if (t.kind === 'word') show(t.text)
} else for (const w of args) show(w)
