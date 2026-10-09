/**
 * 界面语言。zh.ts 是原文，en.ts 手写；以后加界面语言照 zh.ts 的结构加一个文件即可。
 * 学习包里的多语言文字（语言名等）也按界面语言挑，见 pick()。
 */
import zh from './zh'
import en from './en'
import type { LocalizedText } from '$lib/packs/types'

export const LOCALES = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' }
] as const

export type LocaleCode = (typeof LOCALES)[number]['code']

const dicts: Record<LocaleCode, unknown> = { zh, en }
const HTML_LANG: Record<LocaleCode, string> = { zh: 'zh-CN', en: 'en' }

class I18n {
  locale = $state<LocaleCode>('zh')

  set(code: LocaleCode): void {
    this.locale = code
    document.documentElement.lang = HTML_LANG[code]
  }
}

export const i18n = new I18n()

function lookup(dict: unknown, key: string): string | undefined {
  let v: unknown = dict
  for (const part of key.split('.')) {
    if (!v || typeof v !== 'object') return undefined
    v = (v as Record<string, unknown>)[part]
  }
  return typeof v === 'string' ? v : undefined
}

/** 取一条文案；{名字} 换成 params 里的值。这种语言没有就退回中文，都没有就显示键本身 */
export function t(key: string, params?: Record<string, string | number>): string {
  const s = lookup(dicts[i18n.locale], key) ?? lookup(zh, key) ?? key
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s
}

/** 多语言文字按界面语言挑：先挑界面语言，再挑中文、英文，最后随便挑一个有的 */
export function pick(text: LocalizedText | undefined): string {
  if (!text) return ''
  return text[i18n.locale] || text.zh || text.en || Object.values(text).find(Boolean) || ''
}
