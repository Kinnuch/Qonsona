/**
 * 框架里各语言的阅读器分析（主进程）：分句、切词、对词条（常用的优先）、注音、认语法点、估难度。
 * 切词、规整、猜原形都用这门语言的 rules（src/shared/lang/<代码>/rules.ts），语法点用它的 grammar。
 * 词典里收了带空格的短语（parce que、a lot of）的，最长四个词连起来先对短语。
 */
import { LANGS } from '../../shared/lang/registry'
import { primarySystem } from '../../shared/lang/levels'
import { estimateLexLevel, findGrammar } from '../../shared/lang/grammar'
import { segmentSentences, segmentWords } from '../../shared/lang/text'
import type { LexAnalysis, LexSentence, LexToken, RawToken } from '../../shared/lang/types'
import type { LexDb, LookupHit } from './lexdb'

/** 最长几个词连起来对短语 */
const PHRASE_WORDS = 4
/** 不算难度的词性：专名、数词、符号、感叹词 */
const NO_LEVEL = new Set(['propn', 'num', 'symbol', 'intj'])

function toToken(raw: RawToken, hit: LookupHit | null, ruby?: string): LexToken {
  const t: LexToken = { text: raw.text, start: raw.start, end: raw.end, kind: raw.kind }
  if (hit) {
    t.entry = hit.entry
    t.lemma = hit.lemma
    t.pos = hit.pos
    if (hit.tags.length) t.tags = hit.tags
    t.lv = hit.lv
    if (hit.zh) t.zh = hit.zh
    if (hit.en) t.en = hit.en
  }
  if (ruby) t.ruby = ruby
  return t
}

export function analyzeLex(db: LexDb, text: string): LexAnalysis {
  const mod = LANGS[db.code]
  const { rules, spec } = mod
  const locale = spec.bcp47
  const rubyKind = spec.features.ruby
  const order = primarySystem(spec.levelSystems).levels.map((l) => l.id)
  const sentences: LexSentence[] = []
  const levels: string[] = []

  for (const range of segmentSentences(text, locale)) {
    const slice = text.slice(range.start, range.end)
    const raws = (rules.tokenize?.(slice) ?? segmentWords(slice, locale)).map((r) => ({
      ...r,
      start: r.start + range.start,
      end: r.end + range.start
    }))
    const tokens: LexToken[] = []
    for (let i = 0; i < raws.length; i++) {
      const raw = raws[i]
      if (raw.kind !== 'word') {
        tokens.push(toToken(raw, null))
        continue
      }
      // 先试最长的短语：从这个词起，连着的几个词（中间可以隔空白、连字符、撇号）
      let merged: { end: number; hit: LookupHit } | null = null
      const wordIdx: number[] = [i]
      for (let j = i + 1; j < raws.length && wordIdx.length < PHRASE_WORDS; j++) {
        if (raws[j].kind === 'word') wordIdx.push(j)
        else if (!/^[\s'’-]+$/.test(raws[j].text)) break
      }
      for (let n = wordIdx.length; n >= 2; n--) {
        const last = raws[wordIdx[n - 1]]
        const phrase = text.slice(raw.start, last.end)
        const hit = /\s/.test(phrase) ? db.lookup(phrase) : null
        if (hit) {
          merged = { end: wordIdx[n - 1], hit }
          break
        }
      }
      if (merged) {
        const last = raws[merged.end]
        tokens.push(
          toToken(
            {
              text: text.slice(raw.start, last.end),
              start: raw.start,
              end: last.end,
              kind: 'word'
            },
            merged.hit
          )
        )
        if (merged.hit.lv && !NO_LEVEL.has(merged.hit.pos)) levels.push(merged.hit.lv)
        i = merged.end
        continue
      }
      const hit = db.lookup(raw.text)
      const ruby =
        rubyKind === 'romanization'
          ? rules.romanize?.(raw.text)
          : rubyKind === 'ipa'
            ? hit?.ipa
            : undefined
      tokens.push(toToken(raw, hit, ruby))
      if (hit?.lv && !NO_LEVEL.has(hit.pos)) levels.push(hit.lv)
    }
    sentences.push({ start: range.start, end: range.end, para: range.para, tokens })
  }

  return {
    text,
    sentences,
    grammar: findGrammar(sentences, mod.grammar ?? [], rules.key),
    level: estimateLexLevel(levels, order)
  }
}
