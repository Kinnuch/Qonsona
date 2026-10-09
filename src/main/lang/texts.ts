/**
 * 框架里各语言的内置课文（data/<代码>/texts.json，由各语言的数据管线整理：公有领域或开放许可的文章、故事、诗），
 * 构建时打进主进程。
 */
import type { LangCode, LexText } from '../../shared/lang/types'
import en from '../../../data/en/texts.json'
import fr from '../../../data/fr/texts.json'
import ko from '../../../data/ko/texts.json'
import es from '../../../data/es/texts.json'
import ar from '../../../data/ar/texts.json'
import ru from '../../../data/ru/texts.json'
import gd from '../../../data/gd/texts.json'

export const LANG_TEXTS: Record<LangCode, LexText[]> = {
  en: en as LexText[],
  fr: fr as LexText[],
  ko: ko as LexText[],
  es: es as LexText[],
  ar: ar as LexText[],
  ru: ru as LexText[],
  gd: gd as LexText[]
}
