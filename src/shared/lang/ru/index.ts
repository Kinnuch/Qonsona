import type { LangModule } from '../types'
import { rules } from './rules'
import { spec } from './spec'
import { grammar } from './grammar'
import { practice, exams } from './practice'
import { courses } from './courses'
import { news } from './news'

const ru: LangModule = {
  spec,
  rules,
  grammar,
  practice,
  exams,
  news,
  courses: (locale: string) => courses(ru, locale)
}
export default ru
