/**
 * 千语集语言的课：字母与读音、自造文字、文档都从项目数据推出来（Aelith、Tsahun、Merun 三种情况）。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { parseProject } from '$qon/core/serialize'
import type { Project } from '$qon/core/model'
import {
  chunks,
  qonAlphabetCourse,
  qonDocsCourse,
  qonSpellWords,
  segmenter,
  type QonCourseLabels
} from '$lib/courses/qonlang'
import { allLessons, poolUpTo, symbolLessonQuiz, unitItems } from '$shared/course'

const load = (name: string): Project =>
  parseProject(readFileSync(resolve(__dirname, 'fixtures/qonlang', name), 'utf8'))
const labels: QonCourseLabels = {
  alphabet: '字母',
  alphabetIntro: '',
  letters: '字母与发音',
  lettersNote: '',
  script: (n) => `文字：${n}`,
  scriptNote: '',
  docs: '语法',
  docsIntro: '',
  docsUnit: '文档'
}
const gloss = (): string => ''

describe('小工具', () => {
  it('平均分成每份不超过 6 个', () => {
    expect(chunks([...Array(16).keys()]).map((c) => c.length)).toEqual([6, 5, 5])
    expect(chunks([...Array(7).keys()]).map((c) => c.length)).toEqual([4, 3])
    expect(chunks([])).toEqual([])
  })

  it('按字母切开：ng 算一个，分隔符跳过', () => {
    const split = segmenter(['a', 'n', 'ng', 'g', 'o'])
    expect(split('Ngango')).toEqual(['ng', 'a', 'ng', 'o'])
    expect(split('an-go')).toEqual(['a', 'n', 'g', 'o'])
  })
})

describe('Aelith：字母表 + 一套字母文字', () => {
  const p = load('Aelith.laim.json')
  const lang = p.languages.find((l) => l.abbr === 'ae')!
  const course = qonAlphabetCourse(p, lang, labels)

  it('两个单元：字母与发音、Aelith 刻文', () => {
    expect(course.units.map((u) => u.title)).toEqual(['字母与发音', '文字：Aelith 刻文'])
  })

  it('字母的读音按正字法规则转成 IPA，元音在前', () => {
    const letters = course.units[0]
    const first = letters.lessons[0].items.map((k) => course.symbols[k].symbol)
    expect(first.every((x) => /^[aeiouöü]$/.test(x))).toBe(true)
    expect(course.symbols['l:ng'].reading).toBe('/ŋ/')
    expect(course.symbols['l:a'].say).toEqual({ ipa: 'a' })
    expect(course.symbols['l:a'].typeable).toBe(false)
    expect(unitItems(letters).length).toBe(lang.alphabet.length)
  })

  it('刻文：字形 → 转写，句读符号不学', () => {
    const glyphs = unitItems(course.units[1]).map((k) => course.symbols[k])
    expect(glyphs).toHaveLength(23)
    expect(glyphs.find((g) => g.symbol === 'ᚨ')?.reading).toBe('a')
    expect(glyphs.every((g) => g.scriptId === lang.scripts[0].id)).toBe(true)
    expect(glyphs.some((g) => g.reading === '.')).toBe(false)
  })

  it('每一课都出得了题', () => {
    for (const r of allLessons(course)) {
      const qs = symbolLessonQuiz(course, r.lesson, poolUpTo(course, r.lesson.id), {
        seed: 3,
        listen: true
      })
      expect(qs.length, r.lesson.id).toBeGreaterThan(0)
    }
  })

  it('拼读词只用学过的字母、用到这一课的字母', () => {
    const lessons = course.units[0].lessons
    const last = lessons[lessons.length - 1]
    const words = qonSpellWords(p, lang, course, poolUpTo(course, last.id), last.items, {
      gloss,
      hidden: new Set()
    })
    expect(words.length).toBeGreaterThan(0)
    const split = segmenter(lang.alphabet)
    const learned = new Set(poolUpTo(course, last.id).map((k) => k.slice(2)))
    for (const w of words)
      expect(
        split(w.text).every((x) => learned.has(x)),
        w.text
      ).toBe(true)
    // 自造文字的词：写出来的每个字形都学过
    const g = course.units[1].lessons
    const gl = g[g.length - 1]
    const glyphWords = qonSpellWords(p, lang, course, poolUpTo(course, gl.id), gl.items, {
      gloss,
      hidden: new Set()
    })
    const chars = new Set(poolUpTo(course, gl.id).map((k) => course.symbols[k].symbol))
    for (const w of glyphWords)
      expect(
        [...w.text].every((c) => chars.has(c)),
        w.text
      ).toBe(true)
  })

  it('文档：没指定语言的也算，藏起来的不算', () => {
    const docs = qonDocsCourse(p, lang, new Set(), labels)
    expect(docs.kind).toBe('docs')
    const n = p.docs.filter((d) => d.languageId === lang.id || d.languageId === null).length
    expect(allLessons(docs)).toHaveLength(n)
    const hidden = qonDocsCourse(p, lang, new Set([p.docs[0].id]), labels)
    expect(allLessons(hidden)).toHaveLength(n - 1)
  })
})

describe('Tsahun：音节文字按辅音分行，意音文字不进字母课', () => {
  const p = load('Tsahun.laim.json')
  const lang = p.languages[0]
  const course = qonAlphabetCourse(p, lang, labels)

  it('字母 + 音节文字两个单元（刻符是意音文字，不算）', () => {
    expect(course.units.map((u) => u.title)).toEqual(['字母与发音', '文字：Tsahun 音节文字'])
  })

  it('一行一课：a i u e o、pa pi pu pe po……；消音符不学', () => {
    const lessons = course.units[1].lessons.map((l) => l.title)
    expect(lessons[0]).toBe('a · i · u · e · o')
    expect(lessons[1]).toBe('pa · pi · pu · pe · po')
    expect(lessons).toContain('ts' + 'a · tsi · tsu · tse · tso')
    expect(unitItems(course.units[1])).toHaveLength(65)
  })
})

describe('Merun：没有自造文字，只有字母与发音', () => {
  it('一个单元', () => {
    const p = load('Aelith.laim.json')
    const lang = p.languages.find((l) => l.name === 'Merun')!
    const course = qonAlphabetCourse(p, lang, labels)
    expect(course.units.map((u) => u.id)).toEqual(['letters'])
    expect(unitItems(course.units[0]).length).toBeGreaterThan(10)
  })
})
