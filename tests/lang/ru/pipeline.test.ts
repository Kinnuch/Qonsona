/**
 * 俄语数据管线的小零件：变形表同形格子的合并、维基词典释义里转写的清理、标签的次序、OpenCC 繁转简。
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  cleanGloss,
  mapPos,
  mergeCells,
  sortTags,
  type Cell
} from '../../../scripts/data/ru/wiktionary'
import { ToSimplified, mysqlRows } from '../../../scripts/data/ru/read'

const dir = mkdtempSync(join(tmpdir(), 'qonsona-ru-pipeline-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const forms = (cells: Cell[], form: string): string[][] =>
  cells.filter((c) => c[0] === form).map((c) => c.slice(1))

describe('同形的格子合并', () => {
  it('只差一维的并成一项：名词的主格、宾格', () => {
    const out = mergeCells([
      ['стол', 'nominative', 'singular'],
      ['стол', 'accusative', 'singular'],
      ['стола́', 'genitive', 'singular']
    ])
    expect(forms(out, 'стол')).toEqual([['nominative', 'accusative', 'singular']])
    expect(forms(out, 'стола́')).toEqual([['genitive', 'singular']])
  })
  it('差两维的不并（красивого：阳性中性属格 / 阳性有生宾格）', () => {
    const out = mergeCells([
      ['краси́вого', 'genitive', 'masculine', 'neuter', 'singular'],
      ['краси́вого', 'accusative', 'masculine', 'singular', 'animate']
    ])
    expect(forms(out, 'краси́вого')).toHaveLength(2)
  })
  it('阴性的四个格并成一项', () => {
    const out = mergeCells(
      ['genitive', 'dative', 'instrumental', 'prepositional'].map(
        (c) => ['краси́вой', c, 'feminine', 'singular'] as Cell
      )
    )
    expect(forms(out, 'краси́вой')).toEqual([
      ['genitive', 'dative', 'instrumental', 'prepositional', 'feminine', 'singular']
    ])
  })
  it('主格复数与无生宾格复数不并（多了「无生」这一维）', () => {
    const out = mergeCells([
      ['краси́вые', 'nominative', 'plural'],
      ['краси́вые', 'accusative', 'plural', 'inanimate']
    ])
    expect(forms(out, 'краси́вые')).toHaveLength(2)
  })
  it('不变格的词十二格并成一项', () => {
    const cells: Cell[] = []
    for (const n of ['singular', 'plural'])
      for (const c of [
        'nominative',
        'genitive',
        'dative',
        'accusative',
        'instrumental',
        'prepositional'
      ])
        cells.push(['ко́фе', c, n])
    expect(mergeCells(cells)).toHaveLength(1)
  })
  it('标签按固定次序排', () => {
    expect(sortTags(['singular', 'first-person', 'present'])).toEqual([
      'present',
      'first-person',
      'singular'
    ])
    expect(sortTags(['plural', 'animate', 'accusative'])).toEqual([
      'accusative',
      'plural',
      'animate'
    ])
  })
})

describe('释义清理', () => {
  it('去掉转写，带着的意思留下', () => {
    expect(cleanGloss('diminutive of дом (dom); a little house')).toBe(
      'diminutive of дом; a little house'
    )
    expect(cleanGloss('female equivalent of учи́тель (učítelʹ): female teacher')).toBe(
      'female equivalent of учи́тель: female teacher'
    )
    expect(cleanGloss('see до́м (dóm, “house”)')).toBe('see до́м (“house”)')
    // 不是转写的括号不动
    expect(cleanGloss('to eat (food)')).toBe('to eat (food)')
    expect(cleanGloss('USA (= United States of America)')).toBe('USA (= United States of America)')
  })
})

describe('词性', () => {
  it('从属连词与并列连词分开', () => {
    expect(mapPos('conj', 'что')).toBe('sconj')
    expect(mapPos('conj', 'и')).toBe('cconj')
    expect(mapPos('name', 'Москва')).toBe('propn')
    expect(mapPos('prep', 'в')).toBe('adp')
    expect(mapPos('punct', '.')).toBeNull()
  })
})

describe('读原始数据', () => {
  it('MySQL 导出的行：转义、NULL、数字', () => {
    const sql =
      "INSERT INTO `words` VALUES (1,'челове\\'к',NULL,2.5),(2,'a\\\\b','x''y',3);\nINSERT INTO `other` VALUES (9,'z');"
    expect([...mysqlRows(sql, 'words')]).toEqual([
      [1, "челове'к", null, 2.5],
      [2, 'a' + String.fromCharCode(92) + 'b', "x'y", 3]
    ])
  })
  it('繁体转简体：先按词再按字', () => {
    const chars = join(dir, 'c.txt')
    const phrases = join(dir, 'p.txt')
    writeFileSync(chars, '# comment\n說\t说\n話\t话\n乾\t干 乾\n')
    writeFileSync(phrases, '乾隆\t乾隆\n')
    const t = new ToSimplified(chars, phrases)
    expect(t.convert('說話')).toBe('说话')
    expect(t.convert('乾淨，乾隆')).toBe('干淨，乾隆')
  })
})
