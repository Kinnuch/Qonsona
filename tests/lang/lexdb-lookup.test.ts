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
import { defaultKey, foldWithMap, segmentSentences, stripMarks } from '../../src/shared/lang/text'
import type { LangCode, LangModule } from '../../src/shared/lang/types'
import { tagLabel, tagsLabel } from '../../src/shared/lang/tags'

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
    fromLatin: (t) => [[...t.toLowerCase()].map((c) => LATIN[c] ?? c).join('')],
    // 词尾 ы 当复数去掉（只为测猜原形的筛选）
    lemmaCandidates: (t) => (t.endsWith('ы') ? [{ lemma: t.slice(0, -1), tags: ['plural'] }] : []),
    guessFits: (_g, row) => row.tags.includes('lemma')
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
  // 大小写不同的同形词：US 少用、us 常用
  ids.US = w.entry({ w: 'US', p: ['abbr'], s: [{ en: ['United States'], zh: ['美国'] }], fr: 500 })
  ids.us = w.entry({ w: 'us', p: ['pron'], s: [{ en: ['we'], zh: ['我们'] }], fr: 20 })
  // 中文反查：常用的那个第一条中文不是「放弃」，少用的那个第一条就是
  ids.leave = w.entry({
    w: 'уйти',
    p: ['verb'],
    s: [{ en: ['to leave'], zh: ['离开；放弃'] }],
    fr: 30
  })
  ids.abandon = w.entry({
    w: 'бросить',
    p: ['verb'],
    s: [{ en: ['to abandon'], zh: ['放弃；抛弃'] }],
    fr: 800
  })
  // 猜原形的筛选：常用的 сто 有个（假的）变形 стол，名词 стол 少用
  ids.sto = w.entry({
    w: 'сто',
    p: ['num'],
    s: [{ en: ['hundred'] }],
    f: [['стол', 'genitive', 'plural']],
    fr: 1
  })
  ids.stol = w.entry({ w: 'стол', p: ['noun'], s: [{ en: ['table'] }], fr: 100 })
  // 前缀只在原形上找：只有变形 живу 以「жив」开头
  ids.zhit = w.entry({
    w: 'жить',
    p: ['verb'],
    s: [{ en: ['to live'] }],
    f: [['живу', 'first-person', 'singular', 'present']],
    fr: 40
  })
  // 拼写完全一致的在前：重音不同的同形词
  ids.muka1 = w.entry({ w: 'мука', d: 'мука́', p: ['noun'], s: [{ en: ['flour'] }], fr: 60 })
  ids.muka2 = w.entry({ w: 'мука', d: 'му́ка', p: ['noun'], s: [{ en: ['torment'] }], fr: 300 })
  // 词族：同一个「词根」
  w.form(ids.dom, 'д м', ['root'])
  w.form(ids.domaAdv, 'д м', ['root'])
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

describe('查词排序', () => {
  it('大小写完全一样的在前', () => {
    expect(db.search('US').hits[0].id).toBe(ids.US)
    expect(db.search('us').hits[0].id).toBe(ids.us)
  })
  it('中文反查：第一条中文释义正好是查的词的在前', () => {
    const hits = db.search('放弃').hits.map((h) => h.id)
    expect(hits.slice(0, 2)).toEqual([ids.abandon, ids.leave])
  })
})

describe('分句', () => {
  it('前一句停在缩写上（noBreakAfter）就不断开', () => {
    const text = 'Mr. Smith met Dr. Jones. They talked.'
    const plain = segmentSentences(text, 'en').map((r) => text.slice(r.start, r.end))
    const keep = segmentSentences(text, 'en', /\b(?:Mr|Dr)\.$/).map((r) =>
      text.slice(r.start, r.end)
    )
    expect(keep).toEqual(['Mr. Smith met Dr. Jones.', 'They talked.'])
    expect(plain.length).toBeGreaterThanOrEqual(keep.length)
  })
})

describe('猜原形的筛选与前缀', () => {
  it('guessFits 只认原形行：столы 猜出 стол，对上名词 стол，不对上 сто 的变形', () => {
    expect(db.lookup('столы')).toMatchObject({ entry: ids.stol, tags: ['plural'] })
    expect(db.lookup('столы')?.form).toBeUndefined()
    expect(db.search('столы').hits[0]).toMatchObject({ id: ids.stol, match: 'guess' })
  })
  it('前缀只在原形上找：查 жив 不出 жить（只有变形 живу 以它开头）', () => {
    expect(db.search('жив').hits.map((h) => h.id)).not.toContain(ids.zhit)
    expect(db.search('жи').hits.map((h) => h.id)).toContain(ids.zhit)
  })
  it('查词结果带上对上的那一行的原文写法：同一词条里记号最全的那行（转写、注音用）', () => {
    expect(db.lookup('мука')?.form).toBe('мука́')
  })
})

describe('拼写完全一致的在前', () => {
  it('带重音输入时重音对得上的在前，不带时按常用', () => {
    expect(db.search('му́ка').hits[0].id).toBe(ids.muka2)
    expect(db.search('мука').hits[0].id).toBe(ids.muka1)
  })
})

describe('词族', () => {
  it('按标着 root 的行列出同一词根的词，写不写空格都行', () => {
    const both = [ids.dom, ids.domaAdv].sort()
    expect(
      db
        .family('д м', 'root')
        .map((m) => m.id)
        .sort()
    ).toEqual(both)
    expect(
      db
        .family('дм', 'root')
        .map((m) => m.id)
        .sort()
    ).toEqual(both)
    expect(db.family('д м', 'hanja')).toEqual([])
  })
})

describe('叫法', () => {
  it('这门语言自己的叫法优先，没有的用通用的', () => {
    const own = { 'non-past': { zh: '现在式', en: 'non-past' } }
    expect(tagsLabel(['non-past', 'plural'], 'zh', own)).toBe('现在式 · 复数')
    expect(tagLabel('plural', 'en', own)).toBe('plural')
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
