/**
 * 新闻的 RSS / Atom 解析：标题、链接、日期、分类；有版权的只留导语，开放许可的留全文；HTML 与实体转纯文本。
 */
import { describe, expect, it } from 'vitest'
import { decodeEntities, htmlToText, leadOf, parseFeed } from '../../src/shared/lang/feed'
import type { NewsSource } from '../../src/shared/lang/types'

const src = (license: 'headline' | 'full'): NewsSource => ({
  id: 's',
  name: 'Source',
  url: 'https://example.org/rss',
  license,
  licenseName: license === 'full' ? 'Public domain' : '©',
  home: 'https://example.org'
})

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title><![CDATA[Le chat &amp; le chien]]></title><link>https://example.org/a</link>
<description><![CDATA[<p>Premier paragraphe. Deuxième phrase ici. Troisième phrase qui est longue et qui continue encore et encore pour dépasser la limite des deux cent quatre-vingts caractères, vraiment très longue, avec beaucoup de mots en plus pour que ce soit coupé proprement à la fin d'une phrase complète.</p><p>Second.</p>]]></description>
<pubDate>Fri, 09 Oct 2026 08:30:00 GMT</pubDate><category>Monde</category></item>
<item><title>Sans lien</title><description>x</description></item>
</channel></rss>`

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>W</title>
<entry><title>Wikinews story</title><link rel="alternate" href="https://en.wikinews.org/wiki/X"/>
<updated>2026-10-08T10:00:00Z</updated>
<content type="html">&lt;p&gt;First paragraph.&lt;/p&gt;&lt;p&gt;Second paragraph.&lt;/p&gt;</content></entry></feed>`

describe('新闻解析', () => {
  it('RSS：有版权的只留导语，没有链接的不收', () => {
    const items = parseFeed(RSS, src('headline'))
    expect(items).toHaveLength(1)
    const a = items[0]
    expect(a.title).toBe('Le chat & le chien')
    expect(a.link).toBe('https://example.org/a')
    expect(a.excerpt).toBe(true)
    expect(a.body.startsWith('Premier paragraphe. Deuxième phrase ici.')).toBe(true)
    expect(a.body.length).toBeLessThanOrEqual(280)
    expect(a.publishedAt).toBe('2026-10-09T08:30:00.000Z')
    expect(a.topic).toBe('Monde')
  })

  it('Atom：开放许可的留全文，段落之间空一行', () => {
    const [a] = parseFeed(ATOM, src('full'))
    expect(a.link).toBe('https://en.wikinews.org/wiki/X')
    expect(a.excerpt).toBe(false)
    expect(a.body).toBe('First paragraph.\n\nSecond paragraph.')
    expect(a.publishedAt).toBe('2026-10-08T10:00:00.000Z')
  })

  it('实体、HTML、导语', () => {
    expect(decodeEntities('&#233;t&#xe9; &laquo;x&raquo; &nbsp;')).toBe('été «x»  ')
    expect(htmlToText('<p>A<br>B</p><script>x()</script><p>C</p>')).toBe('A\nB\n\nC')
    expect(leadOf('Short.')).toBe('Short.')
  })
})
