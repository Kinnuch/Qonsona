/**
 * 框架的阅读分析：分句切词、对词条（常用的优先、变形找回原形）、短语合并、估难度，
 * 以及语法点的词序列匹配（隔几个词、可有可无、前后文只看不算、长的吞掉短的）。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LexDbWriter } from '../../scripts/lang/lexdb-writer'
import { LexDb } from '../../src/main/lang/lexdb'
import { analyzeLex } from '../../src/main/lang/analyze'
import { estimateLexLevel, findGrammar, matchAt } from '../../src/shared/lang/grammar'
import type { LexGrammarPoint, LexToken } from '../../src/shared/lang/types'
import { LANGS } from '../../src/shared/lang/registry'

const dir = mkdtempSync(join(tmpdir(), 'qonsona-analyze-'))
let db: LexDb
const key = LANGS.fr.rules.key

beforeAll(() => {
  const file = join(dir, 'fr.sqlite')
  const w = new LexDbWriter('fr', { file })
  w.source({ id: 't', name: 'Test', license: 'CC0', credit: 'me', home: 'https://example.org' })
  w.entry({
    w: 'avoir',
    p: ['verb'],
    s: [{ en: ['to have'], zh: ['有'], zs: 't' }],
    f: [
      ['a', 'third-person', 'singular', 'present', 'indicative'],
      ['ont', 'third-person', 'plural', 'present', 'indicative']
    ],
    lv: { cefr: 'A1' },
    fr: 10
  })
  // 同形的名词不常用：a 应该对到 avoir
  w.entry({ w: 'a', p: ['noun'], s: [{ en: ['the letter a'] }], lv: { cefr: 'C1' }, fr: 9000 })
  w.entry({
    w: 'manger',
    p: ['verb'],
    s: [{ en: ['to eat'], zh: ['吃'], zs: 't' }],
    f: [['mangé', 'past', 'participle']],
    lv: { cefr: 'A1' },
    fr: 300
  })
  w.entry({ w: 'il', p: ['pron'], s: [{ en: ['he'] }], lv: { cefr: 'A1' }, fr: 5 })
  w.entry({ w: 'bien', p: ['adv'], s: [{ en: ['well'] }], lv: { cefr: 'A1' }, fr: 40 })
  w.entry({ w: 'parce que', p: ['sconj'], s: [{ en: ['because'] }], lv: { cefr: 'A2' }, fr: 200 })
  w.entry({ w: 'pomme', p: ['noun'], g: 'f', s: [{ en: ['apple'] }], lv: { cefr: 'A1' }, fr: 2000 })
  w.finish()
  db = new LexDb('fr', file)
})
afterAll(() => {
  db?.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('阅读分析', () => {
  it('分句、对词条、变形找回原形、短语合并', () => {
    const a = analyzeLex(db, 'Il a bien mangé, parce que il a faim.\n\nPomme.')
    expect(a.sentences.map((s) => s.para)).toEqual([0, 1])
    const words = a.sentences[0].tokens.filter((t) => t.kind === 'word')
    expect(words.map((t) => t.lemma ?? null)).toEqual([
      'il',
      'avoir',
      'bien',
      'manger',
      'parce que',
      'il',
      'avoir',
      null
    ])
    const mange = words[3]
    expect(mange.tags).toEqual(['past', 'participle'])
    expect(mange).toMatchObject({ text: 'mangé', zh: '吃', lv: 'A1', pos: 'verb' })
    expect(words[4].text).toBe('parce que')
    // 段首大写也对得上
    expect(a.sentences[1].tokens[0].lemma).toBe('pomme')
  })

  it('估难度：有等级的词 85% 在哪一级以内', () => {
    expect(estimateLexLevel(['A1', 'A1', 'A1', 'A2'], ['A1', 'A2'])).toBeNull()
    // 七个词里只有一个 B2：85% 的位置还是 A1；多数是 B2 时才是 B2
    expect(
      estimateLexLevel(['A1', 'A1', 'A1', 'A1', 'A1', 'A1', 'B2'], ['A1', 'A2', 'B1', 'B2'])
    ).toBe('A1')
    expect(
      estimateLexLevel(['A1', 'A1', 'B2', 'B2', 'B2', 'B2', 'B2'], ['A1', 'A2', 'B1', 'B2'])
    ).toBe('B2')
    expect(
      estimateLexLevel(
        Array.from({ length: 20 }, (_, i) => (i < 18 ? 'A1' : 'B1')),
        ['A1', 'A2', 'B1']
      )
    ).toBe('A1')
  })
})

describe('认语法点', () => {
  const tok = (text: string, lemma: string, tags: string[] = [], start = 0): LexToken => ({
    text,
    lemma,
    tags,
    start,
    end: start + text.length,
    kind: 'word'
  })
  const sentence = [
    tok('il', 'il', [], 0),
    tok('a', 'avoir', ['present'], 3),
    tok('bien', 'bien', [], 5),
    tok('mangé', 'manger', ['past', 'participle'], 10)
  ]
  const passeCompose: LexGrammarPoint = {
    id: 'passe-compose',
    level: 'A1',
    name: { zh: '复合过去时', en: 'passé composé' },
    form: { zh: 'avoir / être + 过去分词', en: 'avoir / être + past participle' },
    meaning: { zh: '过去完成的动作', en: 'completed past action' },
    examples: [],
    patterns: [
      [
        { lemma: ['avoir', 'être'], tags: ['present'] },
        { tags: ['participle'], gap: 2 }
      ]
    ]
  }

  it('隔几个词也能对上，标出从助动词到分词', () => {
    const hits = findGrammar(
      [{ start: 0, end: 15, para: 0, tokens: sentence }],
      [passeCompose],
      key
    )
    expect(hits).toEqual([{ id: 'passe-compose', sentence: 0, start: 3, end: 15 }])
  })

  it('gap 不够、前后文、可有可无', () => {
    const tight: LexGrammarPoint = {
      ...passeCompose,
      id: 'tight',
      patterns: [[{ lemma: 'avoir' }, { tags: ['participle'] }]]
    }
    expect(findGrammar([{ start: 0, end: 15, para: 0, tokens: sentence }], [tight], key)).toEqual(
      []
    )
    // 前面要有 il（只看不算）
    expect(matchAt(sentence, 0, [{ lemma: 'il', ctx: true }, { lemma: 'avoir' }], key)).toEqual({
      first: 1,
      last: 1
    })
    // 副词可有可无
    expect(
      matchAt(
        sentence,
        1,
        [{ lemma: 'avoir' }, { pos: 'adv', optional: true }, { lemma: 'manger' }],
        key
      )
    ).toBeNull()
    const withPos = sentence.map((t) => (t.lemma === 'bien' ? { ...t, pos: 'adv' as const } : t))
    expect(
      matchAt(
        withPos,
        1,
        [{ lemma: 'avoir' }, { pos: 'adv', optional: true }, { lemma: 'manger' }],
        key
      )
    ).toEqual({ first: 1, last: 3 })
  })

  it('长的命中吞掉被它盖住的别的语法点', () => {
    const aux: LexGrammarPoint = {
      ...passeCompose,
      id: 'avoir-present',
      patterns: [[{ lemma: 'avoir' }]]
    }
    const hits = findGrammar(
      [{ start: 0, end: 15, para: 0, tokens: sentence }],
      [passeCompose, aux],
      key
    )
    expect(hits.map((h) => h.id)).toEqual(['passe-compose'])
  })
})
