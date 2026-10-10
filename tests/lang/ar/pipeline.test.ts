/**
 * 阿拉伯语数据管线里的纯函数：变形表的合并、词根的写法、繁简与中文释义的清理、词形归到词条（词频）。
 */
import { describe, expect, it } from 'vitest'
import { mergeCells, normalizeRoot, verbInfo } from '../../../scripts/data/ar/wiktionary'
import { simplifiedOf } from '../../../scripts/data/ar/translations'
import { cleanZhGloss } from '../../../scripts/data/ar/zh'
import { FormIndex, allocate, analyseCorpus, headwordEvidence } from '../../../scripts/data/ar/freq'
import { actflOf, cefrOf } from '../../../scripts/data/ar/levels'
import type { PosTag } from '../../../src/shared/lang/types'

describe('维基词典解析', () => {
  it('同形的格合成一项：三个格都一样不写格，阳阴性同形不写性', () => {
    const cells = mergeCells([
      ['كِتَابَيْنِ', ['accusative', 'dual', 'indefinite']],
      ['كِتَابَيْنِ', ['dual', 'genitive', 'indefinite']],
      ['أَكْتُبُ', ['first-person', 'masculine', 'singular']],
      ['أَكْتُبُ', ['feminine', 'first-person', 'singular']],
      ['مُسْتَشْفًى', ['indefinite', 'nominative', 'singular']],
      ['مُسْتَشْفًى', ['accusative', 'indefinite', 'singular']],
      ['مُسْتَشْفًى', ['genitive', 'indefinite', 'singular']]
    ])
    expect(cells).toContainEqual(['كِتَابَيْنِ', ['accusative', 'dual', 'genitive', 'indefinite']])
    expect(cells).toContainEqual(['أَكْتُبُ', ['first-person', 'singular']])
    expect(cells).toContainEqual(['مُسْتَشْفًى', ['indefinite', 'singular']])
    expect(cells).toHaveLength(3)
  })
  it('词头模板的派生式：II、IV、VIII 不会被当成 I、V', () => {
    expect(verbInfo({ '1': 'I/a~u.pass.vn:كِتَابَة' })).toEqual({ form: 'I', vowels: 'a~u' })
    expect(verbInfo({ '1': 'II.pass' })).toEqual({ form: 'II', vowels: undefined })
    expect(verbInfo({ '1': 'IV' }).form).toBe('IV')
    expect(verbInfo({ '1': 'VIII.ipass' }).form).toBe('VIII')
    expect(verbInfo({ '1': 'X.pass' }).form).toBe('X')
    expect(verbInfo({ '1': 'Iq' }).form).toBe('Iq')
    expect(verbInfo({ '1': 'كتب<I/a~u>' })).toEqual({ form: 'I', vowels: 'a~u' })
    expect(verbInfo({ '1': 'IIII' })).toEqual({})
  })
  it('词根写成用空格隔开的字母', () => {
    expect(normalizeRoot('ك ت ب')).toBe('ك ت ب')
    expect(normalizeRoot('ك-ت-ب')).toBe('ك ت ب')
    expect(normalizeRoot('كَتَبَ')).toBe('ك ت ب')
    expect(normalizeRoot('ت ر ج م')).toBe('ت ر ج م')
    expect(normalizeRoot('x')).toBeUndefined()
  })
})

describe('中文释义', () => {
  it('繁简并列的译词取简体', () => {
    expect(simplifiedOf('書 /书')).toBe('书')
    expect(simplifiedOf('為甚麼 /為什麼 /为什么')).toBe('为什么')
    expect(simplifiedOf('水')).toBe('水')
  })
  it('去掉没展开的模板、变形说明、过长的括号；只有阿拉伯语的不要', () => {
    expect(cleanZhGloss(':Template:不可数 水')).toBe('水')
    expect(cleanZhGloss('كَتَبَ 的第三人称阳性单数过去式')).toBeNull()
    expect(cleanZhGloss('مَلِك')).toBeNull()
    expect(cleanZhGloss('多瑙河（欧洲河流；全长约2,850公里，发源于德国）')).toBe('多瑙河')
  })
})

describe('词形归到词条（词频）', () => {
  // 0 فِي 介词「在」；1 فَى 动词（变位 في 跟介词同形）；2 كِتَاب 名词；3 كَتَبَ 动词（变位 كتبت）
  const pos: PosTag[][] = [['adp'], ['verb'], ['noun'], ['verb']]
  const index = new FormIndex(pos)
  index.add('فِي', 0, 1)
  index.add('فَى', 1, 1)
  index.add('فِي', 1, 0.3)
  index.add('كِتَاب', 2, 1)
  index.add('كَتَبَ', 3, 1)
  index.add('كَتَبْتُ', 3, 0.6)
  it('虚词占住自己的写法：同形的动词变位只分到一点点', () => {
    const hits = index.analyse('في')
    expect(hits.get(0)).toBe(1)
    expect(hits.get(1)).toBeLessThan(0.05)
  })
  it('冠词、بِ 只接名词类；سَ 只接动词', () => {
    expect([...index.analyse('بالكتاب').keys()]).toEqual([2])
    expect(index.analyse('الكتبت').has(3)).toBe(false)
  })
  it('只分一遍：先验是各词条独有词形的频率', () => {
    const wf = new Map<string, number>([
      ['في', 0.03],
      ['فى', 0.0001],
      ['كتاب', 0.001],
      ['الكتاب', 0.002],
      ['كتبت', 0.0005]
    ])
    const corpus = analyseCorpus(wf, index, 4)
    expect(corpus.coverage.none).toBe(0)
    const base = new Float64Array([2, 1, 1, 1])
    // 虚词 فِي 没有独有的词形；不算它词头的频率时，几乎全被同形的动词分走
    const without = allocate(corpus, base, new Float64Array(4)).freq
    expect(without[0]).toBeLessThan(0.001)
    const extra = headwordEvidence(wf, ['في', 'فى', 'كتاب', 'كتب'], pos)
    expect([...extra]).toEqual([0.03, 0, 0, 0])
    const { freq } = allocate(corpus, base, extra)
    expect(freq[0]).toBeGreaterThan(0.029)
    expect(freq[1]).toBeLessThan(0.001)
    expect(freq[2]).toBeCloseTo(0.003, 6)
    expect(freq[3]).toBeCloseTo(0.0005, 6)
  })
})

describe('分级切分点', () => {
  it('CEFR 与 ACTFL 的名次切分对得上（ACTFL 每个小级都落在它对应的 CEFR 级里）', () => {
    const map: Record<string, string> = {
      NL: 'A1',
      NM: 'A1',
      NH: 'A1',
      IL: 'A1',
      IM: 'A2',
      IH: 'B1',
      AL: 'B1',
      AM: 'B2',
      AH: 'C1',
      S: 'C1',
      D: 'C2'
    }
    for (let rank = 1; rank <= 9000; rank += 7) expect(map[actflOf(rank)!]).toBe(cefrOf(rank))
    expect(cefrOf(9001)).toBeUndefined()
  })
})
