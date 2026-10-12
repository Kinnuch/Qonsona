/**
 * 框架里各语言的阅读页状态：文章列表与筛选、打开的文章与分析结果、阅读器的显示方式。
 * 每门语言各记一份筛选与打开的文章，换语言再换回来原样还在；分析结果按文章缓存。
 */
import { platform } from '$lib/platform'
import { t } from '$lib/i18n/index.svelte'
import type {
  LangArticle,
  LangArticleInput,
  LangArticleMeta,
  LangArticleSource,
  LangNewsStatus
} from '$shared/lang/articles'
import type { LexAnalysis } from '$shared/lang/types'
import { ui } from './ui.svelte'

export type LangSourceFilter = 'all' | LangArticleSource
export type LangSideTab = 'vocab' | 'grammar'

/** 每门语言各记一份的 */
interface Memo {
  level: string | null
  source: LangSourceFilter
  topic: string | null
  hideRead: boolean
  openId: string | null
}

const emptyMemo = (): Memo => ({
  level: null,
  source: 'all',
  topic: null,
  hideRead: false,
  openId: null
})

class LangReadingState {
  code = $state<string | null>(null)
  articles = $state.raw<LangArticleMeta[]>([])
  loaded = $state(false)
  loading = $state(false)
  news = $state.raw<LangNewsStatus | null>(null)
  refreshing = $state(false)
  #loads = new Map<string, Promise<void>>()
  #refreshes = new Set<string>()

  #memo = $state<Record<string, Memo>>({})
  /** 当前语言的筛选与打开的文章（ensure() 先建好；$derived 里不能新建状态） */
  memo = $derived<Memo>(this.#memo[this.code ?? ''] ?? emptyMemo())

  /** 从首页的新闻、故事课点进来的：返回时回到那里 */
  backTo = $state<'home' | 'course' | null>(null)
  article = $state.raw<LangArticle | null>(null)
  analysis = $state.raw<LexAnalysis | null>(null)
  #cache = new Map<string, LexAnalysis>()

  // 阅读器的显示（各语言共用）
  ruby = $state(true)
  underline = $state(true)
  bilingual = $state(false)
  fontSize = $state(20)
  side = $state<LangSideTab>('vocab')
  grammarFocus = $state<string | null>(null)
  /** 关掉的记号（俄语重音、阿拉伯语元音符号）：记号 id → true */
  hiddenMarks = $state<Record<string, boolean>>({})

  topics = $derived.by<[string, number][]>(() => {
    const n = new Map<string, number>()
    for (const a of this.articles) if (a.topic) n.set(a.topic, (n.get(a.topic) ?? 0) + 1)
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  })

  shown = $derived(
    this.articles.filter(
      (a) =>
        (this.memo.level === null || a.level === this.memo.level) &&
        (this.memo.source === 'all' || a.source === this.memo.source) &&
        (this.memo.topic === null || a.topic === this.memo.topic) &&
        !(this.memo.hideRead && a.readAt)
    )
  )

  /** 进阅读页、首页时：换了语言就重读列表，顺便取一次新闻（一小时最多一次） */
  async ensure(code: string): Promise<void> {
    if (!this.#memo[code]) this.#memo[code] = emptyMemo()
    if (this.code !== code) {
      this.code = code
      this.loaded = false
      this.article = null
      this.analysis = null
      this.news = null
      this.refreshing = this.#refreshes.has(code)
    }
    if (!this.loaded) await this.load()
    if (this.code !== code) return
    void this.refreshNews(false)
    const id = this.memo.openId
    if (id && this.article?.id !== id) await this.open(id, this.backTo)
  }

  async load(): Promise<void> {
    const code = this.code
    if (!code) return
    const pending = this.#loads.get(code)
    if (pending) return pending
    this.loading = true
    const request = (async () => {
      try {
        const list = await platform.lang.articles.list(code)
        if (this.code === code) {
          this.articles = list
          this.loaded = true
        }
      } finally {
        this.#loads.delete(code)
        if (this.code === code) this.loading = false
      }
    })()
    this.#loads.set(code, request)
    return request
  }

  async refreshNews(force: boolean): Promise<void> {
    const code = this.code
    if (!code || this.#refreshes.has(code)) return
    this.#refreshes.add(code)
    this.refreshing = true
    try {
      const r = await platform.lang.news(code, force)
      if (this.code !== code) return
      if (r && !r.skipped) this.news = r
      if (r?.added) await this.load()
      if (force && r && !r.ok && r.sources.length) ui.toast(t('langReading.newsFailed'), 'error')
    } catch {
      // 取不到就算了，列表里还有内置的与自己导入的
    } finally {
      this.#refreshes.delete(code)
      if (this.code === code) this.refreshing = false
    }
  }

  async open(id: string, backTo: 'home' | 'course' | null = null): Promise<void> {
    const code = this.code
    if (!code) return
    this.memo.openId = id
    this.backTo = backTo
    this.grammarFocus = null
    const a = await platform.lang.articles.get(code, id)
    if (this.code !== code || this.memo.openId !== id) return
    this.article = a
    if (!a) {
      this.memo.openId = null
      return
    }
    const cached = this.#cache.get(`${code}:${id}`)
    this.analysis = cached ?? null
    if (cached) return
    const r = await platform.lang.analyze(code, a.body)
    if (r) {
      this.#cache.set(`${code}:${id}`, r)
      while (this.#cache.size > 12) this.#cache.delete(this.#cache.keys().next().value!)
    }
    if (this.code === code && this.memo.openId === id) this.analysis = r
  }

  back(): void {
    const to = this.backTo
    this.memo.openId = null
    this.article = null
    this.analysis = null
    this.backTo = null
    if (to === 'home') ui.go('home')
    else if (to === 'course') ui.go('courses')
  }

  async setRead(id: string, read: boolean): Promise<void> {
    if (!this.code) return
    await platform.lang.articles.markRead(this.code, id, read)
    const at = read ? new Date().toISOString() : null
    this.articles = this.articles.map((a) => (a.id === id ? { ...a, readAt: at } : a))
    if (this.article?.id === id) this.article = { ...this.article, readAt: at }
  }

  async setTranslation(id: string, text: string): Promise<void> {
    if (!this.code) return
    await platform.lang.articles.setTranslation(this.code, id, text)
    const translated = !!text.trim()
    this.articles = this.articles.map((a) => (a.id === id ? { ...a, translated } : a))
    if (this.article?.id === id)
      this.article = { ...this.article, translation: translated ? text : undefined }
    if (translated) this.bilingual = true
  }

  async save(input: LangArticleInput): Promise<LangArticleMeta | null> {
    if (!this.code) return null
    const meta = await platform.lang.articles.save(this.code, input)
    await this.load()
    return meta
  }

  async remove(id: string): Promise<void> {
    if (!this.code) return
    await platform.lang.articles.remove(this.code, id)
    if (this.memo.openId === id) this.back()
    await this.load()
  }
}

export const langReading = new LangReadingState()
