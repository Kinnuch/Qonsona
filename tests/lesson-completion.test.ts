import { describe, expect, it } from 'vitest'
import { completionViewMatches, lessonHasLearningContent } from '../src/shared/lesson-completion'
import type { Course, CourseLesson } from '../src/shared/course'
const lesson: CourseLesson = { id: 'one', title: 'Lesson', items: ['key'] }
const course = (kind: Course['kind']): Course => ({
  id: 'course',
  kind,
  title: 'Course',
  units: [{ id: 'unit', title: 'Unit', lessons: [lesson], test: false }],
  symbols: {},
  grammar: {},
  docs: {}
})
describe('explicit lesson completion', () => {
  it('requires the current active language and exact displayed lesson, never module navigation or a stale view', () => {
    const view = { page: 'lesson', course: 'course', lesson: 'one' }
    expect(completionViewMatches('en', 'en', 'courses', view, 'course', 'one')).toBe(true)
    for (const [pack, active, section, page, c, l] of [
      [null, 'en', 'courses', 'lesson', 'course', 'one'],
      ['en', 'fr', 'courses', 'lesson', 'course', 'one'],
      ['en', 'en', 'reading', 'lesson', 'course', 'one'],
      ['en', 'en', 'courses', 'home', 'course', 'one'],
      ['en', 'en', 'courses', 'lesson', 'different', 'one'],
      ['en', 'en', 'courses', 'lesson', 'course', 'different']
    ] as const) {
      expect(
        completionViewMatches(
          pack,
          active,
          section,
          { page, course: c, lesson: l },
          'course',
          'one'
        )
      ).toBe(false)
    }
  })
  it('rejects empty lessons and missing items for every supported lesson kind', () => {
    for (const kind of ['symbols', 'grammar', 'forms', 'phrases', 'docs'] as const) {
      expect(lessonHasLearningContent(course(kind), lesson)).toBe(false)
      expect(lessonHasLearningContent(course(kind), { ...lesson, items: [] })).toBe(false)
    }
  })
  it('accepts actual displayed symbols and learn-only explanations rather than an empty symbol placeholder', () => {
    const c = course('symbols')
    c.symbols.key = { key: 'key', symbol: ' ', reading: '' }
    expect(lessonHasLearningContent(c, lesson)).toBe(false)
    c.symbols.key.note = { en: 'Vowel length changes meaning.' }
    c.symbols.key.learnOnly = true
    expect(lessonHasLearningContent(c, lesson)).toBe(true)
  })
  it('requires grammar explanation, phrases with meanings and real inflection examples', () => {
    const g = course('grammar')
    g.grammar.key = { key: 'key', name: 'Heading', form: '', meaning: { en: ' ' }, examples: [] }
    expect(lessonHasLearningContent(g, lesson)).toBe(false)
    g.grammar.key.meaning.en = 'A condition in the past.'
    expect(lessonHasLearningContent(g, lesson)).toBe(true)
    const p = course('phrases')
    p.phrases = { key: { key: 'key', text: 'hello', meaning: { en: ' ' } } }
    expect(lessonHasLearningContent(p, lesson)).toBe(false)
    p.phrases.key.meaning.en = 'A greeting'
    expect(lessonHasLearningContent(p, lesson)).toBe(true)
    const f = course('forms')
    f.forms = {
      key: { key: 'key', title: 'Past', examples: [{ base: 'walk', form: ' ', wrong: [] }] }
    }
    expect(lessonHasLearningContent(f, lesson)).toBe(false)
    f.forms.key.examples[0].form = 'walked'
    expect(lessonHasLearningContent(f, lesson)).toBe(true)
  })
  it('rejects a document reference or title without a real markdown body', () => {
    const d = course('docs')
    d.docs.key = { key: 'key', title: 'Document', docId: 'doc' }
    expect(lessonHasLearningContent(d, lesson)).toBe(false)
    expect(lessonHasLearningContent(d, lesson, () => ' ')).toBe(false)
    expect(
      lessonHasLearningContent(d, lesson, (id) =>
        id === 'doc' ? 'Actual document content' : undefined
      )
    ).toBe(true)
  })
})
