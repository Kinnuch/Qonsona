import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LexDbWriter } from '../../scripts/lang/lexdb-writer'
import { refreshDb } from '../../scripts/lang/refresh-db'
import { unpackEntry } from '../../src/main/lang/lexdb-schema'
import { gdLooseKey } from '../../src/shared/lang/gd/rules'
import { loadMt } from '../../scripts/lang/mt-zh'

describe('刷新词典保留学习记录引用', () => {
  it('保留词条、例句、词表及额外词形编号，重算宽松键并应用已有译文', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qonsona-refresh-'))
    const file = join(dir, 'gd.sqlite')
    try {
      const translations = loadMt(process.cwd(), 'gd')
      const first = [...translations][0]
      const [word, pos, gloss] = first[0].split('\t')
      const writer = new LexDbWriter('gd', { file, mt: false })
      writer.source({
        id: 'test',
        name: 'Test',
        license: 'CC0',
        credit: 'Test',
        home: 'https://example.org'
      })
      writer.meta('themes', [{ id: 'test', title: { zh: '测试', en: 'Test' } }])
      const id = writer.entry({ w: word, p: [pos as 'noun'], s: [{ en: [gloss] }] })
      writer.form(id, "dh'ionnsaich", ['past'])
      const example = writer.example({ text: 'Dh’ionnsaich mi.', en: 'I learned.', src: 'test' }, [
        id
      ])
      writer.list('theme:test', id, 7)
      writer.finish()
      const old = new DatabaseSync(file)
      old
        .prepare("UPDATE form SET key = 'dhionnsaich' WHERE form = ? AND loose = 1")
        .run("dh'ionnsaich")
      old.close()
      refreshDb('gd', file)
      const db = new DatabaseSync(file, { readOnly: true })
      try {
        const entry = db.prepare('SELECT id, data FROM entry').get() as {
          id: number
          data: Uint8Array
        }
        expect(entry.id).toBe(id)
        expect(unpackEntry(entry.data).s[0]).toMatchObject({ zh: [first[1]], zs: 'mt-en' })
        expect(db.prepare('SELECT example, entry FROM example_entry').get()).toMatchObject({
          example,
          entry: id
        })
        expect(db.prepare('SELECT name, entry, rank FROM list').get()).toMatchObject({
          name: 'theme:test',
          entry: id,
          rank: 7
        })
        const forms = db.prepare('SELECT key, tags FROM form WHERE form = ?').all("dh'ionnsaich")
        expect(forms.some((r) => r.key === gdLooseKey("dh'ionnsaich") && r.tags === 'past')).toBe(
          true
        )
        expect(forms.some((r) => r.key === 'dhionnsaich')).toBe(false)
        expect(
          JSON.parse(
            String(db.prepare("SELECT value FROM meta WHERE key='sources'").get()!.value)
          ).some((s: { id: string }) => s.id === 'mt-en')
        ).toBe(true)
      } finally {
        db.close()
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  it('不能保持编号时拒绝替换原库', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qonsona-refresh-'))
    const file = join(dir, 'gd.sqlite')
    try {
      const w = new LexDbWriter('gd', { file, mt: false })
      w.source({
        id: 'test',
        name: 'Test',
        license: 'CC0',
        credit: 'Test',
        home: 'https://example.org'
      })
      w.entry({ w: 'bàta', p: ['noun'], s: [{ en: ['boat'] }] })
      w.entry({ w: 'taigh', p: ['noun'], s: [{ en: ['house'] }] })
      w.finish()
      const db = new DatabaseSync(file)
      db.exec('DELETE FROM entry WHERE id=1')
      db.close()
      const before = readFileSync(file)
      expect(() => refreshDb('gd', file)).toThrow('词条 id 不连续')
      expect(readFileSync(file)).toEqual(before)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
