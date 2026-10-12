/**
 * 阿拉伯语学习包本身：能力开关、叫法（labels）、屏幕键盘。
 */
import { describe, expect, it } from 'vitest'
import ar from '../../../src/shared/lang/ar'
import { CLITICS, arKey } from '../../../src/shared/lang/ar/rules'
import { CLS_NAMES } from '../../../src/shared/lang/ar/morph'

describe('能力开关', () => {
  it('阶段二：阅读、语法、转写注音、词根页签', () => {
    const f = ar.spec.features
    expect(f.lexicon && f.texts && f.grammar).toBe(true)
    expect(f.ruby).toBe('romanization')
    expect(f.characters).toBe('roots')
    expect(ar.spec.direction).toBe('rtl')
  })
})

describe('叫法', () => {
  it('类别代号、附着词代号、x 字段都有中英文叫法', () => {
    for (const k of [...Object.keys(CLS_NAMES), ...Object.keys(CLITICS)]) {
      if (k === 'accusative') continue // 用通用的「宾格」
      expect(ar.labels[k]?.zh, k).toBeTruthy()
      expect(ar.labels[k]?.en, k).toBeTruthy()
    }
    expect(ar.labels['non-past'].zh).toBe('现在式')
    expect(ar.labels['conj-wa'].zh).toContain('وَ')
    expect(ar.labels['x.form'].zh).toBe('派生式')
    expect(ar.labels['x.vowels'].zh).toBeTruthy()
  })
})

describe('屏幕键盘', () => {
  it('28 个字母、hamza 的几种写法、ة ى、元音符号', () => {
    const keys = ar.keyboard.flat()
    const letters = [...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي']
    expect(letters).toHaveLength(28)
    for (const l of letters) expect(keys, l).toContain(l)
    for (const h of ['ء', 'أ', 'إ', 'آ', 'ؤ', 'ئ', 'ة', 'ى']) expect(keys, h).toContain(h)
    // 元音符号单独一行：每个键查词时都会被去掉（查词不看元音）
    const marks = ar.keyboard[ar.keyboard.length - 1]
    expect(marks.length).toBeGreaterThanOrEqual(8)
    for (const m of marks) expect(arKey('ب' + m)).toBe('ب')
    // 没有重复的键
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('新闻来源', () => {
  it('id 不重复、地址是 https、许可写清；开放许可的只有写明 CC / 公有领域的', () => {
    const news = ar.news ?? []
    expect(news.length).toBeGreaterThanOrEqual(15)
    expect(new Set(news.map((s) => s.id)).size).toBe(news.length)
    for (const s of news) {
      expect(s.url, s.id).toMatch(/^https:\/\//)
      expect(s.home, s.id).toMatch(/^https:\/\//)
      expect(s.licenseName, s.id).toBeTruthy()
      if (s.license === 'full') expect(s.licenseName, s.id).toMatch(/CC|公有领域/)
    }
    expect(news.some((s) => s.license === 'full')).toBe(true)
  })
})
