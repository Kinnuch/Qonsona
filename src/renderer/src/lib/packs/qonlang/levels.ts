/**
 * 人造语言按词频自动分级（2026-09-23 用户定）。
 *
 * 1. 数词频：这门语言的例句和短语，用千语集自己的认词（analyzeSentence）逐词认出词条；
 *    确认过的分析直接用，一个词里挂了几个词条（复合词）各算一次。
 * 2. 排序：出现次数多的在前；次数一样（包括语料里没出现过的）再看这个词派生出了多少别的词
 *    （别的词条的词源来源写了它），最后短的在前、再按字母。
 * 3. 分档：词越多档越多（不到 60 个词 3 档，不到 400 个 4 档，再多 5 档）；
 *    一级最少、越往后越多（按 1 : 2 : 3 : … 分），一级就是最常用的核心词。
 *
 * 词头里一个字母都没有的词条（千语集里当占位用的「·」这类）不参加分级，也不拿来学。
 * 从学习包导入时，作者藏起来的词条也不参加；作者固定了级别的词放到那一级（级数不够就放最后一级）。
 */
import type { Lexeme, Project, Token } from '$qon/core/model'
import { analyzeSentence } from '$qon/engine/gloss'
import type { Level, LevelSystem } from '../types'

export interface LevelAssignment {
  method: 'frequency'
  system: LevelSystem
  /** 词条 id → 等级 id */
  entries: Record<string, string>
  /** 词条 id → 在例句和短语里出现的次数（只记出现过的） */
  freq: Record<string, number>
}

const CN_DIGITS = '一二三四五六七八九十'

export function levelCount(words: number): number {
  return words < 60 ? 3 : words < 400 ? 4 : 5
}

/** 能拿来学的词条：词头里至少有一个字母 */
export function learnable(l: Lexeme): boolean {
  return /\p{L}/u.test(l.lemma)
}

/** 一句话里认出来的词条 id（每个词里同一个词条只算一次） */
function lexemesInTokens(tokens: Token[]): string[] {
  const out: string[] = []
  for (const tk of tokens) {
    const a = tk.analyses[tk.chosen]
    if (!a) continue
    const ids = new Set<string>()
    if (a.lexemeId) ids.add(a.lexemeId)
    for (const m of a.morphs) if (m.lexemeId) ids.add(m.lexemeId)
    out.push(...ids)
  }
  return out
}

export function corpusFrequency(project: Project, languageId: string): Map<string, number> {
  const freq = new Map<string, number>()
  const texts = [
    ...project.sentences.filter((s) => s.languageId === languageId),
    ...project.phrasebook
      .filter((p) => p.languageId === languageId)
      .map((p) => ({ ...p, tokens: p.tokens ?? [] }))
  ]
  for (const text of texts) {
    // analyzeSentence 会改写传进去的对象：给它一份拷贝，项目本身不动
    const copy = structuredClone({
      languageId: text.languageId,
      text: text.text,
      translation: text.translation,
      tokens: text.tokens
    })
    for (const id of lexemesInTokens(analyzeSentence(project, copy).tokens))
      freq.set(id, (freq.get(id) ?? 0) + 1)
  }
  return freq
}

export interface LevelOptions {
  /** 作者藏起来的 id */
  hidden?: ReadonlySet<string>
  /** 作者固定的级别：词条 id → 第几级（1 起） */
  pinned?: Record<string, number>
}

export function frequencyLevels(
  project: Project,
  languageId: string,
  opts: LevelOptions = {}
): LevelAssignment {
  const lexemes = project.lexemes.filter(
    (l) => l.languageId === languageId && learnable(l) && !opts.hidden?.has(l.id)
  )
  const freq = corpusFrequency(project, languageId)
  // 派生出了多少别的词：别的词条的词源来源指着它
  const derived = new Map<string, number>()
  for (const l of project.lexemes)
    for (const s of l.etymology.sources)
      if (s.kind === 'lexeme' && s.id !== l.id) derived.set(s.id, (derived.get(s.id) ?? 0) + 1)

  const ranked = [...lexemes].sort(
    (a, b) =>
      (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) ||
      (derived.get(b.id) ?? 0) - (derived.get(a.id) ?? 0) ||
      [...a.lemma].length - [...b.lemma].length ||
      a.lemma.localeCompare(b.lemma)
  )

  const n = levelCount(ranked.length)
  const weights = Array.from({ length: n }, (_, i) => i + 1)
  const total = weights.reduce((x, y) => x + y, 0)
  const levels: Level[] = weights.map((_, i) => ({
    id: `L${i + 1}`,
    name: { zh: `${CN_DIGITS[i]}级`, en: `Level ${i + 1}` },
    count: 0
  }))
  const entries: Record<string, string> = {}
  let start = 0
  let acc = 0
  for (let i = 0; i < n; i++) {
    acc += weights[i]
    // 最后一档收下剩下的全部，免得四舍五入漏掉；词很少时也先填满前面的档（一个词就是一级）
    const end =
      i === n - 1
        ? ranked.length
        : Math.max(Math.round((ranked.length * acc) / total), Math.min(start + 1, ranked.length))
    for (const l of ranked.slice(start, end)) entries[l.id] = levels[i].id
    start = end
  }
  for (const [id, n0] of Object.entries(opts.pinned ?? {}))
    if (id in entries && Number.isInteger(n0) && n0 >= 1)
      entries[id] = levels[Math.min(n0, n) - 1].id
  for (const lv of levels) lv.count = 0
  const byId = new Map(levels.map((lv) => [lv.id, lv]))
  for (const id of Object.values(entries)) {
    const lv = byId.get(id)!
    lv.count = (lv.count ?? 0) + 1
  }

  return {
    method: 'frequency',
    system: { id: 'frequency', name: { zh: '按词频分级', en: 'Frequency levels' }, levels },
    entries,
    freq: Object.fromEntries(freq)
  }
}
