import type { LangModule } from '../types'
import { AR_KEYBOARD } from './keyboard'
import { AR_LABELS } from './labels'
import { AR_NEWS } from './news'
import { rules } from './rules'
import { spec } from './spec'
import { grammar } from './grammar'
import { practice, exams } from './practice'
import { courses } from './courses'

const ar: LangModule = {
  spec,
  rules,
  grammar,
  practice,
  exams,
  courses: (locale: string) => courses(ar, locale),
  news: AR_NEWS,
  labels: AR_LABELS,
  keyboard: AR_KEYBOARD
}
export default ar
