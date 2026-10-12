/**
 * 阅读页的状态：文章列表与筛选、打开的文章、阅读器的显示方式、分析结果（按文章缓存）。
 * 离开阅读页再回来原样还在；显示方式（振假名 / 罗马音、下划线、字号）记进偏好以外的内存，重启复原成默认。
 */
import { platform } from '$lib/platform'
import { t } from '$lib/i18n/index.svelte'
import type { Article, ArticleInput, ArticleMeta, NhkStatus } from '$shared/articles'
import type { JaAnalysis } from '$shared/ja/reader'
import { ui } from './ui.svelte'

export type RubyMode = 'furigana' | 'romaji' | 'none'
export type SourceFilter = 'all' | 'aozora' | 'user' | 'nhk'
export type SideTab = 'vocab' | 'grammar'

/** 千语集语言的阅读页：每门语言各记一份 */
export interface QonReadingMemo {
  /** 打开的一篇（QonText.key）；null 是在列表上 */
  text: string | null
  showScript: boolean
  showIpa: boolean
  showGloss: boolean
  showTranslation: boolean
}

/** NHK 的文章多久取一次（打开首页、阅读页时看） */
const NHK_EVERY = 3600 * 1000

class ReadingState {
  articles = $state.raw<ArticleMeta[]>([])
  loaded = $state(false)
  loading = $state(false)
  nhk = $state.raw<NhkStatus | null>(null)
  /** 正在取 NHK 的文章 */
  refreshing = $state(false)

  // 列表的筛选
  level = $state<number | null>(null)
  source = $state<SourceFilter>('all')
  /** 主题（故事、诗、NHK 新闻的分类、自己填的）；null 是全部 */
  topic = $state<string | null>(null)
  hideRead = $state(false)

  // 打开的文章
  openId = $state<string | null>(null)
  /** 从首页的新闻、故事课点进来的：阅读器里点「返回」回到首页、课程 */
  backTo = $state<'home' | 'course' | null>(null)
  /** 首页的新闻停在哪一篇（每门语言各记一份） */
  newsAt = $state<Record<string, string>>({})
  article = $state.raw<Article | null>(null)
  analysis = $state.raw<JaAnalysis | null>(null)
  #cache = new Map<string, JaAnalysis>()

  // 阅读器的显示
  ruby = $state<RubyMode>('furigana')
  /** 双语对照：每段原文下面显示自己贴的译文 */
  bilingual = $state(false)
  underline = $state(true)
  fontSize = $state(20)
  side = $state<SideTab>('vocab')
  /** 本文语法里点中的一条：原文里对应的词高亮 */
  grammarFocus = $state<string | null>(null)

  /** 文章库里有的主题与篇数（多的在前） */
  topics = $derived.by<[string, number][]>(() => {
    const n = new Map<string, number>()
    for (const a of this.articles) if (a.topic) n.set(a.topic, (n.get(a.topic) ?? 0) + 1)
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  })

  shown = $derived(
    this.articles.filter(
      (a) =>
        (this.level === null || a.level === this.level) &&
        (this.source === 'all' || a.source === this.source) &&
        (this.topic === null || a.topic === this.topic) &&
        !(this.hideRead && a.readAt)
    )
  )

  #qon = $state<Record<string, QonReadingMemo>>({})

  /** 千语集语言的阅读页状态；第一次按学习包作者定的默认显示（没有学习包时文字、IPA 都显示） */
  qon(packId: string, defaults: { showIpa: boolean; showScript: boolean }): QonReadingMemo {
    // 先放进状态再读出来，读出来的才是响应式代理
    if (!this.#qon[packId])
      this.#qon[packId] = { text: null, showGloss: true, showTranslation: true, ...defaults }
    return this.#qon[packId]
  }

  async load(): Promise<void> {
    if (this.loading) return
    this.loading = true
    try {
      this.articles = await platform.articles.list()
      this.nhk = await platform.articles.nhkStatus()
      this.loaded = true
    } finally {
      this.loading = false
    }
    this.maybeRefresh()
  }

  /** 首页、阅读页打开时：还没读过文章列表就读；设置里开着、隔了一阵没取过 NHK，就在后台取一次 */
  ensure(): void {
    if (!this.loaded) void this.load()
    else this.maybeRefresh()
  }

  maybeRefresh(): void {
    const last = this.nhk ? Date.parse(this.nhk.checkedAt) : 0
    if (ui.prefs.nhkEasy && !this.refreshing && Date.now() - last > NHK_EVERY)
      void this.refreshNhk(false)
  }

  async refreshNhk(announce = true): Promise<void> {
    if (this.refreshing) return
    this.refreshing = true
    try {
      const s = await platform.articles.refreshNhk()
      this.nhk = s
      if (s.ok && s.added) this.articles = await platform.articles.list()
      if (announce)
        ui.toast(
          s.ok ? t('reading.nhk.added', { n: s.added }) : t(`reading.nhk.reasons.${s.reason}`),
          s.ok ? 'info' : 'error',
          6000
        )
    } finally {
      this.refreshing = false
    }
  }

  async open(id: string, from: 'home' | 'course' | null = null): Promise<void> {
    this.backTo = from
    this.openId = id
    this.grammarFocus = null
    this.article = await platform.articles.get(id)
    if (!this.article) return
    const cached = this.#cache.get(id)
    this.analysis = cached ?? null
    if (!cached) {
      const a = await platform.ja.analyze(this.article.body)
      this.#cache.set(id, a)
      while (this.#cache.size > 12) this.#cache.delete(this.#cache.keys().next().value!)
      if (this.openId === id) this.analysis = a
    }
  }

  close(): void {
    this.openId = null
    this.article = null
    this.analysis = null
  }

  /** 阅读器里的「返回」：从首页的新闻点进来的回首页，从故事课点进来的回课程，不然回文章列表 */
  back(): void {
    const to = this.backTo
    this.backTo = null
    this.close()
    if (to === 'home') ui.go('home')
    else if (to === 'course') ui.go('courses')
  }

  async add(input: ArticleInput): Promise<void> {
    const meta = await platform.articles.save(input)
    this.articles = [...this.articles, meta]
    ui.toast(t('reading.imported', { title: meta.title }))
    await this.open(meta.id)
  }

  async remove(id: string): Promise<void> {
    await platform.articles.remove(id)
    this.#cache.delete(id)
    this.articles = this.articles.filter((a) => a.id !== id)
    if (this.openId === id) this.close()
  }

  /** 存自己贴的译文（空的就删掉），存好打开双语对照 */
  async setTranslation(id: string, text: string): Promise<void> {
    await platform.articles.setTranslation(id, text)
    const translation = text.trim()
    this.articles = this.articles.map((a) =>
      a.id === id ? { ...a, translated: !!translation || undefined } : a
    )
    if (this.article?.id === id)
      this.article = { ...this.article, translation, translated: !!translation }
    this.bilingual = !!translation
  }

  async setRead(id: string, read: boolean): Promise<void> {
    await platform.articles.markRead(id, read)
    const readAt = read ? new Date().toISOString() : null
    this.articles = this.articles.map((a) => (a.id === id ? { ...a, readAt } : a))
    if (this.article?.id === id) this.article = { ...this.article, readAt }
  }
}

export const reading = new ReadingState()
