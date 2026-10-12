import type { NewsSource } from '../types'
export const news: NewsSource[] = [
  [
    'kbs',
    'KBS WORLD — 연예가 소식（娱乐新闻）',
    'https://world.kbs.co.kr/rss/rss_enternews.htm?lang=k',
    'https://world.kbs.co.kr/service/about_rss.htm?lang=k'
  ],
  ['hankyoreh', '한겨레 韩民族日报', 'https://www.hani.co.kr/rss/', 'https://www.hani.co.kr/'],
  [
    'khan',
    '경향신문 京乡新闻',
    'https://www.khan.co.kr/rss/rssdata/total_news.xml',
    'https://www.khan.co.kr/'
  ],
  ['donga', '동아일보 东亚日报', 'https://rss.donga.com/total.xml', 'https://www.donga.com/']
].map(([id, name, url, home]) => ({
  id,
  name,
  url,
  home,
  license: 'headline',
  licenseName: '版权所有；只收公开 RSS 标题和导语'
}))
