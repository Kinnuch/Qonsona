import type { Text } from './course'

/** Rule explanations are a separate task from a word's gloss or a sentence's translation. */
export const GRAMMAR_FUNCTION_ASK: Text = {
  zh: '标出的结构在这句话中有什么语法作用？',
  en: 'What grammatical function does the marked structure have in this sentence?'
}

export const GRAMMAR_SENTENCE_ASK: Text = {
  zh: '结合整句话，选出这句话表达的意思',
  en: 'Read the whole sentence and choose what it means'
}

/** A provided example translation; never substitute a grammar rule for missing material. */
export function sentenceTranslation(ex: { zh?: string | null; en?: string | null }): Text | null {
  const zh = ex.zh?.trim() || '',
    en = ex.en?.trim() || ''
  return zh || en ? { zh: zh || en, en: en || zh } : null
}

const normalized = (text: string): string =>
  text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

/** A duplicate in either displayed language must not become an alternative correct answer. */
export function sameMeaning(a: Text, b: Text): boolean {
  if (typeof a === 'string' && typeof b === 'string') return normalized(a) === normalized(b)
  const aa = typeof a === 'string' ? { zh: a, en: a } : a,
    bb = typeof b === 'string' ? { zh: b, en: b } : b
  return Object.keys(aa).some(
    (locale) =>
      !!normalized(aa[locale] || '') && normalized(aa[locale]) === normalized(bb[locale] || '')
  )
}

/** Everyday mixed practice uses comprehension and production; rules can be selected explicitly. */
export function mixedPracticeKinds<T extends string>(kinds: readonly T[], canListen: boolean): T[] {
  return kinds.filter(
    (kind) =>
      kind !== 'grammar-meaning' &&
      (canListen || (kind !== 'listen-word' && kind !== 'listen-sentence'))
  )
}
