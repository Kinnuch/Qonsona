/**
 * 把法语的新闻来源逐个取一次：看地址能不能用、parseFeed 解不解析得出来；再用自己造的词典分析标题与导语，
 * 统计查不到词条的词（写进 docs/lang/fr.md，拿来补规则）：
 *   node scripts/data/run-ts.mjs scripts/data/fr/news-check.ts [--save]
 * --save 把取到的 RSS 存进 .cache/data/fr/news/（下次不联网也能统计：--offline）
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { news } from '../../../src/shared/lang/fr/news'
import { parseFeed, type NewsItem } from '../../../src/shared/lang/feed'
import { LexDb } from '../../../src/main/lang/lexdb'
import { analyzeLex } from '../../../src/main/lang/analyze'
import { dataDir } from '../../lang/lexdb-writer'
import { CACHE } from './fetch'

const save = process.argv.includes('--save')
const offline = process.argv.includes('--offline')
const dir = join(CACHE, 'news')
mkdirSync(dir, { recursive: true })

const items: NewsItem[] = []
for (const s of news) {
  const file = join(dir, `${s.id}.xml`)
  let xml = ''
  const t0 = Date.now()
  try {
    if (offline && existsSync(file)) xml = readFileSync(file, 'utf8')
    else {
      const res = await fetch(s.url, {
        headers: { 'User-Agent': 'Qonsona (https://github.com/Kinnuch/Qonsona)' },
        signal: AbortSignal.timeout(20000)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      xml = await res.text()
      if (save) writeFileSync(file, xml)
    }
    const got = parseFeed(xml, s)
    items.push(...got)
    const withBody = got.filter((x) => x.body).length
    console.log(
      `✓ ${s.id.padEnd(13)} ${String(got.length).padStart(3)} 篇（有导语 ${withBody}），${((Date.now() - t0) / 1000).toFixed(1)} 秒  ${got[0]?.title.slice(0, 60) ?? ''}`
    )
  } catch (e) {
    console.log(`✗ ${s.id.padEnd(13)} ${(e as Error).message}`)
  }
}

// 查不到词条的词
const db = new LexDb('fr', join(dataDir('fr'), 'dict.sqlite'))
let words = 0
let unknown = 0
let names = 0
const miss = new Map<string, number>()
for (const it of items) {
  for (const s of analyzeLex(db, `${it.title}\n\n${it.body}`).sentences)
    s.tokens.forEach((t, i) => {
      if (t.kind !== 'word') return
      words++
      if (t.entry) return
      // 句中大写开头的当专名，不算（句首的要算）
      const first = s.tokens.findIndex((x) => x.kind === 'word') === i
      if (!first && /^\p{Lu}/u.test(t.text)) {
        names++
        return
      }
      unknown++
      miss.set(t.text, (miss.get(t.text) ?? 0) + 1)
    })
}
console.log(
  `\n${items.length} 篇，${words} 个词：查不到 ${unknown}（${((unknown / words) * 100).toFixed(2)}%），另有句中大写的专名 ${names}（${((names / words) * 100).toFixed(1)}%）`
)
console.log(
  '查不到最多的：' +
    [...miss]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([w, n]) => `${w} ${n}`)
      .join('，')
)
