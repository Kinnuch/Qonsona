/**
 * 中文释义的来源之一：中文维基词典的阿拉伯语词条（kaikki.org 抽取，繁体标题「阿拉伯語」五千来条、
 * 简体标题「阿拉伯语」一千多条）。释义多是繁体，用 OpenCC 的繁简对照表（先词组、后单字）转成简体。
 */
import { readFileSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

// ───────────────────────── 繁 → 简 ─────────────────────────

export class T2S {
  #chars = new Map<string, string>()
  #phrases = new Map<string, string>()
  #maxPhrase = 1
  constructor(charsFile: string, phrasesFile: string) {
    for (const line of readFileSync(charsFile, 'utf8').split(/\r?\n/)) {
      const [t, s] = line.split('\t')
      if (t && s) this.#chars.set(t, s.split(' ')[0])
    }
    for (const line of readFileSync(phrasesFile, 'utf8').split(/\r?\n/)) {
      const [t, s] = line.split('\t')
      if (t && s) {
        this.#phrases.set(t, s.split(' ')[0])
        this.#maxPhrase = Math.max(this.#maxPhrase, [...t].length)
      }
    }
  }
  convert(text: string): string {
    const cs = [...text]
    let out = ''
    for (let i = 0; i < cs.length;) {
      let done = false
      for (let n = Math.min(this.#maxPhrase, cs.length - i); n >= 2; n--) {
        const p = this.#phrases.get(cs.slice(i, i + n).join(''))
        if (p) {
          out += p
          i += n
          done = true
          break
        }
      }
      if (done) continue
      out += this.#chars.get(cs[i]) ?? cs[i]
      i++
    }
    return out
  }
}

// ───────────────────────── 中文维基词典的阿拉伯语词条 ─────────────────────────

export interface ZhEntry {
  w: string
  pos: string
  /** 带元音的写法（canonical） */
  d?: string
  /** 义项的中文释义（已转简体、清理过） */
  senses: string[]
}

/** 释义里不要的：「……的复数」这类变形说明、只有阿拉伯语的、太长的百科说明截短 */
const FORM_OF =
  /的(?:[^，。]{0,24})(?:式|形|數|数|格|態|态|拼寫|拼写|寫法|写法|變體|变体)$|的縮寫|的缩写|之誤|另一種寫法|另一种写法|的異體|的异体/

export function cleanZhGloss(s: string): string | null {
  let g = s
    .replace(/:?Template:[^\s，。；、]*/g, '') // 没展开的模板（:Template:不可数）
    .replace(/\s+/g, ' ')
    .replace(/[（(][^（()）]{14,}[)）]/g, '') // 长的括号说明（百科式的产地、年代……）
    .replace(/[。.]$/, '')
    .trim()
  if (!g || !/\p{Script=Han}/u.test(g)) return null
  if (FORM_OF.test(g)) return null
  if (g.length > 60) g = g.slice(0, 60).replace(/[，,；;、][^，,；;、]*$/, '') + '……'
  return g
}

export async function readZhWiktionary(files: string[], t2s: T2S): Promise<ZhEntry[]> {
  const out: ZhEntry[] = []
  for (const file of files) {
    const input = createReadStream(file).pipe(createGunzip())
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      if (!line) continue
      const o = JSON.parse(line) as {
        word: string
        pos: string
        lang_code: string
        forms?: { form: string; tags?: string[] }[]
        senses?: { glosses?: string[]; tags?: string[]; form_of?: unknown[]; alt_of?: unknown[] }[]
      }
      if (o.lang_code !== 'ar') continue
      const senses: string[] = []
      for (const s of o.senses ?? []) {
        if (s.form_of || s.alt_of || s.tags?.includes('form-of') || s.tags?.includes('alt-of'))
          continue
        const g = s.glosses?.[s.glosses.length - 1]
        if (!g) continue
        const c = cleanZhGloss(t2s.convert(g))
        if (c && !senses.includes(c)) senses.push(c)
      }
      if (!senses.length) continue
      out.push({
        w: o.word,
        pos: o.pos,
        d: o.forms?.find((f) => f.tags?.includes('canonical'))?.form,
        senses
      })
    }
  }
  return out
}
