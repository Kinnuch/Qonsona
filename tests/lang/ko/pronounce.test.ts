/**
 * 标准发音（표준 발음법）与国语罗马字：例词多取自《标准发音法》与《罗马字表记法》的说明。
 * 跟한국어기초사전 4.6 万个词的发音整体比对见 docs/lang/ko.md（一致约 95%，差的多是要看词素的紧音化、ㄴ 添加）。
 */
import { describe, expect, it } from 'vitest'
import {
  pronounce,
  romanize,
  romanizeFromPronunciation
} from '../../../src/shared/lang/ko/pronounce'

const cases: [string, string][] = [
  // 连音
  ['한국어', '한구거'],
  ['읽어', '일거'],
  ['값이', '갑씨'],
  ['앉아', '안자'],
  // ㅎ 脱落、送气化
  ['좋아', '조아'],
  ['많아', '마나'],
  ['싫어', '시러'],
  ['좋고', '조코'],
  ['않다', '안타'],
  ['축하', '추카'],
  ['입학', '이팍'],
  ['앉히다', '안치다'],
  ['밝히다', '발키다'],
  ['놓는', '논는'],
  ['좋소', '조쏘'],
  // 腭化
  ['같이', '가치'],
  ['굳이', '구지'],
  ['해돋이', '해도지'],
  ['닫히다', '다치다'],
  // 鼻音化
  ['먹는다', '멍는다'],
  ['합니다', '함니다'],
  ['백마', '뱅마'],
  ['국립', '궁닙'],
  ['종로', '종노'],
  ['심리', '심니'],
  // 流音化
  ['신라', '실라'],
  ['설날', '설랄'],
  ['뚫는', '뚤른'],
  // 紧音化
  ['학교', '학꾜'],
  ['듣다', '듣따'],
  ['밟다', '밥따'],
  ['넓다', '널따'],
  ['젊다', '점따'],
  ['없어요', '업써요'],
  ['할게요', '할께요'],
  // 收音中和、双收音
  ['옷', '옫'],
  ['부엌', '부억'],
  ['닭', '닥'],
  ['삶', '삼'],
  ['밖에', '바께'],
  // 元音
  ['희망', '히망'],
  ['무늬', '무니'],
  ['가져', '가저'],
  ['의사', '의사']
]

describe('标准发音', () => {
  it.each(cases)('%s → [%s]', (w, p) => expect(pronounce(w)).toBe(p))
  it('词干信息：词干末 ㄴ/ㅁ 后的词尾读紧音、ㄺ 在 ㄱ 前读 ㄹ', () => {
    expect(pronounce('신고', { stemEnd: 0 })).toBe('신꼬')
    expect(pronounce('신고')).toBe('신고') // 名词「申告」不变
    expect(pronounce('맑게', { stemEnd: 0 })).toBe('말께')
    expect(pronounce('감다', { stemEnd: 0 })).toBe('감따')
  })
  it('汉字词 ㄹ 后的 ㄷ、ㅅ、ㅈ 读紧音', () => {
    expect(pronounce('갈등', { sino: true })).toBe('갈뜽')
    expect(pronounce('발전', { sino: true })).toBe('발쩐')
    expect(pronounce('결정하다', { sino: 2 })).toBe('결쩡하다')
    expect(pronounce('갈등')).toBe('갈등')
  })
  it('不是韩文的字原样留着，语节之间不连读', () => {
    expect(pronounce('밥 먹어요!')).toBe('밥 머거요!')
    expect(pronounce('K팝을 좋아해요')).toBe('K파블 조아해요')
  })
})

describe('国语罗马字', () => {
  it.each([
    ['먹는다', 'meongneunda'],
    ['같이', 'gachi'],
    ['신라', 'silla'],
    ['학교', 'hakgyo'],
    ['좋고', 'joko'],
    ['종로', 'jongno'],
    ['왕십리', 'wangsimni'],
    ['별내', 'byeollae'],
    ['압구정', 'apgujeong'],
    ['낙동강', 'nakdonggang'],
    ['해돋이', 'haedoji'],
    ['울산', 'ulsan'],
    ['한국어', 'hangugeo'],
    ['감사합니다', 'gamsahamnida'],
    ['안녕하세요', 'annyeonghaseyo'],
    ['의사', 'uisa'],
    ['희망', 'huimang'],
    ['가져', 'gajyeo']
  ])('%s → %s', (w, r) => expect(romanize(w)).toBe(r))
  it('体词里 ㄱ、ㄷ、ㅂ 后的 ㅎ 照写', () => {
    expect(romanize('묵호', { noun: true })).toBe('mukho')
    expect(romanize('집현전', { noun: true })).toBe('jiphyeonjeon')
    expect(romanize('축하')).toBe('chuka')
  })
  it('按词典给的发音：规则推不出的 ㄴ 添加也对，紧音不标', () => {
    expect(romanizeFromPronunciation('솜이불', '솜니불')).toBe('somnibul')
    expect(romanizeFromPronunciation('학교', '학꾜')).toBe('hakgyo')
    expect(romanizeFromPronunciation('신라', '실라')).toBe('silla')
    // 音节数对不上时按写法自己推
    expect(romanizeFromPronunciation('학교', '학')).toBe('hakgyo')
  })
})
