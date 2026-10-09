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

/** 一门语言的全部：说明 + 规则，以及各阶段加上的部分（没做的省略） */
export interface LangModule {
  spec: LangSpec
  rules: LangRules
  /** 阶段二：语法点（阅读器认、词典的语法页签、语法课用） */
  grammar?: LexGrammarPoint[]
  /** 阶段二：新闻来源 */
  news?: NewsSource[]
}

// ───────────────────────── 阅读（阶段二） ─────────────────────────

/** 正文里的一段：阅读器显示、点击查词、认语法点都用它 */
export interface LexToken {
  text: string
  start: number
  end: number
  kind: RawToken['kind']
  /** 对上的词条（词典 entry.id） */
  entry?: number
  /** 原形（词头） */
  lemma?: string
  /** 词性 */
  pos?: PosTag
  /** 这个词形的标签：复数、过去分词、主格助词……（form 表的 tags，或者猜原形时给的） */
  tags?: string[]
  /** 主分级的等级 */
  lv?: string | null
  zh?: string
  en?: string
  /** 注音：罗马化 / IPA（按 features.ruby） */
  ruby?: string
}

export interface LexSentence {
  start: number
  end: number
  /** 第几段 */
  para: number
  tokens: LexToken[]
}

/** 正文里认出的一个语法点 */
export interface LexGrammarHit {
  id: string
  /** 第几句 */
  sentence: number
  start: number
  end: number
}

export interface LexAnalysis {
  text: string
  sentences: LexSentence[]
  grammar: LexGrammarHit[]
  /** 估出来的难度（主分级的等级）；词太少时为 null */
  level: string | null
}

/**
 * 认语法点用的「一个词」的条件。几个条件都要满足；没写的不管。
 * 一个语法点的 pattern 是这种条件的序列，按顺序对上正文里的词（标点、空白跳过）。
 */
export interface TokenTest {
  /** 原形是这个（或其中之一）；用 rules.key() 规整后比较 */
  lemma?: string | string[]
  /** 原文写法是这个（或其中之一）；规整后比较 */
  form?: string | string[]
  /** 原文写法要匹配的正则 */
  surface?: RegExp
  pos?: PosTag | PosTag[]
  /** 这些标签都要有 */
  tags?: string[]
  /** 这些标签里有一个就行 */
  anyTags?: string[]
  /** 这个词不能满足的条件 */
  not?: TokenTest
  /** 可以没有这个词 */
  optional?: boolean
  /** 跟上一个词之间最多隔几个词（默认 0：紧挨着） */
  gap?: number
  /** 只看不算：前后文条件，不算进标出的范围 */
  ctx?: boolean
}

/** 一个语法点：讲解、例句，以及在正文里怎么认出来 */
export interface LexGrammarPoint {
  id: string
  /** 主分级的等级（CEFR A1、TOPIK 2……） */
  level: string
  /** 名字：passé composé、-고 싶다、present perfect */
  name: LocalizedText
  /** 构成：avoir / être + 过去分词 */
  form: LocalizedText
  /** 意思与用法 */
  meaning: LocalizedText
  /** 补充说明（易错点、跟相近语法的区别） */
  notes?: LocalizedText
  /** 例句（自己写的或语料里的；要地道、正确） */
  examples: { text: string; zh?: string; en?: string }[]
  /** 正文里怎么认出来：几种词序列，任一种对上就算；没有的只在语法课、词典里出现 */
  patterns?: TokenTest[][]
  /** 意思相近、出题时不互相当干扰项的一组 */
  group?: string
}

/** 新闻来源 */
export interface NewsSource {
  id: string
  name: string
  /** RSS / Atom 地址 */
  url: string
  /** headline：有版权，只收标题与导语，正文看原文；full：开放许可（公有领域、CC），可以收全文 */
  license: 'headline' | 'full'
  /** 许可的名字（公有领域、CC BY 2.5、版权所有……） */
  licenseName: string
  home: string
  /** 分类：显示在文章库的主题里 */
  topic?: string
  /** 简易新闻（美国之音 Learning English、RFI 简易法语）标出难度（主分级的等级） */
  level?: string
}

/** 内置课文（data/<代码>/texts.json 的一项）：公有领域或开放许可的文章、故事、诗 */
export interface LexText {
  id: string
  title: string
  author?: string
  /** 正文：段落之间空一行 */
  text: string
  /** 出处：维基文库的页面、古登堡编号…… */
  source: string
  license: string
  url?: string
  /** 主题：story、fable、poem、news、wiki…… */
  topic?: string
  /** 难度（主分级的等级），数据管线估好写进来 */
  level?: string
}
