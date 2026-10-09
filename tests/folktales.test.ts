/**
 * 民间故事课的课文（data/ja/folktales.json：node scripts/data/folktales-ja.mjs 从青空文库下载，
 * npm run data:levels 算难度）：id 不重复、标题作者正文齐全、字数对得上、正文里没有青空文库的注音注记记号、
 * 难度是 N5～N1。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

interface Tale {
  id: string
  title: string
  author: string
  url: string
  colophon: string
  body: string
  chars: number
  level?: number | null
}

const read = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, '../data/ja', name), 'utf8'))
const { generated, tales } = read('folktales.json') as { generated: string; tales: Tale[] }
const articles = read('articles.json') as { id: string }[]

describe('民间故事的课文', () => {
  it('十到十四篇，生成日期是 YYYY-MM-DD', () => {
    expect(generated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(tales.length).toBeGreaterThanOrEqual(10)
    expect(tales.length).toBeLessThanOrEqual(14)
  })

  it('id 不重复，也不跟内置文章撞（两边都是 aozora-图书卡号）', () => {
    const ids = tales.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const a of articles) expect(ids).not.toContain(a.id)
  })

  it('标题、作者、正文、底本齐全，id 跟图书卡链接对得上', () => {
    for (const t of tales) {
      expect(t.title.trim(), t.id).not.toBe('')
      expect(t.author.trim(), t.id).not.toBe('')
      expect(t.body.trim(), t.id).not.toBe('')
      expect(t.colophon, t.id).toMatch(/^底本：/)
      const card = t.id.match(/^aozora-(\d+)$/)?.[1]
      expect(card, t.id).toBeDefined()
      expect(t.url, t.id).toMatch(
        new RegExp(String.raw`^https://www\.aozora\.gr\.jp/cards/\d{6}/card${card}\.html$`)
      )
    }
  })

  it('chars 跟内置文章一个算法：正文的长度（换行也算）', () => {
    for (const t of tales) expect(t.chars, t.id).toBe(t.body.length)
  })

  it('标题、正文里没有残留的注音、注记记号（《》｜［］＃），也没有认不得的外字（〓）', () => {
    for (const t of tales) expect(t.title + t.body, t.id).not.toMatch(/[《》｜［］＃〓]/)
  })

  it('段落之间一个换行：没有 \\r，空行最多连一行，行首行尾没有空白', () => {
    for (const t of tales) {
      expect(t.body, t.id).not.toMatch(/\r|\n{3,}/)
      for (const line of t.body.split('\n')) expect(line, t.id).toBe(line.trim())
    }
  })

  it('难度算好了，是 1～5（5 = N5 … 1 = N1）', () => {
    for (const t of tales) expect([1, 2, 3, 4, 5], t.id).toContain(t.level)
  })
})
