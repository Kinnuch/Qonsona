/**
 * 框架里各语言的词典：主进程（src/main/lang/lexdb.ts 查 SQLite）交给界面的数据形状。
 */
import type { AudioRef, LexExample, LocalizedText, PosTag, SourceRef } from './types'

/** 查词时怎么对上的：词头、变形、去掉变音符号、按规则猜原形、前缀、释义反查 */
export type LexMatch = 'exact' | 'form' | 'loose' | 'guess' | 'prefix' | 'gloss'

export interface LexHit {
  id: number
  w: string
  /** 带辅助记号的写法（俄语重音、阿拉伯语元音符号） */
  d?: string
  p: PosTag[]
  g?: string
  /** 主分级的等级 */
  lv: string | null
  /** 列表上的一句释义 */
  zh?: string
  en?: string
  match: LexMatch
  /** 经变形、猜原形对上的：用户输入的是哪个形、是什么变化 */
  via?: { form: string; tags: string[] }
}

export interface LexSearchResult {
  query: string
  hits: LexHit[]
}

export interface LexSenseView {
  p: PosTag[]
  en: string[]
  zh: string[]
  /** 中文释义的来源；machine = 机器翻译 */
  zhSource: { id: string; name: string; machine: boolean } | null
  mono: string[]
  tags: string[]
  dom: string[]
  examples: LexExample[]
  syn: string[]
  ant: string[]
  see: string[]
}

/** 词条在某一套分级里的等级 */
export interface LexLevelView {
  system: string
  systemName: LocalizedText
  kind: 'proficiency' | 'wordlist'
  primary: boolean
  levels: { id: string; name: LocalizedText; short: string }[]
}

export interface LexEntryView {
  id: number
  code: string
  w: string
  d?: string
  p: PosTag[]
  g?: string
  ipa: string[]
  rom?: string
  au: AudioRef[]
  senses: LexSenseView[]
  /** 变形表：[形式, 标签] */
  /** 变形；ipa 是这个形的读音（词条的 fi 里有的才有） */
  forms: { form: string; tags: string[]; ipa?: string }[]
  cls: string[]
  levels: LexLevelView[]
  /** 词频名次 */
  freq?: number
  x: Record<string, unknown>
  sources: SourceRef[]
  /** 挂在词条上、没分到义项的例句 */
  examples: LexExample[]
}

/** 词表、生词本里的一个词 */
export interface LexWordItem {
  id: number
  w: string
  d?: string
  p: PosTag[]
  g?: string
  lv: string | null
  zh: string
  en: string
}

/** 一张词表：分级的一级（cefr:A1）、主题（theme:food）、别的（x:awl） */
export interface LexListInfo {
  name: string
  count: number
  /** 主题词本、别的词表的名字（数据管线写在 meta.themes / meta.lists_info 里）；分级的名字界面按 spec 写 */
  title?: LocalizedText
}

/** 一门语言的数据装了没有、多大、什么时候生成的 */
export interface LexStatus {
  code: string
  available: boolean
  entries: number
  examples: number
  bytes: number
  builtAt: string | null
}
