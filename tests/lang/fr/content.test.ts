import { describe, expect, it } from 'vitest'
import fr from '../../../src/shared/lang/fr'
import { findGrammar } from '../../../src/shared/lang/grammar'
import { rng, allLessons, lessonQuiz, poolUpTo } from '../../../src/shared/course'
import type { PracticeDb, LexToken } from '../../../src/shared/lang/types'
import texts from '../../../data/fr/texts.json'
describe('French authored learning content', () => {
  it('covers ten points at each main level and matches all highlighted spans', () => {
    expect(fr.grammar).toHaveLength(60)
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
      expect(fr.grammar!.filter((g) => g.level === level)).toHaveLength(10)
    for (const g of fr.grammar!)
      for (const e of g.examples) {
        expect(e.zh).toBeTruthy()
        expect(e.en).toBeTruthy()
        const hits = findGrammar(
          [{ start: 0, end: e.text.length, para: 0, tokens: fr.rules.tokenize!(e.text) }],
          [g],
          fr.rules.key
        )
        const start = e.text.indexOf(e.hl!)
        expect(
          hits.some((h) => h.start === start && h.end === start + e.hl!.length),
          `${g.id}: ${e.text}`
        ).toBe(true)
      }
  })
  it('productive passé composé needs a verbal participle, not a neighbouring noun', () => {
    const g = fr.grammar!.find((g) => g.id === 'fr-passe')!
    const tokens: LexToken[] = [
      { text: 'a', start: 0, end: 1, kind: 'word' },
      { text: 'déjà', start: 2, end: 6, kind: 'word' },
      { text: 'mangé', start: 7, end: 12, kind: 'word', pos: 'verb', tags: ['past', 'participle'] }
    ]
    expect(findGrammar([{ start: 0, end: 12, para: 0, tokens }], [g], fr.rules.key)).toContainEqual(
      { id: g.id, sentence: 0, start: 0, end: 12 }
    )
    tokens[2] = { ...tokens[2], text: 'faim', pos: 'noun', tags: [] }
    expect(findGrammar([{ start: 0, end: 12, para: 0, tokens }], [g], fr.rules.key)).toEqual([])
  })
  it('custom agreement/conjugation exercises are seeded, unique and full at each level', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      const qs = fr.practice![0].make({ rand: rng(7) } as PracticeDb, level, 6)
      expect(qs).toHaveLength(6)
      expect(new Set(qs.map((q) => q.id)).size).toBe(6)
      expect(qs).toEqual(fr.practice![0].make({ rand: rng(7) } as PracticeDb, level, 6))
      for (const q of qs) {
        expect(new Set(q.choices.map((c) => c.text)).size).toBe(4)
        expect(q.choices[q.answer]).toBeDefined()
      }
    }
  })
  it('courses generate quizzes and stories resolve to licensed texts', () => {
    for (const c of fr.courses!('en'))
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
