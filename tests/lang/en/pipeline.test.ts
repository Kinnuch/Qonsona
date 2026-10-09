/**
 * 英语数据管线里的纯函数（scripts/data/en/）：ECDICT 的 CSV 与字段、IPA 的整理、词组匹配、分级切点。
 */
import { describe, expect, it } from 'vitest'
import {
  isFlaggedEn,
  parseCsv,
  parseDefinitions,
  parseExchange,
  parseTransLine,
  parseTranslation,
  rankOf,
  splitItems,
  typeTags
} from '../../../scripts/data/en/ecdict'
import {
  britfoneStressed,
  britfoneToIpa,
  ecdictPhonetic,
  splitIpaDict,
  usStyle,
  wiktionaryIpa
} from '../../../scripts/data/en/ipa'
import { PhraseCounter, phrasePattern } from '../../../scripts/data/en/phrases'
import { frequencyCuts, levelByRank, splitVariants } from '../../../scripts/data/en/levels'

describe('ECDICT', () => {
  it('CSV：引号里的逗号、换行、两个引号', () => {
    const rows = [
      ...parseCsv('word,translation\ncat,"n. 猫, 猫科动物"\nsay,"v. 说 ""你好""\nn. 发言权"\n')
    ]
    expect(rows).toEqual([
      ['word', 'translation'],
      ['cat', 'n. 猫, 猫科动物'],
      ['say', 'v. 说 "你好"\nn. 发言权']
    ])
  })
  it('词频名次取两个语料库里较小的', () => {
    expect(rankOf({ bnc: 642, frq: 0 })).toBe(642)
    expect(rankOf({ bnc: 24372, frq: 697 })).toBe(697)
    expect(rankOf({ bnc: 0, frq: 0 })).toBe(0)
  })
  it('exchange：变形与「这是谁的变形」', () => {
    expect(parseExchange('p:went/d:gone/i:going/3:goes')).toEqual({
      forms: [
        ['went', 'p'],
        ['gone', 'd'],
        ['going', 'i'],
        ['goes', '3']
      ]
    })
    expect(parseExchange('0:go/1:p')).toMatchObject({ lemma: 'go', types: 'p', forms: [] })
    expect(typeTags('dp')).toEqual([['past', 'participle'], ['past']])
    expect(typeTags('s')).toEqual([['plural']])
  })
  it('中文释义：词性、条目、括号里的逗号不拆', () => {
    const lines = parseTranslation('n. 狗, 坏蛋\\nvt. 使(马,鹰等)戴头罩；给…加罩')
    expect(lines.map((l) => l.pos)).toEqual([['noun'], ['verb']])
    expect(lines[0].items).toEqual(['狗', '坏蛋'])
    expect(lines[1].items).toEqual(['使(马,鹰等)戴头罩', '给…加罩'])
    expect(splitItems('甲，乙（丙，丁）；戊')).toEqual(['甲', '乙（丙，丁）', '戊'])
  })
  it('中文释义：领域、网络释义、地区与语体标记', () => {
    expect(parseTransLine('[计] 数据; 数据库')).toMatchObject({
      domain: 'computing',
      items: ['数据', '数据库']
    })
    expect(parseTransLine('[网络] 狗；犬')).toMatchObject({ web: true, items: ['狗', '犬'] })
    expect(parseTransLine('[美] n. 公寓')).toMatchObject({ labels: ['US'], pos: ['noun'] })
    expect(parseTransLine('n. <口>家伙, 伙计')).toMatchObject({
      labels: ['colloquial'],
      items: ['家伙', '伙计']
    })
  })
  it('中文释义里的变形说明拿出来，不当释义', () => {
    expect(parseTransLine('go的过去式')).toMatchObject({
      items: [],
      notes: [{ lemma: 'go', tags: ['past'] }]
    })
    expect(parseTransLine('a. 更大的（big的比较级）')).toMatchObject({
      items: ['更大的'],
      notes: [{ lemma: 'big', tags: ['comparative'] }]
    })
    expect(parseTransLine('find的过去式和过去分词')?.notes).toEqual([
      { lemma: 'find', tags: ['past'] },
      { lemma: 'find', tags: ['past', 'participle'] }
    ])
  })
  it('带粗俗、贬损标记的条目去掉', () => {
    const l = parseTransLine('n. 甲义, <贬>乙义')!
    expect(l.items).toEqual(['甲义'])
    expect(l.flagged).toBe(true)
    expect(parseTransLine('<粗>某义')).toMatchObject({ items: [], allFlagged: true })
  })
  it('英文释义（WordNet）：词性、续行、只说变形的不要', () => {
    const d = parseDefinitions(
      'n. a domestic animal\\nv. follow closely\\ns. very large\\nplural of dog'
    )
    expect(d.map((x) => x.pos)).toEqual(['noun', 'verb', 'adj'])
    expect(d[0].gloss).toBe('a domestic animal')
    expect(isFlaggedEn('a disparaging term for someone')).toBe(true)
    expect(isFlaggedEn('an offensive against the enemy')).toBe(false)
  })
})

describe('IPA', () => {
  it('Britfone → 课本写法：重音挪到音节开头（首音尽量长）', () => {
    expect(britfoneToIpa('ə b ˈæ n d ə n')).toBe('/əˈbændən/')
    expect(britfoneToIpa('k ə n s t ɹ ˈɐ k t')).toBe('/kənˈstrʌkt/')
    expect(britfoneToIpa('f ə t ˈɒ g ɹ ə f i')).toBe('/fəˈtɒgrəfi/')
    expect(britfoneToIpa('w ˈɔː t ə')).toBe('/ˈwɔːtə/')
    expect(britfoneToIpa('ʃ ˈɛ dʒ uː l')).toBe('/ˈʃedʒuːl/')
    expect(britfoneToIpa('t ə m ˈɑː t ˌəʊ')).toBe('/təˈmɑːˌtəʊ/')
    expect(britfoneToIpa('w ˈɪ n d ˌəʊ')).toBe('/ˈwɪnˌdəʊ/')
  })
  it('单音节不标重音；没有重音的是弱读式', () => {
    expect(britfoneToIpa('k ˈæ t')).toBe('/kæt/')
    expect(britfoneStressed('ə n d')).toBe(false)
    expect(britfoneStressed('ˈæ n d')).toBe(true)
  })
  it('ipa-dict 美式 → 词典写法', () => {
    expect(usStyle('/ˈwɔtɝ/')).toBe('/ˈwɔtɚ/')
    expect(usStyle('/ˈbɝd/')).toBe('/bɝd/')
    expect(usStyle('/ˈɹən/')).toBe('/rʌn/')
    expect(usStyle('/ˈkəlɝ/')).toBe('/ˈkʌlɚ/')
    expect(usStyle('/ˈskɛdʒuɫ/')).toBe('/ˈskedʒul/')
    expect(usStyle('/təˈmeɪˌtoʊ/')).toBe('/təˈmeɪˌtoʊ/')
    expect(usStyle('/ənd/')).toBe('/ənd/')
    expect(splitIpaDict('/ˈeɪ/, /ə/')).toEqual(['/ˈeɪ/', '/ə/'])
  })
  it('ECDICT 的旧式音标 → 课本写法', () => {
    expect(ecdictPhonetic("'betә")).toBe('/ˈbetə/')
    expect(ecdictPhonetic('gou')).toBe('/gəʊ/')
    expect(ecdictPhonetic('its')).toBe('/ɪts/')
    expect(ecdictPhonetic("'mistә(r)")).toBe('/ˈmɪstə(r)/')
    expect(ecdictPhonetic('hɔt')).toBe('/hɒt/')
    expect(ecdictPhonetic('bә:d')).toBe('/bɜːd/')
    expect(ecdictPhonetic('')).toBeNull()
    expect(ecdictPhonetic('ABC')).toBeNull()
  })
  it('维基词典的 IPA', () => {
    expect(wiktionaryIpa('/ˈwɔː.tə(ɹ)/', 'uk')).toBe('/ˈwɔːtə(r)/')
    expect(wiktionaryIpa('/dɒɡ/', 'uk')).toBe('/dɒg/')
    expect(wiktionaryIpa('[nəu̯n]', 'us')).toBeNull()
  })
})

describe('词组', () => {
  const lemma = (w: string): string[] =>
    ({ gave: ['give'], made: ['make'], minds: ['mind'] })[w] ?? [w]
  it('写法变成匹配用的样子', () => {
    expect(phrasePattern('give up', lemma)).toEqual({ key: 'give up' })
    expect(phrasePattern("make up one's mind", lemma)).toEqual({ key: 'make up <poss> mind' })
    expect(phrasePattern('by oneself', lemma)).toEqual({ key: 'by <refl>' })
    expect(phrasePattern('take sb to task', lemma)).toEqual({
      key: 'take <gap> to task',
      gap: { first: 'take', second: 'to task' }
    })
    expect(phrasePattern('take care of sb', lemma)).toEqual({ key: 'take care of' })
    expect(phrasePattern('a/b c', lemma)).toBeNull()
    expect(phrasePattern('dog', lemma)).toBeNull()
  })
  it("在句子里数：连着的、one's、中间隔着宾语的", () => {
    const pats = [
      phrasePattern('give up', lemma)!,
      phrasePattern("make up one's mind", lemma)!,
      phrasePattern('take sb to task', lemma)!
    ]
    const c = new PhraseCounter(pats)
    // She gave up. / I made up my mind. / They took him to task.（句子已经换成原形）
    c.add(0, ['she', 'give', 'up'], [null, null, null])
    c.add(1, ['i', 'make', 'up', 'my', 'mind'], [null, null, null, '<poss>', null])
    c.add(2, ['they', 'take', 'him', 'to', 'task'], [null, null, null, null, null])
    c.add(3, ['give', 'up', 'give', 'up'], [null, null, null, null])
    expect(c.counts.get('give up')).toBe(2)
    expect(c.counts.get('make up <poss> mind')).toBe(1)
    expect(c.counts.get('take <gap> to task')).toBe(1)
    expect(c.hits.get('give up')).toEqual([0, 3])
  })
})

describe('分级', () => {
  it('并列写法拆开', () => {
    expect(splitVariants('color/colour')).toEqual(['color', 'colour'])
    expect(splitVariants('a.m./A.M./am/AM')).toEqual(['a.m.', 'A.M.', 'am', 'AM'])
  })
  it('词频切点递增，按名次分级', () => {
    const ranked = [
      ...Array.from({ length: 50 }, (_, i) => ({ rank: 100 + i, level: 'A1' as const })),
      ...Array.from({ length: 50 }, (_, i) => ({ rank: 1000 + i, level: 'A2' as const })),
      ...Array.from({ length: 50 }, (_, i) => ({ rank: 3000 + i, level: 'B1' as const })),
      ...Array.from({ length: 50 }, (_, i) => ({ rank: 6000 + i, level: 'B2' as const })),
      ...Array.from({ length: 50 }, (_, i) => ({ rank: 9000 + i, level: 'C1' as const })),
      ...Array.from({ length: 50 }, (_, i) => ({ rank: 14000 + i, level: 'C2' as const }))
    ]
    const cuts = frequencyCuts(ranked)
    expect(cuts).toHaveLength(5)
    for (let i = 1; i < cuts.length; i++) expect(cuts[i]).toBeGreaterThan(cuts[i - 1])
    expect(levelByRank(120, cuts)).toBe('A1')
    expect(levelByRank(1020, cuts)).toBe('A2')
    expect(levelByRank(6010, cuts)).toBe('B2')
    expect(levelByRank(50000, cuts)).toBe('C2')
  })
})
