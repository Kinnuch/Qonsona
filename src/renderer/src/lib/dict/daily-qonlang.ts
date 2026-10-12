import type { Language, Project } from '$qon/core/model'
import type { DailyPool } from '$shared/dictionary-daily'
import { dailyCandidates } from '$shared/dictionary-daily'
import type { LevelAssignment } from '$lib/packs/qonlang/levels'
import { storedIpa } from '$lib/packs/qonlang/pronounce'

/** 本机项目的只读适配。没有 IPC、上传、网络、分析改写；隐藏项在每次重算时排除。 */
export function qonDailyPool(
  project: Project,
  language: Language,
  hidden: ReadonlySet<string> = new Set(),
  levels: LevelAssignment | null = null
): DailyPool {
  const words = dailyCandidates(
    project.lexemes.filter(
      (l) =>
        l.languageId === language.id &&
        !hidden.has(l.id) &&
        /\p{L}/u.test(l.lemma) &&
        l.senses.some((s) => Object.values(s.definition).some((value) => value.trim()))
    )
  ).map((l) => {
    const meaning =
      l.senses.find((s) => Object.values(s.definition).some((value) => value.trim()))?.definition ??
      {}
    const reading = storedIpa(language, l.pronunciations)
    const card = { key: `lexeme-${l.id}`, front: l.lemma, reading, meaning }
    return {
      id: l.id,
      front: l.lemma,
      reading,
      meaning,
      level: levels?.entries[l.id] ?? null,
      card
    }
  })
  const sentences = dailyCandidates(
    project.sentences.filter(
      (s) => s.languageId === language.id && !hidden.has(s.id) && s.text.trim()
    )
  ).map((s) => ({
    id: s.id,
    text: s.text,
    meaning: s.translation,
    level: null,
    source: s.source,
    audioKey: `sentence-${s.id}`
  }))
  const grammar = dailyCandidates(
    project.docs.filter(
      (d) =>
        (d.languageId === language.id || d.languageId === null) &&
        !hidden.has(d.id) &&
        d.markdown.trim()
    ),
    128
  ).map((d) => ({
    id: d.id,
    docId: d.id,
    title: { zh: d.title, en: d.title },
    meaning: { zh: d.markdown.slice(0, 240), en: d.markdown.slice(0, 240) },
    level: null,
    lessonId: `doc-${d.id}`
  }))
  return {
    database: true,
    words,
    sentences,
    grammar,
    levels: Object.fromEntries(levels?.system.levels.map((l) => [l.id, l.name]) ?? [])
  }
}
