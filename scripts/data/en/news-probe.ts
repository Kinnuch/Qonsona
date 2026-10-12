/**
 * 拿真实新闻试阅读器：逐个抓英语的新闻来源（src/shared/lang/en/news.ts），用 parseFeed 解析，
 * 再用 analyzeLex 分析正文，统计查不到词条的词的比例、合成短语的次数、估出的难度：
 *   node scripts/data/run-ts.mjs scripts/data/en/news-probe.ts            全部来源
 *   node scripts/data/run-ts.mjs scripts/data/en/news-probe.ts gv nasa    只看这几个
 * 抓到的正文另存在 .cache/data/en/news-sample.json（离线再分析用）。
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeLex } from '../../../src/main/lang/analyze'
import { LexDb } from '../../../src/main/lang/lexdb'
import { parseFeed, type NewsItem } from '../../../src/shared/lang/feed'
import { NEWS } from '../../../src/shared/lang/en/news'
import { cacheDir, dataDir } from '../../lang/lexdb-writer'

const want = process.argv.slice(2)
const db = new LexDb('en', join(dataDir('en'), 'dict.sqlite'))
const all: NewsItem[] = []
const report: string[] = []
for (const src of NEWS.filter((s) => !want.length || want.includes(s.id))) {
  const t0 = Date.now()
  try {
    const res = await fetch(src.url, {
      headers: { 'User-Agent': 'Qonsona (https://github.com/Kinnuch/Qonsona)' },
      signal: AbortSignal.timeout(20000)
    })
    const xml = await res.text()
    const items = res.ok ? parseFeed(xml, src) : []
    const newest =
      items
        .map((i) => i.publishedAt ?? '')
        .sort()
        .pop() ?? '-'
    const avg = items.length
      ? Math.round(items.reduce((n, i) => n + i.body.length, 0) / items.length)
      : 0
    report.push(
      `${res.ok && items.length ? '✓' : '✗'} ${src.id.padEnd(14)} ${res.status} ${((Date.now() - t0) / 1000).toFixed(1)}s ${items.length} 篇，最新 ${newest.slice(0, 10)}，正文平均 ${avg} 字符（${src.license}）`
    )
    all.push(...items)
  } catch (e) {
    report.push(`✗ ${src.id.padEnd(14)} ${(e as Error).name} ${(e as Error).message}`)
  }
}
console.log(report.join('\n'))
writeFileSync(join(cacheDir('en'), 'news-sample.json'), JSON.stringify(all))

let words = 0
let unknown = 0
let proper = 0
const merged = new Map<string, number>()
const missing = new Map<string, number>()
const levels = new Map<string, number>()
for (const item of all) {
  const a = analyzeLex(db, `${item.title}\n\n${item.body}`)
  levels.set(a.level ?? '—', (levels.get(a.level ?? '—') ?? 0) + 1)
  for (const s of a.sentences)
    for (const t of s.tokens) {
      if (t.kind !== 'word') continue
      words++
      if (/\s/.test(t.text) && t.lemma) merged.set(t.lemma, (merged.get(t.lemma) ?? 0) + 1)
      if (!t.entry) {
        unknown++
        if (/^[A-Z]/.test(t.text)) proper++
        else missing.set(t.text.toLowerCase(), (missing.get(t.text.toLowerCase()) ?? 0) + 1)
      }
    }
}
console.log(
  `\n${all.length} 篇，${words} 个词，查不到 ${unknown}（${((unknown / Math.max(1, words)) * 100).toFixed(2)}%），其中大写开头 ${proper}`
)
console.log('估出的难度：', Object.fromEntries([...levels].sort()))
const top = (m: Map<string, number>, n: number): string =>
  [...m]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w, c]) => `${w}×${c}`)
    .join('  ')
console.log('\n合成的短语（前 80）：', top(merged, 80))
console.log('\n查不到的小写词（前 60）：', top(missing, 60))
db.close()
