/**
 * 朗读 IPA 前的整理与报错解析（不起系统语音，只测纯函数）。
 */
import { describe, expect, it } from 'vitest'
import { invalidPhoneme, prepareIpa } from '../src/main/speech'

describe('按 IPA 读之前整理', () => {
  it('撇号、连字符在词里去掉，不算读不出', () => {
    expect(prepareIpa("ˈkin'en")).toEqual({ text: 'ˈkinen', dropped: [] })
    expect(prepareIpa('kin’en ‘ka’')).toEqual({ text: 'kinen ka', dropped: [] })
    expect(prepareIpa('ka-so')).toEqual({ text: 'kaso', dropped: [] })
  })

  it('别的标点当词界；两个字母之间的冒号当长音', () => {
    expect(prepareIpa('「kaso」, sen?')).toEqual({ text: 'kaso sen', dropped: [] })
    expect(prepareIpa('ka:so: sen')).toEqual({ text: 'kaːso sen', dropped: [] })
    expect(prepareIpa('(a/b) c·d | e')).toEqual({ text: 'a b c d e', dropped: [] })
  })

  it('IPA 自己的符号不动，声调字母照旧拿掉并记下', () => {
    expect(prepareIpa('ˈka.so ˌta‿ma kʼa t͡sa kaːso')).toEqual({
      text: 'ˈka.so ˌta‿ma kʼa t͡sa kaːso',
      dropped: []
    })
    expect(prepareIpa('ma˥˩ ma3')).toEqual({ text: 'ma ma', dropped: ['˥', '˩', '3'] })
  })
})

describe('从系统语音的报错里找出读不出的符号', () => {
  it('中文系统的报错，读不出的符号本身是引号也认得出', () => {
    expect(invalidPhoneme("音素“'”无效。", "kin'en")).toBe("'")
    expect(invalidPhoneme('音素“’”无效。', 'kin’en')).toBe('’')
    expect(invalidPhoneme('音素“」”无效。', 'kaso」')).toBe('」')
    expect(invalidPhoneme('音素“ã”无效。', 'kãso')).toBe('ã')
  })

  it('单引号的报错也认得出；不在内容里的、整段读音不算', () => {
    expect(invalidPhoneme("The phoneme ''' is not valid.", "kin'en")).toBe("'")
    expect(invalidPhoneme("Invalid phoneme 'ʕ'", 'ʕa')).toBe('ʕ')
    expect(invalidPhoneme("Invalid phoneme 'ʕ'", 'ka')).toBeNull()
    expect(invalidPhoneme("The pronunciation 'kin' is not valid", 'kin')).toBeNull()
    expect(invalidPhoneme('something went wrong', 'ka')).toBeNull()
  })
})
