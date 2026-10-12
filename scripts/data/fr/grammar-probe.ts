/**
 * 看法语句子在阅读器里怎么切、每个词对到哪个词条（原形、词性、标签），认出了哪些语法点：
 *   node scripts/data/run-ts.mjs scripts/data/fr/grammar-probe.ts "Je ne l'ai pas vu." "Il faut que tu viennes."
 *   node scripts/data/run-ts.mjs scripts/data/fr/grammar-probe.ts --point a2-passe-compose-avoir   在 Tatoeba 里找这个语法点
 * 写语法点的 patterns 时用：先看例句的词长什么样，再写条件。
 */
import { join } from 'node:path'
import { LexDb } from '../../../src/main/lang/lexdb'
import { analyzeLex } from '../../../src/main/lang/analyze'
import fr from '../../../src/shared/lang/fr'
import { dataDir } from '../../lang/lexdb-writer'
import { loadTatoeba } from './tatoeba'
import { loadCedict } from './zh-sources'

const db = new LexDb('fr', join(dataDir('fr'), 'dict.sqlite'))
const args = process.argv.slice(2)
const pi = args.indexOf('--point')

function show(text: string): void {
  const a = analyzeLex(db, text)
  console.log(`\n「${text}」  难度 ${a.level ?? '-'}`)
  for (const s of a.sentences)
    for (const t of s.tokens) {
      if (t.kind === 'space') continue
      const info = t.lemma
        ? `${t.lemma} [${t.pos}] ${(t.tags ?? []).join(' ')}${t.alt?.length ? ` | alt ${t.alt.map((x) => x.join(' ')).join(' / ')}` : ''}${t.ruby ? `  ${t.ruby}` : ''}`
        : `(${t.kind})`
      console.log(`  ${t.text.padEnd(16)} ${info}`)
    }
  for (const g of a.grammar) console.log(`  ▶ ${g.id}「${text.slice(g.start, g.end)}」`)
}

if (pi >= 0) {
  const id = args[pi + 1]
  const point = (fr.grammar ?? []).find((p) => p.id === id)
  if (!point) throw new Error(`没有语法点 ${id}`)
  const limit = Number(args[pi + 2] ?? 30)
  const cedict = await loadCedict()
  const tat = await loadTatoeba(cedict.t2s)
  let found = 0
  for (const s of tat) {
    if (s.text.length > 90) continue
    const a = analyzeLex(db, s.text)
    const hits = a.grammar.filter((g) => g.id === id)
    if (!hits.length) continue
    console.log(`${s.text}  ⟶  ${hits.map((h) => `「${s.text.slice(h.start, h.end)}」`).join(' ')}`)
    if (++found >= limit) break
  }
} else for (const t of args) show(t)
