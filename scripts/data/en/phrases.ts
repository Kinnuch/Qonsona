/**
 * 词组：ECDICT 有 37 万个多词词条，绝大多数是术语与专名。按它们在 Tatoeba 母语者句子里出现的次数挑：
 * 词组与句子都按原形比（gave up 也算 give up），one's、oneself 对上 my / his……、myself……，
 * 中间的 sb / sth 可以隔一到三个词（take sb to task）。
 */

/** 句子里这些词能对上词组里的 one's / oneself */
export const POSSESSIVES = new Set([
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  "one's",
  'whose'
])
export const REFLEXIVES = new Set([
  'myself',
  'yourself',
  'himself',
  'herself',
  'itself',
  'ourselves',
  'yourselves',
  'themselves',
  'oneself'
])

const POSS_SLOT = new Set(["one's", "someone's", "somebody's", "sb's", "sb.'s", "sth's", 'one’s'])
const REFL_SLOT = new Set(['oneself'])
const GAP_SLOT = new Set([
  'sb',
  'sb.',
  'somebody',
  'someone',
  'sth',
  'sth.',
  'something',
  'sp',
  'sp.'
])

export interface PhrasePattern {
  /** 连着的原形序列（有 <poss> <refl> 占位） */
  key: string
  /** 中间隔着宾语的：前半、后半 */
  gap?: { first: string; second: string }
}

/**
 * 把一个词组写法变成匹配用的样子；不适合匹配的（带斜线、括号、数字、省略号，太长，只有一个词）返回 null。
 * lemma 把一个词（小写）换成它的原形。
 */
export function phrasePattern(
  phrase: string,
  lemma: (w: string) => string[]
): PhrasePattern | null {
  const p = phrase.toLowerCase().replace(/’/g, "'").trim()
  if (/[/()…\d[\]=?!"]|\.\.\./.test(p) || p.length > 60) return null
  let toks = p.split(/\s+/).filter(Boolean)
  if (toks.length < 2 || toks.length > 7) return null
  toks = toks.map((t) =>
    POSS_SLOT.has(t) ? '<poss>' : REFL_SLOT.has(t) ? '<refl>' : GAP_SLOT.has(t) ? '<gap>' : t
  )
  while (toks[0] === '<gap>') toks.shift()
  while (toks[toks.length - 1] === '<gap>') toks.pop()
  const gaps = toks.filter((t) => t === '<gap>').length
  if (gaps > 1 || toks.length < 2) return null
  const lem = toks.flatMap((t) => (t.startsWith('<') ? [t] : lemma(t)))
  if (lem.length < 2) return null
  if (!gaps) return { key: lem.join(' ') }
  const i = lem.indexOf('<gap>')
  const first = lem.slice(0, i).join(' ')
  const second = lem.slice(i + 1).join(' ')
  if (!first || !second) return null
  return { key: lem.join(' '), gap: { first, second } }
}

/** 数词组在句子里出现的次数，并记下前几句的编号（句子按挑例句的先后排好） */
export class PhraseCounter {
  readonly counts = new Map<string, number>()
  readonly hits = new Map<string, number[]>()
  #contiguous = new Set<string>()
  #gapped = new Map<string, { key: string; second: string }[]>()
  #maxLen = 2

  constructor(
    patterns: PhrasePattern[],
    readonly keepHits = 3
  ) {
    for (const p of patterns) {
      if (p.gap) {
        const list = this.#gapped.get(p.gap.first) ?? []
        list.push({ key: p.key, second: p.gap.second })
        this.#gapped.set(p.gap.first, list)
      } else {
        this.#contiguous.add(p.key)
        this.#maxLen = Math.max(this.#maxLen, p.key.split(' ').length)
      }
    }
  }

  #hit(key: string, sentence: number, seen: Set<string>): void {
    if (seen.has(key)) return
    seen.add(key)
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1)
    const h = this.hits.get(key) ?? []
    if (h.length < this.keepHits) {
      h.push(sentence)
      this.hits.set(key, h)
    }
  }

  /**
   * 一句话：lemmas 是每个词的原形（缩约已拆开），slots 是同一位置能对上的占位（<poss>、<refl>）
   */
  add(sentence: number, lemmas: string[], slots: (string | null)[]): void {
    const seen = new Set<string>()
    const n = lemmas.length
    const word = (i: number, alt: boolean): string => (alt && slots[i] ? slots[i]! : lemmas[i])
    for (let i = 0; i < n; i++) {
      for (const alt of [false, true]) {
        if (alt && !slots.slice(i, i + this.#maxLen).some(Boolean)) break
        let s = word(i, alt)
        for (let len = 2; len <= this.#maxLen && i + len <= n; len++) {
          s += ' ' + word(i + len - 1, alt)
          if (this.#contiguous.has(s)) this.#hit(s, sentence, seen)
        }
      }
      // 中间隔着宾语的
      let first = ''
      for (let len = 1; len <= 4 && i + len <= n; len++) {
        first += (len > 1 ? ' ' : '') + lemmas[i + len - 1]
        const cands = this.#gapped.get(first)
        if (!cands) continue
        for (const c of cands) {
          const m = c.second.split(' ').length
          for (let g = 1; g <= 3; g++) {
            const at = i + len + g
            if (at + m > n) break
            if (lemmas.slice(at, at + m).join(' ') === c.second) {
              this.#hit(c.key, sentence, seen)
              break
            }
          }
        }
      }
    }
  }
}
