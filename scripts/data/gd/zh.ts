/**
 * 中文维基词典「苏格兰盖尔语」词条的中文释义（人写的，三百来个词）：繁体按 OpenCC 的对照表转成简体，
 * 词头、词性都对上的才挂到词条上。词网对照出的中文见 wordnet.ts。
 */
import { readFileSync } from 'node:fs'
import type { GdEntry, KEntry } from './kaikki'

// ───────────────────────── 繁简 ─────────────────────────

export class T2S {
  #phrases = new Map<string, string>()
  #chars = new Map<string, string>()
  #maxLen = 1
  constructor(phrasesFile: string, charsFile: string) {
    for (const [file, map] of [
      [phrasesFile, this.#phrases],
      [charsFile, this.#chars]
    ] as const)
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line || line.startsWith('#')) continue
        const [from, to] = line.split('\t')
        if (!from || !to) continue
        map.set(from, to.split(' ')[0])
        if (map === this.#phrases) this.#maxLen = Math.max(this.#maxLen, [...from].length)
      }
  }
  convert(text: string): string {
    const chars = [...text]
    let out = ''
    for (let i = 0; i < chars.length;) {
      let done = false
      for (let n = Math.min(this.#maxLen, chars.length - i); n >= 2; n--) {
        const p = this.#phrases.get(chars.slice(i, i + n).join(''))
        if (p) {
          out += p
          i += n
          done = true
          break
        }
      }
      if (done) continue
      out += this.#chars.get(chars[i]) ?? chars[i]
      i++
    }
    return out
  }
}

// ───────────────────────── 中文维基词典 ─────────────────────────

/** 核对过、写错了的中文释义（词头|词性）：冠词 an 在名词前，中文维基词典写成了「用于名词后」 */
const WRONG = new Set(['an|article'])

/** 中文释义里过长的括号说明（地名的地理说明）去掉，留短的 */
function tidyZh(gloss: string): string {
  return gloss
    .replace(/（[^（）]{13,}）/g, '')
    .replace(/\([^()]{13,}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 把中文维基词典的释义挂到词条上：词头、词性都对上的才用；义项数一样就一一对上，否则都放在第一个义项。
 * 返回用上的词条数
 */
export function applyZhWiktionary(entries: GdEntry[], raw: KEntry[], t2s: T2S): number {
  // 词头要一字不差（mór 是 mòr 的旧写法，它的中文释义「mòr 的旧写法」不能挂到 mòr 上），只不分大小写
  const exact = (w: string): string => w.normalize('NFC').toLowerCase()
  const byKey = new Map<string, GdEntry[]>()
  for (const e of entries) {
    const k = exact(e.data.w)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(e)
  }
  let used = 0
  for (const z of raw) {
    if (WRONG.has(`${z.word}|${z.pos}`)) continue
    const senses = z.senses
      .filter((s) => !s.form_of?.length && !s.alt_of?.length && s.glosses?.length)
      .map((s) => tidyZh(t2s.convert(s.glosses![s.glosses!.length - 1])))
      // 「X 的旧写法 / 另一种拼写 / 属格」这类指向别的词的说明不当释义
      .filter((g) => g && !/^[\p{Script=Latin}\s'’-]+\s*的/u.test(g))
    if (!senses.length) continue
    const cands = (byKey.get(exact(z.word)) ?? []).filter((e) => e.kpos === z.pos)
    if (cands.length !== 1) continue
    const e = cands[0]
    const s = e.data.s
    if (s.length === senses.length) senses.forEach((g, i) => setZh(s[i], [g], 'zhwikt'))
    else setZh(s[0], senses.slice(0, 4), 'zhwikt')
    if (!e.data.src?.includes('zhwikt')) e.data.src = [...(e.data.src ?? []), 'zhwikt']
    used++
  }
  return used
}

function setZh(sense: GdEntry['data']['s'][number], zh: string[], source: string): void {
  sense.zh = [...new Set(zh)]
  sense.zs = source
}
