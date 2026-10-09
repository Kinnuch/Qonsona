/**
 * RSS 2.0 / Atom 的解析（纯函数）：主进程取新闻（src/main/lang/news.ts）用，测试里直接测。
 * 有版权的来源只留导语（正文开头一两句），开放许可的留全文。
 */
import type { NewsSource } from './types'

export interface NewsItem {
  sourceId: string
  title: string
  link: string
  /** 正文：headline 是导语，full 是全文（段落之间空一行） */
  body: string
  excerpt: boolean
  publishedAt: string | null
  topic?: string
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  laquo: '«',
  raquo: '»'
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** HTML 转纯文本：段落、换行成空行，去掉标签与脚本，合并空白 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<(script|style|figure|figcaption|table)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const cdata = (s: string): string => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')

function tag(block: string, names: string[]): string | null {
  for (const n of names) {
    const m = new RegExp(`<${n}\\b[^>]*>([\\s\\S]*?)<\\/${n}>`, 'i').exec(block)
    if (m && m[1].trim()) return cdata(m[1])
  }
  return null
}

function atomLink(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1])
  const pick =
    links.find((a) => /rel=["']alternate["']/.test(a)) ??
    links.find((a) => !/rel=/.test(a)) ??
    links[0]
  return pick ? (/href=["']([^"']+)["']/.exec(pick)?.[1] ?? null) : null
}

/** 导语：正文开头，到两句话或 280 个字为止（只在完整的句子处截断） */
export function leadOf(text: string, max = 280): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const sentences = flat.match(/[^.!?。！？؟]+[.!?。！？؟]+["'”’»)]*\s*/g) ?? []
  let out = ''
  for (const s of sentences) {
    if (out.length + s.length > max || out.split(/[.!?。！？؟]/).length > 3) break
    out += s
  }
  return (out || flat.slice(0, max)).trim()
}

/** 解析一份 RSS 2.0 / Atom */
export function parseFeed(xml: string, source: NewsSource): NewsItem[] {
  const atom = /<feed\b/i.test(xml) && !/<rss\b/i.test(xml)
  const blocks = [
    ...xml.matchAll(atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi)
  ].map((m) => m[0])
  const out: NewsItem[] = []
  for (const b of blocks) {
    const title = htmlToText(tag(b, ['title']) ?? '')
    const link = (atom ? atomLink(b) : (tag(b, ['link']) ?? atomLink(b)))?.trim() ?? ''
    if (!title || !/^https?:\/\//.test(link)) continue
    // Atom 的 content 常是转义过的 HTML（&lt;p&gt;）：先解码再去标签
    const unescape = (s: string | null): string | null =>
      s && /&lt;\/?[a-z]/i.test(s) ? decodeEntities(s) : s
    const full = unescape(tag(b, ['content:encoded', 'content']))
    const summary = unescape(tag(b, ['description', 'summary']))
    const text = htmlToText(full ?? summary ?? '')
    const isFull = source.license === 'full' && !!text
    const body = isFull ? text : leadOf(htmlToText(summary ?? full ?? ''))
    const date = tag(b, ['pubDate', 'published', 'updated', 'dc:date'])
    const parsed = date ? new Date(date.trim()) : null
    out.push({
      sourceId: source.id,
      title,
      link,
      body,
      excerpt: !isFull,
      publishedAt: parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      topic: source.topic ?? (htmlToText(tag(b, ['category']) ?? '') || undefined)
    })
  }
  return out
}
