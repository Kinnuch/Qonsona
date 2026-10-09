/**
 * 苏格兰盖尔语的词首音变：弱化、去弱化、t- / h- / n- 前缀、省音、强调后缀、去窄化、宽窄拼写规则。
 */
import { describe, expect, it } from 'vitest'
import {
  broadSlenderClashes,
  broadenings,
  canLenite,
  delenite,
  lenite,
  looksLenited,
  stripElision,
  stripEmphatic,
  stripProthesis
} from '../../../src/shared/lang/gd/mutation'

describe('弱化', () => {
  it('b c d f g m p s t 后面加 h', () => {
    expect(lenite('bàta')).toBe('bhàta')
    expect(lenite('cù')).toBe('chù')
    expect(lenite('dorus')).toBe('dhorus')
    expect(lenite('fuil')).toBe('fhuil')
    expect(lenite('gaol')).toBe('ghaol')
    expect(lenite('màthair')).toBe('mhàthair')
    expect(lenite('peann')).toBe('pheann')
    expect(lenite('sùil')).toBe('shùil')
    expect(lenite('taigh')).toBe('thaigh')
  })
  it('保留大小写', () => {
    expect(lenite('Màiri')).toBe('Mhàiri')
    expect(lenite('BÀTA')).toBe('BHÀTA')
  })
  it('s 后面是 l n r 也弱化，sg sm sp st 不弱化', () => {
    expect(lenite('sràid')).toBe('shràid')
    expect(lenite('slàn')).toBe('shlàn')
    expect(lenite('sgian')).toBe('sgian')
    expect(lenite('sporan')).toBe('sporan')
    expect(lenite('stòr')).toBe('stòr')
  })
  it('l n r、元音开头、已经弱化的不变', () => {
    expect(canLenite('loch')).toBe(false)
    expect(canLenite('nighean')).toBe(false)
    expect(canLenite('ròd')).toBe(false)
    expect(lenite('òran')).toBe('òran')
    expect(lenite('bhàta')).toBe('bhàta')
    // 带前缀、省音的不是一个词首
    expect(lenite('t-uisge')).toBe('t-uisge')
    expect(canLenite("b'e")).toBe(false)
  })
  it('去弱化', () => {
    expect(delenite('bhàta')).toBe('bàta')
    expect(delenite('fhuair')).toBe('fuair')
    expect(delenite('Shìne')).toBe('Sìne')
    expect(delenite('bàta')).toBeNull()
    expect(looksLenited('thu')).toBe(true)
    expect(looksLenited('lha')).toBe(false)
  })
})

describe('前缀、省音、强调后缀', () => {
  it('t- h- n-', () => {
    expect(stripProthesis('t-uisge')).toEqual({ prefix: 't', rest: 'uisge' })
    expect(stripProthesis('h-Alba')).toEqual({ prefix: 'h', rest: 'Alba' })
    expect(stripProthesis('n-athair')).toEqual({ prefix: 'n', rest: 'athair' })
    expect(stripProthesis('a-nis')).toBeNull()
    expect(stripProthesis('uisge')).toBeNull()
  })
  it("dh' m' d' b'", () => {
    expect(stripElision("dh'fhalbh")).toEqual({ full: 'do', rest: 'fhalbh' })
    expect(stripElision('m’athair')).toEqual({ full: 'mo', rest: 'athair' })
    expect(stripElision("b'fheàrr")).toEqual({ full: 'bu', rest: 'fheàrr' })
    expect(stripElision('dhachaigh')).toBeNull()
  })
  it('带连字符的强调后缀', () => {
    expect(stripEmphatic('càr-sa')).toBe('càr')
    expect(stripEmphatic('taigh-san')).toBe('taigh')
    expect(stripEmphatic('agamsa')).toBeNull()
  })
})

describe('窄化与拼写规则', () => {
  it('去窄化的几种猜法', () => {
    expect(broadenings('balaich')).toContain('balach')
    expect(broadenings('cait')).toContain('cat')
    expect(broadenings('eilein')).toContain('eilean')
    expect(broadenings('fir')).toContain('fear')
    expect(broadenings('eòin')).toContain('eun')
    expect(broadenings('èisg')).toContain('iasg')
    expect(broadenings('bàta')).toEqual([])
  })
  it('宽对宽、窄对窄', () => {
    expect(broadSlenderClashes('Gàidhlig')).toEqual([])
    expect(broadSlenderClashes('balaich')).toEqual([])
    expect(broadSlenderClashes('ionnsachadh')).toEqual([])
    expect(broadSlenderClashes('telebhisean')).toEqual([])
    // esan 是公认的例外（e…a 夹着 s）
    expect(broadSlenderClashes('esan')).toHaveLength(1)
  })
})
