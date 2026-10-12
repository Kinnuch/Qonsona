import type { LangPracticeKind, LangExamDef } from '../types'
import { spec } from './spec'
import { rules } from './rules'
import { shuffled } from '../../course'

const cases = [
  ['genitive', '属格', 'genitive'],
  ['dative', '与格', 'dative'],
  ['accusative', '宾格', 'accusative'],
  ['instrumental', '工具格', 'instrumental'],
  ['prepositional', '前置格', 'prepositional']
]
export const practice: LangPracticeKind[] = [
  {
    id: 'ru-case',
    name: { zh: '名词的格与数', en: 'Noun case and number' },
    section: 'grammar',
    make(db, level, n) {
      const pool = shuffled(
        db.words({ level, pos: ['noun'], limit: 1000, need: ['forms', 'gloss'] }),
        db.rand
      )
      const out: ReturnType<LangPracticeKind['make']> = []
      for (const w of pool) {
        const targets = shuffled(cases, db.rand)
        for (const [tag, zh, en] of targets) {
          const candidates = w.forms.filter((f) => f.includes(tag) && f.includes('singular'))
          // 一个格若有多个合法异体，不以其中一个合法形作干扰项。
          const valid = new Set(candidates.map((f) => rules.key(f[0])))
          const wrong = [
            ...new Map(
              w.forms.filter((f) => !valid.has(rules.key(f[0]))).map((f) => [rules.key(f[0]), f[0]])
            ).values()
          ]
          if (!candidates.length || wrong.length < 3) continue
          const correct = candidates[0][0]
          const choices = shuffled([correct, ...shuffled(wrong, db.rand).slice(0, 3)], db.rand)
          out.push({
            id: `ru-case-${w.id}-${tag}`,
            kind: 'custom',
            custom: 'ru-case',
            section: 'grammar',
            ask: {
              zh: `选择单数${zh}；注意词形中的重音。`,
              en: `Choose the singular ${en}; observe stress in the inflected form.`
            },
            prompt: { text: w.d ?? w.w, lang: 'ru', sub: { zh: w.zh, en: w.en } },
            choices: choices.map((text) => ({ text, lang: 'ru' })),
            answer: choices.indexOf(correct),
            explain: {
              lines: [
                {
                  zh: `${w.w} 的单数${zh}：${correct}。同形异格可能存在，应依句法判断。`,
                  en: `Singular ${en} of ${w.w}: ${correct}. Syncretic forms may represent more than one case.`
                }
              ]
            }
          })
          break
        }
        if (out.length >= n) break
      }
      return out
    }
  }
]
export const exams: LangExamDef[] = spec.levelSystems
  .find((s) => s.primary)!
  .levels.map((l) => ({
    id: `ru-training-${l.id}`,
    level: l.id,
    title: { zh: `ТРКИ ${l.short} 自编训练卷`, en: `TORFL ${l.short} original practice` },
    basis: {
      zh: '面向 ТРКИ 等级的自编短训练，题数、时间和分项与正式考试不同；缺写作和口语，听力使用合成语音。不套用正式考试的66%合格线，不换算认证成绩。参考：https://testingcenter.spbu.ru/',
      en: 'An original short practice paper for TORFL learners, with different item counts, timings and sections. Writing and speaking are absent; listening uses synthetic speech. No official 66% pass threshold or certification score is applied. Reference: https://testingcenter.spbu.ru/'
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
        title: { zh: '格与语法', en: 'Case and grammar' },
        minutes: 10,
        parts: [
          { kind: 'custom:ru-case', n: 3 },
          { kind: 'grammar-fill', n: 4 }
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
