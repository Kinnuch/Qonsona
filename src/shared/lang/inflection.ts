import type { LocalizedText, SourceRef } from './types'
import type { LexEntryView } from './views'
import { koreanInflectionFallback } from './ko/inflection'

export type InflectionKind = 'verbal' | 'nominal' | 'degree' | 'mutation' | 'other'
export interface InflectionExample {
  text: string
  translation?: LocalizedText
  source?: SourceRef
  sourceId?: string
  provenance?: 'original' | 'dictionary'
}
/** A conditional, language-specific rule output; never implicitly added to dictionary forms. */
export interface InflectionAlternation {
  id: string
  title: LocalizedText
  form: string
  tags: string[]
  notice: LocalizedText
  provenance: 'dictionary' | 'rule'
  examples: InflectionExample[]
  sources: SourceRef[]
}
export interface InflectionForm {
  form: string
  tags: string[]
  ipa?: string
  provenance: 'dictionary' | 'rule'
}
export interface InflectionTable {
  id: string
  kind: InflectionKind
  /** Tense/mood/voice etc. Unknown tags remain intact instead of being guessed. */
  tags: string[]
  rows: { tags: string[]; cells: InflectionForm[][] }[]
  cols: string[][]
}
export type InflectionEntry = Pick<
  LexEntryView,
  'code' | 'w' | 'd' | 'p' | 'cls' | 'forms' | 'sources'
>
export interface InflectionData {
  lemma: string
  forms: InflectionForm[]
  tables: InflectionTable[]
  recorded: number
  generated: number
  /** Absence of recorded forms is not proof that a word should inflect. */
  notice: LocalizedText
  sources: SourceRef[]
}
export const INFLECTION_KINDS: Record<InflectionKind, LocalizedText> = {
  verbal: { zh: '动词与谓词活用', en: 'Verb and predicate forms' },
  nominal: { zh: '性、数与格', en: 'Gender, number and case' },
  degree: { zh: '比较级与最高级', en: 'Comparison' },
  mutation: { zh: '词首音变', en: 'Initial alternations' },
  other: { zh: '其它记录形式', en: 'Other recorded forms' }
}

const CASES = [
  'nominative',
  'genitive',
  'dative',
  'accusative',
  'instrumental',
  'prepositional',
  'locative',
  'vocative',
  'partitive',
  'ablative'
]
const PERSONS = ['first-person', 'second-person', 'third-person', 'impersonal']
const NUMBERS = ['singular', 'dual', 'plural']
const GENDERS = ['masculine', 'neuter', 'feminine', 'common-gender']
const DEGREES = ['comparative', 'superlative', 'positive']
const MUTATIONS = ['lenition', 'eclipsis', 'mutation', 't-prothesis', 'h-prothesis', 'n-prothesis']
const VERBAL = new Set([
  'present',
  'past',
  'future',
  'imperfect',
  'past-historic',
  'preterite',
  'aorist',
  'perfect',
  'pluperfect',
  'anterior',
  'indicative',
  'subjunctive',
  'conditional',
  'imperative',
  'jussive',
  'optative',
  'participle',
  'infinitive',
  'gerund',
  'converb',
  'active',
  'passive'
])
const NOTES = new Set([
  'animate',
  'inanimate',
  'formal',
  'informal',
  'vos',
  'vos-form',
  'archaic',
  'rare',
  'before-vowel',
  'after-consonant',
  'dated',
  'alternative',
  'dialectal',
  'colloquial'
])
const AXES = new Set([...CASES, ...PERSONS, ...NUMBERS, ...GENDERS])
const ORDER = [
  'indicative',
  'subjunctive',
  'conditional',
  'imperative',
  'jussive',
  'optative',
  'present',
  'imperfect',
  'past',
  'past-historic',
  'preterite',
  'aorist',
  'future',
  'perfect',
  'pluperfect',
  'anterior',
  'infinitive',
  'gerund',
  'participle',
  'active',
  'passive',
  ...CASES,
  ...PERSONS,
  ...NUMBERS,
  ...GENDERS,
  ...DEGREES
]
const rank = (tag: string): number => {
  const i = ORDER.indexOf(tag)
  return i < 0 ? ORDER.length : i
}
const sorted = (tags: string[]): string[] =>
  [...new Set(tags.filter(Boolean))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
const inSet = (tags: string[], set: string[]): string[] => set.filter((x) => tags.includes(x))

function kindOf(entry: InflectionEntry, tags: string[]): InflectionKind {
  if (tags.some((t) => MUTATIONS.includes(t))) return 'mutation'
  if (tags.some((t) => DEGREES.includes(t))) return 'degree'
  if (tags.some((t) => VERBAL.has(t) || PERSONS.includes(t))) return 'verbal'
  if (
    entry.code === 'ko' &&
    entry.p.some((p) => p === 'verb' || p === 'adj') &&
    tags.some((t) => t.startsWith('-'))
  )
    return 'verbal'
  if (tags.some((t) => AXES.has(t))) return 'nominal'
  return 'other'
}

/** Organise only attested forms; no lemma-fill, inferred slots or declension guessing. */
export function inflectionData(entry: InflectionEntry): InflectionData {
  const seen = new Set<string>()
  const forms: InflectionForm[] = []
  for (const raw of entry.forms) {
    const form = raw.form.trim()
    if (!form) continue
    const tags = sorted(raw.tags)
    const key = JSON.stringify([form.normalize('NFC'), tags, raw.ipa ?? ''])
    if (seen.has(key)) continue
    seen.add(key)
    forms.push({ form, tags, ...(raw.ipa ? { ipa: raw.ipa } : {}), provenance: 'dictionary' })
  }
  const recorded = forms.length
  const fallback = recorded === 0 ? koreanInflectionFallback(entry) : null
  if (fallback) forms.push(...fallback.forms)
  const groups = new Map<
    string,
    { kind: InflectionKind; tags: string[]; items: InflectionForm[] }
  >()
  for (const form of forms) {
    const kind = kindOf(entry, form.tags)
    const hasAxes = form.tags.some((t) => AXES.has(t))
    // An ending-labelled Korean form, comparison or unclassified variant is a labelled row,
    // not dozens of one-cell tables. Keep the complete tags on each stored form.
    const tags =
      hasAxes && kind !== 'degree' && kind !== 'mutation'
        ? form.tags.filter((t) => !AXES.has(t) && !NOTES.has(t) && t !== 'lemma')
        : []
    const key = JSON.stringify([kind, tags])
    const group = groups.get(key) ?? { kind, tags, items: [] }
    group.items.push(form)
    groups.set(key, group)
  }
  const kinds = Object.keys(INFLECTION_KINDS) as InflectionKind[]
  const tables: InflectionTable[] = []
  for (const [key, group] of [...groups].sort(
    ([, a], [, b]) =>
      kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || a.tags.join().localeCompare(b.tags.join())
  )) {
    const cells = new Map<string, InflectionForm[]>()
    const rowTags = new Map<string, string[]>(),
      colTags = new Map<string, string[]>()
    for (const form of group.items) {
      const cases = inSet(form.tags, CASES),
        persons = inSet(form.tags, PERSONS),
        numbers = inSet(form.tags, NUMBERS),
        genders = inSet(form.tags, GENDERS)
      let rows: string[][], cols: string[][]
      if (cases.length) {
        rows = cases.map((c) => [c])
        cols = [...(numbers.length ? numbers : [''])].flatMap((n) =>
          genders.length ? genders.map((g) => [n, g].filter(Boolean)) : [[n].filter(Boolean)]
        )
      } else if (persons.length) {
        rows = persons.map((p) => [p, ...genders])
        cols = (numbers.length ? numbers : ['']).map((n) => [n].filter(Boolean))
      } else if (numbers.length || genders.length) {
        rows = [[]]
        cols = (numbers.length ? numbers : ['']).flatMap((n) =>
          genders.length ? genders.map((g) => [n, g].filter(Boolean)) : [[n].filter(Boolean)]
        )
      } else {
        rows = [form.tags.filter((t) => t !== 'lemma')]
        cols = [[]]
      }
      for (const row of rows)
        for (const col of cols) {
          const r = JSON.stringify(row),
            c = JSON.stringify(col),
            slot = JSON.stringify([r, c])
          rowTags.set(r, row)
          colTags.set(c, col)
          const current = cells.get(slot) ?? []
          if (!current.includes(form)) current.push(form)
          cells.set(slot, current)
        }
    }
    const axisSort = ([, a]: [string, string[]], [, b]: [string, string[]]): number => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const d = rank(a[i] ?? '') - rank(b[i] ?? '')
        if (d) return d
      }
      return a.join().localeCompare(b.join())
    }
    const rows = [...rowTags].sort(axisSort),
      cols = [...colTags].sort(axisSort)
    tables.push({
      id: key,
      kind: group.kind,
      tags: group.tags,
      cols: cols.map(([, v]) => v),
      rows: rows.map(([r, tags]) => ({
        tags,
        cells: cols.map(([c]) => cells.get(JSON.stringify([r, c])) ?? [])
      }))
    })
  }
  return {
    lemma: entry.d ?? entry.w,
    forms,
    tables,
    recorded,
    generated: forms.length - recorded,
    notice:
      fallback?.notice ??
      (recorded
        ? {
            zh: '只显示本词条已记录的形式；空格表示未提供，不代表该形式不存在。词条来源覆盖整体记录，未逐形标注出处。',
            en: 'Only forms recorded for this entry are shown. Empty cells mean not supplied, not impossible. Entry sources apply to the overall record; individual forms are not source-linked.'
          }
        : {
            zh: '此词条未提供词形数据。它可能不发生这类屈折，或资料尚未收录；不会据此猜造形式。',
            en: 'No forms are supplied for this entry. The word may not inflect this way, or the data may be incomplete; missing forms are not guessed.'
          }),
    sources: fallback ? [...entry.sources, ...fallback.sources] : entry.sources
  }
}
