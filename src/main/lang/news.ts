/**
 * 框架里各语言的新闻：按这门语言的 NewsSource（src/shared/lang/<代码>/ 里定义）取 RSS / Atom。
 * 有版权的（license: 'headline'）只收标题与导语（正文开头一两句），附原文链接，跟日语的 NHK 一样；
 * 开放许可的（'full'：公有领域、CC）收 RSS 里给的全文。要登录、付费的不碰。
 * 不用 XML 库：RSS / Atom 的结构简单，按标签取就够了。
 */
import { net } from 'electron'
import type { NewsSource } from '../../shared/lang/types'
import { parseFeed, type NewsItem } from '../../shared/lang/feed'

export type { NewsItem }

/** 取一个来源（十五秒超时）；出错时抛出原因 */
export async function fetchSource(source: NewsSource): Promise<NewsItem[]> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 15000)
  try {
    const res = await net.fetch(source.url, {
      signal: ctl.signal,
      headers: {
        'User-Agent': 'Qonsona (https://github.com/Kinnuch/Qonsona)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml'
      }
    })
    if (res.status === 401 || res.status === 403) throw new Error('auth')
    if (!res.ok) throw new Error(`http ${res.status}`)
    const xml = await res.text()
    if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error('format')
    return parseFeed(xml, source)
  } finally {
    clearTimeout(timer)
  }
}
