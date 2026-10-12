/**
 * 拿真实的新闻（gd/news.ts 的全部来源，标题与导语）和内置课文（data/gd/texts.json）跑阅读器的分析，
 * 数一数有多少词查不到词条、多少是靠猜原形（form 表里没有）找到的，列出最常见的漏网词形：
 *   node scripts/data/run-ts.mjs scripts/data/gd/coverage.ts            （新闻现抓，存进 .cache/data/gd/news/）
 *   node scripts/data/run-ts.mjs scripts/data/gd/coverage.ts --cached   （用上次抓的）
 * 结果写进 docs/lang/gd.md「规则细化」一节。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeLex } from '../../../src/main/lang/analyze'
import { LexDb } from '../../../src/main/lang/lexdb'
import { parseFeed } from '../../../src/shared/lang/feed'
import { news } from '../../../src/shared/lang/gd/news'
import type { LexText } from '../../../src/shared/lang/types'
import { ROOT, cacheDir, dataDir } from '../../lang/lexdb-writer'

const cached = process.argv.includes('--cached')
const dir = join(cacheDir('gd'), 'news')
mkdirSync(dir, { recursive: true })

const corpora: { name: string; texts: string[] }[] = []
const newsTexts: string[] = []
for (const src of news) {
  const file = join(dir, `${src.id}.xml`)
  let xml = ''
  if (cached && existsSync(file)) xml = readFileSync(file, 'utf8')
  else {
    try {
      const res = await fetch(src.url, {
        headers: { 'User-Agent': 'Qonsona (https://github.com/Kinnuch/Qonsona)' }
      })
      xml = await res.text()
      writeFileSync(file, xml)
    } catch (e) {
      console.log(`${src.id}：取不到（${(e as Error).message}）`)
      if (existsSync(file)) xml = readFileSync(file, 'utf8')
    }
  }
  const items = parseFeed(xml, src)
  for (const it of items) newsTexts.push(`${it.title}. ${it.body}`)
  console.log(`${src.id}：${items.length} 条`)
}
corpora.push({ name: '新闻（标题与导语）', texts: newsTexts })
const textsFile = join(ROOT, 'data', 'gd', 'texts.json')
if (existsSync(textsFile)) {
  const texts = JSON.parse(readFileSync(textsFile, 'utf8')) as LexText[]
  if (texts.length) corpora.push({ name: '内置课文', texts: texts.map((t) => t.text) })
}

// 英文词（新闻里双语的段落、WordPress 的「The post … appeared first on」）：Tatoeba 英文句子里出现过、
// 盖尔语词典里没有的算英文，单独数
const english = new Set<string>()
{
  const bz = join(cacheDir('gd'), 'tatoeba-eng_sentences.tsv.bz2')
  if (existsSync(bz)) {
    const Bunzip = (await import('seek-bzip')).default
    for (const line of Bunzip.decode(readFileSync(bz)).toString('utf8').split('\n'))
      for (const w of (line.split('\t')[2] ?? '').toLowerCase().match(/[a-z]+/g) ?? [])
        english.add(w)
  }
}

const db = new LexDb('gd', join(dataDir('gd'), 'dict.sqlite'))
for (const c of corpora) {
  let words = 0
  let unknown = 0
  let names = 0
  let eng = 0
  const miss = new Map<string, number>()
  for (const text of c.texts) {
    const a = analyzeLex(db, text)
    for (const s of a.sentences)
      for (const t of s.tokens) {
        if (t.kind !== 'word') continue
        words++
        if (t.entry) continue
        // 句中大写开头的多是人名、地名、机构名
        if (/^\p{Lu}/u.test(t.text) && t.start > s.start) {
          names++
          continue
        }
        if (english.has(t.text.toLowerCase())) {
          eng++
          continue
        }
        unknown++
        miss.set(t.text.toLowerCase(), (miss.get(t.text.toLowerCase()) ?? 0) + 1)
      }
  }
  const pct = (n: number): string => `${((n / Math.max(1, words)) * 100).toFixed(1)}%`
  const gaelic = words - eng - names
  console.log(
    `\n${c.name}：${c.texts.length} 篇，${words} 词；盖尔语词（去掉英文 ${eng}、句中大写的专名 ${names}）${gaelic} 个，` +
      `查不到 ${unknown}（占盖尔语词的 ${((unknown / Math.max(1, gaelic)) * 100).toFixed(1)}%）；全部词里查不到的 ${pct(unknown + eng + names)}`
  )
  console.log(
    '  最常见的：' +
      [...miss]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60)
        .map(([w, n]) => `${w}×${n}`)
        .join(' ')
  )
}
db.close()
