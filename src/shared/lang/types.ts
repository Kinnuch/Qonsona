/**
 * 内置自然语言的通用框架：英语、法语、韩语、西班牙语、阿拉伯语、俄语、苏格兰盖尔语。
 *
 * 日语先做、自成一套（src/shared/ja、src/main/dict.ts……）；这一套照日语的做法抽出来，
 * 程序本体只认这里的形状，各语言按自己的特点往里填（规则、数据、课程、题型）。
 * 约定与分工见 docs/lang-kit.md；每门语言的特点、资料与计划见 docs/lang/<代码>.md。
 *
 * 这个文件只放类型（主进程、界面、数据管线、测试共用），不放任何一门语言的内容。
 */

/** 多语言文字：键是界面语言（zh、en），值是那种语言的写法 */
export type LocalizedText = Record<string, string>

/** 这套框架里的语言（日语不在里面，另有一套） */
export type LangCode = 'en' | 'fr' | 'ko' | 'es' | 'ar' | 'ru' | 'gd'

export const LANG_CODES: LangCode[] = ['en', 'fr', 'ko', 'es', 'ar', 'ru', 'gd']

// ───────────────────────── 来源与许可 ─────────────────────────

/** 一份资料：设置里「数据来源与许可」逐条列出，词条下注明释义出自哪里 */
export interface SourceRef {
  /** 短 id：词条、例句里用它指来源（wiktionary、ecdict、krdict……） */
  id: string
  name: string
  /** 许可证：CC BY-SA 4.0、MIT、公有领域…… */
  license: string
  /** 署名：作者、机构 */
  credit: string
  /** 主页 */
  home: string
  /** 补充说明：取了哪一部分、怎么处理过、机器翻译…… */
  note?: string
}

// ───────────────────────── 等级 ─────────────────────────

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export interface LevelDef {
  /** A1、1、cet4……（在这一套体系里唯一） */
  id: string
  /** 显示名：A1 入门级、TOPIK 3 级、大学英语四级 */
  name: LocalizedText
  /** 角标、图例用的短名：A1、3级、四级 */
  short: string
  /** 这一级能做什么、考试是什么样（CEFR 的能力描述、考试说明） */
  desc?: LocalizedText
}

/**
 * 一套分级。一门语言可以有几套：
 * - proficiency：能力等级（CEFR、TOPIK、ТРКИ、ACTFL），各级之间是递进的；
 * - wordlist：考试 / 教材词表（中考、四级、雅思……），一个词可以同时在几张表里。
 */
export interface LevelSystemDef {
  id: string
  name: LocalizedText
  kind: 'proficiency' | 'wordlist'
  /** 从易到难 */
  levels: LevelDef[]
  /**
   * 主分级：阅读的下划线、练习选级、模拟卷、文章难度都按它。
   * 每门语言恰好一套 primary，而且必须是 proficiency
   */
  primary?: boolean
  /** 各级大致对应的 CEFR（跨体系比较、给只在别的体系里有等级的词兜底） */
  cefr?: Record<string, CefrLevel>
  /** 分级依据：哪份大纲、哪张词表、按词频怎么切 */
  sources: SourceRef[]
}

// ───────────────────────── 词典数据（dict.sqlite） ─────────────────────────

/**
 * 词性：Universal Dependencies 的 UPOS（小写），再加词典专用的几种。
 * 各语言的数据管线把来源的词性对到这里；更细的分类放进 LexEntryData.cls 或 tags。
 */
export type PosTag =
  | 'noun'
  | 'propn'
  | 'verb'
  | 'aux'
  | 'adj'
  | 'adv'
  | 'pron'
  | 'det'
  | 'adp'
  | 'cconj'
  | 'sconj'
  | 'num'
  | 'part'
  | 'intj'
  | 'phrase'
  | 'idiom'
  | 'proverb'
  | 'affix'
  | 'abbr'
  | 'symbol'
  | 'other'

/** 发音录音（维基共享资源、Lingua Libre……）：联网时点击播放，放过的存进缓存 */
export interface AudioRef {
  url: string
  /** 口音、说话人：UK、US、Paris、Seoul…… */
  label?: string
  license?: string
  credit?: string
}

/** 一个义项 */
export interface LexSense {
  /** 只属于这个义项的词性（跟词条的 p 不同时才写） */
  p?: PosTag[]
  /** 英文释义（几条，短的在前） */
  en?: string[]
  /** 中文释义（几条） */
  zh?: string[]
  /** 中文释义出自哪个来源（SourceRef.id）；机器翻译的来源 id 以 mt- 开头，界面会标出来 */
  zs?: string
  /** 这门语言自己的释义（单语词典），给中高级学习者 */
  mono?: string[]
  /** 标签：用 Wiktextract 的标签词（colloquial、formal、archaic、slang、figuratively……） */
  t?: string[]
  /** 领域：medicine、law、computing…… */
  dom?: string[]
  /** 例句：example 表的 id */
  ex?: number[]
  /** 近义、反义、参见（词头） */
  syn?: string[]
  ant?: string[]
  see?: string[]
}

/**
 * entry.data 解压后的 JSON。键都很短，省空间；没有的字段省略。
 * 变形表、标签一律用 Wiktextract 的标签词（plural、genitive、past、first-person、feminine……），
 * 别的来源（Lexique、OpenCorpora、한국어기초사전……）由数据管线对过来。
 */
export interface LexEntryData {
  /** 词头：规范写法，保留大小写与变音符号 */
  w: string
  /** 带辅助记号的写法：俄语重音（молоко́）、阿拉伯语元音符号（كَتَبَ）；跟 w 一样时省略 */
  d?: string
  /** 词性（可以几个；第一个是主要的） */
  p: PosTag[]
  /** 性：m、f、n、c（通性）、mf（阴阳同形）…… */
  g?: string
  /** IPA（可以几种：英式、美式、方言……） */
  ipa?: string[]
  /** 罗马化 / 转写：韩语国语罗马字、阿拉伯语、俄语的拉丁转写 */
  rom?: string
  /** 真人录音 */
  au?: AudioRef[]
  /** 义项 */
  s: LexSense[]
  /** 变形：[形式, ...标签]；词典里按标签排成表，变形练习从这里出题 */
  f?: [string, ...string[]][]
  /** 变形类别：法语 -er 动词、俄语第一变格法、阿拉伯语第二式（Form II）、韩语 ㅂ 不规则…… */
  cls?: string[]
  /** 各套分级里的等级：{ cefr: 'A1', 'cn-exam': ['cet4', 'cet6'] } */
  lv?: Record<string, string | string[]>
  /** 词频名次（1 最常用）；没有词频数据时省略 */
  fr?: number
  /** 这门语言特有的信息（韩语汉字词 hanja、阿拉伯语词根 root、俄语体的配对 aspect……），见各语言的文档 */
  x?: Record<string, unknown>
  /** 这一条用到的来源（SourceRef.id） */
  src?: string[]
}

/** 例句（example 表的一行） */
export interface LexExample {
  id: number
  text: string
  en?: string | null
  zh?: string | null
  /** 中文翻译出自哪里；mt- 开头是机器翻译 */
  zs?: string | null
  /** 例句来源（tatoeba……） */
  src?: string | null
  /** 估出来的难度（主分级的等级 id） */
  lv?: string | null
}

// ───────────────────────── 语言规则（纯函数） ─────────────────────────

/** 切词结果里的一段 */
export interface RawToken {
  /** 原文里的这一段 */
  text: string
  /** 在原文里的起止（码元下标） */
  start: number
  end: number
  /** 词、数字、标点、空白 */
  kind: 'word' | 'num' | 'punct' | 'space'
}

/** 从词形猜原形：lemma 拿去查 form 表；tags 说明猜了什么变化（复数、宾格助词、冠词省音……） */
export interface LemmaGuess {
  lemma: string
  tags: string[]
}

/** 正文上可开关的辅助记号（俄语重音符、阿拉伯语元音符号） */
export interface MarkDef {
  id: string
  name: LocalizedText
  /** 去掉这种记号 */
  strip(text: string): string
}

/**
 * 一门语言的规则：主进程查词、阅读器切词、数据管线写 form 表都用同一份（纯函数，测试里直接测）。
 * key() 是查词的根本：数据管线存 form.key、主进程查词时都过一遍，两边必须一致。
 */
export interface LangRules {
  /** 查词的键：小写、统一写法（NFC、统一引号、阿拉伯语统一字形……） */
  key(text: string): string
  /** 宽松的键：去掉重音与变音符号（é→e、ё→е、阿拉伯语去元音符号）；查不到时再试 */
  looseKey?(text: string): string
  /** 切词；不写时用 Intl.Segmenter（text.ts 的 segmentWords） */
  tokenize?(text: string): RawToken[]
  /** form 表查不到时，猜可能的原形（韩语去助词与词尾、阿拉伯语去附着词、英语去 -ing……） */
  lemmaCandidates?(surface: string): LemmaGuess[]
  /** 正文上可开关的记号 */
  marks?: MarkDef[]
  /** 转写成拉丁字母 */
  romanize?(text: string): string
}

// ───────────────────────── 语言说明（学习包的描述） ─────────────────────────

/** 字母课学什么：字母逐个学（拉丁、西里尔、阿拉伯、韩文字母）/ 拼读规则 */
export type LangAlphabet = 'letters' | 'phonics' | null

/** 词典里另外的一栏：韩语汉字词的汉字、阿拉伯语词根 */
export type LangCharacters = 'hanja' | 'roots' | null

/** 能力：界面每个模块显不显示只看这些（对应 lib/packs/types.ts 的 PackFeatures） */
export interface LangFeatures {
  texts: boolean
  lexicon: boolean
  alphabet: LangAlphabet
  characters: LangCharacters
  grammar: boolean
  inflection: boolean
  phrasebook: boolean
  idioms: boolean
  stories: boolean
  media: boolean
  exam: boolean
  /** 正文上方的注音：罗马化（韩语、阿拉伯语、俄语）/ IPA（盖尔语、英语）；不注音为 null */
  ruby: 'romanization' | 'ipa' | null
  romanization: boolean
  /** 系统语音的语言代码（BCP-47，en-US、fr-FR……）；Windows 没有这门语言的语音时也照写，界面会提示去装 */
  speech: string | null
}

export interface LangSpec {
  code: LangCode
  /** 界面上怎么称呼 */
  name: LocalizedText
  /** 这门语言自己的叫法：English、français、한국어…… */
  nativeName: string
  /** BCP-47 */
  bcp47: string
  /** 界面强调色 */
  color: string
  direction: 'ltr' | 'rtl'
  /** 几套分级，恰好一套 primary */
  levelSystems: LevelSystemDef[]
  features: LangFeatures
  /** 一句话介绍（首页「关于这门语言」） */
  intro: LocalizedText
}

/** 一门语言的全部：说明 + 规则；以后的阶段再加阅读、课程、练习的部分 */
export interface LangModule {
  spec: LangSpec
  rules: LangRules
}
