/**
 * 课程里跟语言无关的部分：出题（选项里有答案、读音不重复、同一种子出同一套题）、判分、进度。
 */
import { describe, expect, it } from 'vitest'
import {
  PASS,
  courseSummary,
  emptyProgress,
  isRight,
  lessonAfter,
  lessonState,
  markLearned,
  nextLesson,
  normalizeProgress,
  poolUpTo,
  progressKey,
  recordLesson,
  recordPractice,
  recordTest,
  rng,
  shuffled,
  symbolLessonQuiz,
  symbolTestQuiz,
  typedRight,
  weakItems,
  type Course,
  type Question,
  type SpellWord,
  type SymbolItem
} from '$shared/course'

const sym = (key: string, reading: string, extra: Partial<SymbolItem> = {}): SymbolItem => ({
  key,
  symbol: key.toUpperCase(),
  reading,
  say: { ipa: reading },
  ...extra
})

/** 一门假想的课：两个单元，五个字；b 和 d 读音一样（像 じ / ぢ） */
function course(): Course {
  const symbols = Object.fromEntries(
    [
      sym('a', 'a', { alike: ['o'] }),
      sym('o', 'o', { alike: ['a'] }),
      sym('i', 'i'),
      sym('b', 'ba'),
      sym('d', 'ba', { accept: ['da'] }),
      sym('x', '', { learnOnly: true })
    ].map((s) => [s.key, s])
  )
  return {
    id: 'alphabet',
    kind: 'symbols',
    title: 'test',
    units: [
      {
        id: 'u1',
        title: 'u1',
        test: true,
        lessons: [
          { id: 'l1', title: 'l1', items: ['a', 'o', 'i'] },
          { id: 'l2', title: 'l2', items: ['b', 'd', 'x'] }
        ]
      },
      { id: 'u2', title: 'u2', test: false, lessons: [{ id: 'l3', title: 'l3', items: ['x'] }] }
    ],
    symbols,
    grammar: {},
    docs: {}
  }
}

const readingsOf = (c: Course, q: Question): string[] =>
  'choices' in q && q.type !== 'word' && q.type !== 'fill' && q.type !== 'meaning'
    ? q.choices.map((k) => c.symbols[k].reading)
    : []

describe('随机', () => {
  it('同一种子同一串数；打乱不丢不重', () => {
    const a = rng(42)
    const b = rng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    const list = [1, 2, 3, 4, 5, 6, 7]
    expect([...shuffled(list, rng(1))].sort()).toEqual(list)
  })
})

describe('出题', () => {
  it('一课：每个字考读音和选字，能出声的再考听音；选项里有答案，读音互不相同', () => {
    const c = course()
    const qs = symbolLessonQuiz(c, c.units[0].lessons[0], poolUpTo(c, 'l1'), {
      seed: 7,
      listen: true
    })
    expect(qs).toHaveLength(9)
    for (const q of qs) {
      if (!('choices' in q) || q.type === 'word') continue
      expect(q.choices).toContain((q as { key: string }).key)
      const r = readingsOf(c, q)
      expect(new Set(r).size).toBe(r.length)
    }
    // 同一种子出同一套题
    expect(
      symbolLessonQuiz(c, c.units[0].lessons[0], poolUpTo(c, 'l1'), { seed: 7, listen: true })
    ).toEqual(qs)
  })

  it('读音一样的字不会同时当选项；只讲不考的不出题', () => {
    const c = course()
    const qs = symbolLessonQuiz(c, c.units[0].lessons[1], poolUpTo(c, 'l2'), { seed: 3 })
    expect(qs.every((q) => 'key' in q && q.key !== 'x')).toBe(true)
    for (const q of qs) {
      if (!('choices' in q) || q.type === 'word') continue
      const keys = q.choices as string[]
      expect(keys.includes('b') && keys.includes('d')).toBe(false)
    }
  })

  it('不能输入的字（IPA）凑不够选项就不出；能输入的改成输入题', () => {
    const c = course()
    c.symbols.i.typeable = false
    const lonely = { id: 'solo', title: '', items: ['i'] }
    expect(symbolLessonQuiz(c, lonely, ['i'], { seed: 1 })).toEqual([])
    c.symbols.i.typeable = true
    expect(symbolLessonQuiz(c, lonely, ['i'], { seed: 1 }).every((q) => q.type === 'type')).toBe(
      true
    )
  })

  it('拼读题：选项的读法互不相同；少于两个词不出', () => {
    const c = course()
    const w = (text: string, reading: string): SpellWord => ({ text, reading, meaning: '' })
    const words = [w('AI', 'ai'), w('OI', 'oi'), w('IA', 'ia'), w('AO', 'ai')]
    const qs = symbolLessonQuiz(c, { id: 'w', title: '', items: [] }, [], { seed: 2, words })
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      if (q.type !== 'word') continue
      const r = q.choices.map((x) => x.reading)
      expect(new Set(r).size).toBe(r.length)
      expect(q.choices).toContain(q.word)
    }
    expect(
      symbolLessonQuiz(c, { id: 'w', title: '', items: [] }, [], {
        seed: 2,
        words: words.slice(0, 1)
      })
    ).toEqual([])
  })

  it('单元测验：每个字考一道，最多 max 道', () => {
    const c = course()
    const qs = symbolTestQuiz(c, ['a', 'o', 'i', 'b', 'd', 'x'], poolUpTo(c, 'l2'), {
      seed: 5,
      max: 4
    })
    expect(qs).toHaveLength(4)
    expect(new Set(qs.map((q) => ('key' in q ? q.key : ''))).size).toBe(4)
  })
})

describe('判分', () => {
  it('选择题比条目键，输入题比读音与 accept（不分大小写）', () => {
    const c = course()
    expect(isRight(c, { type: 'read', key: 'a', choices: ['a', 'o'] }, 'a')).toBe(true)
    expect(isRight(c, { type: 'read', key: 'a', choices: ['a', 'o'] }, 'o')).toBe(false)
    expect(typedRight(c, c.symbols.d, ' BA ')).toBe(true)
    expect(typedRight(c, c.symbols.d, 'da')).toBe(true)
    expect(typedRight(c, c.symbols.d, 'ga')).toBe(false)
    expect(typedRight(c, c.symbols.d, '')).toBe(false)
  })
})

describe('进度', () => {
  it('答对 80% 算过关，最好成绩留最高的；没有题的课直接过关', () => {
    const c = course()
    const p = emptyProgress()
    const ans = (n: number, right: number): { keys: string[]; right: boolean }[] =>
      Array.from({ length: n }, (_, i) => ({ keys: ['a'], right: i < right }))
    expect(recordLesson(p, c, 'l1', ans(5, 3), 1)).toEqual({ score: 0.6, passed: false })
    expect(lessonState(p, c, 'l1')).toBe('learned')
    expect(recordLesson(p, c, 'l1', ans(5, 4), 2).passed).toBe(true)
    recordLesson(p, c, 'l1', ans(5, 2), 3)
    const rec = p.lessons[progressKey('alphabet', 'l1')]
    expect(rec).toMatchObject({ best: 0.8, passed: true, tries: 3 })
    expect(PASS).toBe(0.8)
    expect(recordLesson(p, c, 'l3', [], 4)).toEqual({ score: 1, passed: true })
  })

  it('过关之后接着学这一课后面的；后面都过了再从头找', () => {
    const c = course()
    const p = emptyProgress()
    recordLesson(p, c, 'l2', [{ keys: [], right: true }])
    expect(lessonAfter(c, p, 'l2')?.lesson.id).toBe('l3')
    recordLesson(p, c, 'l3', [{ keys: [], right: true }])
    expect(lessonAfter(c, p, 'l3')?.lesson.id).toBe('l1')
    recordLesson(p, c, 'l1', [{ keys: [], right: true }])
    expect(lessonAfter(c, p, 'l1')).toBeNull()
  })

  it('接着学的是第一课没过关的；全过了是 null', () => {
    const c = course()
    const p = emptyProgress()
    expect(nextLesson(c, p)?.lesson.id).toBe('l1')
    for (const l of ['l1', 'l2', 'l3']) recordLesson(p, c, l, [{ keys: [], right: true }])
    expect(nextLesson(c, p)).toBeNull()
    expect(courseSummary(c, p)).toEqual({ lessons: 3, passed: 3, tests: 1, testsPassed: 0 })
    recordTest(p, c, 'u1', [{ keys: ['a'], right: true }])
    expect(courseSummary(c, p).testsPassed).toBe(1)
  })

  it('薄弱项：学过的课里答错多的在前；练薄弱项不改课的成绩', () => {
    const c = course()
    const p = emptyProgress()
    recordLesson(p, c, 'l1', [
      { keys: ['a'], right: false },
      { keys: ['a'], right: false },
      { keys: ['o'], right: false },
      { keys: ['i'], right: true }
    ])
    expect(weakItems(c, p)).toEqual(['a', 'o'])
    const before = structuredClone(p.lessons)
    recordPractice(p, c, [{ keys: ['a'], right: true }])
    expect(p.lessons).toEqual(before)
    expect(p.items[progressKey('alphabet', 'a')]).toEqual({ right: 1, wrong: 2 })
  })

  it('文档课读完就过关；读回来的进度坏数据丢掉', () => {
    const c = { ...course(), kind: 'docs' as const }
    const p = emptyProgress()
    markLearned(p, c, 'l1')
    expect(lessonState(p, c, 'l1')).toBe('passed')
    expect(p.last).toEqual({ course: 'alphabet', lesson: 'l1' })
    const n = normalizeProgress({
      lessons: { 'x/y': { learned: 1, best: 7, passed: true, tries: 'a' }, bad: null },
      items: { k: { right: 2 } },
      last: { course: 1 }
    })
    expect(n.lessons['x/y']).toEqual({ learned: true, best: 1, passed: true, tries: 0, at: 0 })
    expect(n.lessons.bad).toBeUndefined()
    expect(n.items.k).toEqual({ right: 2, wrong: 0 })
    expect(n.last).toBeNull()
  })
})
