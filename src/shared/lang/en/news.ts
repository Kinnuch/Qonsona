/**
 * 英语的新闻来源（2026-10-10 从这台电脑逐个抓过、解析得了的；结果见 docs/lang/en.md）。
 * full：开放许可，收 RSS 里给的全文；headline：版权所有，只收标题与导语，正文看原文。
 * 美国之音 Learning English 是公有领域，但 2025 年 3 月起停更，RSS 里只有一句简介：当作存档、只放导语，
 * 全文另收在内置课文里（data/en/texts.json）。维基新闻 2026 年 5 月起只读，没有 RSS 了。
 */
import type { NewsSource } from '../types'

const full = (
  id: string,
  name: string,
  url: string,
  licenseName: string,
  home: string,
  topic?: string,
  level?: string
): NewsSource => ({
  id,
  name,
  url,
  license: 'full',
  licenseName,
  home,
  ...(topic ? { topic } : {}),
  ...(level ? { level } : {})
})
const headline = (
  id: string,
  name: string,
  url: string,
  home: string,
  topic?: string,
  level?: string
): NewsSource => ({
  id,
  name,
  url,
  license: 'headline',
  licenseName: '版权所有（只收标题与导语）',
  home,
  ...(topic ? { topic } : {}),
  ...(level ? { level } : {})
})

export const NEWS: NewsSource[] = [
  // ── 开放许可：全文 ──
  full(
    'gv',
    'Global Voices',
    'https://globalvoices.org/feed/',
    'CC BY 3.0',
    'https://globalvoices.org/',
    'world'
  ),
  full(
    'nasa',
    'NASA',
    'https://www.nasa.gov/news-release/feed/',
    '公有领域（美国联邦政府作品）',
    'https://www.nasa.gov/news/',
    'science'
  ),
  full(
    'conversation',
    'The Conversation',
    'https://theconversation.com/global/articles.atom',
    'CC BY-ND 4.0（原样转载，不改正文）',
    'https://theconversation.com/global',
    'analysis'
  ),
  full(
    'wiki-featured',
    'Wikipedia: Today’s featured article',
    'https://en.wikipedia.org/w/api.php?action=featuredfeed&feed=featured&feedformat=atom',
    'CC BY-SA 4.0',
    'https://en.wikipedia.org/wiki/Wikipedia:Today%27s_featured_article',
    'wiki'
  ),
  full(
    'wiki-onthisday',
    'Wikipedia: On this day',
    'https://en.wikipedia.org/w/api.php?action=featuredfeed&feed=onthisday&feedformat=atom',
    'CC BY-SA 4.0',
    'https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries',
    'history'
  ),
  // ── 简易新闻（存档）：公有领域，RSS 只有一句简介 ──
  {
    ...headline(
      'voa-asitis',
      'VOA Learning English: As It Is（存档）',
      'https://learningenglish.voanews.com/api/zkm-ql-vomx-tpej-rqi',
      'https://learningenglish.voanews.com/',
      'news',
      'B1'
    ),
    licenseName: '公有领域（2025 年 3 月起停更的存档；RSS 只有简介）'
  },
  {
    ...headline(
      'voa-science',
      'VOA Learning English: Science & Technology（存档）',
      'https://learningenglish.voanews.com/api/zmg_pl-vomx-tpeymtm',
      'https://learningenglish.voanews.com/',
      'science',
      'B1'
    ),
    licenseName: '公有领域（2025 年 3 月起停更的存档；RSS 只有简介）'
  },
  // ── 版权所有：标题与导语 ──
  headline(
    'bbc-world',
    'BBC News: World',
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.bbc.com/news/world',
    'world'
  ),
  headline(
    'bbc-science',
    'BBC News: Science & Environment',
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    'https://www.bbc.com/news/science_and_environment',
    'science'
  ),
  headline(
    'bbc-tech',
    'BBC News: Technology',
    'https://feeds.bbci.co.uk/news/technology/rss.xml',
    'https://www.bbc.com/news/technology',
    'technology'
  ),
  headline('npr', 'NPR News', 'https://feeds.npr.org/1001/rss.xml', 'https://www.npr.org/'),
  headline(
    'npr-science',
    'NPR: Science',
    'https://feeds.npr.org/1007/rss.xml',
    'https://www.npr.org/sections/science/',
    'science'
  ),
  headline(
    'guardian-world',
    'The Guardian: World',
    'https://www.theguardian.com/world/rss',
    'https://www.theguardian.com/world',
    'world'
  ),
  headline(
    'guardian-science',
    'The Guardian: Science',
    'https://www.theguardian.com/science/rss',
    'https://www.theguardian.com/science',
    'science'
  ),
  headline(
    'nyt',
    'The New York Times',
    'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    'https://www.nytimes.com/'
  ),
  headline(
    'cbc',
    'CBC News',
    'https://www.cbc.ca/webfeed/rss/rss-topstories',
    'https://www.cbc.ca/news'
  ),
  headline(
    'abc-au',
    'ABC News (Australia)',
    'https://www.abc.net.au/news/feed/51120/rss.xml',
    'https://www.abc.net.au/news'
  ),
  headline(
    'rte',
    'RTÉ News',
    'https://www.rte.ie/feeds/rss/?index=/news/',
    'https://www.rte.ie/news/'
  ),
  headline(
    'rnz',
    'RNZ News',
    'https://www.rnz.co.nz/rss/national.xml',
    'https://www.rnz.co.nz/news'
  ),
  headline(
    'sky',
    'Sky News: World',
    'https://feeds.skynews.com/feeds/rss/world.xml',
    'https://news.sky.com/world',
    'world'
  ),
  headline(
    'aljazeera',
    'Al Jazeera English',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://www.aljazeera.com/'
  ),
  headline(
    'un-news',
    'UN News',
    'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    'https://news.un.org/en/',
    'world'
  ),
  headline(
    'the-hindu',
    'The Hindu',
    'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://www.thehindu.com/'
  ),
  headline(
    'cna',
    'CNA (Singapore)',
    'https://www.channelnewsasia.com/rssfeeds/8395986',
    'https://www.channelnewsasia.com/'
  ),
  headline(
    'scmp',
    'South China Morning Post',
    'https://www.scmp.com/rss/91/feed',
    'https://www.scmp.com/'
  ),
  headline(
    'cgtn',
    'CGTN',
    'https://www.cgtn.com/subscribe/rss/section/world.xml',
    'https://www.cgtn.com/',
    'world'
  ),
  headline(
    'japantimes',
    'The Japan Times',
    'https://www.japantimes.co.jp/feed/',
    'https://www.japantimes.co.jp/'
  ),
  headline(
    'snexplores',
    'Science News Explores',
    'https://www.snexplores.org/feed',
    'https://www.snexplores.org/',
    'science',
    'B2'
  )
]
