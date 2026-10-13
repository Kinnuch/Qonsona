/**
 * 学习包：软件里「一门要学的语言」。
 *
 * 程序本体不认识任何一门具体语言——名字、等级体系、有没有字母课、用什么注音，全由学习包说了算。
 * 学习包有两个来路：
 * - builtin：随软件带的自然语言（先做日语），数据由 M1 起的数据管线生成；
 * - qonlang：从千语集项目（.laim.json）里挑一门语言转过来，见 lib/packs/qonlang/。
 *
 * 界面上每个模块显示与否只看 PackFeatures，不看 kind——以后加中文、韩语、德语，
 * 或者别人在千语集里造的语言，都走同一套判断。
 */

/** 多语言文字：键是界面语言（zh、en），值是那种语言的写法；允许只填一种 */
export type LocalizedText = Record<string, string>

export type PackKind = 'builtin' | 'qonlang'

export type TextDirection = 'ltr' | 'rtl' | 'ttb'

/** 字母课学什么：假名表 / 自造文字的字形表 / 音位与拼写 / 字母逐个学（韩文、西里尔、阿拉伯字母）/ 拼读规则（英、法、盖尔） */
export type AlphabetKind = 'kana' | 'glyphs' | 'phonemes' | 'letters' | 'phonics'

/** 词典里「字」那一栏：汉字 / 自造文字字形 / 语素（词根词缀）/ 韩语汉字词的汉字 / 阿拉伯语词根 */
export type CharacterKind = 'kanji' | 'glyphs' | 'morphemes' | 'hanja' | 'roots'

/** 正文上方的注音：振假名 / 国际音标 / 另一套正字法 / 罗马字转写（韩、阿、俄） */
export type RubyKind = 'furigana' | 'ipa' | 'orthography' | 'romanization' | 'pronunciation'

export interface PackFeatures {
  /** 有文章、例句可读（自己导入的文本也要能切词） */
  texts: boolean
  /** 有词库：词典、生词本、练习都靠它 */
  lexicon: boolean
  alphabet: AlphabetKind | null
  characters: CharacterKind | null
  /** 有语法讲解（日语的语法点、千语集作者写的语法文档） */
  grammar: boolean
  /** 有变形可练（日语动词活用、千语集的构形表） */
  inflection: boolean
  /** 有会话 / 短语 */
  phrasebook: boolean
  /** 有惯用语课（日语的慣用句、ことわざ、四字熟語） */
  idioms: boolean
  /** 有故事课（一课一篇文章：日语的民间故事） */
  stories: boolean
  /** 带字幕的视频、音频 */
  media: boolean
  /** 有考试模板（JLPT 这类） */
  exam: boolean
  ruby: RubyKind | null
  /** 能在罗马化 / 转写与原文之间切换 */
  romanization: boolean
  /** 朗读用的语音语言代码（BCP-47）；没有能朗读的语音时为 null */
  speech: string | null
  /** 有逐词对译（隔行注释：原文 / 切分 / gloss） */
  gloss: boolean
  /** 有词源、历史形式 */
  etymology: boolean
}

export interface Level {
  id: string
  name: LocalizedText
  /** 这一级有多少个词（数据生成时算好；内置包的数据还没做出来时没有） */
  count?: number
}

/** 等级体系：日语 JLPT N5–N1、中文 HSK 1–9、欧洲语言 CEFR A1–C2……按从易到难排 */
export interface LevelSystem {
  id: string
  name: LocalizedText
  levels: Level[]
}

/** 一套要显示的文字（自造文字的字体、竖排等） */
export interface PackScript {
  id: string
  name: string
  /** 字母文字、音节文字、意音文字…… */
  type: string
  direction: TextDirection
  vertical: boolean
  glyphCount: number
  /** 字体：系统字体名；内嵌字体在来源项目里，按需注册 */
  fontFamily: string
  embeddedFont: boolean
}

/** 学习包里有多少东西，首页和语言管理页上显示 */
export interface PackStats {
  lexemes: number
  morphemes: number
  sentences: number
  phrases: number
  docs: number
  /** 这门语言的词条实际用到的构形 */
  paradigms: number
  phonemes: number
  orthographies: number
}

/** 从千语集来的学习包记着它出自哪个项目的哪门语言；重新导入时靠这两个 id 认出是同一个包 */
export interface QonlangSource {
  projectId: string
  projectName: string
  languageId: string
  /** 写这个项目文件的千语集版本 */
  appVersion: string
  /** 读它时用的千语集引擎快照（vendor/qonlang/VERSION.json） */
  engineVersion: string
  fileName: string
  importedAt: string
}

export interface PackManifest {
  id: string
  kind: PackKind
  /** 界面上怎么称呼这门语言（按界面语言挑） */
  name: LocalizedText
  /** 这门语言自己的叫法（日本語；千语集里语言的名字） */
  nativeName: string
  /** 页面 lang 属性与排版用的语言标记；人造语言用 art-x- 开头的私用标记 */
  bcp47: string
  /** 强调色：切到这门语言时界面跟着换 */
  color: string
  direction: TextDirection
  levels: LevelSystem | null
  features: PackFeatures
  scripts: PackScript[]
  stats: PackStats | null
  source?: QonlangSource
  /** 从千语集的学习包（.qstudy.json）导入的：作者给的设置概况（详细的在包目录 study.json） */
  study?: PackStudySummary
}

export interface PackStudySummary {
  author: string
  lessons: number
  /** 作者录音的条数 */
  audio: number
  hidden: number
  hasIntro: boolean
}

/** 界面上的模块 */
export type ModuleId =
  | 'home'
  | 'reading'
  | 'courses'
  | 'dictionary'
  | 'notebook'
  | 'practice'
  | 'media'
  | 'stats'
  | 'collection'
  | 'packs'
  | 'settings'

// ───────────────────────── 语言适配器（M1 起实现） ─────────────────────────

/** 切词结果里的一个词 */
export interface TextToken {
  /** 原文里的写法 */
  surface: string
  /** 在原文里的起止位置（码元下标） */
  start: number
  end: number
  /** 是不是词（标点、空白为 false） */
  word: boolean
  /** 原形 / 词头（查词用） */
  lemma?: string
  /** 注音（振假名、IPA……），按 PackFeatures.ruby 的种类 */
  ruby?: string
  /** 词库里对上的条目 id（千语集来的包就是千语集的词条 id） */
  entryId?: string
  /** 等级（JLPT N3 之类），给下划线上色 */
  levelId?: string
}

/**
 * 语言适配器：每门语言「怎么切词、怎么查原形、怎么注音」的代码实现。
 * 学习包只是数据；需要算的东西放在适配器里。日语用 kuromoji，千语集来的语言共用一个
 * 通用适配器（跑千语集自己的分词、构形反推与文字转写），以后简单的语言可以只按空格切。
 */
export interface LanguageAdapter {
  tokenize(text: string): Promise<TextToken[]>
  /** 把变过形的写法还原成可以查词典的形式，按可能性排 */
  lemmatize(surface: string): Promise<string[]>
  /** 转成罗马字 / 转写；没有这一项的语言不提供 */
  romanize?(text: string): string
  /** 用某套文字写出来（千语集的自造文字）；没有这一项的语言不提供 */
  renderScript?(text: string, scriptId: string): string
}
