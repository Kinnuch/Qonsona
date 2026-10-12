/**
 * 韩语的查词键、宽松键（去空格、汉字转简体）、按语节切词、学习包描述（分级）。
 */
import { describe, expect, it } from 'vitest'
import ko from '../../../src/shared/lang/ko'
import { key, looseKey, tokenize } from '../../../src/shared/lang/ko/rules'
import { primarySystem } from '../../../src/shared/lang/levels'
import { toSimplified } from '../../../src/shared/lang/ko/t2s'

describe('查词键', () => {
  it('NFC、小写、空白并成一个；词缀词尾的连字符留着（宽松键去掉）', () => {
    expect(key('한국어')).toBe('한국어')
    expect(key('한국어'.normalize('NFD'))).toBe('한국어')
    expect(key('  눈이   높다 ')).toBe('눈이 높다')
    expect(key('-고')).toBe('-고')
    expect(key('가-')).toBe('가-')
    expect(looseKey('-고')).toBe('고')
    expect(key('SNS')).toBe('sns')
  })
  it('宽松键：去掉空格，汉字转简体', () => {
    expect(looseKey('한국 사람')).toBe(looseKey('한국사람'))
    expect(looseKey('學校')).toBe('学校')
    expect(looseKey('学校')).toBe('学校')
    expect(looseKey('敎育')).toBe('教育')
    expect(looseKey('靑年')).toBe('青年')
    expect(looseKey('계획')).toBe('계획')
  })
  it('繁简对照只管汉字', () => {
    expect(toSimplified('國語')).toBe('国语')
    expect(toSimplified('한국어')).toBe('한국어')
  })
})

describe('切词', () => {
  const words = (s: string): string[] =>
    tokenize(s)
      .filter((t) => t.kind === 'word')
      .map((t) => t.text)
  it('按语节切，助词词尾留在语节里', () => {
    expect(words('저는 학교에서 한국어를 공부했어요.')).toEqual([
      '저는',
      '학교에서',
      '한국어를',
      '공부했어요'
    ])
  })
  it('首尾相接覆盖全文', () => {
    const s = '“안녕하세요!” 그가 말했다… 10월 9일, 3,000원.'
    const t = tokenize(s)
    expect(t.map((x) => x.text).join('')).toBe(s)
    for (const x of t) expect(s.slice(x.start, x.end)).toBe(x.text)
  })
  it('数字单独成段，月份、量词好查', () => {
    const t = tokenize('2026년 10월 3,000원')
    expect(t.filter((x) => x.kind === 'num').map((x) => x.text)).toEqual(['2026', '10', '3,000'])
    expect(t.filter((x) => x.kind === 'word').map((x) => x.text)).toEqual(['년', '월', '원'])
  })
  it('拉丁字母之间的连字符、撇号算在词里；汉字、拉丁字母跟后面的助词连着', () => {
    expect(words('K-pop을 좋아해요')).toEqual(['K-pop을', '좋아해요'])
    expect(words('學校에 가요')).toEqual(['學校에', '가요'])
  })
  it('扩展区汉字不拆坏', () => {
    const s = '𠀀에'
    expect(tokenize(s)).toEqual([{ text: s, start: 0, end: s.length, kind: 'word' }])
  })
})

describe('学习包描述', () => {
  it('主分级是 TOPIK 1–6，对应 CEFR A1–C2', () => {
    const p = primarySystem(ko.spec.levelSystems)
    expect(p.id).toBe('topik')
    expect(p.kind).toBe('proficiency')
    expect(p.levels.map((l) => l.id)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(p.cefr).toEqual({ '1': 'A1', '2': 'A2', '3': 'B1', '4': 'B2', '5': 'C1', '6': 'C2' })
    for (const l of p.levels) expect(l.desc?.zh && l.desc.en).toBeTruthy()
  })
  it('另有标准课程词表、기초사전等级、2003 学习用词汇', () => {
    expect(ko.spec.levelSystems.map((s) => s.id)).toEqual(['topik', 'kstd', 'krdict', 'nikl2003'])
    for (const s of ko.spec.levelSystems) expect(s.sources.length).toBeGreaterThan(0)
  })
  it('词典、课程与学习模块已接入', () => {
    const f = ko.spec.features
    expect(f.lexicon).toBe(true)
    expect([
      f.texts,
      f.grammar,
      f.inflection,
      f.phrasebook,
      f.idioms,
      f.stories,
      f.media,
      f.exam
    ]).toEqual(Array(8).fill(true))
  })
  it('规则都在', () => {
    expect(ko.rules.romanize?.('한국어')).toBe('hangugeo')
    expect(ko.rules.lemmaCandidates?.('먹었어요').map((g) => g.lemma)).toContain('먹다')
  })
})
