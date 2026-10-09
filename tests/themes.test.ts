/**
 * 内置主题词本（data/ja/themes.json，scripts/data/themes-ja.mjs 生成）：主题 id 不重复、有中英标题、
 * 每个主题 20 个词以上、同一主题里词条不重复；有词典数据库时再查每个词条都在、写法与读音对得上。
 */
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'

interface ThemeData {
  generated: string
  themes: {
    id: string
    title: { zh: string; en: string }
    /** [词条 id, 写法, 读音] */
    words: [number, string, string][]
  }[]
}

const data = JSON.parse(
  readFileSync(resolve(__dirname, '../data/ja/themes.json'), 'utf8')
) as ThemeData

describe('内置主题词本', () => {
  it('主题 id 不重复，每个主题都有中英标题', () => {
    const ids = data.themes.map((t) => t.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of data.themes) {
      expect(t.title.zh, t.id).toBeTruthy()
      expect(t.title.en, t.id).toBeTruthy()
    }
  })

  it('每个主题 20 个词以上，同一主题里词条不重复', () => {
    for (const t of data.themes) {
      expect(t.words.length, t.id).toBeGreaterThanOrEqual(20)
      for (const [id, text, reading] of t.words)
        expect(Number.isInteger(id) && !!text && !!reading, `${t.id} ${text}`).toBe(true)
      const ids = t.words.map((w) => w[0])
      expect(new Set(ids).size, t.id).toBe(ids.length)
    }
  })
})

// 词典数据库要先跑 node scripts/data/build-ja.mjs 生成（不入库）；没有时跳过
const DB = resolve(__dirname, '../resources/data/ja/dict.sqlite')
const run = existsSync(DB) ? describe : describe.skip

run('主题词本对得上词典', () => {
  const db = existsSync(DB)
    ? new DatabaseSync(DB, { readOnly: true })
    : (null as unknown as DatabaseSync)
  afterAll(() => db?.close())

  it('每个词条都在，写法是这个词条的写法，读音是它的假名写法', () => {
    const entry = db.prepare('SELECT id FROM entry WHERE id = ?')
    // form 表按 (text, entry, kana) 存，按写法查才快
    const form = db.prepare('SELECT kana FROM form WHERE text = ? AND entry = ?')
    for (const t of data.themes)
      for (const [id, text, reading] of t.words) {
        const at = `${t.id} ${text}【${reading}】${id}`
        expect(entry.get(id), `${at}：没有这个词条`).toBeTruthy()
        expect(form.all(text, id).length, `${at}：写法不是这个词条的`).toBeGreaterThan(0)
        expect(
          form.all(reading, id).some((r) => r.kana),
          `${at}：读音不是这个词条的假名写法`
        ).toBe(true)
      }
  })
})
