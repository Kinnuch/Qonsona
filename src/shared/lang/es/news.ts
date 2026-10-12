import type { NewsSource } from '../types'
export const news: NewsSource[] = [
  {
    id: 'elpais',
    name: 'El País — Portada',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
    home: 'https://elpais.com/',
    license: 'headline',
    licenseName: '© EDICIONES EL PAÍS'
  },
  {
    id: 'rtve',
    name: 'RTVE — Noticias',
    url: 'https://www.rtve.es/rss/temas_noticias.xml',
    home: 'https://www.rtve.es/noticias/',
    license: 'headline',
    licenseName: '© RTVE'
  },
  {
    id: 'bbc-mundo',
    name: 'BBC Mundo',
    url: 'https://feeds.bbci.co.uk/mundo/rss.xml',
    home: 'https://www.bbc.com/mundo',
    license: 'headline',
    licenseName: '© BBC'
  }
]
