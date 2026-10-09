/**
 * 文章的存取（主进程）：内置的青空文库文章随程序带着（data/ja/articles.json，民间故事在 folktales.json），
 * 自己导入的和从 NHK 取来的一篇一个文件放在 userData/articles/，读完没有、估计的难度记在 state.json，
 * 自己贴的译文（双语对照）一篇一个文本文件放在 userData/articles/translations/（内置文章也能加）。
 */
import { promises as fs, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import builtinJson from '../../data/ja/articles.json'
import folktalesJson from '../../data/ja/folktales.json'
import type {
  Article,
  ArticleInput,
  ArticleMeta,
  ArticleSource,
  NhkStatus
} from '../shared/articles'

type Stored = Omit<Article, 'level' | 'readAt' | 'preview'>

/** 存一篇时另外记的：主题、发布时间、是不是只有导语 */
export type ArticleExtra = Partial<Pick<Stored, 'topic' | 'publishedAt' | 'excerpt'>>

/** 列表、首页新闻栏上的开头几个字 */
const PREVIEW = 160

interface ReadingState {
  /** 文章 id → 读完的时间 */
  read: Record<string, string>
  /** 文章 id → 估计的难度（算过一次就记下，内置文章不用每次重算） */
  levels: Record<string, number | null>
  nhk?: NhkStatus
}

/**
 * 内置文章：青空文库的几篇短篇，加上故事课的民间故事（主题 folktale）；
 * 难度是先算好的（npm run data:levels），不用现算
 */
const BUILTIN = [
  ...(builtinJson as (Stored & { level?: number | null })[]),
  ...(
    folktalesJson as unknown as { tales: (Omit<Stored, 'source'> & { level?: number })[] }
  ).tales.map((t) => ({ ...t, source: 'aozora' as const, topic: 'folktale' }))
]

/** 先算好的难度；没有就是 undefined */
const preset = (a: Stored): number | null | undefined => (a as { level?: number | null }).level

export class ArticleStore {
  #dir: string
  #estimate: (text: string) => Promise<number | null>
  #state: ReadingState | null = null

  constructor(dir: string, estimate: (text: string) => Promise<number | null>) {
    this.#dir = dir
    this.#estimate = estimate
  }

  get #stateFile(): string {
    return join(this.#dir, 'state.json')
  }

  async #st(): Promise<ReadingState> {
    if (this.#state) return this.#state
    try {
      this.#state = {
        read: {},
        levels: {},
        ...JSON.parse(await fs.readFile(this.#stateFile, 'utf8'))
      }
    } catch {
      this.#state = { read: {}, levels: {} }
    }
    return this.#state!
  }

  async #saveState(): Promise<void> {
    await fs.mkdir(this.#dir, { recursive: true })
    const tmp = this.#stateFile + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(this.#state))
    await fs.rename(tmp, this.#stateFile)
  }

  /** 自己导入的与 NHK 的文章（文件名就是 id） */
  async #stored(): Promise<Stored[]> {
    if (!existsSync(this.#dir)) return []
    const out: Stored[] = []
    for (const f of await fs.readdir(this.#dir)) {
      if (!f.endsWith('.json') || f === 'state.json') continue
      try {
        out.push(JSON.parse(await fs.readFile(join(this.#dir, f), 'utf8')))
      } catch {
        // 写到一半的文件跳过
      }
    }
    return out
  }

  #file(id: string): string {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error(`文章 id 不合法：${id}`)
    return join(this.#dir, `${id}.json`)
  }

  get #trDir(): string {
    return join(this.#dir, 'translations')
  }

  #trFile(id: string): string {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error(`文章 id 不合法：${id}`)
    return join(this.#trDir, `${id}.txt`)
  }

  /** 加了译文的文章 */
  async #translated(): Promise<Set<string>> {
    if (!existsSync(this.#trDir)) return new Set()
    return new Set(
      (await fs.readdir(this.#trDir)).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4))
    )
  }

  /** 存译文；空的就删掉 */
  async setTranslation(id: string, text: string): Promise<void> {
    if (!(await this.hasArticle(id))) throw new Error(`没有这篇文章：${id}`)
    const file = this.#trFile(id)
    const clean = text.replace(/\r\n?/g, '\n').trim()
    if (!clean) {
      await fs.rm(file, { force: true })
      return
    }
    await fs.mkdir(this.#trDir, { recursive: true })
    await fs.writeFile(file + '.tmp', clean)
    await fs.rename(file + '.tmp', file)
  }

  /** 全部文章（不带正文）；没算过难度的这次算出来记下 */
  async list(): Promise<ArticleMeta[]> {
    const st = await this.#st()
    const all = [...BUILTIN, ...(await this.#stored())]
    let changed = false
    for (const a of all)
      if (preset(a) === undefined && !(a.id in st.levels)) {
        st.levels[a.id] = await this.#estimate(a.body)
        changed = true
      }
    if (changed) await this.#saveState()
    const translated = await this.#translated()
    return all.map(({ body, colophon: _c, ...meta }) => ({
      ...meta,
      preview: body.replace(/\s+/g, ' ').slice(0, PREVIEW),
      ...(translated.has(meta.id) && { translated: true }),
      level: preset(meta as Stored) ?? st.levels[meta.id] ?? null,
      readAt: st.read[meta.id] ?? null
    }))
  }

  async get(id: string): Promise<Article | null> {
    const st = await this.#st()
    let a: Stored | undefined = BUILTIN.find((x) => x.id === id)
    if (!a) {
      try {
        a = JSON.parse(await fs.readFile(this.#file(id), 'utf8')) as Stored
      } catch {
        return null
      }
    }
    let translation: string | null = null
    try {
      translation = await fs.readFile(this.#trFile(id), 'utf8')
    } catch {
      translation = null
    }
    return {
      ...a,
      level: preset(a) ?? st.levels[id] ?? null,
      readAt: st.read[id] ?? null,
      ...(translation && { translation, translated: true })
    }
  }

  async save(
    input: ArticleInput,
    source: ArticleSource = 'user',
    id?: string,
    extra: ArticleExtra = {}
  ): Promise<ArticleMeta> {
    const body = input.body.replace(/\r\n?/g, '\n').trim()
    if (!body) throw new Error('正文是空的')
    const a: Stored = {
      id: id ?? `user-${randomUUID().slice(0, 8)}`,
      source,
      // 没填标题：用第一句（最多 30 字）
      title:
        input.title.trim() ||
        (body.split('\n')[0].match(/^[^。！？!?]*[。！？!?]?/)?.[0] ?? '').slice(0, 30),
      ...(input.author && { author: input.author }),
      ...(input.url && { url: input.url }),
      ...(input.topic?.trim() && { topic: input.topic.trim().slice(0, 40) }),
      ...extra,
      chars: body.length,
      addedAt: new Date().toISOString(),
      body
    }
    await fs.mkdir(this.#dir, { recursive: true })
    await fs.writeFile(this.#file(a.id), JSON.stringify(a))
    const st = await this.#st()
    st.levels[a.id] = await this.#estimate(body)
    await this.#saveState()
    const { body: _b, ...meta } = a
    return { ...meta, level: st.levels[a.id], readAt: null }
  }

  async remove(id: string): Promise<void> {
    if (BUILTIN.some((x) => x.id === id)) throw new Error('内置文章不能删除')
    await fs.rm(this.#file(id), { force: true })
    await fs.rm(this.#trFile(id), { force: true })
    const st = await this.#st()
    delete st.read[id]
    delete st.levels[id]
    await this.#saveState()
  }

  async markRead(id: string, read: boolean): Promise<void> {
    const st = await this.#st()
    if (read) st.read[id] = new Date().toISOString()
    else delete st.read[id]
    await this.#saveState()
  }

  async hasArticle(id: string): Promise<boolean> {
    return BUILTIN.some((x) => x.id === id) || existsSync(this.#file(id))
  }

  /**
   * NHK 新闻只留最近的 keep 篇：更早的删掉（读完的留着）。返回删了几篇
   */
  async pruneNews(keep: number): Promise<number> {
    const st = await this.#st()
    const news = (await this.#stored())
      .filter((a) => a.id.startsWith(NEWS_PREFIX))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    let removed = 0
    for (const a of news.slice(keep)) {
      if (st.read[a.id]) continue
      await fs.rm(this.#file(a.id), { force: true })
      delete st.levels[a.id]
      removed++
    }
    if (removed) await this.#saveState()
    return removed
  }

  async nhkStatus(): Promise<NhkStatus | null> {
    return (await this.#st()).nhk ?? null
  }

  async setNhkStatus(s: NhkStatus): Promise<void> {
    ;(await this.#st()).nhk = s
    await this.#saveState()
  }
}

// ── NHK：先试 NHK News Web Easy（全文），要登录时改取 NHK 新闻公开的标题与导语 ──

const NHK_LIST = 'https://www3.nhk.or.jp/news/easy/news-list.json'
const NHK_PAGE = (id: string): string => `https://www3.nhk.or.jp/news/easy/${id}/${id}.html`
/** 一次最多取这么多篇新的 */
const NHK_MAX = 10

/** NHK 新闻的 RSS：0 主要、1 社会、2 暮らし、3 科学・文化、4 政治、5 経済、6 国際、7 スポーツ */
const NEWS_FEEDS = [0, 1, 2, 3, 4, 5, 6, 7].map(
  (n) => `https://news.web.nhk/n-data/conf/na/rss/cat${n}.xml`
)
/** NHK 新闻的文章 id 开头（nhk-nd20261008de56275） */
export const NEWS_PREFIX = 'nhk-nd'
/** 每次只看最新的这么多条（存下其中还没有的）；一共留这么多条 */
const NEWS_POOL = 30
const NEWS_KEEP = 80
/** 只有视频、没有文字的（【動画】Pickup NEWS 这类）不收 */
const VIDEO_ONLY = /^【動画】/

interface NhkItem {
  news_id: string
  title: string
}

/**
 * 取 NHK 的文章。先试 NHK Easy：2025 年起它并进了 NHK ONE，文章列表要登录后发的令牌（没有令牌返回 401），
 * 学习软件不绕过这一关；这时改取 NHK 新闻公开的 RSS——标题和导语（正文前一两句），全文要登录，放「原文」链接。
 */
export async function refreshNhk(store: ArticleStore): Promise<NhkStatus> {
  const easy = await refreshNhkEasy(store)
  if (easy.ok || easy.reason === 'network') return easy
  return refreshNhkNews(store)
}

async function refreshNhkEasy(store: ArticleStore): Promise<NhkStatus> {
  const checkedAt = new Date().toISOString()
  const fail = (reason: NhkStatus['reason']): NhkStatus => ({
    ok: false,
    reason,
    added: 0,
    checkedAt
  })
  let items: NhkItem[]
  try {
    const res = await fetch(NHK_LIST, { signal: AbortSignal.timeout(10_000) })
    if (res.status === 401 || res.status === 403) return fail('auth')
    if (!res.ok) return fail('network')
    // 老格式：[{ "2024-01-01": [{ news_id, title, … }] }]
    const json = (await res.json()) as unknown
    items = Array.isArray(json)
      ? json.flatMap((day) => Object.values(day as Record<string, NhkItem[]>).flat())
      : []
    if (!items.length || !items.every((x) => x && typeof x.news_id === 'string'))
      return fail('format')
  } catch {
    return fail('network')
  }
  let added = 0
  for (const item of items.slice(0, NHK_MAX)) {
    const id = `nhk-${item.news_id.replace(/[^A-Za-z0-9]/g, '')}`
    if (await store.hasArticle(id)) continue
    try {
      const html = await (
        await fetch(NHK_PAGE(item.news_id), { signal: AbortSignal.timeout(10_000) })
      ).text()
      const body = nhkBody(html)
      if (!body) continue
      await store.save({ title: item.title, body, url: NHK_PAGE(item.news_id) }, 'nhk', id)
      added++
    } catch {
      // 一篇取不到就跳过
    }
  }
  return { ok: true, via: 'easy', added, checkedAt }
}

async function refreshNhkNews(store: ArticleStore): Promise<NhkStatus> {
  const checkedAt = new Date().toISOString()
  const feeds = await Promise.all(
    NEWS_FEEDS.map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
        return res.ok ? parseNhkRss(await res.text()) : null
      } catch {
        return null
      }
    })
  )
  const got = feeds.filter((f): f is NonNullable<typeof f> => !!f)
  if (!got.length) return { ok: false, reason: 'network', added: 0, checkedAt }
  // 同一条在「主要」和分类里都有：主题用分类的
  const byLink = new Map<string, NewsItem & { topic: string }>()
  for (const f of got)
    for (const it of f.items) {
      const hit = byLink.get(it.link)
      if (!hit || (hit.topic === MAIN_TOPIC && f.topic !== MAIN_TOPIC))
        byLink.set(it.link, { ...it, topic: f.topic })
    }
  const items = [...byLink.values()]
    .filter((it) => !VIDEO_ONLY.test(it.title))
    .sort((a, b) => b.published.localeCompare(a.published))
  if (!items.length) return { ok: false, reason: 'format', added: 0, checkedAt }
  let added = 0
  for (const it of items.slice(0, NEWS_POOL)) {
    const id = newsId(it.link)
    const body = leadText(it.description)
    if (!id || !body || (await store.hasArticle(id))) continue
    try {
      await store.save({ title: it.title, body, url: it.link }, 'nhk', id, {
        topic: it.topic,
        publishedAt: it.published,
        excerpt: true
      })
      added++
    } catch {
      // 一条存不下就跳过
    }
  }
  await store.pruneNews(NEWS_KEEP)
  return { ok: true, via: 'news', added, checkedAt }
}

/** RSS 里的一条新闻 */
export interface NewsItem {
  title: string
  link: string
  description: string
  /** ISO 时间 */
  published: string
}

/** 「主要ニュース」那个源没有分类名 */
const MAIN_TOPIC = '主要'

const decode = (s: string): string =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .trim()

/** NHK 新闻的 RSS：频道的分类名（「NHKONEニュース|社会」的后半），与每一条的标题、链接、导语、时间 */
export function parseNhkRss(xml: string): { topic: string; items: NewsItem[] } {
  const tag = (block: string, name: string): string =>
    decode(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)?.[1] ?? '')
  const channel = xml.split('<item>')[0]
  const topic = tag(channel, 'title').split(/[|｜]/)[1]?.trim() || MAIN_TOPIC
  const items: NewsItem[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const date = new Date(tag(m[1], 'pubDate'))
    const item = {
      title: tag(m[1], 'title'),
      link: tag(m[1], 'link'),
      description: tag(m[1], 'description'),
      published: Number.isNaN(date.getTime()) ? '' : date.toISOString()
    }
    if (item.title && item.link) items.push(item)
  }
  return { topic, items }
}

/** 文章链接里的编号做 id：…/newsweb/na/nd-20261008de56275 → nhk-nd20261008de56275 */
export function newsId(link: string): string | null {
  const m = /\/(nd-[A-Za-z0-9]+)\/?$/.exec(link)
  return m ? `${NEWS_PREFIX}${m[1].slice(3)}` : null
}

/** 导语：去掉【NHK】，按段落换行；RSS 截断的（以「…」结尾）只留到最后一个完整的句子 */
export function leadText(description: string): string {
  let text = description
    .replace(/^【NHK】/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
  if (/(…|\.\.\.)$/.test(text)) {
    const cut = Math.max(text.lastIndexOf('。'), text.lastIndexOf('！'), text.lastIndexOf('？'))
    if (cut > 0) text = text.slice(0, cut + 1)
  }
  return text.trim()
}

/** 文章页里正文那一块：去掉振假名（<rt>）和标签，段落换行 */
export function nhkBody(html: string): string {
  const m = /<div[^>]*id="js-article-body"[^>]*>([\s\S]*?)<\/div>/.exec(html)
  if (!m) return ''
  return m[1]
    .replace(/<rt>[\s\S]*?<\/rt>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}
