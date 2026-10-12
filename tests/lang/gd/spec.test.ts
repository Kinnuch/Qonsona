/**
 * 苏格兰盖尔语的学习包描述：分级、真实能力开关与系统语音的区别。
 */
import { describe, expect, it } from 'vitest'
import gd from '../../../src/shared/lang/gd'
import { primarySystem } from '../../../src/shared/lang/levels'
import { langModule } from '../../../src/shared/lang/registry'

describe('盖尔语的学习包描述', () => {
  const { spec } = gd
  it('在框架里登记了', () => {
    expect(langModule('gd')?.spec.code).toBe('gd')
    expect(spec.nativeName).toBe('Gàidhlig')
    expect(spec.direction).toBe('ltr')
  })
  it('主分级是 CEFR 六级，每级都有中英说明', () => {
    const p = primarySystem(spec.levelSystems)
    expect(p.id).toBe('cefr')
    expect(p.kind).toBe('proficiency')
    expect(p.levels.map((l) => l.id)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    for (const l of p.levels) {
      expect(l.desc?.zh).toBeTruthy()
      expect(l.desc?.en).toBeTruthy()
    }
    expect(p.sources.map((s) => s.id)).toEqual(
      expect.arrayContaining(['cefr', 'clag', 'gd-grading'])
    )
  })
  it('SQA 等级只作说明，不是主分级，各级都对到 CEFR', () => {
    const sqa = spec.levelSystems.find((s) => s.id === 'sqa')
    expect(sqa?.primary).toBeFalsy()
    for (const l of sqa?.levels ?? []) expect(sqa?.cefr?.[l.id]).toMatch(/^[ABC][12]$/)
  })
  it('学习模块已接入；注音用 IPA，录音可用而系统语音为空', () => {
    const f = spec.features
    expect(f.lexicon).toBe(true)
    for (const k of [
      'texts',
      'grammar',
      'inflection',
      'phrasebook',
      'idioms',
      'stories',
      'media',
      'exam'
    ] as const)
      expect(f[k]).toBe(true)
    expect(f.alphabet).toBe('phonics')
    expect(f.characters).toBeNull()
    expect(f.ruby).toBe('ipa')
    expect(f.romanization).toBe(false)
    expect(f.speech).toBeNull()
  })
})
