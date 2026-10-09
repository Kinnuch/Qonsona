import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { inspectQonlang, buildQonlangPack } from '$lib/packs/qonlang/convert'
import { corpusFrequency, frequencyLevels, learnable, levelCount } from '$lib/packs/qonlang/levels'
import { spellingIpa, storedIpa } from '$lib/packs/qonlang/pronounce'
import type { Project } from '$qon/core/model'

const load = (name: string): Project => {
  const r = inspectQonlang(readFileSync(resolve(__dirname, 'fixtures/qonlang', name), 'utf8'))
  if (!r.ok) throw new Error(r.reason)
  return r.project
}

describe('按词频分级', () => {
  const p = load('Aelith.laim.json')
  const ae = p.languages.find((l) => l.abbr === 'ae')!
  const lexemes = p.lexemes.filter((l) => l.languageId === ae.id)

  it('例句和短语里认得出词', () => {
    const freq = corpusFrequency(p, ae.id)
    expect(freq.size).toBeGreaterThan(5)
    // 认出来的都是这门语言的词条
    for (const id of freq.keys()) expect(lexemes.some((l) => l.id === id)).toBe(true)
  })

  it('每个能学的词都分到一级，一级最少、最常用', () => {
    const lv = frequencyLevels(p, ae.id)
    const learn = lexemes.filter(learnable)
    expect(Object.keys(lv.entries).length).toBe(learn.length)
    expect(lv.system.levels.length).toBe(levelCount(learn.length))
    const counts = lv.system.levels.map((x) => x.count!)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(learn.length)
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
    // 一级里的词出现次数不少于后面任何一级的词
    const f = (id: string): number => lv.freq[id] ?? 0
    const minL1 = Math.min(...learn.filter((l) => lv.entries[l.id] === 'L1').map((l) => f(l.id)))
    const maxRest = Math.max(...learn.filter((l) => lv.entries[l.id] !== 'L1').map((l) => f(l.id)))
    expect(minL1).toBeGreaterThanOrEqual(maxRest)
  })

  it('分级结果稳定：同一个项目算两次一样', () => {
    expect(frequencyLevels(p, ae.id)).toEqual(frequencyLevels(p, ae.id))
  })

  it('不算项目本身：分析在拷贝上做', () => {
    const before = JSON.stringify(p.sentences)
    frequencyLevels(p, ae.id)
    expect(JSON.stringify(p.sentences)).toBe(before)
  })

  it('没有字母的占位词条不参加分级', () => {
    const q = structuredClone(p)
    q.lexemes.push({ ...structuredClone(lexemes[0]), id: 'placeholder', lemma: '·' })
    expect(frequencyLevels(q, ae.id).entries.placeholder).toBeUndefined()
  })

  it('只有一个词时它在一级', () => {
    const proto = p.languages.find((l) => l.abbr === 'PAe')!
    const lv = frequencyLevels(p, proto.id)
    expect(Object.values(lv.entries)).toEqual(['L1'])
  })

  it('档数随词数增加', () => {
    expect([10, 59, 60, 399, 400, 5000].map(levelCount)).toEqual([3, 3, 4, 4, 5, 5])
  })

  it('导入时写进学习包：清单里有等级体系，另有一份词条到等级的对照', () => {
    const { manifest, files } = buildQonlangPack(p, ae.id, 'Aelith.laim.json', '{}')
    expect(manifest.levels?.id).toBe('frequency')
    expect(Object.keys(files).sort()).toEqual(['levels.json', 'manifest.json', 'source.laim.json'])
    expect(JSON.parse(files['levels.json']).entries).toEqual(frequencyLevels(p, ae.id).entries)
  })
})

describe('读音', () => {
  it('存着的 IPA 优先，主正字法的排前面', () => {
    const p = load('Aelith.laim.json')
    const ae = p.languages.find((l) => l.abbr === 'ae')!
    const kaso = p.lexemes.find((l) => l.lemma === 'kaso')!
    expect(storedIpa(ae, kaso.pronunciations)).toBe('ˈka.so')
  })

  it('没存的按主正字法现转；没有正字法时不冒充', () => {
    const p = load('Aelith.laim.json')
    const ae = p.languages.find((l) => l.abbr === 'ae')!
    expect(spellingIpa(ae, 'kaso')).not.toBe('')
    expect(spellingIpa({ ...ae, orthographies: [] }, 'kaso')).toBe('')
  })
})
