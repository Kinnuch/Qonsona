import type { LangPracticeKind, LangExamDef } from '../types'
import { grammar } from './grammar'
import { spec } from './spec'
import { finalOf } from './hangul'
import { shuffled } from '../../course'

export const practice: LangPracticeKind[] = [
  {
    id: 'ko-particles',
    name: { zh: '助词与收音', en: 'Particles and final consonants' },
    section: 'grammar',
    make(db, level, n) {
      const words = shuffled(
        db.words({ level, pos: ['noun'], limit: 250, need: ['gloss'] }),
        db.rand
      )
      return words.slice(0, n).map((w, i) => {
        const final = Boolean(finalOf(w.w))
        const roles = [
          ['话题', 'topic', '은', '는'],
          ['主语', 'subject', '이', '가'],
          ['宾语', 'object', '을', '를']
        ]
        const [zh, en, c, v] = roles[i % 3]
        const answer = final ? c : v
        const choices = shuffled(
          [...new Set([answer, ...roles.flatMap((r) => r.slice(2))])].slice(0, 4),
          db.rand
        )
        return {
          id: `ko-particle-${w.id}-${i}`,
          kind: 'custom',
          custom: 'ko-particles',
          section: 'grammar',
          ask: {
            zh: `为「${w.w}」选择${zh}助词（按收音判别）。`,
            en: `Choose the ${en} particle after ${w.w}, using its final consonant.`
          },
          prompt: { text: w.w, lang: 'ko', sub: { zh: w.zh, en: w.en } },
          choices: choices.map((text) => ({ text })),
          answer: choices.indexOf(answer),
          explain: {
            lines: [
              {
                zh: final ? '有收音，使用辅音后的形式。' : '无收音，使用元音后的形式。',
                en: final
                  ? 'A final consonant requires the consonant-conditioned form.'
                  : 'A vowel requires the vowel-conditioned form.'
              }
            ]
          }
        }
      })
    }
  },
  {
    id: 'ko-register',
    name: { zh: '词尾、语气与连接', en: 'Endings, register and clause links' },
    section: 'grammar',
    make(db, level, n) {
      const points = grammar.filter((g) => !level || g.level === level)
      return shuffled(points, db.rand)
        .slice(0, n)
        .map((g, i) => {
          const ex = g.examples[0]
          const correct = ex.hl!
          const alternatives = points
            .filter((x) => x.id !== g.id && (!g.group || x.group !== g.group))
            .map((x) => x.examples[0].hl!)
            .filter((x) => x !== correct)
          const choices = shuffled(
            [correct, ...shuffled([...new Set(alternatives)], db.rand).slice(0, 3)],
            db.rand
          )
          return {
            id: `ko-register-${g.id}-${i}`,
            kind: 'custom',
            custom: 'ko-register',
            section: 'grammar',
            ask: {
              zh: '根据译文选择符合语气与接续的词尾或结构。',
              en: 'Choose the ending or construction that matches the translation and register.'
            },
            prompt: {
              text: ex.text,
              blank: [ex.text.indexOf(correct), ex.text.indexOf(correct) + correct.length],
              lang: 'ko',
              sub: { zh: ex.zh!, en: ex.en! }
            },
            choices: choices.map((text) => ({ text })),
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
    id: `ko-training-${l.id}`,
    level: l.id,
    title: {
      zh: `TOPIK ${l.id} 级学习训练卷（自编）`,
      en: `TOPIK ${l.id} study practice (original)`
    },
    basis: {
      zh: '参考 NIIED TOPIK 能力层次的短训练卷。TOPIK I/II 真考合并判级；本卷按级练习，题数、计时、题型均不同，缺写作和口语，不换算官方分数。https://www.niied.go.kr/web/NIIED/contents/niiedEng/eng_topikOverview',
      en: 'A short original study paper informed by NIIED TOPIK proficiency bands. Real TOPIK I/II assign bands from combined tests; this paper has different items, timing and tasks, omits writing and speaking, and does not award official scores.'
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
        title: { zh: '助词与接续', en: 'Particles and endings' },
        minutes: 10,
        parts: [
          { kind: 'custom:ko-particles', n: 3 },
          { kind: 'custom:ko-register', n: 3 }
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
