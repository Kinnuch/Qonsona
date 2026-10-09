/**
 * 框架里的语言都在这里登记（日语另有一套，不在这里）。
 * 每门语言的东西都在 src/shared/lang/<代码>/ 下，这个文件只引用它们。
 */
import { LANG_CODES, type LangCode, type LangModule } from './types'
import en from './en'
import fr from './fr'
import ko from './ko'
import es from './es'
import ar from './ar'
import ru from './ru'
import gd from './gd'

export const LANGS: Record<LangCode, LangModule> = { en, fr, ko, es, ar, ru, gd }

export function isLangCode(code: string): code is LangCode {
  return (LANG_CODES as string[]).includes(code)
}

/** 按代码取一门语言；不是框架里的语言（日语、千语集的包）给 null */
export function langModule(code: string): LangModule | null {
  return isLangCode(code) ? LANGS[code] : null
}
