/**
 * 变形表排成网格（src/shared/lang/paradigm.ts）：格 × 数、格 × 性 / 复数、人称 × 数（每个时态一张）、
 * 只有性数的一行、带性的人称、格子里的小注、排不进去的照旧。
 */
import { describe, expect, it } from 'vitest'
import { paradigm, type ParadigmForm, type ParadigmGrid } from '../../src/shared/lang/paradigm'

const f = (form: string, ...tags: string[]): ParadigmForm => ({ form, tags })
/** 网格写成「行标签: 各列」便于比较 */
const show = (g: ParadigmGrid): string[] =>
  g.rows.map(
    (r) =>
      `${r.tags.join(' ') || '-'}: ${r.cells
        .map(
          (c) =>
            c.map((x) => x.form + (x.note.length ? `(${x.note.join(',')})` : '')).join('/') || '·'
        )
        .join(' | ')}`
  )

describe('名词：格 × 数', () => {
  it('一个形带两个格时两格都填，主格单数空着时填原形', () => {
    const { grids, rest } = paradigm(
      [
        f('стола', 'genitive', 'singular'),
        f('столу', 'dative', 'singular'),
        f('стол', 'accusative', 'singular'),
        f('столы', 'nominative', 'accusative', 'plural'),
        f('столов', 'genitive', 'plural'),
        f('столам', 'dative', 'plural')
      ],
      'стол'
    )
    expect(rest).toEqual([])
    expect(grids).toHaveLength(1)
    expect(grids[0].cols).toEqual([['singular'], ['plural']])
    expect(show(grids[0])).toEqual([
      'nominative: стол | столы',
      'genitive: стола | столов',
      'dative: столу | столам',
      'accusative: стол | столы'
    ])
  })
})

describe('形容词：格 × 阳 / 中 / 阴 / 复数', () => {
  it('性做列，复数单独一列；有生 / 无生写成小注', () => {
    const { grids } = paradigm([
      f('новый', 'nominative', 'masculine', 'singular'),
      f('новое', 'nominative', 'neuter', 'singular'),
      f('новая', 'nominative', 'feminine', 'singular'),
      f('новые', 'nominative', 'plural'),
      f('нового', 'accusative', 'masculine', 'singular', 'animate'),
      f('новый', 'accusative', 'masculine', 'singular', 'inanimate')
    ])
    expect(grids[0].cols).toEqual([['masculine'], ['neuter'], ['feminine'], ['plural']])
    expect(show(grids[0])).toEqual([
      'nominative: новый | новое | новая | новые',
      'accusative: нового(animate)/новый(inanimate) | · | · | ·'
    ])
  })

  it('只有性数的（俄语过去时）排成一行，按时态分表', () => {
    const { grids } = paradigm([
      f('читал', 'past', 'masculine', 'singular'),
      f('читала', 'past', 'feminine', 'singular'),
      f('читало', 'past', 'neuter', 'singular'),
      f('читали', 'past', 'plural')
    ])
    expect(grids[0].title).toEqual(['past'])
    expect(show(grids[0])).toEqual(['-: читал | читало | читала | читали'])
  })
})

describe('动词：每个时态、语气一张人称 × 数', () => {
  it('法语直陈式现在时与简单过去时分两张', () => {
    const { grids, rest } = paradigm([
      f('mange', 'first-person', 'singular', 'present', 'indicative'),
      f('manges', 'second-person', 'singular', 'present', 'indicative'),
      f('mange', 'third-person', 'singular', 'present', 'indicative'),
      f('mangeons', 'first-person', 'plural', 'present', 'indicative'),
      f('mangez', 'second-person', 'plural', 'present', 'indicative'),
      f('mangent', 'third-person', 'plural', 'present', 'indicative'),
      f('mangeai', 'first-person', 'singular', 'past-historic'),
      f('mangeas', 'second-person', 'singular', 'past-historic'),
      f('mangea', 'third-person', 'singular', 'past-historic'),
      f('mangé', 'past', 'participle')
    ])
    expect(grids.map((g) => g.title.join(' '))).toEqual(['indicative present', 'past-historic'])
    expect(show(grids[0])).toEqual([
      'first-person: mange | mangeons',
      'second-person: manges | mangez',
      'third-person: mange | mangent'
    ])
    expect(rest.map((x) => x.form)).toEqual(['mangé'])
  })

  it('带性的人称各成一行，双数一列（阿拉伯语）', () => {
    const { grids } = paradigm([
      f('كتبت', 'first-person', 'singular', 'past'),
      f('كتبتَ', 'second-person', 'masculine', 'singular', 'past'),
      f('كتبتِ', 'second-person', 'feminine', 'singular', 'past'),
      f('كتبتما', 'second-person', 'dual', 'past'),
      f('كتب', 'third-person', 'masculine', 'singular', 'past'),
      f('كتبت', 'third-person', 'feminine', 'singular', 'past'),
      f('كتبوا', 'third-person', 'masculine', 'plural', 'past')
    ])
    const g = grids[0]
    expect(g.cols).toEqual([['singular'], ['dual'], ['plural']])
    expect(g.rows.map((r) => r.tags.join(' '))).toEqual([
      'first-person',
      'second-person',
      'second-person masculine',
      'second-person feminine',
      'third-person masculine',
      'third-person feminine'
    ])
  })
})

describe('排不进网格的', () => {
  it('格子太少、没有格人称数性的标签：照旧一行一组', () => {
    const { grids, rest } = paradigm([f('chats', 'plural'), f('chaton', 'diminutive')], 'chat')
    expect(grids).toEqual([])
    expect(rest.map((x) => x.form)).toEqual(['chaton', 'chats'])
  })
  it('盖尔语名词：主格、属格、与格、呼格 × 单复数，主格单数填原形', () => {
    const { grids } = paradigm(
      [
        f('bàta', 'genitive', 'singular'),
        f('bhàta', 'vocative', 'singular'),
        f('bàtaichean', 'nominative', 'plural'),
        f('bhàtaichean', 'vocative', 'plural')
      ],
      'bàta'
    )
    expect(show(grids[0])).toEqual([
      'nominative: bàta | bàtaichean',
      'genitive: bàta | ·',
      'vocative: bhàta | bhàtaichean'
    ])
  })
})
