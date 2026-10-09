/**
 * 框架的词典数据库：写库工具（scripts/lang/lexdb-writer.ts）写出来的东西能按约定读回来——
 * 词条 JSON、查词键（严格与宽松）、释义反查、分级词表、例句挂接、meta。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import { LexDbWriter } from '../../scripts/lang/lexdb-writer'
import {
  SCHEMA_VERSION,
  enGlossKey,
  unpackEntry,
  zhGlossKeys
} from '../../src/main/lang/lexdb-schema'
import { LANGS, langModule } from '../../src/shared/lang/registry'
import { primarySystem } from '../../src/shared/lang/levels'
import { segmentSentences, segmentWords } from '../../src/shared/lang/text'

const dir = mkdtempSync(join(tmpdir(), 'qonsona-lexdb-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('语言登记', () => {
  it('每门语言恰好一套主分级，主分级是能力等级', () => {
    for (const m of Object.values(LANGS)) {
      const p = primarySystem(m.spec.levelSystems)
      expect(p.kind).toBe('proficiency')
      expect(p.levels.length).toBeGreaterThanOrEqual(3)
      expect(m.spec.code).toBeTruthy()
    }
    expect(langModule('ja')).toBeNull()
    expect(langModule('fr')?.spec.code).toBe('fr')
  })
})

describe('写库与读回', () => {
  it('词条、查词键、反查、词表、例句、meta', () => {
    const file = join(dir, 'fr.sqlite')
    const w = new LexDbWriter('fr', { file })
    w.source({
      id: 'test',
      name: 'Test',
      license: 'CC0',
      credit: 'me',
      home: 'https://example.org'
    })
    const chat = w.entry({
      w: 'chat',
      p: ['noun'],
      g: 'm',
      s: [{ en: ['cat'], zh: ['猫；家猫'], zs: 'test' }],
      f: [['chats', 'plural']],
      lv: { cefr: 'A1' },
      fr: 900,
      src: ['test']
    })
    const ete = w.entry({
      w: 'été',
      p: ['noun'],
      s: [{ en: ['summer'] }],
      lv: { cefr: 'A2' },
      fr: 400
    })
    const ex = w.example({ text: 'Le chat dort.', en: 'The cat is sleeping.', src: 'test' }, [chat])
    w.list('theme:animals', chat, 1)
    const stats = w.finish()
    expect(stats.entries).toBe(2)
    expect(stats.lists).toMatchObject({ 'cefr:A1': 1, 'cefr:A2': 1, 'theme:animals': 1 })

    const db = new DatabaseSync(file, { readOnly: true })
    const meta = Object.fromEntries(
      (db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map(
        (r) => [r.key, r.value]
      )
    )
    expect(meta.schema).toBe(SCHEMA_VERSION)
    expect(meta.lang).toBe('fr')
    expect(JSON.parse(meta.sources)[0].id).toBe('test')
    const row = db.prepare('SELECT * FROM entry WHERE id = ?').get(chat) as {
      w: string
      lv: string
      data: Uint8Array
    }
    expect(row.lv).toBe('A1')
    expect(unpackEntry(row.data).g).toBe('m')
    // 复数形查得到原形；去掉重音的宽松键也在
    expect(
      (db.prepare("SELECT entry FROM form WHERE key = 'chats'").get() as { entry: number }).entry
    ).toBe(chat)
    expect(
      (
        db.prepare("SELECT entry FROM form WHERE key = 'ete' AND loose = 1").get() as {
          entry: number
        }
      ).entry
    ).toBe(ete)
    // 释义反查：英文整条、英文全文检索、中文拆开的每一段
    expect(
      (
        db.prepare("SELECT entry FROM gloss_key WHERE key = 'cat' AND lang = 'en'").get() as {
          entry: number
        }
      ).entry
    ).toBe(chat)
    expect(
      (db.prepare("SELECT rowid AS e FROM gloss WHERE gloss MATCH 'summer'").get() as { e: number })
        .e
    ).toBe(ete)
    expect(
      (
        db.prepare("SELECT entry FROM gloss_key WHERE key = '家猫' AND lang = 'zh'").get() as {
          entry: number
        }
      ).entry
    ).toBe(chat)
    expect(
      (db.prepare('SELECT entry FROM example_entry WHERE example = ?').get(ex) as { entry: number })
        .entry
    ).toBe(chat)
    db.close()
  })

  it('词性、分级写错了直接报错', () => {
    const w = new LexDbWriter('fr', { file: join(dir, 'bad.sqlite') })
    expect(() => w.entry({ w: 'x', p: ['noun-ish' as never], s: [{ en: ['x'] }] })).toThrow()
    expect(() => w.entry({ w: 'x', p: ['noun'], s: [{ en: ['x'] }], lv: { cefr: 'Z9' } })).toThrow()
    expect(() => w.entry({ w: 'x', p: ['noun'], s: [{ en: ['x'] }], lv: { nope: 'A1' } })).toThrow()
    w.db.close()
  })

  it('释义键', () => {
    expect(enGlossKey('to eat (food)')).toBe('eat')
    expect(enGlossKey('The cat.')).toBe('cat')
    expect(zhGlossKeys('吃；吃饭（口语）, 进食')).toEqual(['吃', '吃饭', '进食'])
  })
})

describe('切词与分句', () => {
  it('Intl.Segmenter 切出的段首尾相接', () => {
    const text = "L'été, il fait 30 degrés !"
    const t = segmentWords(text, 'fr')
    expect(t.map((x) => x.text).join('')).toBe(text)
    expect(t.filter((x) => x.kind === 'num').map((x) => x.text)).toEqual(['30'])
  })
  it('分句并记段落', () => {
    const s = segmentSentences('Bonjour. Ça va ?\n\nOui.', 'fr')
    expect(s.map((x) => x.para)).toEqual([0, 0, 1])
  })
})
