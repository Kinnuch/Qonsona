/**
 * 千语集语言的阅读材料：学习包里作者排的课；没有课时按例句的「出处」、短语的分类、文档分成几篇。
 * 以及逐词对照（interlinear gloss）：用千语集自己的认词把一句话切成词，每个词带上词条与 gloss。
 * 纯函数，测试里直接用。
 */
import type { Id, LocalizedText, Project } from '$qon/core/model'
import { analyzeSentence } from '$qon/engine/gloss'
import { spanTokens, tokensMatchText } from '$qon/engine/gloss/tokens'
import { tokenizeOptionsFor } from '$qon/engine/gloss/assign'
import { docLink } from '$qon/core/docLinks'
import type { MdLink } from '$qon/core/markdown'
import { firstGloss } from './lexicon'
import type { PackStudy } from './study'

export interface QonText {
  key: string
  kind: 'lesson' | 'source' | 'phrases' | 'doc'
  title: string
  docId: Id | null
  sentenceIds: Id[]
  phraseIds: Id[]
  /** 这一课的新词 */
  lexemeIds: Id[]
}

export interface TextLabels {
  /** 没写出处的例句 */
  ungrouped: string
  /** 短语的一个分类（没有分类时 category 为空串） */
  phrases: (category: string) => string
}

export function qonTexts(
  project: Project,
  languageId: Id,
  study: PackStudy | null,
  hidden: ReadonlySet<string>,
  labels: TextLabels
): QonText[] {
  const shown = <T extends { id: Id }>(list: T[]): T[] => list.filter((x) => !hidden.has(x.id))
  const sentences = shown(project.sentences.filter((s) => s.languageId === languageId))
  const phrases = shown(project.phrasebook.filter((p) => p.languageId === languageId))
  const docs = shown(
    project.docs.filter((d) => d.languageId === languageId || d.languageId === null)
  )

  if (study?.lessons.length) {
    const ok = (ids: Id[], pool: { id: Id }[]): Id[] =>
      ids.filter((id) => pool.some((x) => x.id === id))
    return study.lessons.map((l) => ({
      key: `lesson-${l.id}`,
      kind: 'lesson',
      title: l.title || docs.find((d) => d.id === l.docId)?.title || '',
      docId: docs.some((d) => d.id === l.docId) ? l.docId : null,
      sentenceIds: ok(l.sentenceIds, sentences),
      phraseIds: ok(l.phraseIds, phrases),
      lexemeIds: l.lexemeIds.filter((id) => !hidden.has(id))
    }))
  }

  const out: QonText[] = []
  const bySource = new Map<string, Id[]>()
  for (const s of sentences) {
    const k = s.source.trim()
    bySource.set(k, [...(bySource.get(k) ?? []), s.id])
  }
  for (const [source, ids] of bySource)
    out.push({
      key: `source-${source}`,
      kind: 'source',
      title: source || labels.ungrouped,
      docId: null,
      sentenceIds: ids,
      phraseIds: [],
      lexemeIds: []
    })
  const byCategory = new Map<string, Id[]>()
  for (const p of phrases) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p.id])
  for (const [category, ids] of byCategory)
    out.push({
      key: `phrases-${category}`,
      kind: 'phrases',
      title: labels.phrases(category),
      docId: null,
      sentenceIds: [],
      phraseIds: ids,
      lexemeIds: []
    })
  for (const d of docs)
    out.push({
      key: `doc-${d.id}`,
      kind: 'doc',
      title: d.title,
      docId: d.id,
      sentenceIds: [],
      phraseIds: [],
      lexemeIds: []
    })
  return out
}

/** 逐词对照的一段：词（带词条与 gloss）或词之间的标点、空白 */
export interface GlossPiece {
  text: string
  word: boolean
  lexemeId: Id | null
  gloss: string
}

export function interlinear(
  project: Project,
  item: {
    languageId: Id
    text: string
    translation: LocalizedText
    tokens?: Project['sentences'][number]['tokens']
  },
  pick: (t: LocalizedText) => string
): GlossPiece[] {
  // analyzeSentence 会改写传进去的对象：给它一份拷贝
  const copy = structuredClone({
    languageId: item.languageId,
    text: item.text,
    translation: item.translation,
    tokens: item.tokens ?? []
  })
  const tokens = analyzeSentence(project, copy).tokens
  const glossOf = (i: number): Pick<GlossPiece, 'lexemeId' | 'gloss'> => {
    const a = tokens[i]?.analyses[tokens[i].chosen]
    if (!a) return { lexemeId: null, gloss: '' }
    const lexemeId = a.lexemeId ?? a.morphs.find((m) => m.lexemeId)?.lexemeId ?? null
    const lex = lexemeId ? project.lexemes.find((l) => l.id === lexemeId) : undefined
    const gloss =
      a.morphs
        .map((m) => m.gloss)
        .filter(Boolean)
        .join('-') || (lex ? firstGloss(lex, pick) : '')
    return { lexemeId, gloss }
  }
  const opts = tokenizeOptionsFor(project, item.languageId)
  const surfaces = tokens.map((t) => t.surface)
  if (tokensMatchText(item.text, surfaces, opts))
    return spanTokens(item.text, surfaces, opts).map((s) =>
      s.at < 0 || !s.word
        ? { text: s.text, word: false, lexemeId: null, gloss: '' }
        : { text: s.text, word: true, ...glossOf(s.at) }
    )
  // 对不上原文（分词方式改过之类）：逐个分析画，中间空一格
  return tokens.flatMap((t, i) => [
    ...(i ? [{ text: ' ', word: false, lexemeId: null, gloss: '' }] : []),
    { text: t.surface, word: true, ...glossOf(i) }
  ])
}

/**
 * 文档里的 `[[…]]` 链接：词条链成可以点的（阅读器点了出词卡），别的（音变、构形、文字……）
 * 学习软件里没有对应的页面，只写名字，不带「音变:」这类前缀。
 */
export function docLinkResolver(project: Project): (inner: string) => MdLink {
  return (inner) => {
    const { ref, hit } = docLink(project, inner)
    const name = hit?.name || ref.name
    const text = hit?.subLabel || ref.sub ? `${name} · ${hit?.subLabel || ref.sub}` : name
    if (hit?.kind === 'lexeme') return { text, target: { kind: 'lexeme', id: hit.id }, data: true }
    return { text, data: hit?.kind === 'morpheme' }
  }
}

/**
 * gloss 里的缩写（PL、NOM……）按项目的缩写表写出全称，给逐词对照的 gloss 当悬停说明；
 * 一个都认不出时是空串。
 */
export function glossTitle(
  project: Project,
  gloss: string,
  pick: (t: LocalizedText) => string
): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of gloss.split(/[.\-=:;,\s]+/)) {
    if (!part || seen.has(part)) continue
    seen.add(part)
    const a = project.abbreviations.find((x) => x.abbr === part)
    const name = a && pick(a.name)
    if (name) out.push(`${part} = ${name}`)
  }
  return out.join('\n')
}
