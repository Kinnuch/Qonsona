import type { LangModule } from '../types'
import { rules } from './rules'
import { spec } from './spec'
import { grammar } from './grammar'
import { NEWS } from './news'
import { courses } from './course'
import { practice, exams, misspell } from './practice'

const en: LangModule = { spec, rules, grammar, news: NEWS, courses, practice, exams, misspell }
export default en
