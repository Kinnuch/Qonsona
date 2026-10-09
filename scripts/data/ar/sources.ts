/**
 * 阿拉伯语数据的来源：下载地址、缓存文件名、许可与署名（写进 dict.sqlite 的 meta，设置里「数据来源与许可」逐条列出）。
 * 换版本只改这里；许可的核实记录见 docs/lang/ar.md「资料清单」。
 */
import type { SourceRef } from '../../../src/shared/lang/types'
import { fetchCached } from './net'

const kaikki = (edition: string, lang: string): string =>
  `https://kaikki.org/${edition}/${encodeURIComponent(lang)}/kaikki.org-dictionary-${encodeURIComponent(lang)}.jsonl.gz`
const tatoeba = (path: string): string =>
  `https://downloads.tatoeba.org/exports/per_language/${path}`

/** 要下载的文件：键 → [地址, 缓存文件名] */
export const FILES = {
  /** 英文维基词典的阿拉伯语词条（kaikki.org 按语言分好的、经过后处理的版本） */
  wiktEn: [kaikki('dictionary', 'Arabic'), 'kaikki-en-Arabic.jsonl.gz'],
  /** 中文维基词典的阿拉伯语词条：繁体标题「阿拉伯語」与简体标题「阿拉伯语」两份 */
  wiktZhHant: [kaikki('zhwiktionary', '阿拉伯語'), 'kaikki-zh-阿拉伯語.jsonl.gz'],
  wiktZhHans: [kaikki('zhwiktionary', '阿拉伯语'), 'kaikki-zh-阿拉伯语.jsonl.gz'],
  /** 英文维基词典的英语词条：只用它的翻译表（同一个英语义项下的阿拉伯语、汉语译词） */
  wiktEnEnglish: [kaikki('dictionary', 'English'), 'kaikki-en-English.jsonl.gz'],
  /** 中文维基词典的汉语词条：只用它的翻译表（汉语词 → 阿拉伯语译词） */
  wiktZhChineseHant: [kaikki('zhwiktionary', '漢語'), 'kaikki-zh-漢語.jsonl.gz'],
  wiktZhChineseHans: [kaikki('zhwiktionary', '汉语'), 'kaikki-zh-汉语.jsonl.gz'],
  /** 词频（wordfreq 的大表：维基百科、字幕、新闻、网页、推特五种语料合起来） */
  wordfreq: [
    'https://raw.githubusercontent.com/rspeer/wordfreq/master/wordfreq/data/large_ar.msgpack.gz',
    'wordfreq-large_ar.msgpack.gz'
  ],
  /** Tatoeba：阿拉伯语句子、阿英 / 阿中对照；英中对照用来给只有英译的句子转一道中文 */
  taraSentences: [tatoeba('ara/ara_sentences.tsv.bz2'), 'tatoeba-ara_sentences.tsv.bz2'],
  taraEng: [tatoeba('ara/ara-eng_links.tsv.bz2'), 'tatoeba-ara-eng_links.tsv.bz2'],
  taraCmn: [tatoeba('ara/ara-cmn_links.tsv.bz2'), 'tatoeba-ara-cmn_links.tsv.bz2'],
  tengSentences: [tatoeba('eng/eng_sentences.tsv.bz2'), 'tatoeba-eng_sentences.tsv.bz2'],
  tengCmn: [tatoeba('eng/eng-cmn_links.tsv.bz2'), 'tatoeba-eng-cmn_links.tsv.bz2'],
  tcmnSentences: [tatoeba('cmn/cmn_sentences.tsv.bz2'), 'tatoeba-cmn_sentences.tsv.bz2'],
  /** OpenCC 的繁简对照（中文维基词典的释义多是繁体，转成简体） */
  openccChars: [
    'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt',
    'opencc-TSCharacters.txt'
  ],
  openccPhrases: [
    'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSPhrases.txt',
    'opencc-TSPhrases.txt'
  ]
} as const satisfies Record<string, readonly [string, string]>

export type FileKey = keyof typeof FILES

/** 下载一份（已经有了就跳过），返回本地路径 */
export const fetchFile = (key: FileKey): Promise<string> => fetchCached(...FILES[key])

/** 写进 dict.sqlite 的来源（词条的 src、义项的 zs、例句的 src 都用这些 id） */
export const SOURCES = {
  wiktionary: {
    id: 'wiktionary',
    name: '维基词典（英文版）的阿拉伯语词条：带元音的写法、词根、派生式、释义、IPA、变位变格表、录音（kaikki.org 用 wiktextract 抽取）',
    license: 'CC BY-SA 4.0',
    credit: 'Wiktionary contributors; kaikki.org / wiktextract (Tatu Ylonen)',
    home: 'https://kaikki.org/dictionary/Arabic/'
  },
  wiktZh: {
    id: 'wikt-zh',
    name: '维基词典（中文版）的阿拉伯语词条：中文释义（繁体经 OpenCC 转成简体）',
    license: 'CC BY-SA 4.0',
    credit:
      '维基词典贡献者（zh.wiktionary.org）；kaikki.org / wiktextract（Tatu Ylonen）；OpenCC（Apache 2.0）',
    home: 'https://zh.wiktionary.org/'
  },
  wiktTr: {
    id: 'wikt-tr',
    name: '维基词典的翻译表：同一个英语义项下的阿拉伯语与汉语译词，按词条的英文释义对到义项上',
    license: 'CC BY-SA 4.0',
    credit:
      'Wiktionary contributors (en.wiktionary.org, zh.wiktionary.org); kaikki.org / wiktextract',
    home: 'https://kaikki.org/dictionary/English/',
    note: '译词是维基词典编者人工写的，但阿拉伯语词与汉语词是本软件按英语义项自动对上的，没有逐条人工核对'
  },
  wordfreq: {
    id: 'wordfreq',
    name: 'wordfreq 阿拉伯语词频（维基百科、OpenSubtitles 字幕、新闻、OSCAR 网页、推特）',
    license: 'CC BY-SA 4.0',
    credit: 'Robyn Speer, wordfreq (Exquisite Corpus); OpenSubtitles; Wikipedia; OSCAR',
    home: 'https://github.com/rspeer/wordfreq',
    note: '只用来算词条的词频名次与分级（把各个词形的频率归到原形上），不收原表'
  },
  tatoeba: {
    id: 'tatoeba',
    name: 'Tatoeba 例句（阿英、阿中对照）',
    license: 'CC BY 2.0 FR',
    credit: 'Tatoeba contributors',
    home: 'https://tatoeba.org/'
  },
  tatoebaPivot: {
    id: 'tatoeba-en',
    name: 'Tatoeba：经英语转过来的中文翻译（阿拉伯语句子的英译在 Tatoeba 上另有人工中译）',
    license: 'CC BY 2.0 FR',
    credit: 'Tatoeba contributors',
    home: 'https://tatoeba.org/',
    note: '中文是英译句子的人工翻译，不是直接从阿拉伯语翻的，意思大致相同，细节可能有出入'
  }
} as const satisfies Record<string, SourceRef>
