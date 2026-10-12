/**
 * 框架里各语言共用的「认语法点」：语法点的 patterns 是词的条件序列（TokenTest[]），
 * 按顺序对上一句里的词（标点、空白跳过），允许隔几个词（gap）、可有可无（optional）、
 * 只看不算的前后文（ctx）。一个更长的命中把它范围里别的语法点的短命中吞掉（日语的做法）。
 */
import type {
  LangRules,
  LexGrammarHit,
  LexGrammarPoint,
  LexSentence,
  LexToken,
  TokenTest
} from './types'
import { segmentWords } from './text'

/** Keep authored examples recognisable alongside productive rules, without guessing unseen syntax. */
export function addExamplePatterns(
  points: LexGrammarPoint[],
  rules: LangRules,
  locale: string
): void {
  for (const point of points) {
    const examples = point.examples.flatMap((ex) => {
      if (!ex.hl) return []
      const tokens = rules.tokenize?.(ex.hl) ?? segmentWords(ex.hl, locale)
      const pattern = tokens
        .filter((t) => t.kind === 'word' || t.kind === 'num')
        .map((t) => ({ form: t.text }))
      return pattern.length ? [pattern] : []
    })
    point.patterns = [...(point.patterns ?? []), ...examples]
  }
}

const asList = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v]

/** 一个词满不满足条件；key 是这门语言的 rules.key */
export function tokenMatches(t: LexToken, test: TokenTest, key: (s: string) => string): boolean {
  const lemmas = asList(test.lemma)
  if (lemmas.length && !lemmas.some((l) => key(l) === key(t.lemma ?? t.text))) return false
  const forms = asList(test.form)
  if (forms.length && !forms.some((f) => key(f) === key(t.text))) return false
  if (test.surface && !test.surface.test(t.text)) return false
  const pos = asList(test.pos)
  if (pos.length && (!t.pos || !pos.includes(t.pos))) return false
  if (test.tags?.length && !test.tags.every((x) => t.tags?.includes(x))) return false
  if (test.anyTags?.length && !test.anyTags.some((x) => t.tags?.includes(x))) return false
  if (test.not && tokenMatches(t, test.not, key)) return false
  return true
}

/**
 * 从第 i 个词起对一个 pattern；对上了返回标出的范围（第一个、最后一个不是 ctx 的词），对不上 null。
 * 回溯：gap 和 optional 都会试几种走法，取第一种对得上的
 */
export function matchAt(
  words: LexToken[],
  i: number,
  pattern: TokenTest[],
  key: (s: string) => string
): { first: number; last: number } | null {
  const go = (
    p: number,
    w: number,
    first: number,
    last: number
  ): { first: number; last: number } | null => {
    if (p === pattern.length) return first < 0 ? null : { first, last }
    const test = pattern[p]
    // 可有可无：先试跳过
    if (test.optional) {
      const skip = go(p + 1, w, first, last)
      if (skip) return skip
    }
    const maxGap = p === 0 ? 0 : (test.gap ?? 0)
    for (let g = 0; g <= maxGap; g++) {
      const at = w + g
      if (at >= words.length) break
      if (!tokenMatches(words[at], test, key)) continue
      const r = test.ctx
        ? go(p + 1, at + 1, first, last)
        : go(p + 1, at + 1, first < 0 ? at : first, at)
      if (r) return r
    }
    return null
  }
  return go(0, i, -1, -1)
}

/** 一篇正文里认出的全部语法点（按句子、位置排） */
export function findGrammar(
  sentences: LexSentence[],
  points: LexGrammarPoint[],
  key: (s: string) => string
): LexGrammarHit[] {
  const out: LexGrammarHit[] = []
  sentences.forEach((s, si) => {
    const words = s.tokens.filter((t) => t.kind === 'word' || t.kind === 'num')
    const hits: LexGrammarHit[] = []
    for (const point of points) {
      for (const pattern of point.patterns ?? []) {
        if (!pattern.length) continue
        for (let i = 0; i < words.length; i++) {
          const m = matchAt(words, i, pattern, key)
          if (!m) continue
          const hit = {
            id: point.id,
            sentence: si,
            start: words[m.first].start,
            end: words[m.last].end
          }
          if (!hits.some((h) => h.id === hit.id && h.start === hit.start && h.end === hit.end))
            hits.push(hit)
        }
      }
    }
    // 长的吞掉被它整个盖住的别的语法点
    const kept = hits.filter(
      (h) =>
        !hits.some(
          (o) =>
            o !== h &&
            o.id !== h.id &&
            o.start <= h.start &&
            o.end >= h.end &&
            o.end - o.start > h.end - h.start
        )
    )
    out.push(...kept.sort((a, b) => a.start - b.start || b.end - a.end))
  })
  return out
}

/**
 * 按词的等级估一篇的难度：有等级的词（按出现次数）85% 在哪一级以内（日语的做法）。
 * order 是主分级各级的 id（从易到难）；有等级的词少于 5 个时为 null
 */
export function estimateLexLevel(levels: string[], order: string[]): string | null {
  const idx = levels.map((l) => order.indexOf(l)).filter((i) => i >= 0)
  if (idx.length < 5) return null
  idx.sort((a, b) => a - b)
  return order[idx[Math.min(idx.length - 1, Math.floor(idx.length * 0.85))]]
}
