/** Adapt Eldamo lexical facts, not prose notes/texts. Preserve historical records and uncertainty. */
import { DOMParser } from '@xmldom/xmldom'
import type { LexEntryData, PosTag } from '../../../src/shared/lang/types'

export interface EldamoRecord {
  code: 'qya' | 'sjn'
  data: LexEntryData
  category: string
  id: string
}
export interface EldamoDocumentaryAlias {
  form: string
  period: string
  language: string
  references: { source: string; mark: string }[]
}
const languages: Record<string, { code: 'qya' | 'sjn'; period: string }> = {
  q: { code: 'qya', period: 'late' },
  mq: { code: 'qya', period: 'middle' },
  eq: { code: 'qya', period: 'early' },
  nq: { code: 'qya', period: 'neo' },
  s: { code: 'sjn', period: 'late' },
  n: { code: 'sjn', period: 'middle' },
  en: { code: 'sjn', period: 'early' },
  g: { code: 'sjn', period: 'early' },
  ns: { code: 'sjn', period: 'neo' }
}
const pos: Record<string, PosTag> = {
  n: 'noun',
  'collective-noun': 'noun',
  vb: 'verb',
  adj: 'adj',
  adv: 'adv',
  pron: 'pron',
  article: 'det',
  prep: 'adp',
  conj: 'cconj',
  particle: 'part',
  interj: 'intj',
  cardinal: 'num',
  ordinal: 'num',
  fraction: 'num',
  suf: 'affix',
  pref: 'affix',
  affix: 'affix'
}
const inflectionTags: Record<string, string[]> = {
  '1st-sg': ['first-person', 'singular'],
  '2nd-sg': ['second-person', 'singular'],
  '3rd-sg': ['third-person', 'singular'],
  '1st-pl': ['first-person', 'plural'],
  '2nd-pl': ['second-person', 'plural'],
  '3rd-pl': ['third-person', 'plural'],
  '1st-pl-exclusive': ['first-person', 'plural', 'exclusive'],
  '1st-pl-inclusive': ['first-person', 'plural', 'inclusive'],
  '2nd-sg-polite': ['second-person', 'singular', 'polite'],
  '2nd-sg-familiar': ['second-person', 'singular', 'familiar'],
  subjective: ['nominative'],
  'partitive-plural': ['partitive', 'plural']
}
type XmlElement = ReturnType<DOMParser['parseFromString']>['documentElement']
function children(node: XmlElement, tag: string): XmlElement[] {
  return Array.from(node.childNodes).filter(
    (child) => child.nodeType === 1 && child.nodeName === tag
  ) as XmlElement[]
}
const attributes = (node: XmlElement): Record<string, string> =>
  Object.fromEntries(
    Array.from(node.attributes).map((attribute) => [attribute.name, attribute.value])
  )
export function reliability(mark: string, period: string, hasReference: boolean): string[] {
  const tags = [`eldamo-period:${period}`]
  if (period === 'neo') tags.push('Neo-Elvish')
  if (mark.includes('!')) tags.push('fan-neologism')
  if (mark.includes('^')) tags.push('reformulated')
  if (mark.includes('#')) tags.push('derived-unattested')
  if (mark.includes('*')) tags.push('reconstructed')
  if (mark.includes('?')) tags.push('speculative')
  if (mark.includes('‽')) tags.push('Tolkien-questioned')
  if (mark.includes('-')) tags.push('rejected')
  if (mark.includes('†')) tags.push('archaic')
  if (mark.includes('⚠')) tags.push('not-recommended')
  if (mark.includes('|')) tags.push('editorially-marked')
  if (!mark && period !== 'neo' && hasReference) tags.push('Tolkien-referenced')
  else if (!mark && !hasReference) tags.push('unverified-reference')
  return tags
}
export function parseEldamo(xml: string): { version: string; records: EldamoRecord[] } {
  const errors: string[] = []
  const document = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (message) => errors.push(message),
      fatalError: (message) => errors.push(message)
    }
  }).parseFromString(xml, 'application/xml')
  if (errors.length || document.documentElement.tagName !== 'word-data')
    throw new Error(`Invalid Eldamo XML: ${errors.join('; ')}`)
  const records: EldamoRecord[] = []
  for (const word of Array.from(document.getElementsByTagName('word'))) {
    const attrs = attributes(word)
    const language = languages[attrs.l]
    const speech = attrs.speech ?? ''
    // These are essays/poems or phonological analyses, not dictionary words.
    if (
      !language ||
      /^(text|phrase|grammar|phonetic-rule|phonetic-group|phonetics|phoneme)$/.test(speech)
    )
      continue
    if (!attrs.v?.trim() || !attrs.gloss?.trim() || attrs.v.length > 120) continue
    const positions = [
      ...new Set(
        speech
          .split(/\s+/)
          .map((type): PosTag => (type.endsWith('-name') ? 'propn' : (pos[type] ?? 'other')))
      )
    ]
    const references = children(word, 'ref').map((ref) => ({
      ...attributes(ref),
      inflections: children(ref, 'inflect').map(attributes),
      changes: children(ref, 'change').map(attributes),
      corrections: children(ref, 'correction').map(attributes)
    }))
    const tags = reliability(
      attrs.mark ?? '',
      language.period,
      references.some((reference) => !!reference.source)
    )
    const forms: [string, ...string[]][] = []
    const aliases = new Map<string, EldamoDocumentaryAlias>()
    for (const reference of references) {
      // A citation can attest a literal variant without describing an inflection.
      // Index that exact word, never expand the editorial parentheses in the headword.
      if (
        reference.source &&
        reference.v &&
        reference.v.toLowerCase() !== attrs.v.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/u, '').toLowerCase() &&
        !reference.inflections.length &&
        !reference.changes.length &&
        !reference.corrections.length &&
        !/[-?!*^#|‽]/u.test(reference.mark ?? '') &&
        /^['’]?[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*-?$/u.test(reference.v)
      ) {
        const alias = aliases.get(reference.v) ?? {
          form: reference.v,
          period: language.period,
          language: attrs.l,
          references: []
        }
        if (
          !alias.references.some(
            (ref) => ref.source === reference.source && ref.mark === (reference.mark ?? '')
          )
        )
          alias.references.push({ source: reference.source, mark: reference.mark ?? '' })
        aliases.set(reference.v, alias)
      }
      for (const inflection of reference.inflections) {
        // No parsing of alternatives, parenthesized insertions or uncertain reconstructed forms.
        if (
          !reference.v ||
          [...'/(){}[]=,?*'].some((symbol) => reference.v.includes(symbol)) ||
          !reference.source ||
          /[-?!*^#|‽]/u.test(reference.mark ?? '')
        )
          continue
        const mapped = (inflection.form ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .flatMap((tag) => inflectionTags[tag] ?? [tag])
        if (!mapped.length) continue
        forms.push([reference.v, ...mapped])
      }
    }
    const id = attrs['page-id'] ?? `${attrs.l}:${attrs.v}`
    records.push({
      code: language.code,
      id,
      category: attrs.cat ?? '',
      data: {
        w: attrs.v.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/u, ''),
        p: positions,
        s: [{ en: [attrs.gloss], t: tags }],
        f: [...new Map(forms.map((form) => [JSON.stringify(form), form])).values()],
        src: ['eldamo'],
        cls: children(word, 'class').flatMap((child) =>
          (child.getAttribute('form') ?? '').split(/\s+/).filter(Boolean)
        ),
        x: {
          eldamo: {
            id,
            language: attrs.l,
            sourceHead: attrs.v,
            category: attrs.cat ?? '',
            period: language.period,
            mark: attrs.mark ?? '',
            status: tags,
            url: attrs['page-id']
              ? `https://eldamo.org/content/words/word-${attrs['page-id']}.html`
              : 'https://eldamo.org/',
            creator: attrs.created ?? null,
            references,
            aliases: [...aliases.values()],
            deprecated: children(word, 'deprecated').map(attributes),
            glossMark: attrs['gloss-mark'] ?? null
          }
        }
      }
    })
  }
  return { version: document.documentElement.getAttribute('version') ?? 'unknown', records }
}
