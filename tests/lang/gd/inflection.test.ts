import { describe, expect, it } from 'vitest'
import {
  gdInflectionAlternations,
  GD_MUTATION_SOURCES,
  type GdInflectionEntry
} from '../../../src/shared/lang/gd/inflection'
import { gdKey } from '../../../src/shared/lang/gd/rules'
const entry = (
  w: string,
  g?: string,
  forms: GdInflectionEntry['forms'] = []
): GdInflectionEntry => ({ code: 'gd', w, p: ['noun'], g, forms, sources: [] })
const row = (w: string, g?: string, id = 'gd-lenition', forms: GdInflectionEntry['forms'] = []) =>
  gdInflectionAlternations(entry(w, g, forms)).find((a) => a.id === id)

describe('Gaelic conditional inflection display', () => {
  it.each([
    ['bàta', 'bhàta'],
    ['cù', 'chù'],
    ['doras', 'dhoras'],
    ['falt', 'fhalt'],
    ['gàrradh', 'ghàrradh'],
    ['màthair', 'mhàthair'],
    ['peann', 'pheann'],
    ['sùil', 'shùil'],
    ['taigh', 'thaigh']
  ])('shows %s -> %s without claiming a case or past tense', (word, form) => {
    const result = row(word)
    expect(result?.form).toBe(form)
    expect(result?.tags).toEqual(['lenition'])
    expect(result?.notice.en).toContain('does not derive')
    expect(result?.examples).not.toHaveLength(0)
  })
  it.each(['sgian', 'smùid', 'sporan', 'stòr'])('does not lenite s clusters in %s', (word) => {
    const result = row(word)
    expect(result?.form).toBe(word)
    expect(result?.tags).toEqual(['unchanged'])
    expect(result?.notice.en).toContain('resist')
  })
  it.each([
    ['sràid', 'shràid'],
    ['slat', 'shlat'],
    ['snàthad', 'shnàthad']
  ])('handles s before eligible l/n/r in %s', (word, form) => expect(row(word)?.form).toBe(form))
  it.each(['leabaidh', 'nead', 'rathad'])(
    'keeps l/n/r spelling without denying phonetic lenition in %s',
    (word) => {
      const result = row(word)
      expect(result?.form).toBe(word)
      expect(result?.notice.en).toContain('pronunciation can change')
      expect(result?.form).not.toMatch(/^[lnr]h/)
    }
  )
  it.each([
    ['bàta', 'm', 'am bàta'],
    ['cù', 'm', 'an cù'],
    ['bean', 'f', "a' bhean"],
    ['faoileag', 'f', 'an fhaoileag'],
    ['sùil', 'f', 'an t-sùil'],
    ['sràid', 'f', 'an t-sràid'],
    ['slat', 'f', 'an t-slat'],
    ['snàthad', 'f', 'an t-snàthad'],
    ['sgian', 'f', 'an sgian'],
    ['smùid', 'f', 'an smùid'],
    ['sporan', 'm', 'an sporan'],
    ['stòr', 'm', 'an stòr'],
    ['deoch', 'f', 'an deoch'],
    ['taigh', 'm', 'an taigh'],
    ['leabaidh', 'f', 'an leabaidh'],
    ['nighean', 'f', 'an nighean'],
    ['rathad', 'm', 'an rathad'],
    ['uisge', 'm', 'an t-uisge'],
    ['uinneag', 'f', 'an uinneag']
  ])('selects a checked gender-sensitive nominative article for %s', (word, gender, form) => {
    const result = row(word, gender, 'gd-article-nominative-singular')
    expect(result?.form).toBe(form)
    expect(result?.tags).toContain('nominative')
    expect(result?.tags).toContain('singular')
  })
  it('refuses unknown, ambiguous or conflicting gender and plural-only heads', () => {
    for (const e of [
      entry('bean'),
      entry('muir', 'mf'),
      entry('taigh', 'f'),
      entry('faclair', 'm'),
      entry('daoine', 'm'),
      entry('gealach')
    ])
      expect(
        gdInflectionAlternations(e).some((a) => a.id === 'gd-article-nominative-singular')
      ).toBe(false)
  })
  it('applies h/n prothesis only to vowel-initial nouns and never generates Irish consonant eclipsis', () => {
    expect(row('athair', 'm', 'gd-possessive-h')?.form).toBe('a h-athair')
    expect(row('athair', 'm', 'gd-possessive-n')?.form).toBe('ar n-athair')
    expect(row('òran', 'm', 'gd-possessive-n')?.tags).toContain('n-prothesis')
    for (const word of ['bàta', 'cù', 'doras'])
      expect(
        gdInflectionAlternations(entry(word)).some(
          (a) => a.form.startsWith('ar n-') || /^ar (mb|gc|nd)/.test(a.form)
        )
      ).toBe(false)
  })
  it('does not invent noun plurals, but adds h- to an actual plain plural from the dictionary', () => {
    expect(row('òran', 'm', 'gd-article-plural-òrain')).toBeUndefined()
    const forms = [
      { form: 'òrain', tags: ['plural'] },
      { form: 'òrain', tags: ['genitive', 'singular'] },
      { form: 'òrannan', tags: ['genitive', 'plural'] },
      { form: 'òrain', tags: ['nominative', 'plural'] },
      { form: 'eich', tags: ['dative', 'plural'] }
    ]
    const result = gdInflectionAlternations(entry('òran', 'm', forms)).filter((a) =>
      a.id.startsWith('gd-article-plural')
    )
    expect(result.map((a) => a.form)).toEqual(['na h-òrain'])
    expect(result[0].examples[0].text).toContain('na h-òrain')
    expect(forms).toHaveLength(5)
  })
  it('prefers actual recorded lenition provenance and retains all other dictionary forms unchanged', () => {
    const forms = [
      { form: 'bhàta', tags: ['lenition'], ipa: '/vaːt̪ə/' },
      { form: 'bàta', tags: ['genitive', 'singular'] },
      { form: 'bàtaichean', tags: ['plural'] }
    ]
    const e = entry('bàta', 'm', forms)
    const before = structuredClone(e)
    const result = gdInflectionAlternations(e)
    expect(result.find((a) => a.id === 'gd-lenition')?.provenance).toBe('dictionary')
    expect(result.find((a) => a.id === 'gd-article-nominative-singular')?.provenance).toBe('rule')
    expect(e).toEqual(before)
  })
  it('does not invent full sentences for an uncurated entry and will use a real attached sentence', () => {
    const e = entry('balach', 'm', [{ form: 'bhalach', tags: ['lenition'] }])
    expect(gdInflectionAlternations(e).flatMap((a) => a.examples)).toEqual([])
    e.sources = [
      {
        id: 'fixture',
        name: 'Fixture corpus',
        credit: 'Test',
        license: 'CC0',
        home: 'https://example.org/'
      }
    ]
    e.examples = [
      { id: 1, text: 'Tha mo bhalach an seo.', en: 'My boy is here.', src: 'fixture' },
      { id: 2, text: 'Tha mo bhalachan an seo.', en: 'My boys are here.', src: 'fixture' }
    ]
    const examples = gdInflectionAlternations(e).find((a) => a.id === 'gd-lenition')!.examples
    expect(examples).toHaveLength(1)
    expect(examples[0]).toMatchObject({
      text: e.examples[0].text,
      provenance: 'dictionary',
      sourceId: 'fixture',
      translation: { en: e.examples[0].en }
    })
  })
  it('does not produce possession phrases for verbs or derive irregular pasts', () => {
    const result = gdInflectionAlternations({ ...entry('faic'), p: ['verb'] })
    expect(result.map((a) => a.form)).toEqual(['fhaic'])
    expect(result.flatMap((a) => a.examples)).toEqual([])
    expect(result.some((a) => a.tags.includes('past'))).toBe(false)
  })
  it('rejects an already mutated head, phrases, hyphenated compounds and another language', () => {
    for (const word of ['bhàta', "a' bhean", 't-uisge', 'bàta-mòr'])
      expect(gdInflectionAlternations(entry(word, 'm'))).toEqual([])
    expect(gdInflectionAlternations({ ...entry('bàta', 'm'), code: 'es' })).toEqual([])
  })
  it('preserves displayed case and normalizes decomposed spelling without mutating the entry', () => {
    expect(row('BÀTA', 'm')?.form).toBe('BHÀTA')
    expect(row('ba' + String.fromCharCode(0x300) + 'ta', 'm')?.form).toBe('bhàta')
  })
  it('keeps examples bilingual, gives official rule references, and marks original examples honestly', () => {
    for (const [word, gender] of [
      ['bàta', 'm'],
      ['cù', 'm'],
      ['sùil', 'f'],
      ['leabaidh', 'f'],
      ['athair', 'm'],
      ['òran', 'm']
    ])
      for (const result of gdInflectionAlternations(entry(word, gender))) {
        expect(
          result.sources.some((s) => GD_MUTATION_SOURCES.some((known) => known.id === s.id))
        ).toBe(true)
        for (const ex of result.examples) {
          expect(ex.translation?.zh).toBeTruthy()
          expect(ex.translation?.en).toBeTruthy()
          expect(gdKey(ex.text)).toContain(gdKey(result.form))
          expect(ex.provenance).toBe('original')
          expect(ex.source?.license).toBe('MIT')
        }
      }
  })
})
