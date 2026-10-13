import { describe, expect, it } from 'vitest'
import { langPractice } from '../src/main/lang/practice'
import type { LexDb } from '../src/main/lang/lexdb'
import { LANGS } from '../src/shared/lang/registry'
import { LANG_CODES, type LangCode } from '../src/shared/lang/types'
import { lexGrammarCourse } from '../src/shared/lang/course'
import { grammarQuestion, isRight, rng, type Course, type GrammarItem } from '../src/shared/course'
import {
  GRAMMAR_FUNCTION_ASK,
  GRAMMAR_SENTENCE_ASK,
  mixedPracticeKinds,
  sameMeaning,
  sentenceTranslation
} from '../src/shared/question-semantics'

// Grammar examples are editorial source data; this route does not require a user's dictionary.
const db = (code: LangCode): LexDb =>
  ({
    code,
    practiceWords: () => [],
    entryExamples: () => [],
    levelSentences: () => [],
    lookup: () => null
  }) as unknown as LexDb

describe.each(LANG_CODES)('%s question semantics', (code) => {
  it('grammar comprehension offers only supplied sentence translations', () => {
    const mod = LANGS[code]
    const examples = (mod.grammar ?? []).flatMap((point) => point.examples)
    const translations = examples.map(sentenceTranslation).filter((text) => !!text)
    const questions = langPractice(db(code), 'grammar-meaning', null, 500, 7, 'zh')
    expect(questions.length).toBeGreaterThan(0)
    for (const question of questions) {
      const original = examples.find((example) => example.text === question.prompt.text)!
      expect(original).toBeDefined()
      expect(question.ask).toEqual(GRAMMAR_SENTENCE_ASK)
      expect(question.choices[question.answer].text).toEqual(sentenceTranslation(original))
      for (const choice of question.choices) expect(translations).toContainEqual(choice.text)
      for (let a = 0; a < question.choices.length; a++)
        for (let b = a + 1; b < question.choices.length; b++)
          expect(sameMeaning(question.choices[a].text, question.choices[b].text)).toBe(false)
    }
  })

  it('course comprehension uses translations rather than paragraphs of grammatical rules', () => {
    const course = lexGrammarCourse(LANGS[code], 'zh')
    const keys = Object.keys(course.grammar)
    const translations = Object.values(course.grammar).flatMap((point) =>
      point.examples.map(sentenceTranslation).filter(Boolean)
    )
    for (const key of keys) {
      const question = grammarQuestion(course, 'meaning', key, 0, keys, keys, rng(17))
      expect(question?.type).toBe('meaning')
      if (question?.type !== 'meaning') continue
      expect(question.sentenceChoices).toBeDefined()
      expect(question.sentenceChoices![key]).toEqual(
        sentenceTranslation(course.grammar[key].examples[0])
      )
      for (const choice of question.choices)
        expect(translations).toContainEqual(question.sentenceChoices![choice])
      expect(isRight(course, question, key)).toBe(true)
      expect(
        isRight(
          course,
          question,
          question.choices.find((choice) => choice !== key)!
        )
      ).toBe(false)
    }
  })
})

describe('comprehension versus grammatical function', () => {
  it('the reported Please open the window example asks a sentence question and answers 请打开窗户', () => {
    const questions = langPractice(db('en'), 'grammar-meaning', 'A1', 100, 1, 'zh')
    const question = questions.find((item) => item.prompt.text === 'Please open the window.')!
    expect(question).toBeDefined()
    expect(question.ask).toEqual(GRAMMAR_SENTENCE_ASK)
    expect(question.choices[question.answer].text).toMatchObject({ zh: '请打开窗户。' })
    expect(question.choices.map((choice) => JSON.stringify(choice.text)).join()).not.toContain(
      '主语通常省略'
    )
  })

  it('missing translations stay a clearly labelled function question rather than inventing a meaning', () => {
    const item = (key: string, rule: string): GrammarItem => ({
      key,
      name: key,
      form: key,
      meaning: { zh: rule },
      examples: [{ ja: key, zh: null, en: null, start: 0, end: key.length, source: 'builtin' }]
    })
    const course: Course = {
      id: 'author-grammar',
      kind: 'grammar',
      title: '',
      units: [],
      symbols: {},
      grammar: { a: item('a', '陈述事实'), b: item('b', '否定陈述') },
      docs: {}
    }
    const question = grammarQuestion(course, 'meaning', 'a', 0, ['a', 'b'], [], rng(2))
    expect(question?.type).toBe('meaning')
    if (question?.type !== 'meaning') return
    expect(question.sentenceChoices).toBeUndefined()
    expect(sentenceTranslation(course.grammar.a.examples[0])).toBeNull()
    expect(GRAMMAR_FUNCTION_ASK).toMatchObject({ zh: expect.stringContaining('语法作用') })
  })

  it('mixed practice includes useful context, translation and filling while excluding rule recognition', () => {
    const kinds = [
      'word-meaning',
      'context',
      'grammar-fill',
      'grammar-meaning',
      'sentence',
      'listen-word',
      'custom:en-forms'
    ]
    expect(mixedPracticeKinds(kinds, false)).toEqual([
      'word-meaning',
      'context',
      'grammar-fill',
      'sentence',
      'custom:en-forms'
    ])
    expect(mixedPracticeKinds(kinds, true)).toContain('listen-word')
    expect(mixedPracticeKinds(kinds, true)).not.toContain('grammar-meaning')
  })

  it('normalization rejects duplicate displayed translations but never treats absent fields as equal', () => {
    expect(
      sameMeaning({ zh: '请开门。', en: 'Open the door.' }, { zh: '请开门。', en: 'Another.' })
    ).toBe(true)
    expect(sameMeaning({ en: '  OPEN the door. ' }, { en: 'Open the door.' })).toBe(true)
    expect(sameMeaning({ zh: '开门' }, { zh: '关门' })).toBe(false)
    expect(sameMeaning({ zh: '', en: 'Open' }, { zh: '', en: 'Close' })).toBe(false)
  })
})
