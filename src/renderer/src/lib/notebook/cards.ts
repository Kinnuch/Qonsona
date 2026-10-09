/**
 * 加进生词本的卡面：日语按 JMdict 词条，千语集的语言按词条 / 短语。
 * 卡的键跟录音键同一套（lexeme-<id>、phrase-<id>），日语是 ja-<词条号>。
 */
import type { CardInput, Texts } from '$shared/notebook'
import type { EntryView, WordListItem } from '$shared/dict'
import type { Language, Lexeme, Phrase, Project } from '$qon/core/model'
import { spellingIpa, storedIpa } from '$lib/packs/qonlang/pronounce'

export const jaKey = (id: number): string => `ja-${id}`

/** 日语卡的键里的词条号；不是日语卡时是 null */
export function jaEntryId(key: string): number | null {
  const m = /^ja-(\d+)$/.exec(key)
  return m ? Number(m[1]) : null
}

export function jaFromEntry(e: EntryView): CardInput {
  const zh = e.senses.map((s) => s.zh).find(Boolean) ?? ''
  const en = e.senses[0]?.en.slice(0, 3).join('; ') ?? ''
  return { key: jaKey(e.id), front: e.head, reading: e.reading, meaning: { zh, en } }
}

export const jaFromListItem = (w: WordListItem): CardInput => ({
  key: jaKey(w.id),
  front: w.head,
  reading: w.reading,
  meaning: { zh: w.zh, en: w.en }
})

/** 第一个有释义的义项（整份多语言文字，换界面语言时跟着换） */
function firstDefinition(l: Lexeme): Texts {
  return (l.senses.find((s) => Object.values(s.definition).some(Boolean))?.definition ??
    {}) as Texts
}

export function qonFromLexeme(lang: Language, l: Lexeme): CardInput {
  return {
    key: `lexeme-${l.id}`,
    front: l.lemma,
    reading: storedIpa(lang, l.pronunciations) || spellingIpa(lang, l.lemma),
    meaning: firstDefinition(l)
  }
}

export function qonFromPhrase(lang: Language, p: Phrase): CardInput {
  return {
    key: `phrase-${p.id}`,
    front: p.text,
    reading: storedIpa(lang, p.pronunciations) || spellingIpa(lang, p.text),
    meaning: p.translation as Texts
  }
}

/** 千语集卡的键指的词条 / 短语 */
export function qonItem(
  project: Project,
  key: string
): { lexeme?: Lexeme; phrase?: Phrase } | null {
  const m = /^(lexeme|phrase)-(.+)$/.exec(key)
  if (!m) return null
  if (m[1] === 'lexeme') {
    const lexeme = project.lexemes.find((l) => l.id === m[2])
    return lexeme ? { lexeme } : null
  }
  const phrase = project.phrasebook.find((p) => p.id === m[2])
  return phrase ? { phrase } : null
}
