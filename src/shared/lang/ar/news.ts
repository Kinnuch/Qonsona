/**
 * 阿拉伯语的新闻来源（2026-10-10 从国内实测能取到、parseFeed 解析得出的）。
 * 版权所有的只收标题与导语（license: 'headline'），附原文链接；开放许可的收全文（'full'）。
 * 要登录、付费、拦爬虫的不收（阿拉伯卫视、独立阿拉伯、阿拉伯新人报等 403，没接）。
 * 检查一遍：node scripts/data/run-ts.mjs scripts/data/ar/news-check.ts
 */
import type { NewsSource } from '../types'

const headline = (
  id: string,
  name: string,
  url: string,
  home: string,
  licenseName = '版权所有'
): NewsSource => ({ id, name, url, home, license: 'headline', licenseName })

export const AR_NEWS: NewsSource[] = [
  // 国际广播、通讯社的阿语部
  headline(
    'bbc',
    'BBC Arabic（BBC 阿拉伯语）',
    'https://feeds.bbci.co.uk/arabic/rss.xml',
    'https://www.bbc.com/arabic'
  ),
  headline(
    'aljazeera',
    'Al Jazeera（半岛电视台）',
    'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9',
    'https://www.aljazeera.net/'
  ),
  headline(
    'france24',
    'France 24 Arabic（法国 24 台）',
    'https://www.france24.com/ar/rss',
    'https://www.france24.com/ar/'
  ),
  headline(
    'dw',
    'DW Arabic（德国之声）',
    'https://rss.dw.com/xml/rss-ar-all',
    'https://www.dw.com/ar/'
  ),
  headline(
    'cnn',
    'CNN Arabic',
    'https://arabic.cnn.com/api/v1/rss/rss.xml',
    'https://arabic.cnn.com/'
  ),
  headline(
    'euronews',
    'Euronews Arabic（欧洲新闻台）',
    'https://arabic.euronews.com/rss',
    'https://arabic.euronews.com/'
  ),
  headline(
    'skynews',
    'Sky News Arabia（天空新闻阿拉伯台，阿联酋）',
    'https://www.skynewsarabia.com/rss',
    'https://www.skynewsarabia.com/'
  ),
  headline('rt', 'RT Arabic（今日俄罗斯）', 'https://arabic.rt.com/rss/', 'https://arabic.rt.com/'),
  headline(
    'sputnik',
    'Sputnik Arabic（卫星通讯社）',
    'https://sarabic.ae/export/rss2/archive/index.xml',
    'https://sarabic.ae/'
  ),
  headline(
    'aa',
    'Anadolu Agency（阿纳多卢通讯社）',
    'https://www.aa.com.tr/ar/rss/default?cat=guncel',
    'https://www.aa.com.tr/ar'
  ),
  headline(
    'un',
    'UN News（联合国新闻）',
    'https://news.un.org/feed/subscribe/ar/news/all/rss.xml',
    'https://news.un.org/ar/',
    '联合国版权'
  ),
  // 各地的报纸、电台、通讯社
  headline(
    'alquds',
    'Al-Quds Al-Arabi（阿拉伯圣城报）',
    'https://www.alquds.co.uk/feed/',
    'https://www.alquds.co.uk/'
  ),
  headline(
    'youm7',
    'Youm7（第七天，埃及）',
    'https://www.youm7.com/rss/SectionRss?SectionID=65',
    'https://www.youm7.com/'
  ),
  headline(
    'annahar',
    'Annahar（白昼报，黎巴嫩）',
    'https://www.annaharar.com/rss',
    'https://www.annaharar.com/'
  ),
  headline('sana', 'SANA（叙利亚通讯社）', 'https://sana.sy/feed/', 'https://sana.sy/'),
  headline(
    'hespress',
    'Hespress（摩洛哥）',
    'https://www.hespress.com/feed',
    'https://www.hespress.com/'
  ),
  headline(
    'mosaique',
    'Mosaique FM（突尼斯）',
    'https://www.mosaiquefm.net/ar/rss',
    'https://www.mosaiquefm.net/ar'
  ),
  // 开放许可：收全文
  {
    id: 'globalvoices',
    name: 'Global Voices 阿语版（الأصوات العالمية）',
    url: 'https://ar.globalvoices.org/feed/',
    home: 'https://ar.globalvoices.org/',
    license: 'full',
    licenseName: 'CC BY 3.0'
  }
]
