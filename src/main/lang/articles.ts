/**
 * 框架里各语言的文章（主进程）：内置课文（data/<代码>/texts.json，公有领域或开放许可）、
 * 自己贴进来的文章、新闻（RSS 的标题与导语，开放许可的收全文）。每门语言各存一份：
 *   userData/articles/<代码>/user/<id>.json   自己导入的
 *   userData/articles/<代码>/news.json        新闻（最多留 120 篇，读过的优先留）
 *   userData/articles/<代码>/state.json       读完的时间、算好的难度
 *   userData/articles/<代码>/translations/<id>.txt  自己贴的译文（双语对照）
 */
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { LangCode, LexText, NewsSource } from '../../shared/lang/types'
import type {
  LangArticle,
  LangArticleInput,
  LangArticleMeta,
  LangNewsStatus
} from '../../shared/lang/articles'
import { fetchSource, type NewsItem } from './news'

/** 新闻多久取一次 */
const NEWS_EVERY = 3600 * 1000
/** 新闻最多留几篇 */
const NEWS_MAX = 120

interface StoredNews extends LangArticle {
  sourceId: string
}

interface State {
  read: Record<string, string>
  levels: Record<string, string | null>
}

export class LangArticleStore {
  #state: State | null = null
  #stateWrite: Promise<void> = Promise.resolve()
  #news: { checkedAt: string | null; items: StoredNews[] } | null = null

  constructor(
    readonly code: LangCode,
    readonly dir: string,
    readonly builtin: LexText[],
    readonly sources: NewsSource[],
    /** 估难度（主分级的等级）；分析不了时 null */
    readonly levelOf: (text: string) => string | null | Promise<string | null>
  ) {}

  async #loadState(): Promise<State> {
    if (this.#state) return this.#state
    try {
      // A later initial read must not replace the first object after a caller mutated it.
      const state = JSON.parse(await fs.readFile(join(this.dir, 'state.json'), 'utf8')) as State
      this.#state ??= state
    } catch {
      this.#state ??= { read: {}, levels: {} }
    }
    return this.#state!
  }

  #saveState(): Promise<void> {
    const content = JSON.stringify(this.#state)
    const file = join(this.dir, 'state.json')
    // Serialize just the short disk commit, never the analysis preceding it. User writes
    // still return this promise to the external shutdown/export mutation barrier.
    const write = this.#stateWrite
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(this.dir, { recursive: true })
        await fs.writeFile(file + '.tmp', content, 'utf8')
        await fs.rename(file + '.tmp', file)
      })
    this.#stateWrite = write
    return write
  }

  async #loadNews(): Promise<{ checkedAt: string | null; items: StoredNews[] }> {
    if (this.#news) return this.#news
    try {
      this.#news = JSON.parse(await fs.readFile(join(this.dir, 'news.json'), 'utf8'))
    } catch {
      this.#news = { checkedAt: null, items: [] }
    }
    return this.#news!
  }

  async #user(): Promise<LangArticle[]> {
    const d = join(this.dir, 'user')
    if (!existsSync(d)) return []
    const out: LangArticle[] = []
    for (const f of await fs.readdir(d)) {
      if (!f.endsWith('.json')) continue
      try {
        out.push(JSON.parse(await fs.readFile(join(d, f), 'utf8')))
      } catch {
        // 坏文件跳过
      }
    }
    return out
  }

  #builtinArticle(t: LexText): LangArticle {
    return {
      id: `b-${t.id}`,
      code: this.code,
      source: 'builtin',
      title: t.title,
      author: t.author,
      url: t.url,
      topic: t.topic,
      origin: t.source,
      license: t.license,
      chars: t.text.length,
      level: t.level ?? null,
      readAt: null,
      body: t.text
    }
  }

  #translationFile(id: string): string {
    return join(this.dir, 'translations', id.replace(/[^\w-]/g, '_') + '.txt')
  }

  async #all(): Promise<LangArticle[]> {
    const news = await this.#loadNews()
    return [
      ...news.items,
      ...(await this.#user()),
      ...this.builtin.map((t) => this.#builtinArticle(t))
    ]
  }

  /** 列表：新闻在前（新的在前），再是自己导入的，最后是内置的 */
  async list(): Promise<LangArticleMeta[]> {
    const state = await this.#loadState()
    let changed = false
    const out: LangArticleMeta[] = []
    for (const a of await this.#all()) {
      let level = a.level
      if (level === null && a.source !== 'builtin') {
        if (!(a.id in state.levels)) {
          state.levels[a.id] = await this.levelOf(a.body)
          changed = true
        }
        level = state.levels[a.id]
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { body, translation, ...meta } = a as LangArticle & { sourceId?: string }
      out.push({
        ...meta,
        level,
        readAt: state.read[a.id] ?? null,
        preview: body.replace(/\s+/g, ' ').slice(0, 80),
        translated: existsSync(this.#translationFile(a.id))
      })
    }
    if (changed) await this.#saveState()
    const rank = { news: 0, user: 1, builtin: 2 } as const
    return out.sort(
      (a, b) =>
        rank[a.source] - rank[b.source] ||
        (b.publishedAt ?? b.addedAt ?? '').localeCompare(a.publishedAt ?? a.addedAt ?? '')
    )
  }

  async get(id: string): Promise<LangArticle | null> {
    const a = (await this.#all()).find((x) => x.id === id)
    if (!a) return null
    const state = await this.#loadState()
    let translation: string | undefined
    try {
      translation = await fs.readFile(this.#translationFile(id), 'utf8')
    } catch {
      // 没有译文
    }
    return {
      ...a,
      level: a.level ?? state.levels[id] ?? null,
      readAt: state.read[id] ?? null,
      translation
    }
  }

  async save(input: LangArticleInput): Promise<LangArticleMeta> {
    const id = `u-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
    const body = input.body.replace(/\r\n?/g, '\n').trim()
    const a: LangArticle = {
      id,
      code: this.code,
      source: 'user',
      title: input.title.trim() || body.slice(0, 30),
      author: input.author,
      url: input.url,
      topic: input.topic?.trim() || undefined,
      chars: body.length,
      // Commit the original text before optional lexical work. list() profiles null levels
      // on demand, so an analysis-worker backlog cannot put imported prose at risk.
      level: null,
      addedAt: new Date().toISOString(),
      readAt: null,
      body
    }
    await fs.mkdir(join(this.dir, 'user'), { recursive: true })
    const file = join(this.dir, 'user', `${id}.json`)
    await fs.writeFile(file + '.tmp', JSON.stringify(a), 'utf8')
    await fs.rename(file + '.tmp', file)
    const { body: _body, ...meta } = a
    void _body
    return meta
  }

  async remove(id: string): Promise<void> {
    if (!id.startsWith('u-')) return
    await fs.rm(join(this.dir, 'user', `${id.replace(/[^\w-]/g, '')}.json`), { force: true })
    await fs.rm(this.#translationFile(id), { force: true })
  }

  async markRead(id: string, read: boolean): Promise<void> {
    const state = await this.#loadState()
    if (read) state.read[id] = new Date().toISOString()
    else delete state.read[id]
    await this.#saveState()
  }

  async setTranslation(id: string, text: string): Promise<void> {
    const f = this.#translationFile(id)
    if (!text.trim()) return void (await fs.rm(f, { force: true }))
    await fs.mkdir(join(this.dir, 'translations'), { recursive: true })
    await fs.writeFile(f, text, 'utf8')
  }

  /** 取新闻：一小时最多一次（force 除外）；每个来源各报结果 */
  async refreshNews(force = false): Promise<LangNewsStatus> {
    const news = await this.#loadNews()
    const now = new Date()
    if (!force && news.checkedAt && now.getTime() - new Date(news.checkedAt).getTime() < NEWS_EVERY)
      return { ok: true, added: 0, checkedAt: news.checkedAt, sources: [], skipped: true }
    const results = await Promise.all(
      this.sources.map(async (s) => {
        try {
          return { s, items: await fetchSource(s), error: null as string | null }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { s, items: [] as NewsItem[], error: msg.includes('abort') ? 'timeout' : msg }
        }
      })
    )
    const state = await this.#loadState()
    const known = new Set(news.items.map((a) => a.url))
    let added = 0
    for (const { s, items } of results)
      for (const it of items) {
        if (known.has(it.link)) continue
        known.add(it.link)
        const id = `n-${s.id}-${createHash('sha1').update(it.link).digest('hex').slice(0, 10)}`
        news.items.push({
          id,
          code: this.code,
          source: 'news',
          sourceId: s.id,
          title: it.title,
          url: it.link,
          topic: it.topic,
          origin: s.name,
          license: s.licenseName,
          chars: it.body.length,
          // Bound the retained news first; discarded feed items never need analysis.
          level: s.level ?? null,
          publishedAt: it.publishedAt ?? now.toISOString(),
          addedAt: now.toISOString(),
          excerpt: it.excerpt,
          readAt: null,
          body: it.body
        })
        added++
      }
    // 留最新的；读过的先留
    news.items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    if (news.items.length > NEWS_MAX) {
      const read = news.items.filter((a) => state.read[a.id])
      const unread = news.items.filter((a) => !state.read[a.id])
      news.items = [...read, ...unread]
        .slice(0, NEWS_MAX)
        .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    }
    for (const article of news.items) {
      if (article.level === null) article.level = await this.levelOf(article.body)
    }
    news.checkedAt = now.toISOString()
    await fs.mkdir(this.dir, { recursive: true })
    await fs.writeFile(join(this.dir, 'news.json'), JSON.stringify(news), 'utf8')
    return {
      ok: results.some((r) => !r.error),
      added,
      checkedAt: news.checkedAt,
      sources: results.map((r) => ({
        id: r.s.id,
        name: r.s.name,
        ok: !r.error,
        count: r.items.length,
        error: r.error ?? undefined
      }))
    }
  }

  async newsStatus(): Promise<{ checkedAt: string | null; count: number }> {
    const news = await this.#loadNews()
    return { checkedAt: news.checkedAt, count: news.items.length }
  }
}
