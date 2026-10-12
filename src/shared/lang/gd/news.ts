/**
 * 盖尔语新闻来源（RSS）。2026-10-10 在本机逐个实际抓过、用 parseFeed 解析过，正文都是盖尔语。
 * 都有版权（机构自己的新闻稿、BBC 的新闻）：只收标题与导语（正文开头一两句），附原文链接，跟日语的 NHK 一样。
 * BBC 的使用条款第 15 条允许个人把 BBC 新闻的 RSS 原样展示、注明出处并附链接。
 *
 * 试过、不收的：CnaG、ACGA（RSS 是英文的）；Stòrlann、Comhairle nan Leabhraichean、Comhairle nan Eilean Siar、
 * LearnGaelic、SpeakGaelic（没有 RSS）；An Comunn Gàidhealach（给的是网页）；Tobar an Dualchais（403）；
 * Gàidhlig aig Baile、dana-mag、gaelcast（连不上）。详见 docs/lang/gd.md。
 */
import type { NewsSource } from '../types'

export const news: NewsSource[] = [
  {
    id: 'bbc-naidheachdan',
    name: "Naidheachdan a' BhBC",
    url: 'https://feeds.bbci.co.uk/naidheachdan/rss.xml',
    license: 'headline',
    licenseName: '© BBC',
    home: 'https://www.bbc.co.uk/naidheachdan'
  },
  {
    id: 'smo',
    name: 'Sabhal Mòr Ostaig',
    url: 'https://www.smo.uhi.ac.uk/feed/',
    license: 'headline',
    licenseName: '© Sabhal Mòr Ostaig',
    home: 'https://www.smo.uhi.ac.uk/gd/'
  },
  {
    id: 'bng',
    name: 'Bòrd na Gàidhlig',
    url: 'https://www.gaidhlig.scot/gd/feed/',
    license: 'headline',
    licenseName: '© Bòrd na Gàidhlig',
    home: 'https://www.gaidhlig.scot/gd/'
  },
  {
    id: 'mgalba',
    name: 'MG ALBA',
    url: 'https://mgalba.com/feed/',
    license: 'headline',
    licenseName: '© MG ALBA',
    home: 'https://mgalba.com/',
    // 来源里的分类只有 Uncategorized
    topic: 'MG ALBA'
  },
  {
    id: 'feisean',
    name: 'Fèisean nan Gàidheal',
    url: 'https://www.feisean.org/feed/',
    license: 'headline',
    licenseName: '© Fèisean nan Gàidheal',
    home: 'https://www.feisean.org/',
    topic: 'Fèisean'
  },
  {
    id: 'togblog',
    name: 'Tog Blog',
    url: 'https://togblog.org/feed/',
    license: 'headline',
    licenseName: '© 各篇作者',
    home: 'https://togblog.org/',
    topic: 'Blog'
  }
]
