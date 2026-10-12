import type { ExamQuestion } from '../../exam'
import { shuffled } from '../../course'
import type { LangExamDef, LangPracticeKind, PracticeDb } from '../types'
import { grammar } from './grammar'

const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
// 按等级选自写语境题；显式保留答案，不从表面词尾猜语气。
export const practice: LangPracticeKind[] = [
  {
    id: 'es-verb-context',
    name: { zh: '变位与系动词语境', en: 'Conjugation and copula in context' },
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
          const start = ex.text.indexOf(ex.hl!)
          return {
            id: `es-context-${g.id}-${i}`,
            kind: 'custom',
            custom: 'es-verb-context',
            section: 'grammar',
            ask: {
              zh: '根据中英译文选出原句缺失部分。',
              en: 'Choose the missing phrase using the translations.'
            },
            prompt: {
              text: ex.text,
              lang: 'es',
              blank: [start, start + ex.hl!.length],
              sub: { zh: ex.zh!, en: ex.en! }
            },
            choices: choices.map((text) => ({ text, lang: 'es' })),
            answer: choices.indexOf(ex.hl!),
            explain: { lines: [g.meaning, { zh: ex.zh!, en: ex.en! }] }
          }
        })
    }
  }
]
export const exams: LangExamDef[] = levels.map((level) => ({
  id: `es-study-${level}`,
  level,
  title: { zh: `西班牙语 ${level} 自测卷`, en: `Spanish ${level} study check` },
  basis: {
    zh: '按CEFR教学编排的自制练习，参考Instituto Cervantes语法目录。不是DELE真题、官方等价考试或完整能力认证；不测口语、写作和真人听力。',
    en: 'Original CEFR-oriented study check informed by Instituto Cervantes grammar inventories. Not a DELE paper or official equivalent; no speaking, writing or recorded listening assessment.'
  },
  sections: [
    {
      id: 'grammar',
      title: { zh: '变位与语境', en: 'Conjugation in context' },
      minutes: 15,
      parts: [{ kind: 'custom:es-verb-context', n: 6 }]
    }
  ]
}))
export function misspell(word: string): string[] {
  const wrong = new Set([
    word.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
    word.replace('ñ', 'n'),
    word.replace('rr', 'r'),
    word.replace('b', 'v'),
    word.replace('v', 'b'),
    word.replace('h', '')
  ])
  wrong.delete(word)
  wrong.delete('')
  return [...wrong]
}
