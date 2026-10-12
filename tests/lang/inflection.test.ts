import { describe, expect, it } from 'vitest'
import { inflectionData, type InflectionEntry } from '../../src/shared/lang/inflection'
import { koreanInflectionFallback } from '../../src/shared/lang/ko/inflection'
import { existsSync } from 'node:fs'
import { LexDb } from '../../src/main/lang/lexdb'
import type { LangCode } from '../../src/shared/lang/types'

const entry = (overrides: Partial<InflectionEntry> = {}): InflectionEntry => ({
  code: 'en',
  w: 'word',
  p: ['noun'],
  cls: [],
  forms: [],
  sources: [],
  ...overrides
})
const cells = (value: ReturnType<typeof inflectionData>) =>
  value.tables.flatMap((t) => t.rows.flatMap((r) => r.cells.flat()))

describe('recorded inflection organisation', () => {
  it('never fills a missing nominative singular with the lemma or infers an irregular case', () => {
    const source = entry({
      code: 'ru',
      w: 'книга',
      forms: [
        { form: 'кни́ги', tags: ['genitive', 'singular'] },
        { form: 'кни́ги', tags: ['nominative', 'plural'] }
      ]
    })
    const data = inflectionData(source),
      table = data.tables[0]
    const row = table.rows.find((r) => r.tags.includes('nominative'))!
    const singular = table.cols.findIndex((c) => c.includes('singular'))
    expect(row.cells[singular]).toEqual([])
    expect(cells(data).some((x) => x.form === 'книга')).toBe(false)
    expect(data.generated).toBe(0)
  })
  it('keeps masculine and feminine plural forms in distinct adjective slots', () => {
    const data = inflectionData(
      entry({
        code: 'fr',
        w: 'beau',
        p: ['adj'],
        forms: [
          { form: 'beaux', tags: ['masculine', 'plural'] },
          { form: 'belles', tags: ['feminine', 'plural'] }
        ]
      })
    )
    expect(data.tables[0].cols).toEqual([
      ['plural', 'masculine'],
      ['plural', 'feminine']
    ])
    expect(data.tables[0].rows[0].cells.map((c) => c.map((f) => f.form))).toEqual([
      ['beaux'],
      ['belles']
    ])
  })
  it('preserves informal/vos and both pronunciations without mutating source data', () => {
    const original = entry({
      code: 'es',
      w: 'tener',
      p: ['verb'],
      forms: [
        { form: 'tienes', tags: ['present', 'second-person', 'singular', 'informal'], ipa: '/a/' },
        {
          form: 'tenés',
          tags: ['present', 'second-person', 'singular', 'informal', 'vos-form'],
          ipa: '/b/'
        },
        { form: 'tienes', tags: ['singular', 'present', 'second-person', 'informal'], ipa: '/c/' }
      ]
    })
    const snapshot = JSON.stringify(original),
      data = inflectionData(original)
    expect(data.forms).toHaveLength(3)
    expect(cells(data).map((f) => f.form)).toEqual(['tienes', 'tenés', 'tienes'])
    expect(cells(data)[1].tags).toContain('vos-form')
    expect(cells(data).map((f) => f.ipa)).toEqual(['/a/', '/b/', '/c/'])
    expect(JSON.stringify(original)).toBe(snapshot)
  })
  it('classifies each tag sequence independently when one entry has multiple parts of speech', () => {
    const data = inflectionData(
      entry({
        w: 'go',
        p: ['verb', 'noun'],
        forms: [
          { form: 'went', tags: ['past'] },
          { form: 'goes', tags: ['plural'] },
          { form: 'going', tags: ['present', 'participle'] }
        ]
      })
    )
    expect(data.tables.some((t) => t.kind === 'verbal')).toBe(true)
    expect(data.tables.some((t) => t.kind === 'nominal')).toBe(true)
    expect(data.forms.map((f) => f.form)).toEqual(['went', 'goes', 'going'])
  })
  it('recognises explicitly shared cases but never creates a different surface spelling', () => {
    const data = inflectionData(
      entry({
        code: 'ru',
        forms: [{ form: 'кни́ги', tags: ['nominative', 'accusative', 'plural'] }]
      })
    )
    expect(data.tables[0].rows.map((r) => r.tags)).toEqual([['nominative'], ['accusative']])
    expect(new Set(cells(data).map((f) => f.form))).toEqual(new Set(['кни́ги']))
  })
  it('keeps empty-data and noninflecting entries honest', () => {
    for (const code of ['en', 'fr', 'ar', 'ru', 'gd', 'ko']) {
      const data = inflectionData(entry({ code, w: code === 'ko' ? '학교' : 'unknown' }))
      expect(data.forms).toEqual([])
      expect(data.tables).toEqual([])
      expect(data.generated).toBe(0)
      expect(data.notice.en).toContain('may not inflect')
    }
  })
  it('retains Gaelic eclipsis-labelled stored prefixes without inventing Irish consonant forms', () => {
    const data = inflectionData(
      entry({ code: 'gd', w: 'athair', forms: [{ form: 'n-athair', tags: ['eclipsis'] }] })
    )
    expect(data.tables[0].kind).toBe('mutation')
    expect(data.forms).toEqual([{ form: 'n-athair', tags: ['eclipsis'], provenance: 'dictionary' }])
  })
  it('deduplicates only identical form/tag/IPA tuples, retaining unknown tags', () => {
    const data = inflectionData(
      entry({
        forms: [
          { form: 'words', tags: ['plural', 'rare', 'dialect-X'] },
          { form: 'words', tags: ['dialect-X', 'rare', 'plural'] },
          { form: 'word', tags: ['unclassified-tag'] }
        ]
      })
    )
    expect(data.forms).toHaveLength(2)
    expect(data.forms[0].tags).toContain('dialect-X')
    expect(cells(data).some((f) => f.tags.includes('unclassified-tag'))).toBe(true)
  })
})

describe('safe, explicitly labelled Korean fallback', () => {
  it('defers entirely to recorded forms, even if the recorded paradigm is incomplete', () => {
    const source = entry({
      code: 'ko',
      w: '먹다',
      p: ['verb'],
      forms: [{ form: '먹어요', tags: ['-아요/어요'] }]
    })
    expect(koreanInflectionFallback(source)).toBeNull()
    expect(inflectionData(source).forms).toEqual([
      { form: '먹어요', tags: ['-아요/어요'], provenance: 'dictionary' }
    ])
  })
  it('generates only familiar forms for an unambiguous class and labels their provenance', () => {
    const data = inflectionData(entry({ code: 'ko', w: '먹다', p: ['verb'] }))
    expect(data.recorded).toBe(0)
    expect(data.generated).toBeGreaterThan(0)
    expect(data.forms.map((f) => f.form)).toEqual(
      expect.arrayContaining(['먹어', '먹어요', '먹습니다', '먹고', '먹지', '먹었어요'])
    )
    expect(data.forms.every((f) => f.provenance === 'rule')).toBe(true)
    expect(data.sources.some((s) => s.id === 'qonsona-ko-conjugator')).toBe(true)
  })
  it('does not guess a ㄷ/ㅂ/르 irregular class from an unannotated lemma', () => {
    for (const w of ['듣다', '춥다', '부르다'])
      expect(koreanInflectionFallback(entry({ code: 'ko', w, p: ['verb'] })), w).toBeNull()
  })
  it('uses a unique documented class but refuses ambiguous display labels', () => {
    const marked = koreanInflectionFallback(
      entry({ code: 'ko', w: '듣다', p: ['verb'], cls: ['ㄷ 불규칙'] })
    )
    expect(marked?.forms.map((f) => f.form)).toContain('들어요')
    expect(
      koreanInflectionFallback(entry({ code: 'ko', w: '춥다', p: ['adj'], cls: ['ㅂ 불규칙'] }))
    ).toBeNull()
  })
})

for (const [code, word] of [
  ['en', 'go'],
  ['fr', 'venir'],
  ['ko', '듣다'],
  ['es', 'tener'],
  ['ar', 'كبير'],
  ['ru', 'книга'],
  ['gd', 'bàta']
] as [LangCode, string][])
  it.skipIf(!existsSync(`resources/data/${code}/dict.sqlite`))(
    `${code}: real recorded data survives organisation unchanged`,
    () => {
      const db = new LexDb(code, `resources/data/${code}/dict.sqlite`)
      try {
        const hit = db.search(word).hits.find((h) => h.w === word) ?? db.search(word).hits[0]
        expect(hit).toBeDefined()
        const source = db.entry(hit.id)!,
          snapshot = JSON.stringify(source),
          data = inflectionData(source)
        expect(data.recorded).toBeGreaterThan(0)
        const allowed = new Set(source.forms.map((f) => f.form.trim()))
        expect(cells(data).every((f) => allowed.has(f.form))).toBe(true)
        expect(new Set(cells(data).map((f) => f.form))).toEqual(
          new Set(data.forms.map((f) => f.form))
        )
        expect(data.generated).toBe(0)
        expect(JSON.stringify(source)).toBe(snapshot)
      } finally {
        db.close()
      }
    }
  )
