import { describe, expect, it } from 'vitest'
import { eldamoSource } from '../../src/shared/lang/eldamo-source'

const base = {
  code: 'qya',
  w: 'Elda',
  x: {
    eldamo: {
      id: '3583944535',
      url: 'https://eldamo.org/content/words/word-3583944535.html',
      language: 'q',
      period: 'late',
      status: ['Tolkien-referenced'],
      references: [{ source: 'WJ/374', v: 'Elda' }]
    }
  }
}
describe('Eldamo source presentation', () => {
  it('uses readable period/reliability labels and verified per-word links', () => {
    const view = eldamoSource(base)!
    expect(view.period.zh).toContain('晚期')
    expect(view.language.en).toBe('Late Quenya')
    expect(view.status[0].zh).toBe('有托尔金文献引用')
    expect(view.eldamoUrl).toBe(base.x.eldamo.url)
    expect(view.elfdictUrl).toBe('https://www.elfdict.com/w/Elda')
    expect(view.references).toEqual([{ citation: 'WJ/374', form: 'Elda' }])
  })
  it('distinguishes Neo creations and early precursor materials', () => {
    const view = eldamoSource({
      code: 'sjn',
      w: 'sample',
      x: {
        eldamo: {
          language: 'ns',
          period: 'neo',
          status: ['Neo-Elvish', 'fan-neologism'],
          creator: 'Named author'
        }
      }
    })!
    expect(view.period.en).toContain('Post-Tolkien')
    expect(view.status.map((status) => status.en)).toEqual(['Neo-Elvish', 'Fan neologism'])
    expect(view.creator).toBe('Named author')
    const early = eldamoSource({
      code: 'sjn',
      w: 'sample',
      x: { eldamo: { language: 'g', period: 'early' } }
    })!
    expect(early.language.en).toContain('Gnomish')
    expect(early.period.zh).toContain('早期')
  })
  it.each([
    'javascript:alert(1)',
    'http://eldamo.org/content/words/word-1.html',
    'https://evil.invalid/content/words/word-1.html',
    'https://eldamo.org.evil.invalid/content/words/word-1.html',
    'https://user@eldamo.org/content/words/word-1.html',
    'https://eldamo.org:8443/content/words/word-1.html'
  ])('rejects unsafe external metadata %s', (url) => {
    expect(eldamoSource({ code: 'qya', w: 'A/B ?#', x: { eldamo: { url } } })!.eldamoUrl).toBeNull()
    expect(eldamoSource({ code: 'qya', w: 'A/B ?#', x: { eldamo: { url } } })!.elfdictUrl).toBe(
      'https://www.elfdict.com/w/A%2FB%20%3F%23'
    )
  })
  it('filters malformed refs, deduplicates and hides long quotation bodies', () => {
    const view = eldamoSource({
      code: 'qya',
      w: 'i',
      x: {
        eldamo: {
          references: [
            null,
            {},
            { source: 'VT/1', v: 'i' },
            { source: 'VT/1', v: 'i' },
            { source: 'PE/2', v: 'x'.repeat(101) }
          ]
        }
      }
    })!
    expect(view.references).toEqual([
      { citation: 'VT/1', form: 'i' },
      { citation: 'PE/2', form: null }
    ])
  })
  it('ignores unrelated dictionaries and absent provenance', () => {
    expect(eldamoSource({ ...base, code: 'en' })).toBeNull()
    expect(eldamoSource({ code: 'qya', w: 'example', x: {} })).toBeNull()
  })
})
