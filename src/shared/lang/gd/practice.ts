import type { ExamQuestion } from '../../exam'
import { shuffled } from '../../course'
import type { LangExamDef, LangPracticeKind, PracticeDb } from '../types'
import { grammar } from './grammar'
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
export const practice: LangPracticeKind[] = [
  {
    id: 'gd-structure',
    name: { zh: '弱化、动词式与介词代词', en: 'Mutation, verb forms and prepositional pronouns' },
    section: 'grammar',
    make(db: PracticeDb, level: string | null, n: number): ExamQuestion[] {
      const pool = grammar
        .filter((g) => !level || levels.indexOf(g.level) <= levels.indexOf(level))
        .flatMap((g) => g.examples.map((ex, i) => ({ g, ex, i })))
      return shuffled(pool, db.rand)
        .slice(0, n)
        .map(({ g, ex, i }) => {
          const distractors = [
            ...new Set(
              grammar.filter((p) => p.id !== g.id).flatMap((p) => p.examples.map((e) => e.hl!))
            )
          ].filter((s) => s !== ex.hl)
          const choices = shuffled([ex.hl!, ...shuffled(distractors, db.rand).slice(0, 3)], db.rand)
          const at = ex.text.indexOf(ex.hl!)
          return {
            id: `gd-structure-${g.id}-${i}`,
            kind: 'custom',
            custom: 'gd-structure',
            section: 'grammar',
            ask: {
              zh: '按译文选择正确结构。',
              en: 'Choose the structure matching the translation.'
            },
            prompt: {
              text: ex.text,
              lang: 'gd',
              blank: [at, at + ex.hl!.length],
              sub: { zh: ex.zh!, en: ex.en! }
            },
            choices: choices.map((text) => ({ text, lang: 'gd' })),
            answer: choices.indexOf(ex.hl!),
            explain: { lines: [g.meaning, { zh: ex.zh!, en: ex.en! }] }
          }
        })
    }
  }
]
export const exams: LangExamDef[] = levels.map((level) => ({
  id: `gd-study-${level}`,
  level,
  title: { zh: `盖尔语 ${level} 自测卷`, en: `Gaelic ${level} study check` },
  basis: {
    zh: '参考LearnGaelic的CLAG描述进行教学编排。此自制练习卷不是SQA或Qualifications Scotland试卷，无官方CEFR等价；不测口语、写作或录音听力。',
    en: 'Original teaching check informed by LearnGaelic CLAG descriptions. Not an SQA/Qualifications Scotland paper or official CEFR equivalent; no speaking, writing or recorded listening assessment.'
  },
  sections: [
    {
      id: 'grammar',
      title: { zh: '结构与语境', en: 'Structure in context' },
      minutes: 15,
      parts: [{ kind: 'custom:gd-structure', n: 6 }]
    }
  ]
}))
export function misspell(word: string): string[] {
  const wrong = new Set([
    word.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
    word.replace(/([bcdgmpst])h/, '$1'),
    word.replace('à', 'á'),
    word.replace('ò', 'ó')
  ])
  wrong.delete(word)
  wrong.delete('')
  return [...wrong]
}
