import { describe, expect, it } from 'vitest'
import { dictionaryInflection } from '../../src/shared/ja/dictionary-inflection'
import type { EntryView, SenseView } from '../../src/shared/dict'
function entry(head: string, reading: string, pos: string[], only: string[] = []): EntryView {
  return { head, reading, senses: [{ pos, only } as SenseView] } as EntryView
}
describe('dictionary inflection follows actual JMdict classes', () => {
  it('keeps writing and changed kana reading for irregular 来る', () => {
    const rows = dictionaryInflection(entry('来る', 'くる', ['vk']))[0].rows
    expect(rows.find((row) => row.id === 'nai')).toMatchObject({
      text: '来ない',
      reading: 'こない'
    })
  })
  it('uses special 行く and いい rules rather than generic endings', () => {
    expect(
      dictionaryInflection(entry('行く', 'いく', ['v5k-s']))[0].rows.find((row) => row.id === 'te')
        ?.text
    ).toBe('行って')
    expect(
      dictionaryInflection(entry('いい', 'いい', ['adj-ix']))[0].rows.find(
        (row) => row.id === 'adj-neg'
      )?.text
    ).toBe('よくない')
  })
  it('adds する once for a licensed verbal noun, and never to an ordinary noun', () => {
    expect(dictionaryInflection(entry('勉強', 'べんきょう', ['n', 'vs']))[0].rows[0].text).toBe(
      '勉強します'
    )
    expect(dictionaryInflection(entry('勉強する', 'べんきょうする', ['vs']))[0].rows[0].text).toBe(
      '勉強します'
    )
    expect(dictionaryInflection(entry('猫', 'ねこ', ['n']))).toEqual([])
  })
  it('omits unsupported rare classes and senses restricted to a different spelling', () => {
    expect(dictionaryInflection(entry('問う', 'とう', ['v5u-s']))).toEqual([])
    expect(dictionaryInflection(entry('生', 'なま', ['adj-na'], ['せい']))).toEqual([])
  })
})
