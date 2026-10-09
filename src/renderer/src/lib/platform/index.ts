/**
 * 渲染层跟主进程打交道的唯一入口。文件读写、偏好、学习包目录都走这里。
 */
import type { PackManifest } from '$lib/packs/types'
import type {
  DictSource,
  EntryView,
  ConjugableWord,
  ExampleView,
  KanaWord,
  KanjiView,
  SearchResult,
  WordListItem
} from '$shared/dict'
import type { JaAnalysis } from '$shared/ja/reader'
import type { UpdateCheck } from '$shared/update'
import type { GrammarExampleData } from '$shared/ja/grammar-course'
import type { ExamPaper, ExamQuestion, PracticeKind } from '$shared/exam'
import type { MediaItem, MediaPatch } from '$shared/media'
import type { Article, ArticleInput, ArticleMeta, NhkStatus } from '$shared/articles'
import type { LexAnalysis, LexExample, SourceRef } from '$shared/lang/types'
import type {
  LangArticle,
  LangArticleInput,
  LangArticleMeta,
  LangNewsStatus
} from '$shared/lang/articles'
import type {
  LexEntryView,
  LexListInfo,
  LexSearchResult,
  LexStatus,
  LexWordItem
} from '$shared/lang/views'

/** 维基词典的一条释义：来源（日语版 / 中文版）、词性、释义、例句、出自哪一页 */
export interface WiktDefinition {
  src: 'ja' | 'zh'
  pos: string
  text: string
  examples: string[]
  word: string
}

export interface Prefs {
  locale: 'zh' | 'en'
  theme: 'system' | 'light' | 'dark'
  activePackId: string | null
  /** 读 IPA 用哪个系统声音；空着自动挑 */
  ipaVoice: string
  /** 朗读语速，-10 … 10 */
  speechRate: number
  /** 阅读页自动取 NHK News Web Easy 的文章（取不到时用内置与自己导入的） */
  nhkEasy: boolean
  /** 复习：每天学几个新词、每天最多复习几个、新词按加入顺序还是打乱、答错的本轮再来一次 */
  newPerDay: number
  reviewCap: number
  studyOrder: 'seq' | 'random'
  relearn: boolean
  /** 自动检查新版本、隔多少分钟查一次、跳过的版本（右下角的提示不再为它弹出） */
  checkUpdates: boolean
  updateCheckMinutes: number
  skippedVersion: string
}

export const DEFAULT_PREFS: Prefs = {
  locale: 'zh',
  theme: 'system',
  activePackId: 'ja',
  ipaVoice: '',
  speechRate: 0,
  nhkEasy: true,
  newPerDay: 20,
  reviewCap: 200,
  studyOrder: 'seq',
  relearn: true,
  checkUpdates: true,
  updateCheckMinutes: 20,
  skippedVersion: ''
}

export interface AppInfo {
  version: string
  userData: string
  platform: string
}

export interface Voice {
  name: string
  /** BCP-47，如 en-US、ja-JP */
  culture: string
  gender: string
}

export interface SpeakResult {
  wav: Uint8Array | null
  /** 系统语音读不出、朗读时略去的符号 */
  dropped: string[]
  error?: string
}

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const b = window.qstudy
  if (!b) return Promise.reject(new Error('Electron bridge 未注入'))
  return b.invoke(channel, ...args) as Promise<T>
}

export const platform = {
  info: () => invoke<AppInfo>('app:info'),
  checkUpdate: () => invoke<UpdateCheck>('app:checkUpdate'),
  /** 下载安装包（装过的 Windows 版先试增量）；version 给了才试增量 */
  downloadUpdate: (url: string, name: string, version?: string) =>
    invoke<{ ok: boolean; path?: string; error?: string }>(
      'app:downloadUpdate',
      url,
      name,
      version
    ),
  installUpdate: (path: string) =>
    invoke<{ ok: boolean; manual?: boolean; error?: string }>('app:installUpdate', path),
  onUpdateProgress: (cb: (p: { received: number; total: number }) => void): void =>
    window.qstudy?.on('update:progress', (p) => cb(p as { received: number; total: number })),
  openDataDir: () => invoke<void>('app:openDataDir'),
  getPrefs: () => invoke<Prefs>('prefs:get'),
  setPrefs: (patch: Partial<Prefs>) => invoke<Prefs>('prefs:set', patch),
  setTheme: (theme: Prefs['theme']) => invoke<void>('theme:set', theme),
  listPacks: () => invoke<PackManifest[]>('packs:list'),
  readPackFile: (id: string, file: string) => invoke<string | null>('packs:readFile', id, file),
  /** audio 是作者录音：条目键 → 字节与扩展名，存在包目录的 audio/ 下 */
  savePack: (
    id: string,
    files: Record<string, string>,
    audio: Record<string, { bytes: Uint8Array; ext: string }> = {}
  ) => invoke<void>('packs:save', id, files, audio),
  /** 包里有作者录音的条目键 */
  listPackAudio: (id: string) => invoke<string[]>('packs:audioList', id),
  getPackAudio: (id: string, key: string) =>
    invoke<{ bytes: Uint8Array; mime: string } | null>('packs:audio', id, key),
  removePack: (id: string) => invoke<void>('packs:remove', id),
  pickQonlang: () => invoke<{ name: string; content: string } | null>('qonlang:pick'),
  voices: () => invoke<Voice[]>('speech:voices'),
  speak: (req: { content: string; ipa: boolean; voice: string; rate: number }) =>
    invoke<SpeakResult>('speech:speak', req),
  listRecordings: (packId: string) => invoke<string[]>('rec:list', packId),
  getRecording: (packId: string, key: string) =>
    invoke<{ bytes: Uint8Array; mime: string } | null>('rec:get', packId, key),
  saveRecording: (packId: string, key: string, bytes: Uint8Array, ext: string) =>
    invoke<void>('rec:save', packId, key, bytes, ext),
  deleteRecording: (packId: string, key: string) => invoke<void>('rec:delete', packId, key),
  pickAudioFile: () => invoke<{ bytes: Uint8Array; ext: string } | null>('rec:pickFile'),
  // 日语词典（主进程查 SQLite）
  ja: {
    available: () => invoke<boolean>('ja:available'),
    search: (q: string) => invoke<SearchResult | null>('ja:search', q),
    entry: (id: number) => invoke<EntryView | null>('ja:entry', id),
    kanji: (ch: string) => invoke<KanjiView | null>('ja:kanji', ch),
    examples: (q: string) => invoke<ExampleView[]>('ja:examples', q),
    tags: () => invoke<Record<string, string>>('ja:tags'),
    sources: () => invoke<DictSource[]>('ja:sources'),
    analyze: (text: string) => invoke<JaAnalysis>('ja:analyze', text),
    jlptWords: (level: number) => invoke<WordListItem[]>('ja:jlptWords', level),
    jlptCounts: () => invoke<Record<number, number>>('ja:jlptCounts'),
    wordItems: (ids: number[]) => invoke<WordListItem[]>('ja:wordItems', ids),
    /** 五十音课：这个假名开头的常用词 */
    kanaStartWords: (prefix: string, limit?: number) =>
      invoke<KanaWord[]>('ja:kanaStartWords', prefix, limit),
    /** 五十音课：只用学过的假名（allowed）写成、用到这一课假名（must）的常用词 */
    kanaSpellWords: (allowed: string[], must: string[], limit?: number) =>
      invoke<KanaWord[]>('ja:kanaSpellWords', allowed, must, limit),
    kanaLookup: (texts: string[]) => invoke<KanaWord[]>('ja:kanaLookup', texts),
    /** 变形课、变形练习：某几级 JLPT 里能变形的动词、形容词 */
    conjugables: (levels: number[]) => invoke<ConjugableWord[]>('ja:conjugables', levels),
    grammarExamples: () => invoke<GrammarExampleData>('ja:grammarExamples'),
    /** 练习：某一级（5 = N5）某一种题出 n 道 */
    practice: (kind: PracticeKind, level: number, n: number, seed: number) =>
      invoke<ExamQuestion[]>('ja:practice', kind, level, n, seed),
    /** 模拟卷（N5–N1）；没有词典数据库时是 null */
    paper: (level: number, seed: number) => invoke<ExamPaper | null>('ja:paper', level, seed),
    /** 手写查字：先把参考数据建好（打开手写板时） */
    handwritingLoad: () => invoke<boolean>('ja:handwritingLoad'),
    /** 手写查字：按笔画（画板坐标的点列）认字，最像的在前 */
    handwriting: (strokes: [number, number][][], n?: number) =>
      invoke<{ ch: string; score: number }[]>('ja:handwriting', strokes, n),
    /** 维基词典的释义：日语版的日语释义（日日词典）、中文版的中文释义；没有数据时是空的 */
    wikt: (entryId: number) => invoke<WiktDefinition[]>('ja:wikt', entryId),
    /** 本文练习：用这篇文章的词、语法、句子出一组题（listen：出不出听力题） */
    articlePractice: (id: string, seed: number, listen: boolean) =>
      invoke<ExamQuestion[]>('ja:articlePractice', id, seed, listen)
  },
  /** 框架里各语言（英、法、韩、西、阿、俄、苏格兰盖尔）的词典：主进程查 SQLite */
  lang: {
    status: (codes: string[]) => invoke<LexStatus[]>('lang:status', codes),
    search: (code: string, q: string) => invoke<LexSearchResult | null>('lang:search', code, q),
    entry: (code: string, id: number) => invoke<LexEntryView | null>('lang:entry', code, id),
    examples: (code: string, q: string) => invoke<LexExample[]>('lang:examples', code, q),
    sources: (code: string) => invoke<SourceRef[]>('lang:sources', code),
    /** 词表（cefr:A1、cn-exam:cet4、theme:food……），常用的在前 */
    list: (code: string, name: string, limit?: number) =>
      invoke<LexWordItem[]>('lang:list', code, name, limit),
    listCounts: (code: string) => invoke<Record<string, number>>('lang:listCounts', code),
    /** 全部词表（分级的各级、主题词本……）与词数 */
    lists: (code: string) => invoke<LexListInfo[]>('lang:lists', code),
    /** 字母课的拼读词：读法与一句释义（查不到的跳过） */
    spell: (code: string, words: string[]) =>
      invoke<{ text: string; reading: string; zh: string; en: string; entry: number }[]>(
        'lang:spell',
        code,
        words
      ),
    /** 主分级每一级多少词 */
    levelCounts: (code: string) => invoke<Record<string, number>>('lang:levelCounts', code),
    items: (code: string, ids: number[]) => invoke<LexWordItem[]>('lang:items', code, ids),
    /** 真人录音（维基共享资源等）：主进程下载并缓存；没联网、地址不在白名单里时是 null */
    audio: (url: string) => invoke<{ bytes: Uint8Array; mime: string } | null>('lang:audio', url),
    /** 阅读器：分句、切词、对词条、注音、认语法点、估难度；没有词典数据时是 null */
    analyze: (code: string, text: string) => invoke<LexAnalysis | null>('lang:analyze', code, text),
    /** 文章库：内置课文、自己导入的、新闻 */
    articles: {
      list: (code: string) => invoke<LangArticleMeta[]>('langArticles:list', code),
      get: (code: string, id: string) => invoke<LangArticle | null>('langArticles:get', code, id),
      save: (code: string, input: LangArticleInput) =>
        invoke<LangArticleMeta | null>('langArticles:save', code, input),
      remove: (code: string, id: string) => invoke<void>('langArticles:remove', code, id),
      markRead: (code: string, id: string, read: boolean) =>
        invoke<void>('langArticles:markRead', code, id, read),
      setTranslation: (code: string, id: string, text: string) =>
        invoke<void>('langArticles:setTranslation', code, id, text)
    },
    /** 取新闻（一小时最多一次，force 除外） */
    news: (code: string, force?: boolean) =>
      invoke<LangNewsStatus | null>('langNews:refresh', code, force)
  },
  /** 课程进度：每门语言一个文件 */
  course: {
    load: (packId: string) => invoke<string | null>('course:load', packId),
    save: (packId: string, content: string) => invoke<void>('course:save', packId, content)
  },
  /** 视听：媒体库（视频、音频只记路径）与字幕 */
  media: {
    list: () => invoke<MediaItem[]>('media:list'),
    /** 挑视频、音频文件加进库；返回加进去的 */
    pick: () => invoke<MediaItem[]>('media:pick'),
    addPaths: (paths: string[]) => invoke<MediaItem[]>('media:addPaths', paths),
    /** 挑字幕文件加到这一条上；failed 是没能解析的文件名 */
    pickSubtitle: (id: string) =>
      invoke<{ item: MediaItem | null; failed: string[] }>('media:pickSubtitle', id),
    addSubtitlePaths: (id: string, paths: string[]) =>
      invoke<{ item: MediaItem | null; failed: string[] }>('media:addSubtitlePaths', id, paths),
    update: (id: string, patch: MediaPatch) => invoke<MediaItem>('media:update', id, patch),
    remove: (id: string) => invoke<void>('media:remove', id),
    removeSubtitle: (id: string, subId: string) =>
      invoke<MediaItem>('media:removeSubtitle', id, subId),
    subtitle: (id: string, subId: string) =>
      invoke<{ name: string; text: string } | null>('media:subtitle', id, subId),
    reveal: (id: string) => invoke<void>('media:reveal', id),
    /** 播放用的地址 */
    url: (id: string) => `qsmedia://file/${encodeURIComponent(id)}`,
    /** 拖进窗口的文件的路径 */
    pathForFile: (file: File): string => window.qstudy?.pathForFile(file) ?? ''
  },
  /** 学习时长（所有语言一个文件） */
  stats: {
    load: () => invoke<string | null>('stats:load'),
    save: (content: string) => invoke<void>('stats:save', content)
  },
  /** 备份：整个学习数据打成一个 zip；恢复在下次启动时做 */
  backup: {
    /** 挑存到哪里并导出；取消了是 null */
    export: () => invoke<{ path: string; files: number; bytes: number } | null>('backup:export'),
    /** 挑一个备份文件看看里面有什么；取消了是 null */
    pick: () =>
      invoke<
        | { ok: true; path: string; createdAt: string; appVersion: string; files: number }
        | { ok: false; reason: string }
        | null
      >('backup:pick'),
    /** 用这个备份恢复：软件会重新启动 */
    restore: (path: string) => invoke<void>('backup:restore', path),
    /** 这次启动时有没有用备份恢复过（问一次就清掉） */
    restored: () =>
      invoke<{ ok: true; files: number; saved: string } | { ok: false; reason: string } | null>(
        'backup:restored'
      )
  },
  /** 练习与模拟考的记录：每门语言一个文件 */
  practice: {
    load: (packId: string) => invoke<string | null>('practice:load', packId),
    save: (packId: string, content: string) => invoke<void>('practice:save', packId, content)
  },
  notebook: {
    load: (packId: string) => invoke<string | null>('notebook:load', packId),
    save: (packId: string, content: string) => invoke<void>('notebook:save', packId, content)
  },
  articles: {
    list: () => invoke<ArticleMeta[]>('articles:list'),
    get: (id: string) => invoke<Article | null>('articles:get', id),
    save: (input: ArticleInput) => invoke<ArticleMeta>('articles:save', input),
    remove: (id: string) => invoke<void>('articles:remove', id),
    /** 存自己贴的译文（双语对照）；空的就删掉 */
    setTranslation: (id: string, text: string) => invoke<void>('articles:setTranslation', id, text),
    markRead: (id: string, read: boolean) => invoke<void>('articles:markRead', id, read),
    pickFile: () => invoke<{ name: string; content: string } | null>('articles:pickFile'),
    nhkStatus: () => invoke<NhkStatus | null>('nhk:status'),
    refreshNhk: () => invoke<NhkStatus>('nhk:refresh')
  }
}
