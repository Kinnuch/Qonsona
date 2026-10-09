/**
 * 千语集语言的读音：优先用项目里存着的 IPA（词条、短语的发音），
 * 没存的按主正字法的规则现转（跟千语集的「自动标音」同一份代码）。
 */
import type { Language, Pronunciation } from '$qon/core/model'
import { spellToIpa } from '$qon/core/pronounce'

/** 存着的发音里第一个有内容的，主正字法的排前面 */
export function storedIpa(lang: Language, prons: Record<string, Pronunciation>): string {
  const primary = lang.orthographies.find((o) => o.isPrimary)?.id
  const first = primary ? prons[primary]?.ipa : ''
  return (first || Object.values(prons).find((p) => p.ipa.trim())?.ipa || '').trim()
}

/** 按主正字法把拼写转成 IPA；这门语言没有正字法时给空串（不拿拼写冒充读音） */
export function spellingIpa(lang: Language, text: string): string {
  const ortho = lang.orthographies.find((o) => o.isPrimary) ?? lang.orthographies[0]
  if (!ortho || !text.trim()) return ''
  return spellToIpa(lang, ortho, text).trim()
}
