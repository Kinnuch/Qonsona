/**
 * 日语活用：各类动词、形容词变出来的形式对；错形不跟正确答案重；
 * 词典里 N5–N3 的动词、い形容词变出来的每个形，都能用 deinflect 还原回原形（有词典数据库时跑）。
 */
import { existsSync } from 'fs'
import { resolve } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  VERB_FORMS,
  classOf,
  conjugate,
  displayForm,
  formsOf,
  wrongForms,
  type Conjugable,
  type FormId
} from '$shared/ja/conjugate'
import { deinflect, type WordType } from '$shared/ja/deinflect'
import { JapaneseDict } from '../src/main/dict'

const w = (head: string, reading: string, pos: string[]): Conjugable => {
  const c = classOf(pos)!
  return { head, reading, cls: c.cls, ...(c.special && { special: c.special }) }
}
const forms = (x: Conjugable, list: FormId[]): string[] =>
  list.map((f) => conjugate(x, f)?.text ?? '?')

describe('动词', () => {
  it('五段：各段、音便', () => {
    const kaku = w('書く', 'かく', ['v5k'])
    expect(forms(kaku, VERB_FORMS)).toEqual([
      '書きます',
      '書きません',
      '書きました',
      '書かない',
      '書かなかった',
      '書いて',
      '書いた',
      '書ける',
      '書こう',
      '書けば',
      '書け',
      '書かれる',
      '書かせる'
    ])
    expect(forms(w('買う', 'かう', ['v5u']), ['nai', 'te', 'passive'])).toEqual([
      '買わない',
      '買って',
      '買われる'
    ])
    expect(forms(w('泳ぐ', 'およぐ', ['v5g']), ['te', 'ta'])).toEqual(['泳いで', '泳いだ'])
    expect(forms(w('話す', 'はなす', ['v5s']), ['te', 'masu'])).toEqual(['話して', '話します'])
    expect(forms(w('待つ', 'まつ', ['v5t']), ['te', 'nai'])).toEqual(['待って', '待たない'])
    expect(forms(w('死ぬ', 'しぬ', ['v5n']), ['te', 'ta'])).toEqual(['死んで', '死んだ'])
    expect(forms(w('遊ぶ', 'あそぶ', ['v5b']), ['te', 'volitional'])).toEqual(['遊んで', '遊ぼう'])
    expect(forms(w('読む', 'よむ', ['v5m']), ['te', 'ta'])).toEqual(['読んで', '読んだ'])
    expect(forms(w('帰る', 'かえる', ['v5r']), ['te', 'masu', 'nai'])).toEqual([
      '帰って',
      '帰ります',
      '帰らない'
    ])
  })

  it('例外：行く、ある、いらっしゃる、くれる', () => {
    expect(forms(w('行く', 'いく', ['v5k-s']), ['te', 'ta', 'masu'])).toEqual([
      '行って',
      '行った',
      '行きます'
    ])
    expect(forms(w('ある', 'ある', ['v5r-i']), ['nai', 'nakatta', 'masu'])).toEqual([
      'ない',
      'なかった',
      'あります'
    ])
    expect(forms(w('いらっしゃる', 'いらっしゃる', ['v5aru']), ['masu', 'imperative'])).toEqual([
      'いらっしゃいます',
      'いらっしゃい'
    ])
    expect(conjugate(w('くれる', 'くれる', ['v1-s']), 'imperative')?.text).toBe('くれ')
  })

  it('一段、する、来る', () => {
    expect(forms(w('食べる', 'たべる', ['v1']), VERB_FORMS)).toEqual([
      '食べます',
      '食べません',
      '食べました',
      '食べない',
      '食べなかった',
      '食べて',
      '食べた',
      '食べられる',
      '食べよう',
      '食べれば',
      '食べろ',
      '食べられる',
      '食べさせる'
    ])
    const benkyou = w('勉強する', 'べんきょうする', ['n', 'vs'])
    expect(benkyou.cls).toBe('vs')
    expect(forms(benkyou, ['masu', 'te', 'potential', 'ba'])).toEqual([
      '勉強します',
      '勉強して',
      '勉強できる',
      '勉強すれば'
    ])
    const kuru = w('来る', 'くる', ['vk'])
    expect(forms(kuru, ['masu', 'nai', 'te', 'volitional', 'ba', 'imperative'])).toEqual([
      '来ます',
      '来ない',
      '来て',
      '来よう',
      '来れば',
      '来い'
    ])
    // 来る 的读音跟着变，选择题按读音出
    expect(conjugate(kuru, 'nai')?.reading).toBe('こない')
    expect(displayForm(kuru, conjugate(kuru, 'masu')!)).toBe('きます')
  })
})

describe('形容词', () => {
  it('い形容词、いい / 良い、な形容词', () => {
    const adj: FormId[] = ['adj-neg', 'adj-past', 'adj-negpast', 'adj-te']
    expect(forms(w('高い', 'たかい', ['adj-i']), adj)).toEqual([
      '高くない',
      '高かった',
      '高くなかった',
      '高くて'
    ])
    expect(forms(w('いい', 'いい', ['adj-ix']), ['adj-neg', 'adj-past'])).toEqual([
      'よくない',
      'よかった'
    ])
    const yoi = w('良い', 'よい', ['adj-ix'])
    expect(conjugate(yoi, 'adj-past')).toEqual({ text: '良かった', reading: 'よかった' })
    expect(forms(w('静か', 'しずか', ['adj-na']), adj)).toEqual([
      '静かではない',
      '静かだった',
      '静かではなかった',
      '静かで'
    ])
    expect(formsOf('adj-na')).not.toContain('te')
  })
})

describe('错形', () => {
  it('常见的错：書って、書きて、食べって、高いだった；不跟正确答案重', () => {
    const kaku = w('書く', 'かく', ['v5k'])
    expect(wrongForms(kaku, 'te').map((x) => x.text)).toEqual(
      expect.arrayContaining(['書って', '書きて'])
    )
    expect(wrongForms(w('食べる', 'たべる', ['v1']), 'te').map((x) => x.text)).toContain('食べって')
    expect(wrongForms(w('行く', 'いく', ['v5k-s']), 'te').map((x) => x.text)).toContain('行いて')
    expect(wrongForms(w('高い', 'たかい', ['adj-i']), 'adj-past').map((x) => x.text)).toContain(
      '高いだった'
    )
    for (const x of [kaku, w('食べる', 'たべる', ['v1']), w('来る', 'くる', ['vk'])])
      for (const f of VERB_FORMS) {
        const right = conjugate(x, f)!.reading
        const wrong = wrongForms(x, f).map((y) => y.reading)
        expect(wrong, `${x.head} ${f}`).toHaveLength(3)
        expect(wrong, `${x.head} ${f}`).not.toContain(right)
        expect(new Set(wrong).size).toBe(3)
      }
  })
})

// ── 词典里的词：变出来的每个形都能还原回原形 ──

const DB = resolve(__dirname, '../resources/data/ja/dict.sqlite')
const run = existsSync(DB) ? describe : describe.skip

const TYPE: Record<string, WordType> = { v5: 'v5', v1: 'v1', vk: 'vk', vs: 'vs', 'adj-i': 'adj-i' }

run('词典里的动词、形容词', () => {
  const dict = existsSync(DB) ? new JapaneseDict(DB) : (null as unknown as JapaneseDict)
  afterAll(() => dict?.close())

  it('N5–N3 的动词与い形容词：每个形都还原得回去', () => {
    const words = dict.conjugables([5, 4, 3]).filter((x) => x.cls !== 'adj-na')
    expect(words.length).toBeGreaterThan(500)
    const failed: string[] = []
    for (const x of words)
      for (const f of formsOf(x.cls)) {
        // 这几个的还原规则 deinflect 没收（ない 还原不出 ある；できる 是另一个词；くれ、いらっしゃい 的命令形）
        if (x.special === 'aru' && (f === 'nai' || f === 'nakatta')) continue
        if (
          x.special === 'aru-honorific' &&
          (f === 'masu' || f === 'masen' || f === 'mashita' || f === 'imperative')
        )
          continue
        if (x.special === 'kureru' && f === 'imperative') continue
        if (x.cls === 'vs' && f === 'potential') continue
        const c = conjugate(x, f)
        if (!c) {
          failed.push(`${x.head} ${f}: 变不出来`)
          continue
        }
        const ok = deinflect(c.text).some(
          (d) =>
            (d.word === x.head || (x.special === 'ii' && /よい$/.test(d.word))) &&
            d.type === TYPE[x.cls]
        )
        if (!ok) failed.push(`${x.head} ${f}: ${c.text}`)
      }
    expect(failed).toEqual([])
  })
})
