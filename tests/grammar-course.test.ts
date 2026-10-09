/**
 * 语法课：N5 到 N1 的语法点每个都在某一课里，接续、例句翻译齐全；挑好的 Tatoeba 例句里标出的那一段对得上，
 * 自带例句（与另写的例句）的那一段跟现在的分词结果一致（改了例句要重跑 npm run data:examples）；出的题没毛病。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { JaAnalyzer } from '../src/main/ja-analyze'
import { GRAMMAR } from '$shared/ja/grammar'
import {
  GRAMMAR_COURSE_IDS,
  GRAMMAR_NOTES,
  jaGrammarCourse,
  type GrammarExampleData
} from '$shared/ja/grammar-course'
import {
  allLessons,
  exampleSpan,
  fillAnswer,
  grammarLessonQuiz,
  grammarTestQuiz,
  poolUpTo,
  unitItems
} from '$shared/course'

const data = JSON.parse(
  readFileSync(resolve(__dirname, '../data/ja/grammar-examples.json'), 'utf8')
) as GrammarExampleData
const course = jaGrammarCourse(data)
const analyzer = new JaAnalyzer(resolve(__dirname, '../node_modules/kuromoji/dict'))

describe('语法课的结构', () => {
  it('所有语法点各在且只在一课里，N5 到 N1 各一个单元，单元里都是这一级的', () => {
    expect([...GRAMMAR_COURSE_IDS].sort()).toEqual(GRAMMAR.map((g) => g.id).sort())
    expect(new Set(GRAMMAR_COURSE_IDS).size).toBe(GRAMMAR_COURSE_IDS.length)
    expect(course.units.map((u) => u.id)).toEqual(['n5', 'n4', 'n3', 'n2', 'n1'])
    for (const u of course.units) {
      expect(u.lessons.length, u.id).toBeGreaterThan(0)
      for (const id of unitItems(u))
        expect(`N${GRAMMAR.find((g) => g.id === id)!.level}`, id).toBe(u.id.toUpperCase())
    }
  })

  it('每个语法点都有接续和自带例句的中英翻译；N3 起另有自己写的例句', () => {
    for (const id of GRAMMAR_COURSE_IDS) {
      const n = GRAMMAR_NOTES[id]
      expect(n?.form && n.zh && n.en, id).toBeTruthy()
      for (const m of n.more ?? []) expect(m.ja && m.zh && m.en, id).toBeTruthy()
      if (GRAMMAR.find((g) => g.id === id)!.level <= 3)
        expect(n.more?.length ?? 0, id).toBeGreaterThan(0)
    }
  })

  it('一课里的语法点不太多也不太少', () => {
    for (const r of allLessons(course))
      expect(r.lesson.items.length, r.lesson.id).toBeGreaterThanOrEqual(2)
    for (const r of allLessons(course))
      expect(r.lesson.items.length, r.lesson.id).toBeLessThanOrEqual(7)
  })
})

describe('例句', () => {
  it('N5、N4 的语法点都有挑好的例句（N3 起难的语法点 Tatoeba 里可能没有），标出的那一段在句子里', () => {
    for (const id of GRAMMAR_COURSE_IDS) {
      const p = data.points[id]
      expect(p, id).toBeTruthy()
      if (GRAMMAR.find((g) => g.id === id)!.level >= 4)
        expect(p.corpus.length, id).toBeGreaterThan(0)
      for (const c of p.corpus) {
        expect(c.start >= 0 && c.start < c.end && c.end <= c.ja.length, `${id} ${c.ja}`).toBe(true)
        expect(c.zh || c.en, `${id} ${c.ja}`).toBeTruthy()
      }
    }
  })

  it('自带例句与另写的例句里标出的那一段跟现在的分词结果一致', async () => {
    const span = async (id: string, ja: string): Promise<[number, number] | null> => {
      const hit = (await analyzer.analyze(ja)).grammar.find((h) => h.id === id)
      return hit ? [hit.start, hit.end] : null
    }
    for (const id of GRAMMAR_COURSE_IDS) {
      const g = GRAMMAR.find((x) => x.id === id)!
      expect(data.points[id].builtin, id).toEqual(await span(id, g.example))
      expect(exampleSpan(course.grammar[id].examples[0]).length, id).toBeGreaterThan(0)
      const more = GRAMMAR_NOTES[id].more ?? []
      expect(data.points[id].more ?? [], id).toEqual(
        await Promise.all(more.map((m) => span(id, m.ja)))
      )
      for (let i = 1; i <= more.length; i++)
        expect(exampleSpan(course.grammar[id].examples[i]).length, `${id} ${i}`).toBeGreaterThan(0)
    }
  })
})

describe('出题', () => {
  it('每一课：每个语法点一道选意思、一道填空；选项里有答案、不重复、没有同组的', () => {
    for (const r of allLessons(course)) {
      const qs = grammarLessonQuiz(course, r.lesson, poolUpTo(course, r.lesson.id), { seed: 5 })
      expect(qs.length, r.lesson.id).toBe(r.lesson.items.length * 2)
      for (const q of qs) {
        if (q.type !== 'meaning' && q.type !== 'fill') continue
        expect(new Set(q.choices).size).toBe(q.choices.length)
        const g = course.grammar[q.key]
        if (q.type === 'meaning') {
          expect(q.choices).toContain(q.key)
          for (const k of q.choices)
            if (k !== q.key && g.group) expect(course.grammar[k].group).not.toBe(g.group)
        } else expect(q.choices).toContain(fillAnswer(course, q))
      }
    }
  })

  it('单元测验：每个语法点至多一道，最多 30 道', () => {
    const u = course.units[1]
    const qs = grammarTestQuiz(course, unitItems(u), poolUpTo(course, 'n4-14'), {
      seed: 8,
      max: 30
    })
    expect(qs.length).toBeLessThanOrEqual(30)
    expect(qs.length).toBeGreaterThan(20)
    const keys = qs.map((q) => ('key' in q ? q.key : ''))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('没有例句数据时只有自带的例句（标不出语法点那一段，不出题）', () => {
    const bare = jaGrammarCourse(null)
    expect(bare.grammar.masu.examples).toHaveLength(1)
    expect(grammarLessonQuiz(bare, bare.units[0].lessons[0], [], { seed: 1 })).toEqual([])
  })
})
