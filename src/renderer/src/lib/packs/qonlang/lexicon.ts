/**
 * 千语集语言的词典检索：词头、屈折形、读音、释义都能查；什么都没输入时按等级列出整个词库。
 * 纯函数，不依赖界面状态（测试里直接用）。hidden 是学习包作者藏起来的 id，一律不列。
 */
import type { Lexeme, Morpheme, Project, Sentence } from '$qon/core/model'
import type { LocalizedText } from '../types'
import { learnable } from './levels'
import { storedIpa } from './pronounce'

export interface LexHit {
  id: string
  lemma: string
  /** 词类缩写（没有缩写用名字） */
  pos: string
  gloss: string
  level: string | null
  match: 'all' | 'exact' | 'form' | 'prefix' | 'contains' | 'gloss' | 'ipa'
  /** 按屈折形对上时：对上的形式与槽位名 */
  form?: string
  slot?: string
}

const NONE: ReadonlySet<string> = new Set()

const RANK: Record<LexHit['match'], number> = {
  all: 0,
  exact: 0,
  form: 1,
  prefix: 2,
  contains: 3,
  ipa: 4,
  gloss: 5
}

/** 比较用：统一成 NFC、小写，再去掉附加符（kâm 也能用 kam 找到） */
const norm = (s: string): string => s.normalize('NFC').toLowerCase().trim()
const fold = (s: string): string =>
  norm(s)
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFC')

/** 槽位名「单数.主格」显示成「单数·主格」 */
export const slotLabel = (key: string): string => key.split('.').join('·')

export function posLabel(
  project: Project,
  id: string | null | undefined,
  pick: (t: LocalizedText) => string
): string {
  const p = project.posList.find((x) => x.id === id)
  return p ? p.abbr || pick(p.name) : ''
}

export function firstGloss(l: Lexeme, pick: (t: LocalizedText) => string): string {
  for (const s of l.senses) {
    const g = pick(s.definition)
    if (g) return g
  }
  return ''
}

export function searchLexicon(
  project: Project,
  languageId: string,
  query: string,
  pick: (t: LocalizedText) => string,
  levels: Record<string, string> = {},
  hidden: ReadonlySet<string> = NONE,
  limit = 200
): LexHit[] {
  const lexemes = project.lexemes.filter(
    (l) => l.languageId === languageId && learnable(l) && !hidden.has(l.id)
  )
  const q = norm(query)
  const qf = fold(query)
  const lang = project.languages.find((l) => l.id === languageId)
  const hits: LexHit[] = []
  const hit = (l: Lexeme, match: LexHit['match'], extra: Partial<LexHit> = {}): LexHit => ({
    id: l.id,
    lemma: l.lemma,
    pos: posLabel(project, l.posId, pick),
    gloss: firstGloss(l, pick),
    level: levels[l.id] ?? null,
    match,
    ...extra
  })
  for (const l of lexemes) {
    if (!q) {
      hits.push(hit(l, 'all'))
      continue
    }
    const lemma = norm(l.lemma)
    const lemmaF = fold(l.lemma)
    if (lemma === q || lemmaF === qf) {
      hits.push(hit(l, 'exact'))
      continue
    }
    const form = Object.entries(l.forms).find(
      ([, f]) => f.surface && (norm(f.surface) === q || fold(f.surface) === qf)
    )
    if (form) {
      hits.push(hit(l, 'form', { form: form[1].surface, slot: slotLabel(form[0]) }))
      continue
    }
    if (lemmaF.startsWith(qf)) {
      hits.push(hit(l, 'prefix'))
      continue
    }
    if (lemmaF.includes(qf)) {
      hits.push(hit(l, 'contains'))
      continue
    }
    if (lang && fold(storedIpa(lang, l.pronunciations)).includes(qf)) {
      hits.push(hit(l, 'ipa'))
      continue
    }
    if (l.senses.some((s) => Object.values(s.definition).some((d) => norm(d).includes(q))))
      hits.push(hit(l, 'gloss'))
  }
  const levelOrder = (id: string | null): number => (id ? Number(id.replace(/\D/g, '')) || 99 : 99)
  return hits
    .sort(
      (a, b) =>
        RANK[a.match] - RANK[b.match] ||
        levelOrder(a.level) - levelOrder(b.level) ||
        a.lemma.localeCompare(b.lemma)
    )
    .slice(0, limit)
}

export function searchMorphemes(project: Project, languageId: string, query: string): Morpheme[] {
  // 语素不在学习包的「隐藏」里（作者只能藏词条、例句、短语、文档）
  const q = fold(query)
  return project.morphemes
    .filter((m) => m.languageId === languageId)
    .filter(
      (m) =>
        !q ||
        fold(m.form).includes(q) ||
        fold(m.gloss).includes(q) ||
        Object.values(m.meaning).some((x) => fold(x).includes(q))
    )
}

export function searchSentences(
  project: Project,
  languageId: string,
  query: string,
  hidden: ReadonlySet<string> = NONE
): Sentence[] {
  const q = fold(query)
  return project.sentences
    .filter((s) => s.languageId === languageId && !hidden.has(s.id))
    .filter(
      (s) =>
        !q ||
        fold(s.text).includes(q) ||
        Object.values(s.translation).some((x) => fold(x).includes(q))
    )
}
