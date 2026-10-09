import { existsSync } from 'fs'
import { resolve } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { WiktDict, type WiktSource } from '../src/main/wikt'

// 释义数据库要先跑 node scripts/data/wiktionary-ja.mjs 生成（不入库）；没有时跳过
const DB = resolve(__dirname, '../resources/data/ja/wikt.sqlite')
const run = existsSync(DB) ? describe : describe.skip

/** JMdict 词条号 */
const TABERU = 1358280 // 食べる
const GAKKOU = 1206730 // 学校
const KIREI = 1591900 // 綺麗（きれい）
const COMMON = [TABERU, GAKKOU, KIREI, 1579110, 1578850, 1387990, 1512670, 1326980] // ＋今日 行く 先生 勉強 取る

const HIRAGANA = /\p{Script=Hiragana}/u
const HAN = /\p{Script=Han}/u

run('维基词典释义', () => {
  const wikt = existsSync(DB) ? new WiktDict(DB) : (null as unknown as WiktDict)
  afterAll(() => wikt?.close())
  const of = (id: number, src: WiktSource) => wikt.definitions(id).filter((d) => d.src === src)

  it('常用词有日语释义（日日词典）', () => {
    for (const id of [TABERU, GAKKOU, KIREI]) {
      const ja = of(id, 'ja')
      expect(ja.length).toBeGreaterThan(0)
      expect(ja[0].text).toMatch(HIRAGANA)
    }
    expect(of(TABERU, 'ja')[0].pos).toBe('動詞')
    expect(of(KIREI, 'ja').some((d) => d.pos === '形容動詞')).toBe(true)
  })

  it('常用词有中文释义', () => {
    expect(COMMON.filter((id) => of(id, 'zh').length > 0).length).toBeGreaterThanOrEqual(6)
    const zh = of(TABERU, 'zh')
    expect(zh[0].text).toContain('吃')
    expect(zh.every((d) => HAN.test(d.text))).toBe(true)
  })

  it('日文版在前，各自按义项顺序；例句是字符串', () => {
    const defs = wikt.definitions(TABERU)
    const firstZh = defs.findIndex((d) => d.src === 'zh')
    expect(firstZh).toBeGreaterThan(0)
    expect(defs.slice(firstZh).every((d) => d.src === 'zh')).toBe(true)
    expect(defs.some((d) => d.examples.length > 0)).toBe(true)
    for (const d of defs) {
      expect(d.examples.length).toBeLessThanOrEqual(2)
      for (const e of d.examples) expect(typeof e).toBe('string')
      expect(d.word).toBeTruthy()
    }
  })

  it('转引和维基标记不当释义', () => {
    for (const id of COMMON)
      for (const d of wikt.definitions(id)) {
        expect(d.text).not.toMatch(/の(?:異体字|旧字体|漢字表記)。?$|を見よ|的舊字體形式/)
        expect(d.text).not.toMatch(/\{\{|\}\}|\[\[|\]\]|'''/)
      }
  })

  it('没有的词条号返回空', () => {
    expect(wikt.definitions(-1)).toEqual([])
  })

  it('统计各来源的词条数、署名', () => {
    const s = wikt.stats()
    expect(s.ja).toBeGreaterThan(10000)
    expect(s.zh).toBeGreaterThan(10000)
    const sources = wikt.sources()
    expect(sources.map((x) => x.key).sort()).toEqual(['ja', 'zh'])
    expect(sources.every((x) => x.license.includes('CC BY-SA'))).toBe(true)
  })
})

describe('没有数据库文件时', () => {
  it('不报错，返回空', () => {
    const wikt = new WiktDict(resolve(__dirname, 'no-such-wikt.sqlite'))
    expect(wikt.definitions(TABERU)).toEqual([])
    expect(wikt.stats()).toEqual({ ja: 0, zh: 0 })
    expect(wikt.sources()).toEqual([])
    wikt.close()
  })
})
