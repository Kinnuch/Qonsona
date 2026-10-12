/**
 * 看盖尔语的句子在阅读器里怎么切、每个词对上哪个词条（原形、词性、标签、读音）、认出了哪些语法点：
 *   node scripts/data/run-ts.mjs scripts/data/gd/probe.ts "Tha mi a' dol dhachaigh." "Chunnaic mi an cù."
 *   node scripts/data/run-ts.mjs scripts/data/gd/probe.ts --file 文章.txt
 *   node scripts/data/run-ts.mjs scripts/data/gd/probe.ts --point gd-progressive   （语法点的例句逐句验）
 * 用的是生成好的 resources/data/gd/dict.sqlite 与主进程的 analyzeLex（跟阅读器一模一样）。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeLex } from '../../../src/main/lang/analyze'
import { LexDb } from '../../../src/main/lang/lexdb'
import gd from '../../../src/shared/lang/gd'
import { dataDir } from '../../lang/lexdb-writer'

const db = new LexDb('gd', join(dataDir('gd'), 'dict.sqlite'))
const args = process.argv.slice(2)
const texts: string[] = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file') texts.push(readFileSync(args[++i], 'utf8'))
  else if (args[i] === '--point') {
    const id = args[++i]
    const p = gd.grammar?.find((g) => g.id === id)
    if (!p) throw new Error(`没有语法点 ${id}`)
    texts.push(...p.examples.map((e) => e.text))
  } else texts.push(args[i])
}

const name = (id: string): string => gd.grammar?.find((g) => g.id === id)?.name.zh ?? id
for (const text of texts) {
  const a = analyzeLex(db, text)
  console.log(
    `\n「${text.length > 120 ? text.slice(0, 117) + '…' : text}」  难度 ${a.level ?? '-'}`
  )
  for (const s of a.sentences)
    console.log(
      '  ' +
        s.tokens
          .filter((t) => t.kind === 'word' || t.kind === 'num')
          .map((t) =>
            t.entry
              ? `${t.text}→${t.lemma}/${t.pos}${t.tags?.length ? '[' + t.tags.join(',') + ']' : ''}${t.lv ? ' ' + t.lv : ''}${t.ruby ? ' ' + t.ruby : ''}`
              : `${t.text}→？`
          )
          .join('  ')
    )
  for (const g of a.grammar) console.log(`  语法：${name(g.id)}「${text.slice(g.start, g.end)}」`)
}
db.close()
