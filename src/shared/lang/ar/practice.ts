import type { LangPracticeKind, LangExamDef } from '../types'
import { spec } from './spec'
import { grammar } from './grammar'
import { shuffled } from '../../course'

export const practice: LangPracticeKind[] = [
  {
    id: 'ar-root',
    name: { zh: '词根辨认', en: 'Root recognition' },
    section: 'vocab',
    make(db, level, n) {
      const pool = db
        .words({ level, limit: 1000, need: ['gloss'] })
        .filter((w) => typeof w.x?.root === 'string')
      const roots = [...new Set(pool.map((w) => String(w.x!.root).replace(/\s+/g, ' ').trim()))]
      if (roots.length < 4) return []
      return shuffled(pool, db.rand)
        .slice(0, n)
        .map((w, i) => {
          const correct = String(w.x!.root).replace(/\s+/g, ' ').trim()
          const choices = shuffled(
            [
              correct,
              ...shuffled(
                roots.filter((r) => r !== correct),
                db.rand
              ).slice(0, 3)
            ],
            db.rand
          )
          return {
            id: `ar-root-${w.id}-${i}`,
            kind: 'custom',
            custom: 'ar-root',
            section: 'vocab',
            ask: {
              zh: '选择该词的词根（不是把冠词或代词当词根）。',
              en: 'Choose the lexical root, excluding articles and pronoun clitics.'
            },
            prompt: { text: w.d ?? w.w, lang: 'ar', sub: { zh: w.zh, en: w.en } },
            choices: choices.map((text) => ({ text, lang: 'ar' })),
            answer: choices.indexOf(correct),
            explain: {
              lines: [
                {
                  zh: `词根：${correct}。词式和元音参与构词，词根相同不代表词义相同。`,
                  en: `Root: ${correct}. Patterns and vowels contribute meaning; a shared root does not imply the same meaning.`
                }
              ]
            }
          }
        })
    }
  },
  {
    id: 'ar-structure',
    name: { zh: '性数配合、格与句法', en: 'Agreement, case and syntax' },
    section: 'grammar',
    make(db, level, n) {
      const points = grammar.filter((g) => !level || g.level === level)
      return shuffled(points, db.rand)
        .slice(0, n)
        .map((g, i) => {
          const ex = g.examples[0]
          const correct = ex.hl!
          const choices = shuffled(
            [
              correct,
              ...shuffled(
                points.filter((x) => x.id !== g.id).map((x) => x.examples[0].hl!),
                db.rand
              ).slice(0, 3)
            ],
            db.rand
          )
          return {
            id: `ar-structure-${g.id}-${i}`,
            kind: 'custom',
            custom: 'ar-structure',
            section: 'grammar',
            ask: {
              zh: '按译文与现代标准语句法选择结构。',
              en: 'Choose the structure matching the translation and Modern Standard Arabic syntax.'
            },
            prompt: {
              text: ex.text,
              lang: 'ar',
              blank: [ex.text.indexOf(correct), ex.text.indexOf(correct) + correct.length],
              sub: { zh: ex.zh!, en: ex.en! }
            },
            choices: choices.map((text) => ({ text, lang: 'ar' })),
            answer: choices.indexOf(correct),
            explain: { lines: [g.meaning] }
          }
        })
    }
  }
]
export const exams: LangExamDef[] = spec.levelSystems
  .find((s) => s.primary)!
  .levels.map((l) => ({
    id: `ar-training-${l.id}`,
    level: l.id,
    title: {
      zh: `现代标准阿语 ${l.id} 自编训练卷`,
      en: `Modern Standard Arabic ${l.id} original practice`
    },
    basis: {
      zh: '按 CEFR 教学等级组织的自编短卷，不是 ALPT、ACTFL 或官方 CEFR 认证考试。未评估写作、口语、方言会话或真实录音听力；不换算官方分数。参考：https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume-and-its-language-versions',
      en: 'An original short paper organized by pedagogical CEFR levels, not an ALPT, ACTFL or official CEFR certification. It does not assess writing, speaking, dialect conversation or recorded listening, and awards no official score.'
    },
    sections: [
      {
        id: 'vocab',
        title: { zh: '词汇', en: 'Vocabulary' },
        minutes: 8,
        parts: [{ kind: 'word-meaning', n: 5 }]
      },
      {
        id: 'grammar',
        title: { zh: '标准语结构', en: 'Standard Arabic structures' },
        minutes: 10,
        parts: [
          { kind: 'custom:ar-structure', n: 3 },
          { kind: 'grammar-fill', n: 3 }
        ]
      },
      {
        id: 'reading',
        title: { zh: '句意练习', en: 'Sentence meaning practice' },
        minutes: 8,
        parts: [{ kind: 'sentence', n: 4 }]
      },
      {
        id: 'listening',
        title: { zh: '合成语音听句', en: 'Synthetic-speech sentence practice' },
        minutes: 8,
        parts: [{ kind: 'listen-sentence', n: 4 }]
      }
    ]
  }))
