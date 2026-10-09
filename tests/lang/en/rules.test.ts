/**
 * 英语的规则（src/shared/lang/en/rules.ts）：查词键、宽松键、切词、缩约、猜原形。
 */
import { describe, expect, it } from 'vitest'
import {
  expandContraction,
  key,
  lemmaCandidates,
  looseKey,
  rules,
  splitContraction,
  tokenize
} from '../../../src/shared/lang/en/rules'
import { LANGS } from '../../../src/shared/lang/registry'

const words = (text: string): string[] =>
  tokenize(text)
    .filter((t) => t.kind === 'word' || t.kind === 'num')
    .map((t) => t.text)
const lemmas = (w: string): string[] => lemmaCandidates(w).map((g) => g.lemma)
const first = (w: string): string | undefined => lemmaCandidates(w)[0]?.lemma

describe('查词键', () => {
  it('小写、弯撇号换直的、空白合一、连字符统一', () => {
    expect(key('Don’t')).toBe("don't")
    expect(key('  Ice   Cream ')).toBe('ice cream')
    expect(key('e‐mail')).toBe('e-mail')
    expect(key('London')).toBe('london')
  })
  it('宽松键去掉附加符号、连字符、撇号、点和空格', () => {
    expect(looseKey('café')).toBe('cafe')
    expect(looseKey('naïve')).toBe('naive')
    expect(looseKey('e-mail')).toBe('email')
    expect(looseKey("o'clock")).toBe('oclock')
    expect(looseKey('U.S.')).toBe('us')
    expect(looseKey('a lot')).toBe('alot')
    expect(looseKey("don't")).toBe('dont')
  })
  it("宽松键留着词尾的所有格（John's 不能变成另一个词 Johns）", () => {
    expect(looseKey("John's")).toBe("john's")
    expect(looseKey("students'")).toBe("students'")
    expect(looseKey("O'Brien's")).toBe("obrien's")
  })
  it('登记在框架里的就是这一份', () => {
    expect(LANGS.en.rules).toBe(rules)
    expect(rules.lemmaCandidates).toBe(lemmaCandidates)
  })
})

describe('切词', () => {
  it('首尾相接覆盖全文', () => {
    const text = "Mr. O'Brien's well-known café isn't open 'til 9 a.m., e.g. on Sundays."
    const t = tokenize(text)
    expect(t.map((x) => x.text).join('')).toBe(text)
    for (let i = 1; i < t.length; i++) expect(t[i].start).toBe(t[i - 1].end)
    expect(t[t.length - 1].end).toBe(text.length)
  })
  it('缩约与所有格是一个词', () => {
    expect(words("I don't know, it's John's dog.")).toEqual([
      'I',
      "don't",
      'know',
      "it's",
      "John's",
      'dog'
    ])
    expect(words('She won’t go; they’re here.')).toEqual(['She', 'won’t', 'go', 'they’re', 'here'])
  })
  it('连字符复合词并成一个词，数字范围不并', () => {
    expect(words('A well-known mother-in-law sent twenty-one e-mails in 1990-2000.')).toEqual([
      'A',
      'well-known',
      'mother-in-law',
      'sent',
      'twenty-one',
      'e-mails',
      'in',
      '1990',
      '2000'
    ])
    expect(words('COVID-19 rules')).toEqual(['COVID-19', 'rules'])
  })
  it('缩写的点算在词里；句末的普通词不算', () => {
    expect(
      words('Mr. Smith met Dr. Brown at 3 p.m. in the U.S. on No. 5 street, e.g. here.')
    ).toEqual([
      'Mr.',
      'Smith',
      'met',
      'Dr.',
      'Brown',
      'at',
      '3',
      'p.m.',
      'in',
      'the',
      'U.S.',
      'on',
      'No.',
      '5',
      'street',
      'e.g.',
      'here'
    ])
    const t = tokenize('I said no.')
    expect(t.map((x) => x.text)).toEqual(['I', ' ', 'said', ' ', 'no', '.'])
  })
  it('撇号在前的缩约、年代、序数词', () => {
    expect(words("rock 'n' roll, tell 'em 'cause")).toEqual([
      'rock',
      "'n'",
      'roll',
      'tell',
      "'em",
      "'cause"
    ])
    const t = tokenize("the 1990s and the '90s, the 21st century")
    const nums = t.filter((x) => x.kind === 'num').map((x) => x.text)
    expect(nums).toEqual(['1990s', "'90s", '21st'])
  })
  it('引号不当撇号', () => {
    expect(words("'Hello,' she said.")).toEqual(['Hello', 'she', 'said'])
  })
})

describe('缩约', () => {
  it('拆成宿主词与附着成分', () => {
    expect(splitContraction("don't")).toMatchObject({ hostLemma: 'do', cliticLemmas: ['not'] })
    expect(splitContraction("can't")).toMatchObject({ hostLemma: 'can' })
    expect(splitContraction("won't")).toMatchObject({ hostLemma: 'will' })
    expect(splitContraction("isn't")).toMatchObject({ hostLemma: 'be' })
    expect(splitContraction("I'm")).toMatchObject({ hostLemma: 'i', cliticLemmas: ['be'] })
    expect(splitContraction("it's")).toMatchObject({
      hostLemma: 'it',
      cliticLemmas: ['be', 'have']
    })
    expect(splitContraction("let's")).toMatchObject({ hostLemma: 'let', cliticLemmas: ['us'] })
    expect(splitContraction("we'd")).toMatchObject({ cliticLemmas: ['would', 'have'] })
    expect(splitContraction('cannot')).toMatchObject({ hostLemma: 'can', cliticLemmas: ['not'] })
  })
  it('所有格', () => {
    expect(splitContraction("dog's")).toMatchObject({ hostLemma: 'dog', possessive: true })
    expect(splitContraction("students'")).toMatchObject({ hostLemma: 'students', possessive: true })
    expect(splitContraction("o'clock")).toBeNull()
    expect(splitContraction('dog')).toBeNull()
  })
  it('完整写法', () => {
    expect(expandContraction("don't")).toBe('do not')
    expect(expandContraction("I'm")).toBe('I am')
    expect(expandContraction("won't")).toBe('will not')
    expect(expandContraction("can't")).toBe('can not')
    expect(expandContraction("it's")).toBe('it is / has')
    expect(expandContraction("let's")).toBe('let us')
    expect(expandContraction("'em")).toBe('them')
    expect(expandContraction("ain't")).toBe('am not / is not / are not')
    expect(expandContraction("dog's")).toBeNull()
  })
})

describe('猜原形', () => {
  it('-s / -es / -ies / -ves', () => {
    expect(lemmas('studies')).toContain('study')
    expect(lemmas('boxes')).toContain('box')
    expect(lemmas('goes')).toContain('go')
    expect(lemmas('knives')).toContain('knife')
    expect(lemmas('leaves')).toContain('leaf')
    expect(first('cats')).toBe('cat')
    expect(lemmaCandidates('cats')[0].tags).toEqual(['plural'])
  })
  it('-ed：去 ed、加回 e、去掉双写、y 变回来', () => {
    expect(first('walked')).toBe('walk')
    expect(first('hoped')).toBe('hope')
    expect(lemmas('hoped')).toContain('hop')
    expect(first('stopped')).toBe('stop')
    expect(first('studied')).toBe('study')
    expect(lemmas('panicked')).toContain('panic')
    expect(lemmaCandidates('walked').map((g) => g.tags.join(' '))).toContain('past participle')
  })
  it('-ing', () => {
    expect(first('making')).toBe('make')
    expect(first('running')).toBe('run')
    expect(first('dying')).toBe('die')
    expect(first('walking')).toBe('walk')
    expect(lemmaCandidates('walking')[0].tags).toEqual(['present', 'participle'])
  })
  it('-er / -est', () => {
    expect(first('bigger')).toBe('big')
    expect(first('happier')).toBe('happy')
    expect(lemmas('nicer')).toContain('nice')
    expect(first('nicest')).toBe('nice')
    expect(lemmas('taller')).toContain('tall')
    expect(lemmaCandidates('biggest')[0].tags).toEqual(['superlative'])
  })
  it('-ly 副词猜回形容词', () => {
    expect(lemmas('happily')).toContain('happy')
    expect(lemmas('basically')).toContain('basic')
    expect(lemmas('gently')).toContain('gentle')
    expect(lemmas('quickly')).toContain('quick')
  })
  it('缩约、所有格、连字符', () => {
    expect(lemmaCandidates("don't")).toEqual([
      { lemma: 'do', tags: ['negative', 'contraction'] },
      { lemma: 'not', tags: ['contraction'] }
    ])
    expect(lemmas("you'd")).toEqual(['you', 'would', 'have'])
    expect(lemmas("children's")).toEqual(['children'])
    expect(lemmas("students'")).toEqual(['students', 'student'])
    expect(lemmaCandidates("students'")[1].tags).toEqual(['plural', 'possessive'])
    expect(lemmas("'em")).toEqual(['them'])
    expect(lemmas('e-mail')).toEqual(['email', 'e mail', 'mail'])
    expect(lemmas('e-mails')).toContain('email')
    expect(lemmas("someone's")).toEqual(['someone'])
    expect(lemmaCandidates("someone's")[0].tags).toEqual(['possessive'])
  })
  it('猜不出的不乱猜', () => {
    expect(lemmaCandidates('xq')).toEqual([])
    expect(lemmaCandidates('')).toEqual([])
    expect(lemmas('dog')).toEqual([])
  })
})
