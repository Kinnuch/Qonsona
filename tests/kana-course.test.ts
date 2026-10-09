/**
 * 五十音这门课：假名表齐全、罗马字对、平片对应、输入题认几种拼法、每一课都出得了题且选项不出岔子。
 */
import { describe, expect, it } from 'vitest'
import { kanaCourse, kanaTyped } from '$shared/ja/kana-course'
import { kanaToRomaji, kanaUnits } from '$shared/ja/kana'
import {
  allLessons,
  poolUpTo,
  symbolLessonQuiz,
  symbolTestQuiz,
  unitItems,
  type Question
} from '$shared/course'

const course = kanaCourse()
const unit = (id: string): string[] => unitItems(course.units.find((u) => u.id === id)!)

describe('假名表', () => {
  it('清音平假名、片假名各 46 个，浊音半浊音 25 个，拗音 33 个', () => {
    expect(unit('h1')).toHaveLength(46)
    expect(unit('k1')).toHaveLength(46)
    expect(unit('h2')).toHaveLength(25)
    expect(unit('h3')).toHaveLength(33)
    expect(unit('k3')).toHaveLength(33)
    expect(new Set(unit('h1')).size).toBe(46)
  })

  it('课的 id 不重复，课里的每个假名都有条目；只讲不考的只有 っ ー ッ', () => {
    const ids = allLessons(course).map((r) => r.lesson.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of allLessons(course))
      for (const k of r.lesson.items) expect(course.symbols[k], k).toBeTruthy()
    expect(
      Object.values(course.symbols)
        .filter((s) => s.learnOnly)
        .map((s) => s.key)
        .sort()
    ).toEqual(['っ', 'ッ', 'ー'].sort())
  })

  it('罗马字：黑本式；を 写 wo，ぢ づ 同 じ ず；外来语的拗音', () => {
    const r = (k: string): string => course.symbols[k].reading
    expect([r('し'), r('ち'), r('つ'), r('ふ'), r('を'), r('ん')]).toEqual([
      'shi',
      'chi',
      'tsu',
      'fu',
      'wo',
      'n'
    ])
    expect([r('きゃ'), r('しゃ'), r('ちゃ'), r('じゃ'), r('ぢ'), r('づ')]).toEqual([
      'kya',
      'sha',
      'cha',
      'ja',
      'ji',
      'zu'
    ])
    expect([r('ファ'), r('ティ'), r('トゥ'), r('デュ'), r('ヴ'), r('シェ')]).toEqual([
      'fa',
      'ti',
      'tu',
      'dyu',
      'vu',
      'she'
    ])
    expect(kanaToRomaji('フュ')).toBe('fyu')
  })

  it('平假名、片假名一一对应', () => {
    expect(course.symbols['か'].pair).toBe('カ')
    expect(course.symbols['カ'].pair).toBe('か')
    expect(course.symbols['きゃ'].pair).toBe('キャ')
    expect(course.symbols['ー'].pair).toBeUndefined()
  })

  it('长得像的互相记着；浊音跟清音、ば 跟 ぱ 也算', () => {
    expect(course.symbols['ぬ'].alike).toContain('め')
    expect(course.symbols['シ'].alike).toContain('ツ')
    expect(course.symbols['ば'].alike).toEqual(expect.arrayContaining(['は', 'ぱ']))
  })

  it('按拍切开：きゃ、ファ 算一拍', () => {
    expect(kanaUnits('きゃく')).toEqual(['きゃ', 'く'])
    expect(kanaUnits('ファイル')).toEqual(['ファ', 'イ', 'ル'])
    expect(kanaUnits('がっこう')).toEqual(['が', 'っ', 'こ', 'う'])
    expect(kanaUnits('コーヒー')).toEqual(['コ', 'ー', 'ヒ', 'ー'])
  })
})

describe('输入题', () => {
  it('黑本式、训令式都算；を 输入 o、ぢ 输入 di 也算', () => {
    const ok = (k: string, input: string): boolean => kanaTyped(course.symbols[k], input)
    expect(ok('し', 'shi') && ok('し', 'si') && ok('し', 'SHI ')).toBe(true)
    expect(ok('ち', 'ti') && ok('つ', 'tu') && ok('ふ', 'hu') && ok('じ', 'zi')).toBe(true)
    expect(ok('を', 'wo') && ok('を', 'o')).toBe(true)
    expect(ok('ぢ', 'ji') && ok('ぢ', 'di') && ok('ん', 'nn')).toBe(true)
    expect(ok('しゃ', 'sya') && ok('シャ', 'sha') && ok('ティ', 'ti')).toBe(true)
    expect(ok('し', 'chi') || ok('か', 'ga') || ok('ティ', 'chi')).toBe(false)
  })
})

describe('出题', () => {
  const checkChoices = (q: Question): void => {
    if (q.type === 'word') {
      const r = q.choices.map((w) => w.reading)
      expect(new Set(r).size, q.word.text).toBe(r.length)
      return
    }
    if (!('choices' in q)) return
    expect(q.choices).toContain(q.key)
    const readings = q.choices.map((k) => course.symbols[k].reading)
    expect(new Set(readings).size, `${q.key}: ${readings.join(' ')}`).toBe(readings.length)
    expect(q.choices.every((k) => !course.symbols[k].learnOnly)).toBe(true)
  }

  it('每一课都出得了题，选项里有答案、读音互不相同（じ ぢ 不同时出现）', () => {
    for (const r of allLessons(course)) {
      const qs = symbolLessonQuiz(course, r.lesson, poolUpTo(course, r.lesson.id), {
        seed: 11,
        listen: true
      })
      const quizzable = r.lesson.items.filter((k) => !course.symbols[k].learnOnly)
      expect(qs.length, r.lesson.id).toBe(quizzable.length * 3)
      qs.forEach(checkChoices)
    }
  })

  it('选字题优先拿长得像的当干扰项', () => {
    const lesson = allLessons(course).find((r) => r.lesson.id === 'h1-ma')!.lesson
    const qs = symbolLessonQuiz(course, lesson, poolUpTo(course, 'h1-ma'), { seed: 3 })
    const q = qs.find((x) => x.type === 'write' && x.key === 'め')!
    expect('choices' in q && q.choices).toContain('ぬ')
  })

  it('平假名清音的单元测验：46 个都考到', () => {
    const qs = symbolTestQuiz(course, unit('h1'), poolUpTo(course, 'h1-wa'), {
      seed: 9,
      max: 50,
      listen: true
    })
    expect(new Set(qs.map((q) => ('key' in q ? q.key : ''))).size).toBe(46)
    qs.forEach(checkChoices)
  })
})
