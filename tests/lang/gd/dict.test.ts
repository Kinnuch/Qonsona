/**
 * 盖尔语词典库（resources/data/gd/dict.sqlite，scripts/data/gd/build.ts 生成）用主进程的读库代码查：
 * 弱化形、t- / h- 前缀、省音、不规则动词的变位、介词代词、旧拼写都要找回原形。
 * 没有生成词典库时（比如只拉了代码）跳过。
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { LexDb } from '../../../src/main/lang/lexdb'

const file = join(__dirname, '../../../resources/data/gd/dict.sqlite')
const has = existsSync(file)
const db = has ? new LexDb('gd', file) : null
afterAll(() => db?.close())

/** 阅读器查一个词形，给原形 */
const lemma = (surface: string): string | undefined => db!.lookup(surface)?.lemma

describe.skipIf(!has)('盖尔语词典库：从变过的形式找回原形', () => {
  it('库是这门语言的、能读', () => {
    expect(db!.ok).toBe(true)
    expect(db!.status().entries).toBeGreaterThan(10000)
  })
  it('弱化形', () => {
    expect(lemma('bhàta')).toBe('bàta')
    expect(lemma('mhòr')).toBe('mòr')
    expect(lemma('Ghàidhlig')).toBe('Gàidhlig')
    expect(lemma('chù')).toBe('cù')
    expect(lemma('mhath')).toBe('math')
    expect(db!.lookup('bhàta')?.tags).toContain('lenition')
  })
  it('维基词典没列弱化形的词也能靠规则去弱化找回（gh + 元音、fh 不发音）', () => {
    expect(lemma('fhuil')).toBe('fuil')
    expect(lemma('ghaol')).toBe('gaol')
  })
  it('不规则动词：独立式、从属式、将来时、动名词', () => {
    expect(lemma('chunnaic')).toBe('faic')
    expect(lemma('faca')).toBe('faic')
    expect(lemma('chaidh')).toBe('rach')
    expect(lemma('deach')).toBe('rach')
    expect(lemma('robh')).toBe('bi')
    expect(lemma('bhith')).toBe('bi')
    expect(lemma('thàinig')).toBe('thig')
    expect(lemma('dol')).toBe('rach')
  })
  it('规则动词的过去式（弱化）与省音的 dh', () => {
    expect(lemma("dh'fhalbh")).toBe('falbh')
    expect(lemma('dh’òl')).toBe('òl')
    expect(lemma('chuir')).toBe('cuir')
  })
  it('介词代词与强调形', () => {
    expect(lemma('agam')).toBe('aig')
    expect(lemma('agamsa')).toBe('aig')
    expect(lemma('orm')).toBe('air')
    expect(lemma('leis')).toBe('le')
    expect(db!.lookup('agam')?.tags).toEqual(expect.arrayContaining(['first-person', 'singular']))
  })
  it('t- h- n- 前缀', () => {
    expect(lemma('t-uisge')).toBe('uisge')
    expect(lemma('h-uile')).toBe('uile')
    expect(lemma('h-òrain')).toBe('òran')
  })
  it('复数、属格与窄化', () => {
    expect(lemma('coin')).toBe('cù')
    expect(lemma('balaich')).toBe('balach')
    expect(lemma('bàtaichean')).toBe('bàta')
  })
  it('旧拼写（锐音符）与宽松键（不打重音符）', () => {
    expect(lemma('mór')).toBe('mòr')
    expect(lemma('Gaidhlig')).toBe('Gàidhlig')
  })
  it('多词说法里不单独成词的一段；旧拼写分写的副词', () => {
    expect(lemma('dheidhinn')).toBe('mu dheidhinn')
    expect(lemma('an diugh')).toBe('an-diugh')
    expect(lemma('a nis')).toBe('a-nis')
  })
  it('虚词认对：系词、否定小品词、冠词', () => {
    expect(lemma('Is')).toBe('is')
    expect(lemma('Bu')).toBe('is')
    expect(lemma('Cha')).toBe('cha')
    expect(lemma('na')).toBe('an')
    expect(db!.lookup('na')?.pos).toBe('det')
    expect(lemma('chan eil')).toBe('bi')
    expect(lemma('bhith')).toBe('bi')
  })
  it("短语查不到时不乱猜（anns a' 不能撞上 annsa）", () => {
    expect(db!.lookup("anns a'")).toBeNull()
    expect(db!.lookup('Is e')).toBeNull()
  })
  it('读音：原形用词条的 IPA，变形用 fi 里这个形的，没有就不注', () => {
    expect(db!.lookup('bàta')?.ipa).toBe('/ˈpaːʰt̪ə/')
    expect(db!.lookup('chù')?.ipa).toBe('/ˈxuː/')
    expect(db!.lookup('bhàta')?.ipa).toBeUndefined()
  })
  it('查词：英文、中文释义反查', () => {
    expect(
      db!
        .search('dog')
        .hits.slice(0, 5)
        .map((h) => h.w)
    ).toContain('cù')
    expect(db!.search('狗').hits.map((h) => h.w)).toContain('cù')
  })
  it('词条：分级、IPA、变形表、弱化形', () => {
    const hit = db!.search('bàta').hits[0]
    expect(hit.w).toBe('bàta')
    const e = db!.entry(hit.id)!
    expect(e.levels[0]?.levels[0]?.id).toMatch(/^[ABC][12]$/)
    expect(e.ipa.length).toBeGreaterThan(0)
    expect(e.forms.map((f) => f.form)).toEqual(expect.arrayContaining(['bhàta', 'bàtaichean']))
    expect(e.x.len).toBe('bhàta')
  })
})
