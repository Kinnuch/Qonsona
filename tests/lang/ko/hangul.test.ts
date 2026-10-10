/**
 * 韩文字母的拆与合：音节 ↔ 初声中声终声、字母串 ↔ 文字（双收音拆成两个辅音）。
 */
import { describe, expect, it } from 'vitest'
import {
  compose,
  decompose,
  finalOf,
  fromJamo,
  hasFinal,
  isHangulWord,
  toJamo,
  withPart
} from '../../../src/shared/lang/ko/hangul'

describe('音节拆合', () => {
  it('拆成初声、中声、终声', () => {
    expect(decompose('한')).toEqual({ l: 'ㅎ', v: 'ㅏ', t: 'ㄴ' })
    expect(decompose('가')).toEqual({ l: 'ㄱ', v: 'ㅏ', t: '' })
    expect(decompose('읽')).toEqual({ l: 'ㅇ', v: 'ㅣ', t: 'ㄺ' })
    expect(decompose('a')).toBeNull()
    expect(decompose('ㄱ')).toBeNull()
  })
  it('合成音节', () => {
    expect(compose('ㅎ', 'ㅏ', 'ㄴ')).toBe('한')
    expect(compose('ㄱ', 'ㅏ')).toBe('가')
    expect(compose('ㅇ', 'ㅣ', 'ㄺ')).toBe('읽')
    expect(compose('ㄸ', 'ㅏ', 'ㄸ')).toBeNull() // ㄸ 不能当收音
  })
  it('所有音节拆了再合都回到原样', () => {
    for (let c = 0xac00; c <= 0xd7a3; c += 37) {
      const ch = String.fromCharCode(c)
      const s = decompose(ch)!
      expect(compose(s.l, s.v, s.t)).toBe(ch)
    }
  })
  it('收音、换部分', () => {
    expect(hasFinal('밥')).toBe(true)
    expect(hasFinal('바')).toBe(false)
    expect(finalOf('학교')).toBe('')
    expect(finalOf('한국')).toBe('ㄱ')
    expect(withPart('나', { t: 'ㄴ' })).toBe('난')
    expect(withPart('이', { v: 'ㅕ' })).toBe('여')
    expect(isHangulWord('한국어')).toBe(true)
    expect(isHangulWord('SNS에서')).toBe(false)
  })
})

describe('字母串', () => {
  it('文字 → 字母串：双收音拆开，无声的 ㅇ 照写', () => {
    expect(toJamo('먹었어요')).toBe('ㅁㅓㄱㅇㅓㅆㅇㅓㅇㅛ')
    expect(toJamo('읽다')).toBe('ㅇㅣㄹㄱㄷㅏ')
    expect(toJamo('값')).toBe('ㄱㅏㅂㅅ')
    expect(toJamo('K팝')).toBe('Kㅍㅏㅂ')
  })
  it('字母串 → 文字：辅音后面跟元音就是下一个音节的初声', () => {
    expect(fromJamo('ㅁㅓㄱㅇㅓㅆㅇㅓㅇㅛ')).toBe('먹었어요')
    expect(fromJamo('ㅇㅣㄹㄱㄷㅏ')).toBe('읽다')
    expect(fromJamo('ㅅㅏㄹㅁ')).toBe('삶')
    expect(fromJamo('ㄱㅏㅂㄴㅣㄷㅏ')).toBe('갑니다')
  })
  it('拼不成音节的给 null', () => {
    expect(fromJamo('ㅏㄱ')).toBeNull() // 元音打头
    expect(fromJamo('ㄱㅏㄹㄱㅅ')).toBeNull() // 三个辅音挤在一起
    expect(fromJamo('ㄱㅏㄷㄱ')).toBeNull() // ㄷㄱ 不是双收音
  })
  it('往返一致', () => {
    for (const w of ['한국어', '닭고기', '앉아서', '없었습니다', '괜찮아요', '읊조리다'])
      expect(fromJamo(toJamo(w))).toBe(w)
  })
})
