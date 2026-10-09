/**
 * 阅读的文章：内置的（青空文库）、自己导入的、从 NHK 取来的（NHK Easy 的全文，或者 NHK 新闻公开的标题与导语）。
 * 主进程存取，界面列表、阅读器与首页的新闻栏用。
 */

import type { JaAnalysis } from './ja/reader'

export type ArticleSource = 'aozora' | 'user' | 'nhk'

export interface ArticleMeta {
  id: string
  source: ArticleSource
  title: string
  author?: string
  /** 原文出处（青空文库的图书卡、NHK 的文章页） */
  url?: string
  /** 故事、诗、新闻…… */
  topic?: string
  chars: number
  /** 估计的难度：5 = N5 … 1 = N1；还没算的为 null */
  level: number | null
  addedAt?: string
  /** 新闻发布的时间 */
  publishedAt?: string
  /** 正文只是开头一段（NHK 新闻公开的导语），全文在原文出处 */
  excerpt?: boolean
  /** 列表上显示的开头几十个字（只在列表里有） */
  preview?: string
  /** 自己加了译文（双语对照） */
  translated?: boolean
  /** 读完的时间；没读完为 null */
  readAt: string | null
}

export interface Article extends ArticleMeta {
  body: string
  /** 青空文库文末的底本与输入、校对信息 */
  colophon?: string
  /** 自己贴进来的译文：一段一行，跟原文的段落按顺序对应（双语对照） */
  translation?: string
}

/** 导入一篇文章时填的 */
export interface ArticleInput {
  title: string
  body: string
  author?: string
  url?: string
  /** 主题（自己填的，可空） */
  topic?: string
}

/** 原文、译文按段落对齐：原文第 i 段配译文第 i 段，译文多出来的段落放在最后 */
export function alignParagraphs(
  paras: number,
  translation: string
): { at: string[]; rest: string[] } {
  const lines = translation
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return { at: lines.slice(0, paras), rest: lines.slice(paras) }
}

/** 取 NHK 文章的结果 */
export interface NhkStatus {
  ok: boolean
  /** 取到的是 NHK Easy 的全文，还是 NHK 新闻公开的标题与导语（NHK Easy 要登录时） */
  via?: 'easy' | 'news'
  /** 取不到的原因：off 设置里关了；auth 要登录或同意条款；network 连不上；format 格式认不出 */
  reason?: 'off' | 'auth' | 'network' | 'format'
  /** 这次新加了几篇 */
  added: number
  checkedAt: string
}

/**
 * 按文中词汇的 JLPT 等级估计难度：JLPT 词表里的实词（按出现次数算）有 85% 在哪一级以内。
 * levels 是这些实词的等级（5 = N5 … 1 = N1）；不在词表里的词不算——文学作品里总有两三成，
 * 算进去每篇都成了 N1。
 */
export function estimateLevel(levels: number[]): number | null {
  if (levels.length < 5) return null
  const sorted = [...levels].sort((a, b) => b - a)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.85))]
}

/** 阅读器里算实词、画 JLPT 下划线的词性 */
export const CONTENT_POS = new Set(['名詞', '動詞', '形容詞', '副詞', '連体詞', '形容動詞'])

/** 一篇分析好的文章的难度：JLPT 词表里的实词按出现次数算（软件里与数据脚本共用） */
export function analysisLevel(a: JaAnalysis): number | null {
  const levels = a.sentences.flatMap((s) =>
    s.words.filter((w) => w.word && w.jlpt && CONTENT_POS.has(w.pos)).map((w) => w.jlpt!)
  )
  return estimateLevel(levels)
}

/** 青空文库格式的文字（带 《》 注音、［＃］ 注记）转成纯文本；别的文字原样返回 */
export function cleanAozora(text: string): string {
  if (!/《[^》]+》|［＃/.test(text)) return text
  return text
    .replace(/※［＃[^］]*］/g, '〓')
    .replace(/［＃[^］]*］/g, '')
    .replace(/《[^》]*》/g, '')
    .replace(/｜/g, '')
}
