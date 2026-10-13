import { describe, expect, it } from 'vitest'
import {
  articleVocabulary,
  makeArticleQuiz,
  mergeArticleQuizProgress,
  parseArticleQuizProgress
} from '../src/shared/article-quiz'

describe('evidence-based article tasks', () => {
  it.each(['ja', 'en', 'fr', 'ko', 'es', 'ar', 'ru', 'gd', 'qya', 'sjn', 'qon-import'])(
    '%s gets source-only evidence and deterministic answers',
    (lang) => {
      const input = {
        id: 'sample',
        body: 'First passage has a blue boat.\n\nSecond passage describes a green hill.\n\nThird passage introduces a small town.',
        lang,
        seed: 1729
      }
      const quiz = makeArticleQuiz(input)
      expect(quiz).toEqual(makeArticleQuiz(input))
      expect(quiz.reading).toBeGreaterThanOrEqual(3)
      expect(quiz.translated).toBe(false)
      for (const q of quiz.questions) {
        expect(q.section).toBe('reading')
        expect(q.answer).toBeGreaterThanOrEqual(0)
        expect(q.answer).toBeLessThan(q.choices.length)
        expect(new Set(q.choices.map((c) => c.text)).size).toBe(q.choices.length)
        expect(q.explain.lines[0]).toHaveProperty('en')
        expect(input.body).toContain(q.choices[q.answer].text as string)
        expect(JSON.stringify(q.ask)).toMatch(/Locate|sequence/)
      }
    }
  )
  it('uses provided translations only with complete paragraph alignment', () => {
    const input = { id: 'tr', body: 'A boat.\nA hill.\nA town.', translation: '船。\n山。\n城镇。' }
    const quiz = makeArticleQuiz(input)
    expect(quiz.translated).toBe(true)
    const meanings = quiz.questions.filter((q) => q.id.includes('meaning'))
    expect(meanings).toHaveLength(3)
    for (const q of meanings)
      expect(JSON.stringify(q.explain.lines)).toContain(q.choices[q.answer].text as string)
    expect(makeArticleQuiz({ ...input, translation: '只有一段。' }).translated).toBe(false)
  })
  it('does not fabricate semantic reading questions for a short excerpt', () => {
    const quiz = makeArticleQuiz({
      id: 'news',
      body: 'A title and a very short lead',
      excerpt: true
    })
    expect(quiz.excerpt).toBe(true)
    expect(quiz.questions).toEqual([])
    const sentences = makeArticleQuiz({
      id: 'news',
      body: 'A boat arrived. A town celebrated.',
      excerpt: true
    })
    expect(sentences.questions).toHaveLength(1)
    expect(JSON.stringify(sentences.questions[0].ask)).toContain('sequence')
  })
  it('repeated passages do not create ambiguous location or sequence targets', () => {
    const quiz = makeArticleQuiz({
      id: 'repeat',
      body: 'Same passage.\nSame passage.\nDifferent passage.'
    })
    for (const q of quiz.questions.filter((q) => q.id.includes('location'))) {
      const matches = ['Same passage.', 'Same passage.', 'Different passage.'].filter((p) =>
        p.includes(q.prompt.text)
      )
      expect(matches).toHaveLength(1)
    }
  })
  it('does not skip a long middle paragraph when claiming immediate sequence', () => {
    const quiz = makeArticleQuiz({ id: 'long', body: `First.\n${'x'.repeat(1900)}\nLast.` })
    expect(quiz.questions.some((q) => q.id === 'reading-next-0')).toBe(false)
    expect(
      quiz.questions.some((q) => q.prompt.text === 'First.' && q.choices[q.answer].text === 'Last.')
    ).toBe(false)
  })
  it('does not remove repeated sentences before generating next-sentence evidence', () => {
    const quiz = makeArticleQuiz({ id: 'repeated-sentence', body: 'A. B. A. C.' })
    const q = quiz.questions.find((q) => q.prompt.text === 'B.')
    expect(q?.choices[q.answer].text).toBe('A.')
    expect(quiz.questions.some((q) => q.prompt.text === 'A.')).toBe(false)
  })
  it('vocabulary has genuine source evidence, unique bilingual choices and stays in vocab', () => {
    const words = [
      {
        id: 'boat',
        word: 'boat',
        meaning: { en: 'a small vessel', zh: '小船' },
        evidence: 'The boat sailed.'
      }
    ]
    const pool = [
      ...words,
      { id: 'hill', word: 'hill', meaning: { en: 'raised land', zh: '小山' }, evidence: '' },
      { id: 'dup', word: 'duplicate', meaning: { en: 'a small vessel', zh: '小船' }, evidence: '' }
    ]
    const questions = articleVocabulary(words, pool)
    expect(questions).toHaveLength(1)
    expect(questions[0].choices).toHaveLength(2)
    expect(questions[0].section).toBe('vocab')
    expect(JSON.stringify(questions[0].explain.lines)).toContain('The boat sailed.')
    const quiz = makeArticleQuiz({ id: 'a', body: 'The boat sailed.', vocabulary: questions })
    expect(quiz.vocabulary).toBe(1)
    expect(quiz.reading).toBe(0)
  })
  it('material and exact choice changes invalidate saved answers', () => {
    const a = makeArticleQuiz({ id: 'a', body: 'A.\nB.\nC.' })
    expect(makeArticleQuiz({ id: 'a', body: 'A.\nD.\nC.' }).fingerprint).not.toBe(a.fingerprint)
    expect(makeArticleQuiz({ id: 'a', body: 'A.\nB.\nC.', seed: 29 }).fingerprint).not.toBe(
      a.fingerprint
    )
  })
})
describe('article quiz progress validation and merge', () => {
  const base = { fingerprint: 'a123', answers: [0], completed: false, history: [] }
  it('strictly validates answers, counts and fingerprint', () => {
    expect(parseArticleQuizProgress(base)).toEqual(base)
    for (const raw of [
      { ...base, answers: [4] },
      { ...base, answers: [0.5] },
      { ...base, completed: 'false' },
      { ...base, fingerprint: '../evil' },
      { ...base, history: [{ at: 1, answers: [0], total: 2, right: 0 }] }
    ])
      expect(parseArticleQuizProgress(raw)).toBeNull()
  })
  it('merges same material idempotently and retains completed histories', () => {
    const b = {
      ...base,
      answers: [0, 1],
      completed: true,
      history: [{ at: 5, answers: [0, 1], right: 1, total: 2 }]
    }
    const merged = mergeArticleQuizProgress(base, b)
    expect(merged.answers).toEqual([0, 1])
    expect(merged.completed).toBe(true)
    expect(mergeArticleQuizProgress(merged, b)).toEqual(merged)
  })
  it('never resumes answers from a changed material', () => {
    const merged = mergeArticleQuizProgress(base, { ...base, fingerprint: 'b456' })
    expect(merged.answers).toEqual([])
    expect(merged.completed).toBe(false)
  })
})
