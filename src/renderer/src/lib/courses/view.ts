/**
 * 课程界面的小工具：按界面语言挑文字、自造文字的字体、例句的译文、条目的发音。
 */
import { i18n, pick } from '$lib/i18n/index.svelte'
import { packs } from '$lib/state/packs.svelte'
import { ensureScriptFont, fontFamilyCss } from '$qon/script/fonts'
import type { GrammarExample, Sound, Text } from '$shared/course'
import type { Sayable } from '$lib/state/audio.svelte'

export const txt = (x: Text | undefined | null): string =>
  !x ? '' : typeof x === 'string' ? x : pick(x)

/** 自造文字的字体（没有 scriptId 的是普通文字，不用管） */
export function scriptCss(scriptId: string | undefined): string {
  if (!scriptId) return ''
  const lang = packs.project?.languages.find((l) => l.id === packs.active?.source?.languageId)
  const script = lang?.scripts.find((s) => s.id === scriptId)
  if (!script) return ''
  ensureScriptFont(script)
  return fontFamilyCss(script)
}

/** 例句的译文：中文界面先给中文（可能是机器翻译），英文界面给英文 */
export function translation(ex: GrammarExample): { text: string; machine: boolean } {
  if (i18n.locale === 'zh' && ex.zh) return { text: ex.zh, machine: !!ex.zhMachine }
  if (ex.en) return { text: ex.en, machine: false }
  return { text: ex.zh ?? '', machine: !!ex.zhMachine }
}

/** 语法点的意思：界面语言的在前 */
export function meanings(m: Record<string, string>): { main: string; other: string } {
  const main = pick(m)
  const other = Object.values(m).find((v) => v && v !== main) ?? ''
  return { main, other }
}

export const sayable = (s: Sound | null | undefined): Sayable | null =>
  s
    ? {
        ...(s.key && { key: s.key }),
        ...(s.text && { text: s.text, lang: s.lang }),
        ...(s.ipa && { ipa: s.ipa })
      }
    : null
