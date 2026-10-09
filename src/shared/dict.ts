/**
 * 日语词典：主进程（查 SQLite）和界面共用的数据形状。
 * 数据库结构见 scripts/data/build-ja.mjs。
 */
import type { Conjugable } from './ja/conjugate'

/** 数据库里词条的紧凑 JSON（entry.data 解压后） */
export interface RawEntry {
  /** 汉字写法：只有文字时是字符串；有标记时 [文字, 常用, 标记] */
  k?: (string | [string, number?, string[]?])[]
  /** 假名写法：[文字, 常用, 标记, 只配哪几个汉字写法] */
  r?: (string | [string, number?, string[]?, string[]?])[]
  s: RawSense[]
  /** 中文释义，与 s 一一对应 */
  z?: string[]
  /** 中文释义的来源（mt-en / tomoshi），存成只有一项的数组 */
  zs?: string[]
}

export interface RawSense {
  /** 词性 */
  p?: string[]
  /** 英文释义 */
  g: string[]
  /** 其他标记（口语、敬语、多写假名……） */
  m?: string[]
  /** 领域（医学、计算机……） */
  f?: string[]
  /** 方言 */
  d?: string[]
  /** 补充说明 */
  i?: string[]
  /** 参见 */
  x?: string[]
  /** 反义 */
  a?: string[]
  /** 只配哪几个汉字写法 / 假名写法 */
  k?: string[]
  r?: string[]
  /** 例句编号（Tatoeba） */
  e?: number[]
}

export interface FormView {
  text: string
  common: boolean
  tags: string[]
}

export interface ExampleView {
  id: number
  ja: string
  en: string | null
  /** 中文翻译：人工翻译（Tatoeba）优先，没有时用机器翻译并标出来 */
  zh: string | null
  zhMachine: boolean
}

export interface SenseView {
  pos: string[]
  en: string[]
  zh: string | null
  misc: string[]
  field: string[]
  dialect: string[]
  info: string[]
  xref: string[]
  antonym: string[]
  /** 这个义项只用于哪些写法（空表示全部） */
  only: string[]
  examples: ExampleView[]
}

export interface EntryView {
  id: number
  head: string
  reading: string
  kanji: FormView[]
  kana: FormView[]
  common: boolean
  /** 5..1（N5 = 5）；不在 JLPT 词表里是 null */
  jlpt: number | null
  senses: SenseView[]
  /** 中文释义的来源：mt-en（本软件由英文翻译）/ tomoshi / null（没有中文） */
  zhSource: string | null
  /** 词头里的汉字：字、第一条中文字义、音读 */
  chars: { ch: string; zh: string; on: string }[]
  /** 自他动词配对 */
  pair: { id: number; head: string; reading: string; role: string } | null
}

/** 内置词本里的一个词（JLPT 词表） */
export interface WordListItem {
  id: number
  head: string
  reading: string
  zh: string
  en: string
}

/** 变形课、变形练习用的词：能变形的动词、形容词（写法按平时的写法，通常写假名的用假名） */
export interface ConjugableWord extends Conjugable {
  id: number
  jlpt: number
  zh: string
  en: string
}

/** 五十音课的例词：假名写法、词头（有汉字的写法）与一句释义 */
export interface KanaWord {
  /** 假名写法（さかな、コーヒー） */
  text: string
  id: number
  head: string
  zh: string
  en: string
}

export interface SearchHit {
  id: number
  head: string
  reading: string
  common: boolean
  jlpt: number | null
  /** 列表上显示的一句释义（中文优先） */
  zh: string | null
  en: string
  /** 怎么对上的 */
  match: 'exact' | 'kana' | 'deinflected' | 'prefix' | 'gloss'
  /** 经词形还原对上的：原形上依次加了哪些变形 */
  reasons?: string[]
  /** 经词形还原对上的：用户输入的是哪个形 */
  inflected?: string
}

export interface ContrastCard {
  cn: string
  summary: string
  items: { entryId: number; ja: string; reading: string; note: string }[]
}

export interface SearchResult {
  query: string
  /** 输入的是罗马字时转出来的假名 */
  kana: string | null
  hits: SearchHit[]
  /** 输入的中文正好有「中日同形词对照」 */
  contrast: ContrastCard | null
}

export interface KanjiView {
  ch: string
  on: string[]
  kun: string[]
  nanori: string[]
  en: string[]
  zh: string[]
  pinyin: string[]
  strokes: number | null
  grade: number | null
  freq: number | null
  jlpt: number | null
  radical: number | null
  /** KanjiVG 笔画路径（viewBox 0 0 109 109），按笔顺 */
  paths: string[]
  words: SearchHit[]
}

export interface DictSource {
  name: string
  license: string
  credit: string
  home: string
}
