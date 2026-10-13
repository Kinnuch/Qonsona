import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LexDbWriter } from '../../../scripts/lang/lexdb-writer'
import { LexDb } from '../../../src/main/lang/lexdb'
import { analyzeLex } from '../../../src/main/lang/analyze'
import { arVocalizedSurface } from '../../../src/shared/lang/ar/reading'
import { arLemmaCandidates, arRomanize } from '../../../src/shared/lang/ar/rules'
let db: LexDb, directory: string
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'qonsona-ar-reading-'))
  const file = join(directory, 'dict.sqlite'),
    writer = new LexDbWriter('ar', { file, mt: false })
  writer.source({
    id: 'fixture',
    name: 'Arabic regression fixture',
    license: 'MIT',
    credit: 'Qonsona tests',
    home: 'https://github.com/Kinnuch/Qonsona'
  })
  writer.entry({
    w: 'في',
    d: 'فِي',
    p: ['adp'],
    fr: 1,
    s: [{ en: ['in'] }],
    f: [['فِي'], ['فِيَّ', 'first-person', 'singular']]
  })
  writer.entry({
    w: 'عزز',
    d: 'عَزَّزَ',
    p: ['verb'],
    fr: 2,
    s: [{ en: ['strengthen'] }],
    f: [['يُعَزِّزُ', 'non-past', 'third-person', 'singular']]
  })
  writer.entry({
    w: 'تعزيز',
    d: 'تَعْزِيز',
    p: ['noun'],
    fr: 3,
    s: [{ en: ['strengthening'] }],
    f: []
  })
  writer.entry({
    w: 'واصل',
    d: 'وَاصَلَ',
    p: ['verb'],
    fr: 2,
    s: [{ en: ['continue'] }],
    f: [['تُوَاصِلُ', 'indicative', 'non-past', 'second-person', 'singular']]
  })
  writer.entry({
    w: 'تواصل',
    d: 'تَوَاصُل',
    p: ['noun'],
    fr: 3,
    s: [{ en: ['communication'] }],
    f: []
  })
  writer.entry({
    w: 'أعرب',
    d: 'أَعْرَبَ',
    p: ['verb'],
    fr: 4,
    s: [{ en: ['express'] }],
    f: [['مُعْرِب', 'participle']]
  })
  writer.entry({
    w: 'كتب',
    d: 'كَتَبَ',
    p: ['verb'],
    fr: 5,
    s: [{ en: ['write'] }],
    f: [['كُتِبَ', 'passive', 'past']]
  })
  writer.finish()
  db = new LexDb('ar', file)
})
afterAll(() => {
  db?.close()
  if (directory?.startsWith(join(tmpdir(), 'qonsona-ar-reading-')))
    rmSync(directory, { recursive: true, force: true })
})
const ruby = (surface: string) =>
  analyzeLex(db, surface)
    .sentences.flatMap((s) => s.tokens)
    .find((t) => t.kind === 'word')?.ruby
describe('Arabic source-backed reading vowels', () => {
  it('does not treat several written words as one inflected verb', () => {
    expect(arLemmaCandidates('في تعزيز')).toEqual([])
    expect(db.lookup('في تعزيز')).toBeNull()
    const tokens = analyzeLex(db, 'في تعزيز التواصل')
      .sentences.flatMap((s) => s.tokens)
      .filter((t) => t.kind === 'word')
    expect(tokens.map((t) => [t.text, t.ruby])).toEqual([
      ['في', 'fī'],
      ['تعزيز', 'taʿzīz'],
      ['التواصل', 'at-tawāṣul']
    ])
  })
  it('prefers an unmarked headword over a longer marked first-person homograph', () => {
    expect(db.lookup('في')?.form).toBe('فِي')
    expect(ruby('في')).toBe('fī')
    expect(ruby('فِيَّ')).toBe('fiyya')
    expect(ruby('في')).toBe('fī')
  })
  it('retains explicit vocalization and does not cache another reading under a stripped key', () => {
    expect(db.lookup('كُتِبَ')?.form).toBe('كُتِبَ')
    expect(ruby('كُتِبَ')).toBe('kutiba')
    expect(ruby('كَتَبَ')).toBe('kataba')
  })
  it('an article selects a nominal reading and restores source vowels and sun assimilation', () => {
    expect(db.lookup('التواصل')?.pos).toBe('noun')
    expect(ruby('التواصل')).toBe('at-tawāṣul')
    expect(arRomanize('التَّوَاصُل')).toBe('at-tawāṣul')
    expect(arRomanize('كَتَبُوا')).toBe('katabū')
  })
  it('restores the marked stem and known accusative suffix rather than displaying a consonant skeleton', () => {
    expect(ruby('معربا')).toBe('muʿriban')
    expect(arVocalizedSurface('معربا', 'مُعْرِب', ['accusative'])).toBe('مُعْرِبًا')
  })
  it('does not pretend to recover short vowels for unknown unmarked words or unmatched inflection', () => {
    expect(ruby('غنطزر')).toBeUndefined()
    expect(arVocalizedSurface('غنطزر', undefined, [])).toBeNull()
    expect(arVocalizedSurface('يكتبان', 'كَتَبَ', ['non-past'])).toBeNull()
  })
})
