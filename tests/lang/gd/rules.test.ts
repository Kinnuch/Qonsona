/**
 * 苏格兰盖尔语的规则：查词键、宽松键、切词、猜原形（去弱化、去 t- / h- 前缀、省音、词尾）。
 */
import { describe, expect, it } from 'vitest'
import gd from '../../../src/shared/lang/gd'
import { gdKey, gdLooseKey, lemmaCandidatesGd, tokenizeGd } from '../../../src/shared/lang/gd/rules'

const words = (text: string): string[] =>
  tokenizeGd(text)
    .filter((t) => t.kind === 'word')
    .map((t) => t.text)

const lemmas = (surface: string): string[] => lemmaCandidatesGd(surface).map((g) => g.lemma)

describe('查词键', () => {
  it('小写、NFC，旧拼写的锐音符换成重音符', () => {
    expect(gdKey('Bàta')).toBe('bàta')
    expect(gdKey('Dé')).toBe('dè')
    expect(gdKey('Mór')).toBe('mòr')
    expect(gdKey('ÓRAN')).toBe('òran')
    // 分解写的重音符（a + U+0300）也统一成一个字
    expect(gdKey('ba\u0300ta')).toBe('bàta')
  })
  it('撇号、连字符、空白统一', () => {
    expect(gdKey('’S')).toBe("'s")
    expect(gdKey('dh‘fhalbh')).toBe("dh'fhalbh")
    expect(gdKey('An T-Uisge')).toBe('an t-uisge')
    expect(gdKey('t\u2011uisge')).toBe('t-uisge')
    expect(gdKey('  tha   mi ')).toBe('tha mi')
  })
  it('规则里的 key 就是 gdKey', () => {
    expect(gd.rules.key('Gàidhlig')).toBe('gàidhlig')
  })
})

describe('宽松键', () => {
  it('去掉重音符', () => {
    expect(gdLooseKey('Gàidhlig')).toBe('gaidhlig')
    expect(gdLooseKey('Mór')).toBe(gdLooseKey('mòr'))
  })
  it('新旧拼写的连写、分写对得上', () => {
    expect(gdLooseKey('an-diugh')).toBe(gdLooseKey('an diugh'))
    expect(gdLooseKey('a-nis')).toBe(gdLooseKey('a nis'))
    expect(gdLooseKey("dh'fhalbh")).toBe(gdLooseKey("dh' fhalbh"))
  })
})

describe('切词', () => {
  it('段首尾相接覆盖全文', () => {
    const text = "'S e latha brèagha a th' ann, nach e? Dh'fhalbh i an-dè."
    const t = tokenizeGd(text)
    expect(t.map((x) => x.text).join('')).toBe(text)
    for (const x of t) expect(text.slice(x.start, x.end)).toBe(x.text)
  })
  it("撇号留在省音形里：a' 'S th' dh'", () => {
    expect(words("Tha mi a' dol dhachaigh.")).toEqual(['Tha', 'mi', "a'", 'dol', 'dhachaigh'])
    expect(words("'S e latha brèagha a th' ann.")).toEqual([
      "'S",
      'e',
      'latha',
      'brèagha',
      'a',
      "th'",
      'ann'
    ])
    expect(words("Dh'fhalbh i.")).toEqual(["Dh'fhalbh", 'i'])
    expect(words('m’ athair is d’ athair')).toEqual(['m’', 'athair', 'is', 'd’', 'athair'])
    expect(words("ars' esan")).toEqual(["ars'", 'esan'])
  })
  it('连字符前缀与复合词是一个词', () => {
    expect(words('Chaidh e a-steach dhan t-seòmar.')).toEqual([
      'Chaidh',
      'e',
      'a-steach',
      'dhan',
      't-seòmar'
    ])
    expect(words('na h-òrain aig a h-uile duine')).toEqual([
      'na',
      'h-òrain',
      'aig',
      'a',
      'h-uile',
      'duine'
    ])
  })
  it('引号不算进词', () => {
    const t = tokenizeGd('‘Tha,’ thuirt i, ‘math.’')
    expect(t.filter((x) => x.kind === 'word').map((x) => x.text)).toEqual([
      'Tha',
      'thuirt',
      'i',
      'math'
    ])
    expect(t.filter((x) => x.kind === 'punct').map((x) => x.text)).toEqual([
      '‘',
      ',',
      '’',
      ',',
      '‘',
      '.',
      '’'
    ])
  })
  it('数字、序数与年代', () => {
    const t = tokenizeGd('Anns na 1990an, air an 21mh latha, 3.5 not')
    expect(t.filter((x) => x.kind === 'num').map((x) => x.text)).toEqual(['1990an', '21mh', '3.5'])
  })
})

describe('猜原形', () => {
  it('去弱化：bhàta → bàta、fhuair → fuair、Shìne → sìne', () => {
    expect(lemmaCandidatesGd('bhàta')[0]).toEqual({ lemma: 'bàta', tags: ['lenition'] })
    expect(lemmas('fhuair')).toContain('fuair')
    expect(lemmas('Shìne')).toContain('sìne')
    expect(lemmas('thu')).toContain('tu')
  })
  it('sg sm sp st 和元音开头的不去弱化', () => {
    expect(lemmas('sgian')).not.toContain('sian')
    expect(lemmaCandidatesGd('òran').some((g) => g.tags.includes('lenition'))).toBe(false)
  })
  it('去掉 t- h- n- 前缀', () => {
    expect(lemmaCandidatesGd('t-uisge')[0]).toEqual({ lemma: 'uisge', tags: ['t-prothesis'] })
    expect(lemmaCandidatesGd('h-uile')[0]).toEqual({ lemma: 'uile', tags: ['h-prothesis'] })
    expect(lemmas('n-athair')).toContain('athair')
    // t- 加在 s 前面（an t-sràid）
    expect(lemmas('t-sràid')).toContain('sràid')
    // 前缀之后还是复数：na h-òrain → òrain → òran
    expect(lemmas('h-òrain')).toEqual(expect.arrayContaining(['òrain', 'òran']))
  })
  it("省音：dh'fhalbh → falbh、m'athair → athair、'S → is", () => {
    const g = lemmaCandidatesGd("dh'fhalbh")
    expect(g.map((x) => x.lemma)).toEqual(expect.arrayContaining(['fhalbh', 'falbh']))
    expect(g.find((x) => x.lemma === 'falbh')?.tags).toEqual(['elision', 'lenition'])
    expect(lemmas("m'athair")).toContain('athair')
    expect(lemmas("'S")).toEqual(expect.arrayContaining(['is', 'agus']))
    expect(lemmas("a'")).toEqual(['an', 'ag'])
    expect(lemmas("'n")).toContain('an')
    expect(lemmas("'ga")).toContain('ga')
  })
  it('强调后缀：chàr-sa → càr', () => {
    expect(lemmas('chàr-sa')).toEqual(expect.arrayContaining(['chàr', 'càr']))
  })
  it('动词词尾：òlaidh → òl、chuireadh → cuir、dh’òlainn → òl、cuiribh → cuir', () => {
    expect(lemmas('òlaidh')).toContain('òl')
    expect(lemmas('chuireadh')).toContain('cuir')
    expect(lemmas('dh’òlainn')).toContain('òl')
    expect(lemmas('cuiribh')).toContain('cuir')
    expect(lemmas('sheinneamaid')).toContain('seinn')
  })
  it('名词词尾与窄化：bàtaichean → bàta、balaich → balach、eilein → eilean、fir → fear', () => {
    expect(lemmas('bàtaichean')).toContain('bàta')
    expect(lemmas('sgoiltean')).toContain('sgoil')
    expect(lemmas('balaich')).toContain('balach')
    expect(lemmas('eilein')).toContain('eilean')
    expect(lemmas('fir')).toContain('fear')
    expect(lemmas('sràide')).toContain('sràid')
  })
  it('带前缀的复合词：ro-mhath → math', () => {
    expect(lemmas('ro-mhath')).toContain('math')
  })
  it('不把自己当原形，结果不重复', () => {
    for (const w of ['bhàta', "dh'fhalbh", 'balaich', 't-uisge']) {
      const l = lemmas(w)
      expect(l).not.toContain(gdKey(w))
      expect(new Set(l).size).toBe(l.length)
    }
  })
})
