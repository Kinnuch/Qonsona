/**
 * 日语文章分析（主进程）：kuromoji + IPADIC 分词，并成词、配读音、查词典（JLPT 等级与一句释义）、找语法点。
 * 不依赖 Electron（测试里直接 new 一个），词典查询由调用方给。
 */
import kuromoji from 'kuromoji'
import { matchGrammar } from '../shared/ja/grammar'
import {
  groupWords,
  readingOf,
  splitSentences,
  type JaAnalysis,
  type JaSentence,
  type JaToken,
  type JaWord
} from '../shared/ja/reader'

/** 查一个词：原形、打头词素的读音、打头词素是不是变过形 */
export type WordLookup = (
  base: string,
  reading: string,
  inflected: boolean
) => Pick<JaWord, 'entryId' | 'jlpt' | 'zh' | 'en'> | null

/** 一次最多分析这么长（再长的文章分段读） */
export const MAX_TEXT = 200_000

export class JaAnalyzer {
  #dicPath: string
  #tokenizer: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null

  constructor(dicPath: string) {
    this.#dicPath = dicPath
  }

  /** 第一次用时才载入 IPADIC（约 0.2 秒） */
  #tk(): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
    return (this.#tokenizer ??= new Promise((resolve, reject) =>
      kuromoji
        .builder({ dicPath: this.#dicPath })
        .build((err, tk) => (err ? reject(err) : resolve(tk)))
    ))
  }

  /** 一段文字的词素，起止位置加上 offset（这段在整篇里的位置） */
  async tokens(text: string, offset = 0): Promise<JaToken[]> {
    const tk = await this.#tk()
    const out: JaToken[] = []
    let cursor = 0
    for (const f of tk.tokenize(text)) {
      const s = f.surface_form
      const at = text.indexOf(s, cursor)
      const start = at < 0 ? cursor : at
      cursor = start + s.length
      out.push({
        s,
        b: f.basic_form && f.basic_form !== '*' ? f.basic_form : s,
        r: readingOf(f.reading),
        pos: f.pos,
        p1: f.pos_detail_1,
        p2: f.pos_detail_2,
        ct: f.conjugated_type,
        cf: f.conjugated_form,
        start: offset + start,
        end: offset + start + s.length
      })
    }
    return out
  }

  async analyze(input: string, lookup?: WordLookup): Promise<JaAnalysis> {
    const text = input.replace(/\r\n?/g, '\n').slice(0, MAX_TEXT)
    const sentences: JaSentence[] = []
    const grammar: JaAnalysis['grammar'] = []
    for (const range of splitSentences(text)) {
      const tokens = await this.tokens(text.slice(range.start, range.end), range.start)
      const words = groupWords(tokens)
      if (lookup) {
        const headAt = new Map(tokens.map((t) => [t.start, t]))
        for (const w of words) {
          const head = headAt.get(w.start)
          if (!w.word || !head) continue
          const inflected = head.cf !== '*' && head.cf !== '基本形'
          const hit = lookup(w.base, head.r, inflected)
          if (hit) Object.assign(w, hit)
        }
      }
      grammar.push(...matchGrammar(tokens, sentences.length))
      sentences.push({ ...range, words, tokens })
    }
    return { text, sentences, grammar }
  }
}
