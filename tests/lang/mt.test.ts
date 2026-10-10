/**
 * 中文释义补译（scripts/lang/mt-zh.ts）：写库时按「词头 + 词性 + 英文释义」补上没有中文的义项，
 * 标成 mt-en，并自动登记来源；已经有中文的、英文对不上的不动。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { LexDbWriter } from '../../scripts/lang/lexdb-writer'
import { MT_SOURCE, mtKey } from '../../scripts/lang/mt-zh'
import { LexDb } from '../../src/main/lang/lexdb'

const dir = mkdtempSync(join(tmpdir(), 'qonsona-mt-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('写库时补中文', () => {
  it('对得上才补，标 mt-en，来源自动登记；有中文的不覆盖', () => {
    const file = join(dir, 'fr.sqlite')
    const mt = new Map([
      [mtKey('maison', 'noun', ['house', 'home']), '房子；家'],
      [mtKey('maison', 'noun', ['firm']), '公司'],
      [mtKey('chat', 'noun', ['cat']), '（不该用上）']
    ])
    const w = new LexDbWriter('fr', { file, mt })
    w.source({ id: 't', name: 'Test', license: 'CC0', credit: 'me', home: 'https://example.org' })
    const maison = w.entry({
      w: 'maison',
      p: ['noun'],
      s: [{ en: ['house', 'home'] }, { en: ['firm'] }, { en: ['household'] }],
      fr: 10
    })
    const chat = w.entry({ w: 'chat', p: ['noun'], s: [{ en: ['cat'], zh: ['猫'], zs: 't' }] })
    w.finish()
    const db = new LexDb('fr', file)
    try {
      const e = db.entry(maison)!
      expect(e.senses.map((s) => [s.zh, s.zhSource?.id ?? null, s.zhSource?.machine])).toEqual([
        [['房子；家'], 'mt-en', true],
        [['公司'], 'mt-en', true],
        [[], null, undefined]
      ])
      expect(db.entry(chat)!.senses[0].zh).toEqual(['猫'])
      expect(db.sources().map((s) => s.id)).toEqual(['t', MT_SOURCE.id])
      // 补上的中文也能反查
      expect(db.search('公司').hits[0]?.id).toBe(maison)
    } finally {
      db.close()
    }
  })

  it('一条都没用上时不登记机器翻译的来源', () => {
    const file = join(dir, 'none.sqlite')
    const w = new LexDbWriter('fr', { file, mt: new Map() })
    w.source({ id: 't', name: 'Test', license: 'CC0', credit: 'me', home: 'https://example.org' })
    w.entry({ w: 'chat', p: ['noun'], s: [{ en: ['cat'] }] })
    w.finish()
    const db = new LexDb('fr', file)
    expect(db.sources().map((s) => s.id)).toEqual(['t'])
    db.close()
  })
})
