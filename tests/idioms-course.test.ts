/**
 * 惯用语课（惯用句、谚语、四字熟语）：结构对（键不重复、每课 5～7 条、中英意思齐全、读音只有假名），
 * 每一课、每个单元测验都出得了题；有词典数据库时，每条的写法、读音都对得上 JMdict 的同一个词条。
 */
import { existsSync } from 'fs'
import { resolve } from 'path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import { jaIdiomsCourse } from '$shared/ja/idioms-course'
import {
  allLessons,
  phraseLessonQuiz,
  poolUpTo,
  testQuiz,
  unitItems,
  type Course,
  type PhraseItem,
  type Question
} from '$shared/course'

const course = jaIdiomsCourse()
const phrases = Object.values(course.phrases ?? {})
const both = (t: unknown) => t as Record<string, string>
const readingOf = (ph: PhraseItem) => ph.reading ?? ph.text

/** 会话题：答案在选项里，选项的键、显示出来的写法或意思都不重复 */
function checkChoices(c: Course, q: Question) {
  expect(q.type).toBe('phrase')
  if (q.type !== 'phrase') return
  expect(q.choices).toContain(q.key)
  expect(q.choices.length).toBeGreaterThanOrEqual(2)
  expect(new Set(q.choices).size).toBe(q.choices.length)
  const shown = q.choices.map((k) =>
    q.mode === 'meaning' ? JSON.stringify(c.phrases![k].meaning) : c.phrases![k].text
  )
  expect(new Set(shown).size, shown.join(' / ')).toBe(shown.length)
}

describe('惯用语课的结构', () => {
  it('会话类的课：四个单元，每单元 4～6 课，每课 5～7 条，一共 100～140 条', () => {
    expect(course.id).toBe('idioms')
    expect(course.kind).toBe('phrases')
    expect(course.units).toHaveLength(4)
    for (const u of course.units) {
      expect(u.lessons.length, u.id).toBeGreaterThanOrEqual(4)
      expect(u.lessons.length, u.id).toBeLessThanOrEqual(6)
      expect(u.test).toBe(true)
    }
    for (const { lesson } of allLessons(course)) {
      expect(lesson.items.length, lesson.id).toBeGreaterThanOrEqual(5)
      expect(lesson.items.length, lesson.id).toBeLessThanOrEqual(7)
    }
    expect(phrases.length).toBeGreaterThanOrEqual(100)
    expect(phrases.length).toBeLessThanOrEqual(140)
  })

  it('键、课 id 不重复，每课的条目都在短语表里', () => {
    const keys = allLessons(course).flatMap((r) => r.lesson.items)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(phrases.length)
    for (const k of keys) expect(course.phrases![k]?.key).toBe(k)
    const ids = allLessons(course).map((r) => r.lesson.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('写法不重复，中文意思、英文意思也各不重复', () => {
    for (const pick of [
      (ph: PhraseItem) => ph.text,
      (ph: PhraseItem) => both(ph.meaning).zh,
      (ph: PhraseItem) => both(ph.meaning).en
    ]) {
      const all = phrases.map(pick)
      const dup = all.filter((x, i) => all.indexOf(x) !== i)
      expect(dup).toEqual([])
    }
  })

  it('每条有中英意思；读音只有假名，朗读读的就是它', () => {
    for (const ph of phrases) {
      const m = both(ph.meaning)
      expect(m.zh?.trim(), ph.text).toBeTruthy()
      expect(m.en?.trim(), ph.text).toBeTruthy()
      expect(m.zh).toBe(m.zh.trim())
      expect(m.en).toBe(m.en.trim())
      expect(readingOf(ph), ph.text).toMatch(/^[ぁ-ゖー]+$/)
      expect(ph.say).toEqual({ text: readingOf(ph), lang: 'ja-JP' })
    }
  })

  it('说明、单元与课的标题中英文都有', () => {
    for (const ph of phrases)
      if (ph.note) {
        const n = both(ph.note)
        expect(n.zh && n.en, ph.text).toBeTruthy()
      }
    for (const u of course.units) {
      expect(both(u.title).zh && both(u.title).en, u.id).toBeTruthy()
      for (const l of u.lessons) expect(both(l.title).zh && both(l.title).en, l.id).toBeTruthy()
    }
    expect(both(course.intro).zh && both(course.intro).en).toBeTruthy()
  })
})

describe('惯用语课出题', () => {
  it('每一课：每条考看短语选意思、看意思选短语、听音选短语各一道，选项不重复', () => {
    for (const { lesson } of allLessons(course)) {
      const qs = phraseLessonQuiz(course, lesson, poolUpTo(course, lesson.id), {
        seed: 13,
        listen: true
      })
      expect(qs, lesson.id).toHaveLength(lesson.items.length * 3)
      for (const k of lesson.items) {
        const modes = qs.filter((q) => q.type === 'phrase' && q.key === k)
        expect(modes.map((q) => (q.type === 'phrase' ? q.mode : '')).sort(), k).toEqual([
          'listen',
          'meaning',
          'pick'
        ])
      }
      qs.forEach((q) => checkChoices(course, q))
    }
  })

  it('不能出声时每条考两道（不出听音题）', () => {
    for (const { lesson } of allLessons(course)) {
      const qs = phraseLessonQuiz(course, lesson, poolUpTo(course, lesson.id), { seed: 5 })
      expect(qs, lesson.id).toHaveLength(lesson.items.length * 2)
      expect(qs.some((q) => q.type === 'phrase' && q.mode === 'listen')).toBe(false)
      qs.forEach((q) => checkChoices(course, q))
    }
  })

  it('单元测验：每条一道，选项不重复', () => {
    for (const u of course.units) {
      const keys = unitItems(u)
      const pool = poolUpTo(course, u.lessons[u.lessons.length - 1].id)
      const qs = testQuiz(course, keys, pool, { seed: 9, listen: true })
      expect(qs, u.id).toHaveLength(Math.min(keys.length, 40))
      qs.forEach((q) => checkChoices(course, q))
    }
  })
})

// ── 词典里查得到：写法在 form 表里，读音是同一个词条的假名写法 ──

const DB = resolve(__dirname, '../resources/data/ja/dict.sqlite')
const run = existsSync(DB) ? describe : describe.skip

run('惯用语在词典里查得到', () => {
  const db = existsSync(DB) ? new DatabaseSync(DB, { readOnly: true }) : null
  afterAll(() => db?.close())

  it('每条的写法、读音对得上同一个词条', () => {
    const hit = db!.prepare(
      `SELECT 1 FROM form w JOIN form r ON r.entry = w.entry
       WHERE w.text = ? AND r.text = ? AND r.kana = 1 LIMIT 1`
    )
    const missing = phrases
      .filter((ph) => !hit.get(ph.text, readingOf(ph)))
      .map((ph) => `${ph.text}（${readingOf(ph)}）`)
    expect(missing).toEqual([])
  })
})
