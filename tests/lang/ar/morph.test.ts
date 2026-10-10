/**
 * 阿拉伯语的构词：词根类型、派生式词型、按词根推词型（وَزْن）。
 */
import { describe, expect, it } from 'vitest'
import {
  CLS_NAMES,
  VERB_FORMS,
  rootTypes,
  samePattern,
  verbPattern,
  wazn
} from '../../../src/shared/lang/ar/morph'

describe('词根类型', () => {
  it('健全、带 hamza、叠音、首弱、中弱、尾弱、双弱、四母', () => {
    expect(rootTypes('ك ت ب')).toEqual(['sound'])
    expect(rootTypes('ء ك ل')).toEqual(['hamzated'])
    expect(rootTypes('م د د')).toEqual(['geminate'])
    expect(rootTypes('و ص ل')).toEqual(['assimilated'])
    expect(rootTypes('ق و ل')).toEqual(['hollow'])
    expect(rootTypes('ر م ي')).toEqual(['defective'])
    expect(rootTypes('و ق ي')).toEqual(['doubly-weak'])
    expect(rootTypes('ت ر ج م')).toEqual(['quadriliteral', 'sound'])
    for (const t of ['sound', 'hamzated', 'geminate', 'hollow', 'quadriliteral'])
      expect(CLS_NAMES[t]).toBeTruthy()
  })
})

describe('动词词型', () => {
  it('第一式按元音，别的按派生式', () => {
    expect(verbPattern('I', 'a~u')).toBe('فَعَلَ')
    expect(verbPattern('I', 'i~a')).toBe('فَعِلَ')
    expect(verbPattern('I', 'u~u')).toBe('فَعُلَ')
    expect(verbPattern('X')).toBe('اِسْتَفْعَلَ')
    expect(verbPattern('Iq')).toBe('فَعْلَلَ')
    for (const f of Object.keys(VERB_FORMS))
      expect(CLS_NAMES[`form-${f.toLowerCase()}`]).toBeTruthy()
  })
})

describe('按词根推词型', () => {
  const cases: [string, string, string][] = [
    ['كِتَاب', 'ك ت ب', 'فِعَال'],
    ['مَكْتَبَة', 'ك ت ب', 'مَفْعَلَة'],
    ['كَاتِب', 'ك ت ب', 'فَاعِل'],
    ['مَكْتُوب', 'ك ت ب', 'مَفْعُول'],
    ['اِسْتِخْدَام', 'خ د م', 'اِسْتِفْعَال'],
    ['مُدَرِّس', 'د ر س', 'مُفَعِّل'],
    ['تَتَبَّعَ', 'ت ب ع', 'تَفَعَّلَ'],
    ['اِسْتَسْلَمَ', 'س ل م', 'اِسْتَفْعَلَ'],
    ['مُسْلِم', 'س ل م', 'مُفْعِل'],
    ['مَمْنُوع', 'م ن ع', 'مَفْعُول'],
    ['اِكْتِتَاب', 'ك ت ب', 'اِفْتِعَال'],
    ['مُتَتَابِع', 'ت ب ع', 'مُتَفَاعِل'],
    ['قَوْل', 'ق و ل', 'فَعْل'],
    ['دَعْوَة', 'د ع و', 'فَعْلَة'],
    ['قُرْآن', 'ق ر ء', 'فُعْلَان'],
    ['آكِل', 'ء ك ل', 'فَاعِل'],
    ['سُؤَال', 'س ء ل', 'فُعَال'],
    ['تَرْجَمَة', 'ت ر ج م', 'فَعْلَلَة'],
    ['مُتَرْجِم', 'ت ر ج م', 'مُفَعْلِل']
  ]
  it.each(cases)('%s（%s）→ %s', (w, root, pattern) => expect(wazn(w, root)).toBe(pattern))
  it('推不准的不给', () => {
    expect(wazn('مَقُول', 'ق و ل')).toBeUndefined() // و 当长元音
    expect(wazn('قَائِل', 'ق و ل')).toBeUndefined() // 根字母 و 变成了 hamza
    expect(wazn('مَدّ', 'م د د')).toBeUndefined() // 叠音写成一个字母
    expect(wazn('كِتَابِيّ', 'ق ر ء')).toBeUndefined() // 根字母不在词里
    expect(wazn('الْكِتَاب الْأَحْمَر', 'ك ت ب')).toBeUndefined() // 词组
  })
  it('比较词型时不管格尾', () => {
    expect(samePattern('فِعَالٌ', 'فِعَال')).toBe(true)
    expect(samePattern('فَعَلَ', 'فَعِلَ')).toBe(false)
  })
})
