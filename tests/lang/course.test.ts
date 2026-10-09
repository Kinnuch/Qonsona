/**
 * 框架语言写课程的帮手（src/shared/lang/course.ts）：语法点变成语法课的条目（hl 定高亮的一段）、
 * 按主分级自动分单元、自己分单元，以及课程出题能用上这些条目。
 */
import { describe, expect, it } from 'vitest'
import { lexGrammarCourse, lexGrammarItem, pickText } from '../../src/shared/lang/course'
import { cefrSystem } from '../../src/shared/lang/levels'
import { defaultKey } from '../../src/shared/lang/text'
import { grammarLessonQuiz, isRight, usableExamples } from '../../src/shared/course'
import type { LangModule, LexGrammarPoint } from '../../src/shared/lang/types'

const point = (id: string, level: string, text: string, hl?: string): LexGrammarPoint => ({
  id,
  level,
  name: { zh: `${id}（中）`, en: `${id} (en)` },
  form: { zh: `${id} 构成`, en: `${id} form` },
  meaning: { zh: `${id} 的意思`, en: `meaning of ${id}` },
  examples: [{ text, zh: `${text}（译）`, en: `${text} (tr)`, ...(hl ? { hl } : {}) }]
})

const POINTS: LexGrammarPoint[] = [
  point('a', 'A1', 'Il ne mange pas.', 'ne mange pas'),
  point('b', 'A1', 'Il y a un chat.', 'Il y a'),
  point('c', 'A1', 'Je vais partir.', 'vais partir'),
  point('d', 'A1', 'Il faut partir.', 'Il faut'),
  point('e', 'A2', "J'habite ici depuis deux ans.", 'depuis deux ans'),
  point('f', 'A2', 'Sans hl.'),
  { ...point('g', 'B1', 'Grâce à toi.', 'pas dedans'), group: 'x' }
]

const MOD: LangModule = {
  spec: {
    code: 'fr',
    name: { zh: '测试', en: 'Test' },
    nativeName: 'test',
    bcp47: 'fr',
    color: '#888888',
    direction: 'ltr',
    levelSystems: [cefrSystem([])],
    features: {
      texts: false,
      lexicon: true,
      alphabet: null,
      characters: null,
      grammar: true,
      inflection: false,
      phrasebook: false,
      idioms: false,
      stories: false,
      media: false,
      exam: false,
      ruby: null,
      romanization: false,
      speech: 'fr-FR'
    },
    intro: { zh: '', en: '' }
  },
  rules: { key: (t) => defaultKey(t, 'fr') },
  grammar: POINTS
}

describe('语法点变成课程条目', () => {
  it('按界面语言挑名字与构成；hl 定高亮的一段，找不到的只讲不考', () => {
    const a = lexGrammarItem(POINTS[0], 'zh')
    expect(a).toMatchObject({ key: 'a', name: 'a（中）', form: 'a 构成' })
    expect(a.meaning).toEqual(POINTS[0].meaning)
    const ex = a.examples[0]
    expect(ex.ja.slice(ex.start, ex.end)).toBe('ne mange pas')
    expect(ex).toMatchObject({ zh: 'Il ne mange pas.（译）', source: 'builtin' })
    expect(lexGrammarItem(POINTS[0], 'en').name).toBe('a (en)')
    // 没写 hl、hl 不在句子里：不标，不出题
    expect(usableExamples(lexGrammarItem(POINTS[5], 'zh'))).toEqual([])
    expect(usableExamples(lexGrammarItem(POINTS[6], 'zh'))).toEqual([])
    expect(lexGrammarItem(POINTS[6], 'zh').group).toBe('x')
  })

  it('挑写法：界面语言 → 英文 → 中文', () => {
    expect(pickText({ zh: '中', en: 'en' }, 'ja')).toBe('en')
    expect(pickText({ zh: '中' }, 'en')).toBe('中')
    expect(pickText({ fr: 'fr' }, 'zh')).toBe('fr')
  })
})

describe('语法课', () => {
  it('不分单元时按主分级每级一个单元，每课几个语法点', () => {
    const c = lexGrammarCourse(MOD, 'zh', { perLesson: 3 })
    expect(c).toMatchObject({ id: 'grammar', kind: 'grammar' })
    expect(c.units.map((u) => [u.id, u.lessons.map((l) => l.items)])).toEqual([
      ['A1', [['a', 'b', 'c'], ['d']]],
      ['A2', [['e', 'f']]],
      ['B1', [['g']]]
    ])
    expect(c.units[0].title).toEqual(cefrSystem([]).levels[0].name)
    expect(c.units[0].lessons[0].title).toEqual({
      zh: 'a（中）、b（中）、c（中）',
      en: 'a (en), b (en), c (en)'
    })
    expect(c.units.every((u) => u.test)).toBe(true)
    expect(Object.keys(c.grammar)).toHaveLength(POINTS.length)
  })

  it('自己分单元：不认识的语法点 id 去掉，课名不写时用语法点的名字', () => {
    const c = lexGrammarCourse(MOD, 'en', {
      title: { zh: '法语语法', en: 'French grammar' },
      units: [
        {
          id: 'u1',
          title: { zh: '否定与存在', en: 'Negation and existence' },
          lessons: [
            { id: 'l1', items: ['a', 'nope', 'b'] },
            { id: 'l2', title: { zh: '将来', en: 'Future' }, items: ['c'] }
          ]
        }
      ]
    })
    expect(c.title).toEqual({ zh: '法语语法', en: 'French grammar' })
    expect(c.units[0].lessons[0]).toMatchObject({
      items: ['a', 'b'],
      title: { zh: 'a（中）、b（中）', en: 'a (en), b (en)' }
    })
    expect(c.units[0].lessons[1].title).toEqual({ zh: '将来', en: 'Future' })
  })

  it('课程出题用得上：填空的正确答案是 hl 那一段', () => {
    const c = lexGrammarCourse(MOD, 'zh', { perLesson: 4 })
    const lesson = c.units[0].lessons[0]
    const qs = grammarLessonQuiz(c, lesson, Object.keys(c.grammar), { seed: 3 })
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      if (q.type !== 'fill') continue
      const ex = c.grammar[q.key].examples[q.ex]
      const right = ex.ja.slice(ex.start, ex.end)
      expect(q.choices).toContain(right)
      expect(isRight(c, q, right)).toBe(true)
    }
  })
})
