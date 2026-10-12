/**
 * 看一句英语在阅读器里怎么切、每个词对上什么（原形、词性、标签），认出了哪些语法点：
 *   node scripts/data/run-ts.mjs scripts/data/en/grammar-probe.ts "She has already eaten." "I'm going to call him."
 *   node scripts/data/run-ts.mjs scripts/data/en/grammar-probe.ts --point present-perfect   看一个语法点的例句认得怎样
 *   node scripts/data/run-ts.mjs scripts/data/en/grammar-probe.ts --tatoeba present-perfect 200
 *       在 Tatoeba 句子里找这个语法点，列出认出的前 200 句（看有没有错认）
 * 要先建好 resources/data/en/dict.sqlite。
 */
import { join } from 'node:path'
import { analyzeLex } from '../../../src/main/lang/analyze'
import { LexDb } from '../../../src/main/lang/lexdb'
import en from '../../../src/shared/lang/en'
import { cacheDir, dataDir } from '../../lang/lexdb-writer'
import { readBz2 } from './tatoeba'

const db = new LexDb('en', join(dataDir('en'), 'dict.sqlite'))
const args = process.argv.slice(2)
const points = en.grammar ?? []

function show(text: string, only?: string): boolean {
  const a = analyzeLex(db, text)
  const hits = a.grammar.filter((h) => !only || h.id === only)
  if (only && !hits.length) return false
  console.log(`\n${text}`)
  for (const s of a.sentences)
    for (const t of s.tokens) {
      if (t.kind === 'space') continue
      const extra = [t.pos, t.tags?.join(' '), t.alt?.map((x) => x.join(' ')).join(' | ')]
        .filter(Boolean)
        .join(' · ')
      console.log(`  ${t.text.padEnd(16)} ${(t.lemma ?? '').padEnd(14)} ${extra}`)
    }
  for (const h of hits) console.log(`  ⇒ ${h.id}：「${text.slice(h.start, h.end)}」`)
  return true
}

if (args[0] === '--point') {
  const p = points.find((x) => x.id === args[1])
  if (!p) throw new Error(`没有语法点 ${args[1]}`)
  for (const ex of p.examples) {
    const a = analyzeLex(db, ex.text)
    const got = a.grammar.filter((h) => h.id === p.id).map((h) => ex.text.slice(h.start, h.end))
    console.log(
      `${got.includes(ex.hl ?? '') ? '✓' : '✗'} ${ex.text}  hl=「${ex.hl}」 认出=${JSON.stringify(got)}`
    )
  }
} else if (args[0] === '--tatoeba') {
  const id = args[1]
  const limit = Number(args[2] ?? 100)
  const lines = readBz2(join(cacheDir('en'), 'tatoeba-eng_sentences_detailed.tsv.bz2')).split('\n')
  let shown = 0
  let tried = 0
  for (const line of lines) {
    const c = line.split('\t')
    if (c[1] !== 'eng' || !c[2]) continue
    tried++
    const a = analyzeLex(db, c[2])
    const hits = a.grammar.filter((h) => h.id === id)
    if (!hits.length) continue
    console.log(`${c[2]}   ⇒ ${hits.map((h) => `「${c[2].slice(h.start, h.end)}」`).join(' ')}`)
    if (++shown >= limit) break
  }
  console.log(`（看了 ${tried} 句）`)
} else for (const t of args) show(t)
db.close()
