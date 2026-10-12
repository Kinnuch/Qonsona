import type { LangModule } from '../types'
import { rules } from './rules'
import { spec } from './spec'
import { grammar } from './grammar'
import { news } from './news'
import { courses } from './course'
import { practice, exams, misspell } from './practice'

const fr: LangModule = { spec, rules, grammar, news, courses, practice, exams, misspell }
export default fr
