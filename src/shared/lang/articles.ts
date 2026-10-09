/**
 * 框架里各语言的阅读文章：内置课文、自己导入的、新闻。主进程存取（src/main/lang/articles.ts），
 * 界面的文章库、阅读器、首页的新闻用。跟日语的 ArticleMeta 一个意思，等级是主分级的等级 id（字符串）。
 */
import type { LangCode } from './types'

export type LangArticleSource = 'builtin' | 'user' | 'news'

export interface LangArticleMeta {
  id: string
  code: LangCode
  source: LangArticleSource
  title: string
  author?: string
  /** 原文地址（新闻、维基文库页面） */
  url?: string
  /** 主题：story、fable、poem、新闻的分类、自己填的…… */
  topic?: string
  /** 出自哪里：新闻源的名字、课文的出处 */
  origin?: string
  /** 许可：公有领域、CC BY 2.5、版权所有（只收标题导语）…… */
  license?: string
  chars: number
  /** 估计的难度（主分级的等级 id）；算不出来是 null */
  level: string | null
  addedAt?: string
  publishedAt?: string
  /** 正文只是导语，全文在原文出处 */
  excerpt?: boolean
  /** 列表上的开头几十个字（只在列表里有） */
  preview?: string
  /** 自己加了译文 */
  translated?: boolean
  readAt: string | null
}

export interface LangArticle extends LangArticleMeta {
  body: string
  /** 自己贴的译文：一段一行，跟原文的段落按顺序对应 */
  translation?: string
}

export interface LangArticleInput {
  title: string
  body: string
  author?: string
  url?: string
  topic?: string
}

/** 取一次新闻的结果：每个来源各报取到几篇、出了什么错（timeout、auth、format、http 404……） */
export interface LangNewsStatus {
  ok: boolean
  added: number
  checkedAt: string
  /** 一小时内已经取过，这次没取 */
  skipped?: boolean
  sources: { id: string; name: string; ok: boolean; count: number; error?: string }[]
}
