/**
 * 法语新闻来源：法国、比利时、瑞士、加拿大的通讯社、公共广播与报纸，外加 RFI 的「简易法语新闻」。
 * 都是版权所有，只收 RSS 里公开的标题与导语，正文看原文（日语 NHK 的做法）；要登录、付费、反爬的不收
 * （1jour1actu 403、Vikidia 人机验证，没收）。2026-10-09 从这台电脑逐个取过，都能解析（见 docs/lang/fr.md）。
 */
import type { NewsSource } from '../types'

const headline = { license: 'headline' as const, licenseName: '版权所有（只收标题与导语）' }

export const news: NewsSource[] = [
  {
    id: 'rfi-jff',
    name: 'RFI · Journal en français facile',
    // 「法语学习」站的同一档节目：标题写当天的几条新闻，链接到带同步文字稿和练习的那一期
    url: 'https://francaisfacile.rfi.fr/fr/podcasts/journal-en-fran%C3%A7ais-facile/podcast',
    home: 'https://francaisfacile.rfi.fr/fr/podcasts/journal-en-fran%C3%A7ais-facile/',
    topic: 'Journal en français facile',
    level: 'B1',
    ...headline
  },
  {
    id: 'rfi',
    name: 'RFI',
    url: 'https://www.rfi.fr/fr/rss',
    home: 'https://www.rfi.fr/fr/',
    ...headline
  },
  {
    id: 'rfi-afrique',
    name: 'RFI Afrique',
    url: 'https://www.rfi.fr/fr/afrique/rss',
    home: 'https://www.rfi.fr/fr/afrique/',
    topic: 'Afrique',
    ...headline
  },
  {
    id: 'france24',
    name: 'France 24',
    url: 'https://www.france24.com/fr/rss',
    home: 'https://www.france24.com/fr/',
    ...headline
  },
  {
    id: 'franceinfo',
    name: 'franceinfo',
    url: 'https://www.francetvinfo.fr/titres.rss',
    home: 'https://www.francetvinfo.fr/',
    ...headline
  },
  {
    id: 'lemonde',
    name: 'Le Monde',
    url: 'https://www.lemonde.fr/rss/une.xml',
    home: 'https://www.lemonde.fr/',
    ...headline
  },
  {
    id: 'lefigaro',
    name: 'Le Figaro',
    url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml',
    home: 'https://www.lefigaro.fr/',
    ...headline
  },
  {
    id: 'liberation',
    name: 'Libération',
    url: 'https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml',
    home: 'https://www.liberation.fr/',
    ...headline
  },
  {
    id: '20minutes',
    name: '20 Minutes',
    url: 'https://www.20minutes.fr/feeds/rss-une.xml',
    home: 'https://www.20minutes.fr/',
    ...headline
  },
  {
    id: 'ouest-france',
    name: 'Ouest-France',
    url: 'https://www.ouest-france.fr/rss/une',
    home: 'https://www.ouest-france.fr/',
    ...headline
  },
  {
    id: 'tv5monde',
    name: 'TV5Monde Info',
    url: 'https://information.tv5monde.com/rss.xml',
    home: 'https://information.tv5monde.com/',
    ...headline
  },
  {
    id: 'radio-canada',
    name: 'Radio-Canada',
    url: 'https://ici.radio-canada.ca/rss/4159',
    home: 'https://ici.radio-canada.ca/info',
    topic: 'Canada',
    ...headline
  },
  {
    id: 'rtbf',
    name: 'RTBF',
    url: 'https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml',
    home: 'https://www.rtbf.be/info',
    topic: 'Belgique',
    ...headline
  },
  {
    id: 'rts',
    name: 'RTS',
    url: 'https://www.rts.ch/info/?format=rss/news',
    home: 'https://www.rts.ch/info/',
    topic: 'Suisse',
    ...headline
  }
]
