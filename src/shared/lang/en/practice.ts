import type { LangExamDef, LangPracticeKind } from '../types'
import { shuffled } from '../../course'
import { LEVELS, forms, formLevels } from './course'

export const practice: LangPracticeKind[] = [
  {
    id: 'en-forms',
    name: { zh: '英语词形与助动词构成', en: 'English forms and auxiliaries' },
    section: 'grammar',
    desc: {
      zh: '按人称、时间与语态要求选择正确形式；答案和干扰项人工核对。',
      en: 'Choose the form required by person, time and voice; distractors are curated.'
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
            custom: 'en-forms',
            section: 'grammar' as const,
            ask: { zh: '根据指定的形式要求选择答案。', en: 'Choose the requested form.' },
            prompt: { text: e.base, lang: 'en-US', sub: f.title },
            choices: choices.map((text) => ({ text, lang: 'en-US' })),
            answer: choices.indexOf(e.form),
            explain: {
              lines: [f.title, { zh: `${e.base} → ${e.form}`, en: `${e.base} → ${e.form}` }],
              say: { text: e.form, lang: 'en-US' }
            }
          }
        })
    }
  }
]
export const exams: LangExamDef[] = LEVELS.map((level) => ({
  id: `en-cefr-review-${level}`,
  level,
  title: { zh: `英语 ${level} 学习检查`, en: `English ${level} learning review` },
  basis: {
    zh: '自编 CEFR 教学分级练习，参照欧洲委员会能力描述安排。不是 IELTS、TOEFL 或 Cambridge 官方模拟考；没有写作/口语评分，不预测官方等级或分数。',
    en: 'Original editorial CEFR review informed by Council of Europe descriptors. Not an IELTS, TOEFL or Cambridge mock; no writing or speaking assessment and no official score prediction.'
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
      title: { zh: '语法与构形', en: 'Grammar and forms' },
      minutes: 15,
      parts: [
        { kind: 'grammar-fill', n: 6 },
        { kind: 'custom:en-forms', n: 6 }
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
    word.replace(/ie/g, 'ei'),
    word.replace(/([bcdfgklmnprst])\1/gi, '$1'),
    word.replace(/ies$/, 'ys'),
    word.endsWith('e') ? word.slice(0, -1) : `${word}e`
  ]
  return [...new Set(candidates)].filter((x) => x && x !== word)
}
