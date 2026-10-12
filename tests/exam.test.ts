/**
 * 练习与模拟卷：判分（JLPT 的换算与合格线）、读音干扰项；
 * 用词典里真的数据按级出题（有词典数据库时跑）：每种题都出得来，答案在选项里、选项不重复，模拟卷四节题量对；
 * 本文练习（用一篇文章出题）。
 */
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { rng } from '$shared/course'
import { normalizePracticeLog, scorePaper, type ExamPaper, type ExamQuestion } from '$shared/exam'
import {
  jaArticlePractice,
  jaPaper,
  jaPractice,
  jaPracticeKinds,
  readingDistractors,
  type JaExamData,
  type LevelSentenceData
} from '$shared/ja/exam'
import { jaGrammarCourse, type GrammarExampleData } from '$shared/ja/grammar-course'
import { JapaneseDict } from '../src/main/dict'
import { JaAnalyzer } from '../src/main/ja-analyze'

const q = (answer: number): ExamQuestion => ({
  id: 'x',
  kind: 'word-meaning',
  section: 'vocab',
  ask: '',
  prompt: { text: '' },
  choices: [{ text: 'a' }, { text: 'b' }],
  answer,
  explain: { lines: [] }
})

describe('判分', () => {
  const paper: ExamPaper = {
    id: 'p',
    level: 'N5',
    title: '',
    scoring: 'jlpt-n5',
    sections: [
      { id: 'vocab', title: '', minutes: 1, questions: [q(0), q(0), q(0), q(0)] },
      { id: 'grammar', title: '', minutes: 1, questions: [q(1), q(1)] },
      { id: 'reading', title: '', minutes: 1, questions: [q(0), q(0)] },
      { id: 'listening', title: '', minutes: 1, questions: [q(0), q(0)] }
    ]
  }

  it('loading history preserves every imported paper beyond the display page size', () => {
    const exams = Array.from({ length: 45 }, (_, i) => ({ id: String(i), paper, answers: [[0]] }))
    const normalized = normalizePracticeLog({ exams, days: {} })
    expect(normalized.exams).toHaveLength(45)
    expect(normalized.exams.map((record) => record.id)).toEqual(exams.map((record) => record.id))
  })

  it('每节答对几题，按比例换算成 JLPT 的两部分分数', () => {
    const r = scorePaper(paper, [
      [0, 0, 0, 1],
      [1, null],
      [0, 0],
      [0, 1]
    ])
    expect(r.sections.map((s) => s.right)).toEqual([3, 1, 2, 1])
    expect(r.right).toBe(7)
    expect(r.total).toBe(10)
    // 言语知识·读解 6 / 8 → 90；听解 1 / 2 → 30
    expect(r.parts?.map((p) => p.score)).toEqual([90, 30])
    expect(r.scaled).toBe(120)
    expect(r.passed).toBe(true)
  })

  it('总分过了但有一部分低于基准分，也不合格', () => {
    const r = scorePaper(paper, [
      [0, 0, 0, 0],
      [1, 1],
      [0, 0],
      [1, 1]
    ])
    expect(r.parts?.map((p) => p.score)).toEqual([120, 0])
    expect(r.scaled).toBe(120)
    expect(r.passed).toBe(false)
  })

  it('N3 起分三部分：言语知识、读解、听解各 60 分，基准分 19', () => {
    const n3 = { ...paper, level: 'N3', scoring: 'jlpt-n3' }
    const r = scorePaper(n3, [
      [0, 0, 0, 1],
      [1, null],
      [0, 0],
      [0, 1]
    ])
    // 言语知识 4 / 6 → 40；读解 2 / 2 → 60；听解 1 / 2 → 30
    expect(r.parts?.map((p) => p.score)).toEqual([40, 60, 30])
    expect(r.scaled).toBe(130)
    expect(r.pass).toBe(95)
    expect(r.passed).toBe(true)
    // N1 合格线 100：总分够了，读解一题没对也不合格
    const n1 = scorePaper({ ...paper, level: 'N1', scoring: 'jlpt-n1' }, [
      [0, 0, 0, 0],
      [1, 1],
      [1, 1],
      [0, 0]
    ])
    expect(n1.parts?.map((p) => p.score)).toEqual([60, 0, 60])
    expect(n1.passed).toBe(false)
  })

  it('没有计分办法的只算答对几题', () => {
    const r = scorePaper({ ...paper, scoring: null }, [[0], [], [], []])
    expect(r.parts).toBeNull()
    expect(r.passed).toBeNull()
  })
})

describe('读音的干扰项', () => {
  it('改一处：清浊、长音、促音、拗音；不跟正确读音、别的读法重', () => {
    const rand = rng(3)
    for (const reading of ['がっこう', 'せんせい', 'きょう', 'ともだち', 'はなし', 'りょこう']) {
      const d = readingDistractors(reading, rand, 3, new Set([reading]))
      expect(d, reading).toHaveLength(3)
      expect(new Set(d).size).toBe(3)
      expect(d).not.toContain(reading)
      for (const x of d) expect(x, reading).toMatch(/^[ぁ-ゖー]+$/)
    }
    expect(readingDistractors('こう', rng(1), 10)).toEqual(expect.arrayContaining(['こ', 'ごう']))
    expect(readingDistractors('きょう', rng(1), 10)).toContain('きよう')
    expect(readingDistractors('きょう', rng(1), 10, new Set(['きよう']))).not.toContain('きよう')
  })
})

// ── 用词典里真的数据出题 ──

const DB = resolve(__dirname, '../resources/data/ja/dict.sqlite')
const run = existsSync(DB) ? describe : describe.skip

/** 一道题的基本要求：答案在选项里，选项不重复，标出 / 挖掉的范围在题面里，听力题带朗读 */
function valid(x: ExamQuestion): void {
  const key = (c: ExamQuestion['choices'][number]): string => JSON.stringify(c.text)
  expect(x.answer, x.id).toBeGreaterThanOrEqual(0)
  expect(x.answer).toBeLessThan(x.choices.length)
  expect(x.choices.length, x.id).toBe(4)
  expect(new Set(x.choices.map(key)).size, `${x.id} ${x.choices.map(key).join(' ')}`).toBe(4)
  for (const r of [x.prompt.mark, x.prompt.blank])
    if (r) expect(r[0] >= 0 && r[0] < r[1] && r[1] <= x.prompt.text.length, x.id).toBe(true)
  if (x.kind.startsWith('listen')) expect(x.prompt.listen?.text, x.id).toBeTruthy()
  expect(x.explain.lines.length, x.id).toBeGreaterThan(0)
}

run('按级出题', () => {
  const dict = existsSync(DB) ? new JapaneseDict(DB) : (null as unknown as JapaneseDict)
  afterAll(() => dict?.close())
  const sentences = JSON.parse(
    readFileSync(resolve(__dirname, '../data/ja/level-sentences.json'), 'utf8')
  ) as LevelSentenceData
  const grammar = jaGrammarCourse(
    JSON.parse(
      readFileSync(resolve(__dirname, '../data/ja/grammar-examples.json'), 'utf8')
    ) as GrammarExampleData
  )
  const data = (level: number): JaExamData => ({
    level,
    words: dict.examWords(level),
    sentences: sentences.levels[level] ?? [],
    grammar,
    verbs: dict.conjugables([level])
  })

  it('N5 的每种题都出得了 10 道', () => {
    const d = data(5)
    for (const kind of jaPracticeKinds(5)) {
      const qs = jaPractice(d, kind, 10, 7)
      expect(qs.length, kind).toBe(10)
      qs.forEach(valid)
    }
  })

  it('N3、N2、N1 也有语法题，每种题都出得了 10 道', () => {
    for (const level of [3, 2, 1]) {
      const kinds = jaPracticeKinds(level)
      expect(kinds).toContain('grammar-fill')
      const d = data(level)
      for (const kind of kinds) {
        const qs = jaPractice(d, kind, 10, 3)
        expect(qs.length, `N${level} ${kind}`).toBe(10)
        qs.forEach(valid)
      }
    }
  })

  it('本文练习：用一篇文章的词、读法、语法、句子出 10 道题，每道都没毛病；没有语音时不出听力题', async () => {
    const analyzer = new JaAnalyzer(resolve(__dirname, '../node_modules/kuromoji/dict'))
    const tales = JSON.parse(
      readFileSync(resolve(__dirname, '../data/ja/folktales.json'), 'utf8')
    ) as { tales: { id: string; body: string }[] }
    const body = tales.tales.find((t) => t.id === 'aozora-18376')!.body
    const analysis = await analyzer.analyze(body, (b, r, i) => dict.word(b, r, i))
    const ids = analysis.sentences.flatMap((s) =>
      s.words.map((w) => w.entryId).filter((x): x is number => !!x)
    )
    const d = { analysis, words: dict.examWordsOf(ids), pool: dict.examWords(3), listen: true }
    const qs = jaArticlePractice(d, 11)
    expect(qs).toHaveLength(10)
    qs.forEach(valid)
    expect(new Set(qs.map((x) => x.kind))).toEqual(
      new Set(['word-meaning', 'kanji-reading', 'grammar-meaning', 'listen-sentence'])
    )
    // 标出的那一段就是文中那个词
    for (const x of qs.filter((y) => y.kind === 'kanji-reading')) {
      const [a, b] = x.prompt.mark!
      expect(body).toContain(x.prompt.text.slice(a, b))
    }
    const quiet = jaArticlePractice({ ...d, listen: false }, 11)
    expect(quiet).toHaveLength(10)
    expect(quiet.some((x) => x.kind === 'listen-sentence')).toBe(false)
  })

  it('N5 到 N1 的模拟卷：四节，题量对（N3 起读解多几道），每道题都没毛病', () => {
    for (const level of [5, 4, 3, 2, 1]) {
      const p = jaPaper(data(level), 42)
      expect(p.scoring).toBe(`jlpt-n${level}`)
      expect(p.sections.map((s) => s.id)).toEqual(['vocab', 'grammar', 'reading', 'listening'])
      expect(
        p.sections.map((s) => s.questions.length),
        `N${level}`
      ).toEqual(level >= 4 ? [23, 16, 6, 9] : [23, 16, 10, 9])
      const ids = p.sections.flatMap((s) => s.questions.map((x) => x.id))
      expect(new Set(ids).size).toBe(ids.length)
      p.sections.flatMap((s) => s.questions).forEach(valid)
    }
  })
})
