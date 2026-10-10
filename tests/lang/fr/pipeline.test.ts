/**
 * 法语数据管线里的纯函数：中文候选的整理与对义项、录音地区、词性标记切分、分级；
 * 以及（本机建过库时）用软件自己的读库代码查几个词，看库跟规则、阅读器配不配套。
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { align, bag, cleanItem, pickSimplified, splitZh } from '../../../scripts/data/fr/align'
import { placeLabel, mapPos } from '../../../scripts/data/fr/wikt-en'
import { splitByPos, toSimplified } from '../../../scripts/data/fr/zh-sources'
import {
  bandOfRank,
  coreLevel,
  levelOfRank,
  loadCore,
  loadZhCore,
  registerFloor
} from '../../../scripts/data/fr/levels'
import { LexDb } from '../../../src/main/lang/lexdb'

describe('中文候选的整理', () => {
  it('拆分、清理', () => {
    expect(splitZh('美丽的，漂亮的；好看的')).toEqual(['美丽的', '漂亮的', '好看的'])
    expect(splitZh('（车辆、船只等）行驶，航行')).toEqual(['（车辆、船只等）行驶', '航行'])
    expect(cleanItem('prep. 和...一起')).toBe('和...一起')
    expect(cleanItem('一个。')).toBe('一个')
    expect(cleanItem('（定冠词）')).toBe('定冠词')
    expect(cleanItem('使得到位置se ~')).toBe('使得到位置')
    expect(pickSimplified('空閒 /空閑 /空闲', {})).toBe('空闲')
    expect(toSimplified('貓', { 貓: '猫' })).toBe('猫')
  })
  it('词袋：实词与虚词两种比法', () => {
    expect([...bag('to be going (to)')]).toEqual(['be', 'going'])
    expect([...bag('eating cats')]).toEqual(['eat', 'cat'])
    expect(bag('you (singular)', 'function').has('you')).toBe(true)
    expect(bag('you (singular)').has('you')).toBe(false)
  })
  it('汉法词典导进来的条目按词性标记切开', () => {
    const parts = splitByPos('num.card. 百；第一百n.m. 百来个n.m. 分')
    expect(parts.map((p) => p.p)).toEqual(['num', 'noun', 'noun'])
    expect(parts[2].text.trim()).toBe('分')
    expect(splitByPos('吃；进食')).toEqual([{ text: '吃；进食' }])
  })
})

describe('中文对到义项', () => {
  const cedict: Record<string, string[]> = {
    猫: ['cat'],
    郎猫: ['tomcat'],
    书: ['book', 'letter'],
    磅: ['pound (unit of weight)'],
    百: ['hundred'],
    分: ['minute', '0.01 yuan']
  }
  it('按英文的桥分给最像的义项，对不上的不要', () => {
    const out = align(
      {
        senses: [{ en: ['cat (feline)'] }, { en: ['cat, tom, tomcat'] }, { en: ['chat (online)'] }],
        key: 'chat',
        pos: 'noun',
        g: 'm',
        zhwikt: [{ k: 'chat', w: 'chat', p: 'noun', s: ['猫', '郎猫'] }]
      },
      cedict,
      {},
      {}
    )
    expect(out.zh[0].items).toEqual(['猫'])
    expect(out.zh[1].items).toContain('郎猫')
    expect(out.zh[2].items).toEqual([])
  })
  it('同一条释义里有别的意思被判定对不上时，整条不硬塞', () => {
    const out = align(
      {
        senses: [{ en: ['cent (one-hundredth of a dollar)'] }],
        key: 'cent',
        pos: 'noun',
        zhwikt: [{ k: 'cent', w: 'cent', p: 'noun', s: ['百；百来个', '分'] }],
        pivot: [
          {
            e: 'cent',
            p: 'noun',
            s: 'subunit of currency',
            fr: [['cent', 'masculine']],
            zh: ['分']
          }
        ]
      },
      cedict,
      {},
      {}
    )
    expect(out.zh[0].items).toEqual(['分'])
  })
  it('英文翻译表：词头得对得上义项（lira 不给 pound）', () => {
    const out = align(
      {
        senses: [{ en: ['book'] }],
        key: 'livre',
        pos: 'noun',
        pivot: [
          { e: 'lira', p: 'noun', s: 'unit of currency', fr: [['livre']], zh: ['里拉'] },
          { e: 'book', p: 'noun', s: 'collection of pages', fr: [['livre']], zh: ['書 /书'] }
        ]
      },
      cedict,
      {},
      {}
    )
    expect(out.zh[0].items).toEqual(['书'])
  })
})

describe('录音地区、词性', () => {
  it('统一写成「国家 (城市)」', () => {
    expect(placeLabel(['Paris (France)'])).toBe('France (Paris)')
    expect(placeLabel(['France (Paris)'])).toBe('France (Paris)')
    expect(placeLabel(['Suisse (canton du Valais)'])).toBe('Switzerland (Valais)')
    expect(placeLabel(['France', 'Agen'])).toBe('France (Agen)')
    expect(placeLabel(['Québec (Canada)'])).toBe('Canada (Québec)')
    expect(placeLabel(['audio'])).toBe('')
  })
  it('wiktextract 的词性对到 UPOS', () => {
    expect(mapPos('noun', 'chat')).toBe('noun')
    expect(mapPos('conj', 'et')).toBe('cconj')
    expect(mapPos('conj', 'que')).toBe('sconj')
    expect(mapPos('contraction', 'au')).toBe('det')
    expect(mapPos('prep_phrase', 'à côté de')).toBe('adp')
    expect(mapPos('character', 'a')).toBeNull()
  })
})

describe('分级', () => {
  it('按名次切 CEFR 与词频段', () => {
    expect(levelOfRank(1)).toBe('A1')
    expect(levelOfRank(2000)).toBe('A2')
    expect(levelOfRank(10000)).toBe('B2')
    expect(levelOfRank(99999)).toBeUndefined()
    expect(levelOfRank(undefined)).toBeUndefined()
    expect(bandOfRank(999)).toBe('1k')
    expect(bandOfRank(4500)).toBe('5k')
    expect(bandOfRank(30000)).toBeUndefined()
  })
  it('语体定的下限：每个义项都是才算', () => {
    expect(registerFloor([['vulgar'], ['offensive']])).toBe('B2')
    expect(registerFloor([['colloquial'], ['slang']])).toBe('B1')
    expect(registerFloor([['archaic']])).toBe('C1')
    expect(registerFloor([['colloquial'], []])).toBeUndefined()
  })
  it('核心词表与虚词中文表读得进来、对得上词性', () => {
    const core = loadCore(process.cwd())
    expect(coreLevel(core, 'stylo', 'noun')).toBe('A1')
    expect(coreLevel(core, 'livre', 'noun', 'm')).toBe('A1')
    expect(coreLevel(core, 'livre', 'noun', 'f')).toBeUndefined()
    expect(coreLevel(core, 'france', 'propn')).toBe('A1')
    expect(coreLevel(core, 'tu', 'pron')).toBe('A1')
    const zh = loadZhCore(process.cwd())
    expect(zh.get('le|det')?.length).toBeGreaterThanOrEqual(4)
    expect(zh.get('à|adp')?.some((l) => l.zh.some((x) => x.includes('到')))).toBe(true)
  })
})

// ───────── 本机建过库时：用软件自己的读库代码查 ─────────

const dictFile = join(process.cwd(), 'resources', 'data', 'fr', 'dict.sqlite')
describe.skipIf(!existsSync(dictFile))('建好的法语词典（resources/data/fr/dict.sqlite）', () => {
  const db = new LexDb('fr', dictFile)
  it('词头、变形、去重音、猜原形都查得到', () => {
    expect(db.ok).toBe(true)
    expect(db.search('chat').hits[0]).toMatchObject({ w: 'chat', match: 'exact' })
    expect(db.search('mangeons').hits[0]).toMatchObject({ w: 'manger', match: 'form' })
    expect(db.search('eleve').hits.some((h) => h.w === 'élève')).toBe(true)
    expect(db.search('coeur').hits.some((h) => h.w === 'cœur')).toBe(true)
    // 省音没切开时靠猜原形
    expect(db.search("l'homme").hits.some((h) => h.w === 'homme' && h.match === 'guess')).toBe(true)
    expect(db.search('猫').hits.some((h) => h.w === 'chat')).toBe(true)
  })
  it('阅读器：省音、缩合、变位都对到原形', () => {
    expect(['le', "l'"]).toContain(db.lookup("l'")?.lemma)
    expect(db.lookup('au')?.lemma).toBe('au')
    expect(db.lookup('allée')?.lemma).toBeTruthy()
    expect(db.lookup('fûmes')?.lemma).toBe('être')
    expect(db.lookup('yeux')?.lemma).toBe('œil')
    expect(db.lookup("aujourd'hui")?.lemma).toBe("aujourd'hui")
  })
  it('词条：性、IPA、分级、中文', () => {
    const hit = db.search('maison').hits.find((h) => h.p.includes('noun'))!
    const e = db.entry(hit.id)!
    expect(e.g).toBe('f')
    expect(e.ipa[0]).toMatch(/mɛ\.?zɔ̃|me\.?zɔ̃/)
    expect(e.levels.find((l) => l.primary)?.levels[0].id).toBe('A1')
    expect(e.senses.some((s) => s.zh.length)).toBe(true)
  })
})
