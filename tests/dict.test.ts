import { existsSync } from 'fs'
import { resolve } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { JapaneseDict } from '../src/main/dict'

// 词典数据库要先跑 node scripts/data/build-ja.mjs 生成（不入库）；没有时跳过
const DB = resolve(__dirname, '../resources/data/ja/dict.sqlite')
const run = existsSync(DB) ? describe : describe.skip

run('日语词典', () => {
  const dict = existsSync(DB) ? new JapaneseDict(DB) : (null as unknown as JapaneseDict)
  afterAll(() => dict?.close())
  const top = (q: string): string => dict.search(q).hits[0]?.head ?? ''

  it('写原形查得到', () => {
    const r = dict.search('食べる')
    expect(r.hits[0]).toMatchObject({ head: '食べる', reading: 'たべる', match: 'exact', jlpt: 5 })
  })

  it('变过形的查得到原形，并说明是什么变形', () => {
    const r = dict.search('食べた')
    expect(r.hits[0]).toMatchObject({ head: '食べる', match: 'deinflected', inflected: '食べた' })
    expect(r.hits[0].reasons).toEqual(['past'])
    expect(top('食べさせられなかった')).toBe('食べる')
    expect(top('行った')).toBe('行く')
    expect(top('勉強しています')).toBe('勉強')
  })

  it('只写假名查得到', () => {
    expect(top('たべる')).toBe('食べる')
    expect(top('たべた')).toBe('食べる')
  })

  it('罗马字查得到', () => {
    const r = dict.search('taberu')
    expect(r.kana).toBe('たべる')
    expect(r.hits[0].head).toBe('食べる')
  })

  it('片假名与平假名通用', () => {
    expect(dict.search('てーぶる').hits.some((h) => h.head === 'テーブル')).toBe(true)
  })

  it('英文释义查得到', () => {
    expect(dict.search('eat').hits.some((h) => h.head === '食べる')).toBe(true)
    expect(dict.search('convenience store').hits.some((h) => h.head === 'コンビニ')).toBe(true)
  })

  it('中文释义查得到', () => {
    expect(dict.search('吃').hits.some((h) => h.head === '食べる')).toBe(true)
  })

  it('查中文时给出中日同形词对照', () => {
    const r = dict.search('勉强')
    expect(r.contrast?.items.length).toBeGreaterThan(0)
  })

  it('词条：写法、义项、中英释义、例句', () => {
    const e = dict.entry(1358280)!
    expect(e.head).toBe('食べる')
    expect(e.kana[0].text).toBe('たべる')
    expect(e.senses[0].en).toContain('to eat')
    expect(e.senses[0].zh).toBeTruthy()
    expect(e.senses[0].examples.length).toBeGreaterThan(0)
    expect(e.senses[0].examples[0].zh).toBeTruthy()
    expect(e.chars[0].ch).toBe('食')
  })

  it('自他动词配对', () => {
    const id = dict.search('上げる').hits[0].id
    const e = dict.entry(id)!
    expect(e.pair?.head).toBe('上がる')
  })

  it('汉字：读音、字义、拼音、笔顺、常用词', () => {
    const k = dict.kanji('食')!
    expect(k.on).toContain('ショク')
    expect(k.pinyin).toContain('shí')
    expect(k.zh.length).toBeGreaterThan(0)
    expect(k.paths.length).toBe(9)
    expect(k.strokes).toBe(9)
    expect(k.jlpt).toBe(5)
    expect(k.words.some((w) => w.head === '食べる')).toBe(true)
  })

  it('假名也有笔顺', () => {
    expect(dict.kanji('あ')?.paths.length).toBe(3)
  })

  it('例句按文字找', () => {
    expect(dict.examples('食べる').length).toBeGreaterThan(0)
  })

  it('查不到时返回空', () => {
    expect(dict.search('').hits).toEqual([])
    expect(dict.search('zzzzqqq').hits).toEqual([])
  })

  it('数据来源都有署名与许可', () => {
    const s = dict.sources()
    expect(s.length).toBeGreaterThanOrEqual(6)
    for (const x of s) expect(x.license).toBeTruthy()
  })
})
