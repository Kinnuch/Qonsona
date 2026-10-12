import type { EntryView } from '../dict'
import {
  classOf,
  conjugate,
  formsOf,
  type Conjugable,
  type FormId,
  type WordClass
} from './conjugate'

export interface JaInflectionGroup {
  key: string
  cls: WordClass
  base: string
  rows: { id: FormId; text: string; reading: string }[]
}

/** Keep each JMdict sense's word class and its writing restrictions; never guess from a final kana. */
export function dictionaryInflection(entry: EntryView): JaInflectionGroup[] {
  const groups: JaInflectionGroup[] = []
  const used = new Set<string>()
  for (const sense of entry.senses) {
    if (
      sense.only.length &&
      !sense.only.includes(entry.head) &&
      !sense.only.includes(entry.reading)
    )
      continue
    const classification = classOf(sense.pos)
    if (!classification) continue
    const suru = classification.suru && !entry.head.endsWith('する')
    const key = `${classification.cls}:${classification.special ?? ''}:${suru}`
    if (used.has(key)) continue
    used.add(key)
    const word: Conjugable = {
      head: entry.head + (suru ? 'する' : ''),
      reading: entry.reading + (suru ? 'する' : ''),
      cls: classification.cls,
      ...(classification.special ? { special: classification.special } : {})
    }
    const rows = formsOf(word.cls).flatMap((id) => {
      const form = conjugate(word, id)
      return form ? [{ id, ...form }] : []
    })
    if (rows.length) groups.push({ key, cls: word.cls, base: word.head, rows })
  }
  return groups
}
