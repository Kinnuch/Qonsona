/**
 * NHK 新闻的 RSS：分类名、每一条的标题链接导语时间，导语只留完整的句子，文章 id。
 * 用的是照 RSS 格式自己写的内容，不放 NHK 的原文。
 */
import { describe, expect, it } from 'vitest'
import { leadText, newsId, parseNhkRss } from '../src/main/articles'

const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:nhknews="http://news.web.nhk/rss/rss2.0/modules/nhknews/" version="2.0">
  <channel>
    <title>NHKONEニュース|暮らし</title>
    <link>https://news.web.nhk/newsweb/</link>
    <item>
      <title>町の図書館 夜も開館へ</title>
      <link>https://news.web.nhk/newsweb/na/nd-20261001de00001</link>
      <guid>https://news.web.nhk/newsweb/na/nd-20261001de00001</guid>
      <description>町の図書館が、来月から夜9時まで開くことになりました。

仕事のあとでも本を借りられるようにするためで、町は利用者の声を聞きながら…</description>
      <pubDate>Thu, 01 Oct 2026 09:30:00 +0900</pubDate>
    </item>
    <item>
      <title><![CDATA[雨の日の &quot;傘&quot; 貸し出し]]></title>
      <link>https://news.web.nhk/newsweb/na/nd-20261002de00002</link>
      <description>駅で傘を無料で貸し出す取り組み&amp;調査が始まりました。</description>
      <pubDate>Fri, 02 Oct 2026 18:05:00 +0900</pubDate>
    </item>
    <item>
      <title></title>
      <link>https://news.web.nhk/newsweb/na/nd-20261003de00003</link>
    </item>
  </channel>
</rss>`

describe('NHK 新闻的 RSS', () => {
  it('分类名取「|」后面那半；每一条的标题、链接、导语、时间（转成 ISO）', () => {
    const r = parseNhkRss(RSS)
    expect(r.topic).toBe('暮らし')
    expect(r.items).toHaveLength(2)
    expect(r.items[0].title).toBe('町の図書館 夜も開館へ')
    expect(r.items[0].link).toBe('https://news.web.nhk/newsweb/na/nd-20261001de00001')
    expect(r.items[0].published).toBe('2026-10-01T00:30:00.000Z')
    expect(r.items[1].title).toBe('雨の日の "傘" 貸し出し')
    expect(r.items[1].description).toBe('駅で傘を無料で貸し出す取り組み&調査が始まりました。')
  })

  it('「主要ニュース」那个源没有分类名，算「主要」', () => {
    expect(parseNhkRss('<rss><channel><title>NHKONEニュース</title></channel></rss>').topic).toBe(
      '主要'
    )
  })

  it('导语：按段落换行；RSS 截断的只留到最后一个完整的句子；没截断的原样', () => {
    const r = parseNhkRss(RSS)
    expect(leadText(r.items[0].description)).toBe(
      '町の図書館が、来月から夜9時まで開くことになりました。'
    )
    expect(leadText('【NHK】一つ目の文です。\n\n二つ目の文です。')).toBe(
      '一つ目の文です。\n二つ目の文です。'
    )
    // 一个完整的句子都没有：只好留着省略号
    expect(leadText('とても長い一文の途中で切れてしまった…')).toBe(
      'とても長い一文の途中で切れてしまった…'
    )
  })

  it('文章 id：链接里的编号', () => {
    expect(newsId('https://news.web.nhk/newsweb/na/nd-20261001de00001')).toBe(
      'nhk-nd20261001de00001'
    )
    expect(newsId('https://news.web.nhk/newsweb/')).toBeNull()
  })
})
