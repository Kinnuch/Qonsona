import type { LangModule } from '../types'
import { spec } from './spec'
import { rules } from './rules'
import { grammar } from './grammar'
import { news } from './news'
import { courses } from './courses'
import { practice, exams, misspell } from './practice'
const mod: LangModule = {
  spec,
  rules,
  grammar,
  news,
  practice,
  exams,
  misspell,
  courses: (locale) => courses(mod, locale)
}
export default mod
