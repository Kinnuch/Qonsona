import type { LangModule } from '../types'
import { keyboard } from './keyboard'
import { labels } from './labels'
import { rules } from './rules'
import { spec } from './spec'
import { grammar } from './grammar'
import { practice, exams } from './practice'
import { courses } from './courses'
import { toJamo } from './hangul'
import { news } from './news'

// 框架的 LangModule 加上 labels、keyboard 之前先这样挂上（对象字面量直接标类型会报多出来的字段）
const mod = {
  spec,
  rules,
  labels,
  keyboard,
  grammar,
  practice,
  exams,
  news,
  hasSymbol: (word: string, symbol: string) => toJamo(word).includes(toJamo(symbol)),
  courses: (locale: string) => courses(mod, locale)
}
const ko: LangModule = mod
export default ko
