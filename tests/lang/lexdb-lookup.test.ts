/**
 * 查词的几处细节：拉丁字母输入转成这门语言的文字再查（fromLatin）、同一个词形还能是的别的词条（others）、
 * 去掉重音等记号比较时换回原文的位置（foldWithMap，例句里标词用）。
 * 用一门测试专用的假语言（代码 zy，西里尔字母），不碰七门语言自己的规则。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LexDbWriter } from '../../scripts/lang/lexdb-writer'
import { LexDb } from '../../src/main/lang/lexdb'
import { LANGS } from '../../src/shared/lang/registry'
import { cefrSystem } from '../../src/shared/lang/levels'
import { defaultKey, foldWithMap, stripMarks } from '../../src/shared/lang/text'
import type { LangCode, LangModule } from '../../src/shared/lang/types'

const CODE = 'zy' as LangCode
const LATIN: Record<string, string> = {
  d: 'д',
  o: 'о',
  m: 'м',
  a: 'а',
  s: 'с',
  t: 'т',
  l: 'л',
  i: 'и'
}

const FAKE: LangModule = {
  spec: {
    code: CODE,
    name: { zh: '测试语', en: 'Test' },
    nativeName: 'test',
    bcp47: 'ru',
    color: '#888888',
    direction: 'ltr',
    levelSystems: [cefrSystem([])],
    features: {
      texts: false,
      lexicon: true,
      alphabet: null,
      characters: null,
      grammar: false,
      inflection: false,
      phrasebook: false,
      idioms: false,
      stories: false,
      media: false,
      exam: false,
      ruby: null,
      romanization: false,
      speech: null
    },
    intro: { zh: '', en: '' }
  },
  rules: {
    key: (t) => stripMarks(defaultKey(t, 'ru')),
    fromLatin: (t) => [[...t.toLowerCase()].map((c) => LATIN[c] ?? c).join('')]
  }
}

const langs = LANGS as Record<string, LangModule>
const dir = mkdtempSync(join(tmpdir(), 'qonsona-lexdb-lookup-'))
let db: LexDb
const ids: Record<string, number> = {}

beforeAll(() => {
  langs[CODE] = FAKE
  const file = join(dir, 'zy.sqlite')
  const w = new LexDbWriter(CODE, { file, mt: false })
  w.source({ id: 't', name: 'Test', license: 'CC0', credit: 'me', home: 'https://example.org' })
  ids.dom = w.entry({
    w: 'дом',
    p: ['noun'],
    s: [{ en: ['house'], zh: ['房子'] }],
    f: [
      ['дома', 'genitive', 'singular'],
      ['дома', 'nominative', 'plural']
    ],
    fr: 10
  })
  ids.domaAdv = w.entry({ w: 'дома', p: ['adv'], s: [{ en: ['at home'], zh: ['在家'] }], fr: 50 })
  ids.stal = w.entry({ w: 'сталь', p: ['noun'], s: [{ en: ['steel'] }], fr: 900 })
  w.finish()
  db = new LexDb(CODE, file)
})
afterAll(() => {
  db?.close()
  delete langs[CODE]
  rmSync(dir, { recursive: true, force: true })
})

describe('拉丁字母输入', () => {
  it('转成这门语言的文字再查：词头、变形都算，标成 latin 并写出转写成了什么', () => {
    expect(db.search('dom').hits[0]).toMatchObject({
      id: ids.dom,
      match: 'latin',
      via: { form: 'дом' }
    })
    const doma = db.search('doma').hits
    expect(doma.map((h) => h.id).sort()).toEqual([ids.dom, ids.domaAdv].sort())
    expect(doma.every((h) => h.match === 'latin')).toBe(true)
    // 输入本来就是这门语言的文字时不转写
    expect(db.search('дом').hits[0]).toMatchObject({ id: ids.dom, match: 'exact' })
    // 转写后的前缀也补上（sta → ста → сталь）
    expect(db.search('sta').hits.map((h) => h.id)).toContain(ids.stal)
  })
})

describe('同形词', () => {
  it('同一个词形还能是的别的词条放进 others（常用的在前）', () => {
    const h = db.lookup('дома')!
    expect(h.entry).toBe(ids.dom)
    expect(h.others).toEqual([{ entry: ids.domaAdv, lemma: 'дома', pos: 'adv' }])
    // 同一词条的另一种标签进 alt，不进 others
    expect(h.alt?.length).toBe(1)
    expect(db.lookup('сталь')?.others).toBeUndefined()
  })
})

describe('去记号定位', () => {
  it('去掉重音、转小写，map 指回原文的位置', () => {
    const s = 'Он пил молоко́.'
    const { folded, map } = foldWithMap(s, 'ru')
    expect(folded).toBe('он пил молоко.')
    const i = folded.indexOf('молоко')
    // 换回原文时连词尾后面的重音符一起（「молоко」加重音符，到句号之前）
    expect(s.slice(map[i], map[i + 'молоко'.length])).toBe(s.slice(7, -1))
    expect(map).toHaveLength(folded.length + 1)
    expect(map[map.length - 1]).toBe(s.length)
  })
  it('阿拉伯语的元音符号也去掉', () => {
    const { folded } = foldWithMap('كَتَبَ', 'ar')
    expect(folded).toBe('كتب')
  })
})
