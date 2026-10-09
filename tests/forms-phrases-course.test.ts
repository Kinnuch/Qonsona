/**
 * 变形课与会话课：日语的变形表（五段各行、一段、する、来る 都有）、日语会话短语；
 * 千语集语言的变形（按构形分单元、按第一个维度分课，干扰项是这个词别的形）与短语本。出的题没毛病。
 */
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { jaFormsCourse, pickVerbs } from '$shared/ja/forms-course'
import { jaPhrasesCourse } from '$shared/ja/phrases-course'
import { classOf } from '$shared/ja/conjugate'
import {
  allLessons,
  poolUpTo,
  formLessonQuiz,
  phraseLessonQuiz,
  testQuiz,
  unitItems,
  type Course,
  type Question
} from '$shared/course'
import type { ConjugableWord } from '$shared/dict'
import { parseProject } from '$qon/core/serialize'
import { qonFormsCourse, qonPhrasesCourse, type QonCourseLabels } from '$lib/courses/qonlang'
import { JapaneseDict } from '../src/main/dict'

const word = (head: string, reading: string, pos: string[]): ConjugableWord => {
  const c = classOf(pos)!
  return {
    id: 0,
    head: head + (c.suru ? 'する' : ''),
    reading: reading + (c.suru ? 'する' : ''),
    cls: c.cls,
    ...(c.special && { special: c.special }),
    jlpt: 5,
    zh: head,
    en: head
  }
}

const WORDS: ConjugableWord[] = [
  word('書く', 'かく', ['v5k']),
  word('行く', 'いく', ['v5k-s']),
  word('買う', 'かう', ['v5u']),
  word('泳ぐ', 'およぐ', ['v5g']),
  word('話す', 'はなす', ['v5s']),
  word('待つ', 'まつ', ['v5t']),
  word('死ぬ', 'しぬ', ['v5n']),
  word('遊ぶ', 'あそぶ', ['v5b']),
  word('読む', 'よむ', ['v5m']),
  word('帰る', 'かえる', ['v5r']),
  word('食べる', 'たべる', ['v1']),
  word('見る', 'みる', ['v1']),
  word('する', 'する', ['vs-i']),
  word('勉強', 'べんきょう', ['n', 'vs']),
  word('来る', 'くる', ['vk']),
  word('高い', 'たかい', ['adj-i']),
  word('いい', 'いい', ['adj-ix']),
  word('静か', 'しずか', ['adj-na'])
]

/** 选择题：选项里有答案、不重复 */
function checkChoices(c: Course, q: Question): void {
  if (q.type === 'form') {
    const ex = c.forms![q.key].examples[q.ex]
    expect(q.choices).toContain(ex.form)
    expect(new Set(q.choices).size, q.choices.join(' ')).toBe(q.choices.length)
  } else if (q.type === 'phrase') {
    expect(q.choices).toContain(q.key)
    expect(new Set(q.choices).size).toBe(q.choices.length)
    const shown = q.choices.map((k) =>
      q.mode === 'meaning' ? JSON.stringify(c.phrases![k].meaning) : c.phrases![k].text
    )
    expect(new Set(shown).size).toBe(shown.length)
  }
}

describe('日语的变形课', () => {
  const course = jaFormsCourse(WORDS)

  it('挑的词五段各行、一段、する、带する的名词、来る 都有', () => {
    const picked = pickVerbs(WORDS).map((w) => w.head)
    for (const h of [
      '書く',
      '行く',
      '買う',
      '泳ぐ',
      '話す',
      '待つ',
      '死ぬ',
      '遊ぶ',
      '読む',
      '帰る',
      '食べる',
      'する',
      '勉強する',
      '来る'
    ])
      expect(picked).toContain(h)
  })

  it('动词九课、形容词两课；每格都有三个错形，不跟正确答案重', () => {
    expect(course.units.map((u) => u.lessons.length)).toEqual([9, 2])
    for (const f of Object.values(course.forms!))
      for (const ex of f.examples) {
        expect(ex.wrong, `${ex.base} ${f.key}`).toHaveLength(3)
        expect(ex.wrong).not.toContain(ex.form)
      }
    const te = course.forms!['v:te'].examples.find((e) => e.base === '行く')!
    expect(te.form).toBe('行って')
    expect(te.wrong).toContain('行いて')
    // 来る 按读音出
    expect(course.forms!['v:nai'].examples.find((e) => e.base === '来る')?.form).toBe('こない')
    expect(course.forms!['an:adj-past'].examples[0].form).toBe('静かだった')
  })

  it('每一课、每个单元测验都出得了题', () => {
    for (const r of allLessons(course)) {
      const qs = formLessonQuiz(course, r.lesson, { seed: 3 })
      expect(qs.length, r.lesson.id).toBeGreaterThan(0)
      qs.forEach((q) => checkChoices(course, q))
    }
    const qs = testQuiz(course, unitItems(course.units[0]), [], { seed: 5 })
    expect(qs.length).toBeGreaterThan(10)
  })
})

describe('日语的会话课', () => {
  const course = jaPhrasesCourse()

  it('四个单元八课，每句有读音、中英意思', () => {
    expect(course.units).toHaveLength(4)
    expect(allLessons(course)).toHaveLength(8)
    for (const ph of Object.values(course.phrases!)) {
      const m = ph.meaning as Record<string, string>
      expect(m.zh && m.en, ph.text).toBeTruthy()
      expect(ph.say?.text).toBeTruthy()
    }
  })

  it('每一课都出得了题，选项的意思、写法都不重复', () => {
    for (const r of allLessons(course)) {
      const qs = phraseLessonQuiz(course, r.lesson, poolUpTo(course, r.lesson.id), {
        seed: 7,
        listen: true
      })
      expect(qs).toHaveLength(r.lesson.items.length * 3)
      qs.forEach((q) => checkChoices(course, q))
    }
  })
})

describe('千语集语言的变形与会话（Aelith）', () => {
  const p = parseProject(
    readFileSync(resolve(__dirname, 'fixtures/qonlang/Aelith.laim.json'), 'utf8')
  )
  const lang = p.languages.find((l) => l.abbr === 'ae')!
  const labels = {
    forms: '变形',
    formsIntro: '',
    phrases: '会话',
    phrasesIntro: '',
    phrasesUnit: '短语',
    uncategorized: '其他'
  } as QonCourseLabels
  const pick = (t: Record<string, string>): string => t.zh || t.en || ''

  it('变形：按构形分单元、按单数 / 复数分课，干扰项是这个词别的形', () => {
    const course = qonFormsCourse(p, lang, new Set(), labels, { gloss: () => '', pick })
    expect(course.units.length).toBeGreaterThan(0)
    const noun = course.units.find((u) => u.lessons.some((l) => String(l.title).startsWith('单数')))
    expect(noun).toBeTruthy()
    const acc = Object.values(course.forms!).find((f) => f.title === '单数·宾格')!
    const kaso = acc.examples.find((e) => e.base === 'kaso')!
    expect(kaso.form).toBe('kasom')
    expect(kaso.wrong.length).toBe(3)
    for (const w of kaso.wrong)
      expect(
        Object.values(p.lexemes.find((l) => l.lemma === 'kaso')!.forms).map((f) => f.surface)
      ).toContain(w)
    for (const r of allLessons(course))
      formLessonQuiz(course, r.lesson, { seed: 2 }).forEach((q) => checkChoices(course, q))
  })

  it('会话：短语本按分类分课，读音是 IPA', () => {
    const course = qonPhrasesCourse(p, lang, new Set(), labels, { pick })
    const n = p.phrasebook.filter((x) => x.languageId === lang.id).length
    expect(Object.keys(course.phrases!)).toHaveLength(n)
    const cats = new Set(
      p.phrasebook.filter((x) => x.languageId === lang.id).map((x) => x.category)
    )
    expect(allLessons(course)).toHaveLength(cats.size)
    expect(Object.values(course.phrases!).every((ph) => ph.reading?.startsWith('/'))).toBe(true)
    for (const r of allLessons(course))
      phraseLessonQuiz(course, r.lesson, Object.keys(course.phrases!), { seed: 4 }).forEach((q) =>
        checkChoices(course, q)
      )
  })
})

// ── 用词典里真的 N5 / N4 词：每个形、每个词都变得出来，错形够三个 ──

const DB = resolve(__dirname, '../resources/data/ja/dict.sqlite')
const run = existsSync(DB) ? describe : describe.skip

run('词典里的词做变形课', () => {
  const dict = existsSync(DB) ? new JapaneseDict(DB) : (null as unknown as JapaneseDict)
  afterAll(() => dict?.close())

  it('N5 / N4 的词：变形表齐全', () => {
    const course = jaFormsCourse(dict.conjugables([5, 4]))
    expect(course.units.map((u) => u.lessons.length)).toEqual([9, 2])
    for (const f of Object.values(course.forms!)) {
      expect(f.examples.length, f.key).toBeGreaterThanOrEqual(6)
      for (const ex of f.examples) expect(ex.wrong.length, `${ex.base} ${f.key}`).toBe(3)
    }
  })
})
