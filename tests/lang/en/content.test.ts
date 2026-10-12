import { describe, expect, it } from 'vitest'
import en from '../../../src/shared/lang/en'
import { findGrammar } from '../../../src/shared/lang/grammar'
import { rng, allLessons, lessonQuiz, poolUpTo } from '../../../src/shared/course'
import type { PracticeDb, LexToken } from '../../../src/shared/lang/types'
import texts from '../../../data/en/texts.json'

describe('English authored learning content', () => {
  it('covers 10 points at each main level and highlights are matched at exact offsets', () => {
    expect(en.grammar).toHaveLength(60)
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
      expect(en.grammar!.filter((g) => g.level === level)).toHaveLength(10)
    for (const g of en.grammar!)
      for (const e of g.examples) {
        expect(e.zh).toBeTruthy()
        expect(e.en).toBeTruthy()
        const tokens = en.rules.tokenize!(e.text)
        const hits = findGrammar(
          [{ start: 0, end: e.text.length, para: 0, tokens }],
          [g],
          en.rules.key
        )
        const start = e.text.indexOf(e.hl!)
        expect(
          hits.some((h) => h.start === start && h.end === start + e.hl!.length),
          `${g.id}: ${e.text}`
        ).toBe(true)
      }
  })
  it('productive perfect requires a participle and allows an intervening adverb', () => {
    const g = en.grammar!.find((g) => g.id === 'en-perfect')!
    const tokens: LexToken[] = [
      { text: 'has', start: 0, end: 3, kind: 'word' },
      { text: 'recently', start: 4, end: 12, kind: 'word' },
      {
        text: 'written',
        start: 13,
        end: 20,
        kind: 'word',
        pos: 'verb',
        tags: ['past', 'participle']
      }
    ]
    expect(findGrammar([{ start: 0, end: 20, para: 0, tokens }], [g], en.rules.key)).toContainEqual(
      { id: g.id, sentence: 0, start: 0, end: 20 }
    )
    tokens[2] = { ...tokens[2], text: 'books', pos: 'noun', tags: ['plural'] }
    expect(findGrammar([{ start: 0, end: 20, para: 0, tokens }], [g], en.rules.key)).toEqual([])
  })
  it('custom forms are deterministic, unique and complete for every level', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      const questions = en.practice![0].make({ rand: rng(7) } as PracticeDb, level, 6)
      expect(questions).toHaveLength(6)
      expect(new Set(questions.map((q) => q.id)).size).toBe(6)
      expect(questions).toEqual(en.practice![0].make({ rand: rng(7) } as PracticeDb, level, 6))
      for (const q of questions) {
        expect(new Set(q.choices.map((c) => c.text)).size).toBe(4)
        expect(q.choices[q.answer]).toBeDefined()
        expect(q.explain.lines.length).toBeGreaterThan(0)
      }
    }
  })
  it('six courses resolve references and every non-story lesson has a quiz', () => {
    for (const c of en.courses!('zh'))
      for (const { lesson } of allLessons(c)) {
        if (c.kind === 'texts') {
          for (const key of lesson.items)
            expect(texts.some((t) => `b-${t.id}` === c.texts![key].articleId)).toBe(true)
        } else
          expect(
            lessonQuiz(c, lesson, poolUpTo(c, lesson.id), { seed: 2, listen: false }).length,
            `${c.id}/${lesson.id}`
          ).toBeGreaterThan(0)
      }
  })
})
