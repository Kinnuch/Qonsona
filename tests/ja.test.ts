import { describe, expect, it } from 'vitest'
import { deinflect, typeMatchesPos, type WordType } from '../src/shared/ja/deinflect'
import { romajiToHiragana, toHiragana, toKatakana, isRomaji } from '../src/shared/ja/kana'

/** 还原结果里有没有「这个词、这个词类」 */
function has(input: string, base: string, type: WordType): boolean {
  return deinflect(input).some((d) => d.word === base && d.type === type)
}

describe('词形还原', () => {
  const cases: [string, string, WordType][] = [
    ['食べた', '食べる', 'v1'],
    ['たべた', 'たべる', 'v1'],
    ['食べさせられなかった', '食べる', 'v1'],
    ['食べている', '食べる', 'v1'],
    ['食べてる', '食べる', 'v1'],
    ['食べちゃった', '食べる', 'v1'],
    ['食べれば', '食べる', 'v1'],
    ['食べよう', '食べる', 'v1'],
    ['食べれる', '食べる', 'v1'],
    ['書いた', '書く', 'v5'],
    ['泳いだ', '泳ぐ', 'v5'],
    ['話した', '話す', 'v5'],
    ['待った', '待つ', 'v5'],
    ['死んだ', '死ぬ', 'v5'],
    ['遊んだ', '遊ぶ', 'v5'],
    ['読んでいます', '読む', 'v5'],
    ['読める', '読む', 'v5'],
    ['書かせられる', '書く', 'v5'],
    ['書けば', '書く', 'v5'],
    ['行った', '行く', 'v5'],
    ['行って', '行く', 'v5'],
    ['行こう', '行く', 'v5'],
    ['飲みたかった', '飲む', 'v5'],
    ['飲みません', '飲む', 'v5'],
    ['飲みませんでした', '飲む', 'v5'],
    ['来なかった', '来る', 'vk'],
    ['こなかった', 'くる', 'vk'],
    ['来ます', '来る', 'vk'],
    ['きた', 'くる', 'vk'],
    ['した', 'する', 'vs'],
    ['させられた', 'する', 'vs'],
    ['勉強した', '勉強', 'vs-n'],
    ['勉強しています', '勉強', 'vs-n'],
    ['高くなかった', '高い', 'adj-i'],
    ['高くて', '高い', 'adj-i'],
    ['寒さ', '寒い', 'adj-i'],
    ['良かった', '良い', 'adj-i'],
    ['高くなった', '高い', 'adj-i']
  ]
  for (const [input, base, type] of cases)
    it(`${input} → ${base}（${type}）`, () => expect(has(input, base, type)).toBe(true))

  it('原样也在结果里，类型为空', () => {
    expect(deinflect('食べる')[0]).toEqual({ word: '食べる', type: null, reasons: [] })
  })

  it('记下经过的变形，原形在前', () => {
    const d = deinflect('食べなかった').find((x) => x.word === '食べる')!
    expect(d.reasons).toEqual(['negative', 'past'])
  })

  it('不会还原出空词', () => {
    expect(deinflect('る').every((d) => d.word.length > 0)).toBe(true)
  })

  it('词性对不上的不算', () => {
    expect(typeMatchesPos('v1', ['v5r'])).toBe(false)
    expect(typeMatchesPos('v5', ['v5r', 'vi'])).toBe(true)
    expect(typeMatchesPos('adj-i', ['n'])).toBe(false)
    expect(typeMatchesPos('vs-n', ['n', 'vs'])).toBe(true)
    expect(typeMatchesPos('te', ['v1'])).toBe(false)
    expect(typeMatchesPos(null, ['n'])).toBe(true)
  })
})

describe('罗马字与假名', () => {
  const cases: [string, string][] = [
    ['taberu', 'たべる'],
    ['tabemasu', 'たべます'],
    ['gakkou', 'がっこう'],
    ['gakkō', 'がっこう'],
    ['shinbun', 'しんぶん'],
    ['sinbun', 'しんぶん'],
    ["kon'ya", 'こんや'],
    ['konnichiwa', 'こんにちわ'],
    ['shinnbun', 'しんぶん'],
    ['chotto', 'ちょっと'],
    ['matcha', 'まっちゃ'],
    ['tsukue', 'つくえ'],
    ['tukue', 'つくえ'],
    ['kyou', 'きょう'],
    ['onna', 'おんな'],
    ['hon', 'ほん'],
    ['fujisan', 'ふじさん'],
    ['jyuu', 'じゅう'],
    ['wo', 'を'],
    ['ramen', 'らめん']
  ]
  for (const [r, k] of cases) it(`${r} → ${k}`, () => expect(romajiToHiragana(r)).toBe(k))

  it('平假名与片假名互换', () => {
    expect(toKatakana('てーぶる')).toBe('テーブル')
    expect(toHiragana('テーブル')).toBe('てーぶる')
  })

  it('认得出罗马字', () => {
    expect(isRomaji('taberu')).toBe(true)
    expect(isRomaji("kon'ya")).toBe(true)
    expect(isRomaji('食べる')).toBe(false)
    expect(isRomaji('to eat')).toBe(true)
  })
})
