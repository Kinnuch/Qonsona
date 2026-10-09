/**
 * 主进程读框架语言的词典（src/main/lang/lexdb.ts）：查词的几种对上方式与先后、词条视图、例句、词表。
 * 用写库工具现做一个小库（法语的规则：小写、去重音的宽松键）。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LexDbWriter } from '../../scripts/lang/lexdb-writer'
import { LexDb } from '../../src/main/lang/lexdb'

const dir = mkdtempSync(join(tmpdir(), 'qonsona-lexdb-reader-'))
let db: LexDb
const ids: Record<string, number> = {}

beforeAll(() => {
  const file = join(dir, 'fr.sqlite')
  const w = new LexDbWriter('fr', { file, mt: false })
  w.source({ id: 't', name: 'Test', license: 'CC0', credit: 'me', home: 'https://example.org' })
  w.source({ id: 'mt-en', name: 'MT', license: 'CC0', credit: 'me', home: 'https://example.org' })
  ids.chat = w.entry({
    w: 'chat',
    p: ['noun'],
    g: 'm',
    ipa: ['ʃa'],
    s: [{ en: ['cat'], zh: ['猫'], zs: 't' }],
    f: [['chats', 'plural']],
    lv: { cefr: 'A1' },
    fr: 900,
    src: ['t']
  })
  ids.chateau = w.entry({
    w: 'château',
    p: ['noun'],
    g: 'm',
    s: [{ en: ['castle'], zh: ['城堡'], zs: 'mt-en' }],
    f: [['châteaux', 'plural']],
    lv: { cefr: 'B1' },
    fr: 3000
  })
  ids.ete = w.entry({ w: 'été', p: ['noun'], s: [{ en: ['summer'] }], lv: { cefr: 'A2' }, fr: 400 })
  ids.aller = w.entry({
    w: 'aller',
    p: ['verb'],
    s: [{ en: ['to go'], zh: ['去'], zs: 't' }],
    f: [
      ['vais', 'first-person', 'singular', 'present', 'indicative'],
      ['allé', 'past', 'participle']
    ],
    lv: { cefr: 'A1' },
    fr: 50
  })
  const ex = w.example(
    { text: 'Le chat dort.', en: 'The cat sleeps.', zh: '猫在睡觉。', zs: 't', src: 't' },
    [ids.chat]
  )
  w.example({ text: 'Je vais à Paris.', en: "I'm going to Paris.", src: 't' }, [ids.aller])
  void ex
  w.list('theme:animals', ids.chat, 1)
  w.finish()
  db = new LexDb('fr', file)
})
afterAll(() => {
  db?.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('查词', () => {
  it('词头、变形、去重音、中英文释义、前缀', () => {
    expect(db.ok).toBe(true)
    expect(db.search('chat').hits[0]).toMatchObject({
      id: ids.chat,
      match: 'exact',
      lv: 'A1',
      zh: '猫'
    })
    const vais = db.search('vais').hits[0]
    expect(vais).toMatchObject({ id: ids.aller, match: 'form' })
    expect(vais.via?.tags).toContain('present')
    expect(db.search('ete').hits[0]).toMatchObject({ id: ids.ete, match: 'loose' })
    expect(db.search('chateaux').hits[0]).toMatchObject({ id: ids.chateau, match: 'loose' })
    expect(db.search('城堡').hits[0]).toMatchObject({ id: ids.chateau, match: 'gloss' })
    expect(db.search('castle').hits[0]).toMatchObject({ id: ids.chateau, match: 'gloss' })
    // 前缀：常用的在前
    const ch = db.search('ch').hits.map((h) => h.id)
    expect(ch.slice(0, 2)).toEqual([ids.chat, ids.chateau])
    expect(db.search('   ').hits).toEqual([])
  })

  it('词条视图：义项、中文来源、变形表、分级、例句', () => {
    const e = db.entry(ids.chateau)!
    expect(e.senses[0].zhSource).toMatchObject({ id: 'mt-en', machine: true })
    expect(e.forms).toEqual([{ form: 'châteaux', tags: ['plural'] }])
    expect(e.levels[0]).toMatchObject({ system: 'cefr', primary: true })
    expect(e.levels[0].levels[0].id).toBe('B1')
    const chat = db.entry(ids.chat)!
    expect(chat.examples.map((x) => x.text)).toEqual(['Le chat dort.'])
    expect(chat.sources[0].id).toBe('t')
    expect(db.entry(99999)).toBeNull()
  })

  it('例句、词表、各级词数', () => {
    expect(db.examples('Paris').map((e) => e.text)).toEqual(['Je vais à Paris.'])
    expect(db.examples('vais')[0].text).toBe('Je vais à Paris.')
    expect(db.list('cefr:A1').map((w) => w.w)).toEqual(['aller', 'chat'])
    expect(db.list('theme:animals')[0]).toMatchObject({ w: 'chat', zh: '猫', en: 'cat' })
    expect(db.listCounts()).toMatchObject({
      'cefr:A1': 2,
      'cefr:A2': 1,
      'cefr:B1': 1,
      'theme:animals': 1
    })
    expect(db.levelCounts()).toMatchObject({ A1: 2, A2: 1, B1: 1, B2: 0 })
    expect(db.items([ids.ete, ids.chat]).map((w) => w.w)).toEqual(['été', 'chat'])
    expect(db.status()).toMatchObject({ available: true, entries: 4, examples: 2 })
  })
})
