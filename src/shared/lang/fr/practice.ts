import type { LangExamDef, LangPracticeKind } from '../types'
import { shuffled } from '../../course'
import { LEVELS, forms, formLevels } from './course'
export const practice: LangPracticeKind[] = [
  {
    id: 'fr-forms',
    name: { zh: '法语变位与配合', en: 'French conjugation and agreement' },
    section: 'grammar',
    desc: {
      zh: '明确人称、时态和配合对象，区别正确形式与真实的常见错误。',
      en: 'Follow explicit person, tense and agreement requirements; curated common errors.'
    },
    make(db, level, n) {
      return shuffled(
        Object.values(forms)
          .filter((f) => !level || formLevels[f.key] === level)
          .flatMap((f) => f.examples.map((e, i) => ({ f, e, i }))),
        db.rand
      )
        .slice(0, Math.max(0, Math.floor(n)))
        .map(({ f, e, i }) => {
          const choices = shuffled([e.form, ...e.wrong], db.rand)
          return {
            id: `${f.key}-${i}`,
            kind: 'custom' as const,
            custom: 'fr-forms',
            section: 'grammar' as const,
            ask: {
              zh: '根据指定人称、时态或性数配合选择正确形式。',
              en: 'Choose the form for the specified person, tense or agreement.'
            },
            prompt: { text: e.base, lang: 'fr-FR', sub: f.title },
            choices: choices.map((text) => ({ text, lang: 'fr-FR' })),
            answer: choices.indexOf(e.form),
            explain: {
              lines: [f.title, { zh: `${e.base} → ${e.form}`, en: `${e.base} → ${e.form}` }],
              say: { text: e.form, lang: 'fr-FR' }
            }
          }
        })
    }
  }
]
export const exams: LangExamDef[] = LEVELS.map((level) => ({
  id: `fr-cefr-review-${level}`,
  level,
  title: { zh: `法语 ${level} 学习检查`, en: `French ${level} learning review` },
  basis: {
    zh: '自编 CEFR 教学练习；DELF/DALF 官方考试包含完整听读写说任务，本卷只有词汇、语法和句子理解。不冒充 DELF/DALF 官方卷，不换算官方分数。',
    en: 'Original editorial CEFR review. Official DELF/DALF assess listening, reading, writing and speaking; this review covers vocabulary, grammar and sentence comprehension only. No official mock or score conversion.'
  },
  sections: [
    {
      id: 'vocab',
      title: { zh: '词汇', en: 'Vocabulary' },
      minutes: 10,
      parts: [{ kind: 'word-meaning', n: 6 }]
    },
    {
      id: 'grammar',
      title: { zh: '语法与配合', en: 'Grammar and agreement' },
      minutes: 15,
      parts: [
        { kind: 'grammar-fill', n: 6 },
        { kind: 'custom:fr-forms', n: 6 }
      ]
    },
    {
      id: 'reading',
      title: { zh: '句子理解', en: 'Sentence comprehension' },
      minutes: 10,
      parts: [{ kind: 'sentence', n: 6 }]
    }
  ]
}))
export function misspell(word: string): string[] {
  const candidates = [
    word.normalize('NFD').replace(/\p{M}/gu, ''),
    word.replace(/é/g, 'è'),
    word.replace(/è/g, 'é'),
    word.replace(/([lnpt])\1/gi, '$1'),
    word.replace(/e$/, 'es')
  ]
  return [...new Set(candidates)].filter((x) => x && x !== word)
}
