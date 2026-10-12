/**
 * 西班牙语数据的来源：下载地址、缓存文件名、许可与署名。
 * 原始文件下到 .cache/data/es/（不入库）；换版本只改这里。许可的核实记录见 docs/lang/es.md「资料清单」。
 */
import { join } from 'node:path'
import { cacheDir } from '../../lang/lexdb-writer'
import type { SourceRef } from '../../../src/shared/lang/types'
import { fetchFile } from './util'

export const CACHE = cacheDir('es')
export const cached = (file: string): string => join(CACHE, file)

const kaikki = (edition: string, lang: string): string =>
  `https://kaikki.org/${edition}/${encodeURIComponent(lang)}/kaikki.org-dictionary-${encodeURIComponent(lang)}.jsonl.gz`
const tatoeba = (path: string): string =>
  `https://downloads.tatoeba.org/exports/per_language/${path}`
const raw = (repo: string, path: string): string =>
  `https://raw.githubusercontent.com/${repo}/${path}`

/** 要下载的文件：键 → 地址与缓存名 */
export const FILES = {
  wiktEn: {
    url: 'https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl.gz',
    file: 'kaikki-en-spanish.jsonl.gz'
  },
  wiktZhHans: { url: kaikki('zhwiktionary', '西班牙语'), file: 'kaikki-zh-spanish-hans.jsonl.gz' },
  wiktZhHant: { url: kaikki('zhwiktionary', '西班牙語'), file: 'kaikki-zh-spanish-hant.jsonl.gz' },
  wiktEs: { url: kaikki('eswiktionary', 'Español'), file: 'kaikki-es-espanol.jsonl.gz' },
  spaSentences: {
    url: tatoeba('spa/spa_sentences.tsv.bz2'),
    file: 'tatoeba-spa_sentences.tsv.bz2'
  },
  spaCmnLinks: { url: tatoeba('spa/spa-cmn_links.tsv.bz2'), file: 'tatoeba-spa-cmn_links.tsv.bz2' },
  spaEngLinks: { url: tatoeba('spa/spa-eng_links.tsv.bz2'), file: 'tatoeba-spa-eng_links.tsv.bz2' },
  cmnSentences: {
    url: tatoeba('cmn/cmn_sentences.tsv.bz2'),
    file: 'tatoeba-cmn_sentences.tsv.bz2'
  },
  engSentences: {
    url: tatoeba('eng/eng_sentences.tsv.bz2'),
    file: 'tatoeba-eng_sentences.tsv.bz2'
  },
  engCmnLinks: { url: tatoeba('eng/eng-cmn_links.tsv.bz2'), file: 'tatoeba-eng-cmn_links.tsv.bz2' },
  wordfreq: {
    url: raw('rspeer/wordfreq', 'master/wordfreq/data/large_es.msgpack.gz'),
    file: 'wordfreq-large_es.msgpack.gz'
  },
  doozanFreq: {
    url: raw('doozan/spanish_data', 'master/frequency.csv'),
    file: 'doozan-frequency.csv'
  },
  openccChars: {
    url: raw('BYVoid/OpenCC', 'master/data/dictionary/TSCharacters.txt'),
    file: 'opencc-TSCharacters.txt'
  },
  openccPhrases: {
    url: raw('BYVoid/OpenCC', 'master/data/dictionary/TSPhrases.txt'),
    file: 'opencc-TSPhrases.txt'
  }
} as const

export type FileKey = keyof typeof FILES

/** 下好（或已经有了）返回本地路径 */
export async function need(key: FileKey): Promise<string> {
  const f = FILES[key]
  const dest = cached(f.file)
  process.stdout.write(`  ${f.file} `)
  await fetchFile(f.url, dest)
  console.log('✓')
  return dest
}

// ───────────────────────── 署名（db.source） ─────────────────────────

const WIKT_CREDIT = 'kaikki.org / wiktextract（Tatu Ylonen）'

export const SRC = {
  wiktionary: {
    id: 'wiktionary',
    name: '英文维基词典的西班牙语词条（kaikki.org 用 wiktextract 抽取）',
    license: 'CC BY-SA 4.0 / GFDL',
    credit: `Wiktionary 贡献者（en.wiktionary.org）；${WIKT_CREDIT}`,
    home: 'https://kaikki.org/dictionary/Spanish/',
    note: '词条、英文释义、性、IPA、变位与变形表、标签（地区、语体）、用法例句、近义反义'
  },
  zhwikt: {
    id: 'zhwikt',
    name: '中文维基词典的西班牙语词条（kaikki.org 用 wiktextract 抽取）',
    license: 'CC BY-SA 4.0 / 3.0',
    credit: `Wiktionary 贡献者（zh.wiktionary.org）；${WIKT_CREDIT}`,
    home: 'https://zh.wiktionary.org/',
    note:
      '中文释义（繁体用 OpenCC 的字表转成简体）。2010 年机器人 Wjcdbot 批量导入的那一批（释义前带 m. f. adj. 缩写、' +
      '没写出处）不用；义项数跟英文维基词典对得上时逐条对应，对不上时整条挂在第一个义项上'
  },
  eswikt: {
    id: 'eswikt',
    name: '西语维基词典 Wikcionario（kaikki.org 用 wiktextract 抽取）',
    license: 'CC BY-SA 4.0 / 3.0',
    credit: `Wikcionario 贡献者（es.wiktionary.org）；${WIKT_CREDIT}`,
    home: 'https://es.wiktionary.org/',
    note: '西班牙语释义（单语释义，给中高级）、翻译表里的汉语对译词、发音录音'
  },
  tatoeba: {
    id: 'tatoeba',
    name: 'Tatoeba 例句（西中、西英对照）',
    license: 'CC BY 2.0 FR',
    credit: 'Tatoeba 贡献者',
    home: 'https://tatoeba.org/'
  },
  tatoebaPivot: {
    id: 'tatoeba-pivot',
    name: 'Tatoeba 例句的中文译文（经英文译文对上的）',
    license: 'CC BY 2.0 FR',
    credit: 'Tatoeba 贡献者',
    home: 'https://tatoeba.org/',
    note: '西语句子没有直接的中文翻译时，取它的英文翻译的中文翻译（人工翻译，但隔了一层英语）'
  },
  wordfreq: {
    id: 'wordfreq',
    name: 'wordfreq 西班牙语词频（维基百科、字幕、新闻、图书、网页、社交媒体七类语料）',
    license: 'CC BY-SA 4.0',
    credit:
      'Robyn Speer（wordfreq）；含 OpenSubtitles 2018（OPUS）、Google Books Ngrams、维基百科、ParaCrawl 等语料的统计',
    home: 'https://github.com/rspeer/wordfreq',
    note: '书面与口语混合的词频，按词形统计；跟 doozan 的口语词元词频一起算出词频名次与分级'
  },
  doozan: {
    id: 'doozan',
    name: '西班牙语词元词频（doozan/spanish_data，由 OpenSubtitles 字幕词频按维基词典归并到词元）',
    license: 'CC BY-SA',
    credit: 'Jeff Doozan；hermitdave/FrequencyWords（OpenSubtitles 2018，CC BY-SA 4.0）',
    home: 'https://github.com/doozan/spanish_data'
  },
  wikidata: {
    id: 'wikidata',
    name: 'Wikidata 词位（西语义项所对应条目的中文名字）',
    license: 'CC0 1.0',
    credit: 'Wikidata 贡献者',
    home: 'https://www.wikidata.org/wiki/Wikidata:Lexicographical_data',
    note: '条目的英文名字或别名对得上英文维基词典的某个义项时，把条目的中文名字挂到那个义项上（繁体转简体）'
  },
  opencc: {
    id: 'opencc',
    name: 'OpenCC 繁简转换字表（中文维基词典的繁体释义转简体）',
    license: 'Apache 2.0',
    credit: 'BYVoid 与 OpenCC 贡献者',
    home: 'https://github.com/BYVoid/OpenCC'
  },
  commons: {
    id: 'commons',
    name: '维基共享资源的西班牙语发音录音（大多出自 Lingua Libre）',
    license: 'CC BY-SA 4.0 等（各文件以文件页为准）',
    credit: 'Lingua Libre 与维基共享资源的录音者',
    home: 'https://lingualibre.org/',
    note: '只存文件地址，联网点击播放'
  },
  qonsona: {
    id: 'qonsona-es',
    name: 'Qonsona 自编：分级调整、主题词表、地区词表',
    license: 'MIT',
    credit: 'Qonsona',
    home: 'https://github.com/Kinnuch/Qonsona',
    note: '按词频分级之后，日常生活的具体词、初学必会的短语按自编的主题词表提到 A1–B1；粗俗词降级'
  }
} satisfies Record<string, SourceRef>
