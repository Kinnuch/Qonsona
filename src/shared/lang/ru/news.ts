import type { NewsSource } from '../types'
export const news: NewsSource[] = [
  ['tass', 'ТАСС 塔斯社', 'https://tass.ru/rss/v2.xml', 'https://tass.ru/'],
  ['ria', 'РИА Новости 俄新社', 'https://ria.ru/export/rss2/archive/index.xml', 'https://ria.ru/'],
  ['interfax', 'Интерфакс 国际文传', 'https://www.interfax.ru/rss.asp', 'https://www.interfax.ru/'],
  [
    'kommersant',
    'Коммерсантъ 生意人报',
    'https://www.kommersant.ru/RSS/news.xml',
    'https://www.kommersant.ru/'
  ],
  [
    'rbc',
    'РБК 商业咨询',
    'https://rssexport.rbc.ru/rbcnews/news/30/full.rss',
    'https://www.rbc.ru/'
  ],
  ['bbc', 'BBC Russian', 'https://feeds.bbci.co.uk/russian/rss.xml', 'https://www.bbc.com/russian']
].map(([id, name, url, home]) => ({
  id,
  name,
  url,
  home,
  license: 'headline',
  licenseName: '版权所有；只收公开 RSS 标题和导语'
}))
