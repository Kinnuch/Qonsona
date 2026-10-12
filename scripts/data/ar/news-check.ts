/**
 * 逐个取一遍阿拉伯语的新闻来源（src/shared/lang/ar/news.ts），看能不能取到、parseFeed 解析出几条、最新一条是什么时候的。
 *   node scripts/data/run-ts.mjs scripts/data/ar/news-check.ts
 * 请求头跟软件取新闻时一样（src/main/lang/news.ts）。一个一个取，免得同时连太多被拒。
 */
import { parseFeed } from '../../../src/shared/lang/feed'
import { AR_NEWS } from '../../../src/shared/lang/ar/news'

for (const s of AR_NEWS) {
  const t0 = Date.now()
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 25_000)
    const res = await fetch(s.url, {
      signal: ctl.signal,
      headers: {
        'User-Agent': 'Qonsona (https://github.com/Kinnuch/Qonsona)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml'
      }
    })
    const xml = await res.text()
    clearTimeout(timer)
    if (!res.ok) {
      console.log(`✗ ${s.id}  HTTP ${res.status}`)
      continue
    }
    const items = parseFeed(xml, s)
    const dates = items
      .map((i) => i.publishedAt)
      .filter(Boolean)
      .sort()
    const ms = Date.now() - t0
    console.log(
      `${items.length ? '✓' : '✗'} ${s.id}  ${items.length} 条  最新 ${dates[dates.length - 1] ?? '（没写日期）'}  ${ms} ms`
    )
    if (items[0]) console.log(`    ${items[0].title}｜${items[0].body.slice(0, 80)}`)
  } catch (e) {
    console.log(`✗ ${s.id}  ${(e as Error).message}  ${Date.now() - t0} ms`)
  }
}
