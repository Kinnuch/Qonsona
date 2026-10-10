/**
 * 词频：wordfreq 的阿拉伯语大表（large_ar.msgpack.gz，维基百科、字幕、新闻、网页、推特五种语料合起来，
 * 去掉了元音符号与延长线，跟查词键一个口径）。表里是词形（كتابه、والكتاب……），这里把它们归到词条上：
 *   1. 词形的查词键在变形表里（كتب = كَتَبَ 的过去式、كِتَاب 的复数……）就分给这些词条；
 *   2. 不在表里的试宽松键（الى → إلى），再剥掉附着词（وبكتابه → كتاب）；跟附着词连写的高频组合（وقد、ولا）两种分析都算；
 *   3. 一个词形对上几个词条时按「先验」分：先验是各词条独有的词形的频率（加上 Tatoeba 按英译分辨出来的次数），
 *      لم 对上否定词 لَمْ 和动词 لَمَّ 时，动词别的词形（يلم、لممت……）很少见，大头就归否定词。
 * 结果是每个词条的频率（每百万词出现几次）与名次。
 */
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import type { PosTag } from '../../../src/shared/lang/types'
import { CLITICS, arKey, arLemmaCandidates, arLooseKey } from '../../../src/shared/lang/ar/rules'

// ───────────────────────── msgpack（只解 wordfreq 用到的几种） ─────────────────────────

function decodeMsgpack(buf: Uint8Array): unknown {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const td = new TextDecoder()
  let p = 0
  const str = (n: number): string => {
    const s = td.decode(buf.subarray(p, p + n))
    p += n
    return s
  }
  const arr = (n: number): unknown[] => {
    const a = new Array<unknown>(n)
    for (let i = 0; i < n; i++) a[i] = read()
    return a
  }
  const map = (n: number): Record<string, unknown> => {
    const o: Record<string, unknown> = {}
    for (let i = 0; i < n; i++) {
      const k = String(read())
      o[k] = read()
    }
    return o
  }
  function read(): unknown {
    const b = buf[p++]
    if (b <= 0x7f) return b
    if (b >= 0xe0) return b - 0x100
    if ((b & 0xf0) === 0x80) return map(b & 0x0f)
    if ((b & 0xf0) === 0x90) return arr(b & 0x0f)
    if ((b & 0xe0) === 0xa0) return str(b & 0x1f)
    switch (b) {
      case 0xc0:
        return null
      case 0xc2:
        return false
      case 0xc3:
        return true
      case 0xca:
        return ((p += 4), view.getFloat32(p - 4))
      case 0xcb:
        return ((p += 8), view.getFloat64(p - 8))
      case 0xcc:
        return buf[p++]
      case 0xcd:
        return ((p += 2), view.getUint16(p - 2))
      case 0xce:
        return ((p += 4), view.getUint32(p - 4))
      case 0xd0:
        return ((p += 1), view.getInt8(p - 1))
      case 0xd1:
        return ((p += 2), view.getInt16(p - 2))
      case 0xd2:
        return ((p += 4), view.getInt32(p - 4))
      case 0xd9:
        return str(buf[p++])
      case 0xda:
        return ((p += 2), str(view.getUint16(p - 2)))
      case 0xdb:
        return ((p += 4), str(view.getUint32(p - 4)))
      case 0xdc:
        return ((p += 2), arr(view.getUint16(p - 2)))
      case 0xdd:
        return ((p += 4), arr(view.getUint32(p - 4)))
      case 0xde:
        return ((p += 2), map(view.getUint16(p - 2)))
      case 0xdf:
        return ((p += 4), map(view.getUint32(p - 4)))
      default:
        throw new Error(`msgpack：不认识的类型 0x${b.toString(16)}（位置 ${p - 1}）`)
    }
  }
  return read()
}

/**
 * wordfreq 的 cBpack：[表头, 第 0 档, 第 1 档, …]，第 i 档里的词频率约为 10^(-i/100)。
 * 返回 词 → 频率（每个词占全部词的比例）。
 */
export function readWordfreq(file: string): Map<string, number> {
  const data = decodeMsgpack(gunzipSync(readFileSync(file))) as unknown[]
  const header = data[0] as { format?: string; version?: number }
  if (header?.format !== 'cB') throw new Error(`wordfreq 文件格式不对：${JSON.stringify(header)}`)
  const out = new Map<string, number>()
  for (let i = 1; i < data.length; i++) {
    const f = Math.pow(10, -(i - 1) / 100)
    for (const w of data[i] as string[]) out.set(w, f)
  }
  return out
}

// ───────────────────────── 词形归到词条 ─────────────────────────

/** 一个查词键对上的词条，weight 是这个写法有多像这个词条的「本来面目」（词头 1，变形低一些） */
export interface FormHit {
  entry: number
  weight: number
}

/**
 * 附着词能接什么词：冠词、بِ、كَ、不定宾格只接名词类（动词不带冠词），سَ 只接动词；
 * 别的（连词、لِ、后附代词）都能接。
 */
function cliticAllows(tags: string[], pos: PosTag[]): boolean {
  if (tags.includes('fut-sa')) return pos.includes('verb')
  if (
    tags.some((t) => t === 'definite' || t === 'prep-bi' || t === 'prep-ka' || t === 'accusative')
  )
    return pos.some((p) => p !== 'verb')
  return true
}

/** 虚词（代词、介词、连词、小品词、限定词、数词） */
const CLOSED = new Set<PosTag>(['pron', 'det', 'adp', 'cconj', 'sconj', 'part', 'num'])

/** 词形 → 词条：严格键一张表，宽松键（أ إ آ → ا、ى → ي、ة → ه）另一张 */
export class FormIndex {
  readonly map = new Map<string, FormHit[]>()
  readonly looseMap = new Map<string, FormHit[]>()
  /** @param pos 每个词条的词性（剥附着词时看接得上接不上） */
  constructor(readonly pos: PosTag[][]) {}
  add(form: string, entry: number, weight: number): void {
    const put = (m: Map<string, FormHit[]>, k: string): void => {
      if (!k) return
      const list = m.get(k)
      if (!list) m.set(k, [{ entry, weight }])
      else {
        const h = list.find((x) => x.entry === entry)
        if (h) h.weight = Math.max(h.weight, weight)
        else list.push({ entry, weight })
      }
    }
    put(this.map, arKey(form))
    put(this.looseMap, arLooseKey(form))
  }
  get(k: string): FormHit[] | undefined {
    return this.map.get(k)
  }
  getLoose(k: string): FormHit[] | undefined {
    return this.looseMap.get(k)
  }
  /**
   * 一个词形可能是哪些词条：严格键对上的（权重照登记的），对不上时宽松键（打八折）；
   * 再加上剥附着词的分析（只剥附着词、取剥得最少的一档）——有直接对上的时每剥一个打三折，
   * 没有时打九折。وقد 既是动词 وَقَدَ（点火）又是 وَ + قَدْ，两种都算进去，按先验分。
   */
  analyse(surface: string): Map<number, number> {
    const hits = new Map<number, number>()
    const put = (list: FormHit[] | undefined, factor: number): void => {
      for (const h of list ?? [])
        hits.set(h.entry, Math.max(hits.get(h.entry) ?? 0, h.weight * factor))
    }
    const direct = this.get(arKey(surface))
    // 词形本身就是一个虚词（أنت، أن، من، على، في）时，同形的别的词条（أُنْتَ 是动词 آنَ 的变位）只给一点点：
    // 虚词出现得极多，同形的冷僻词分到一点也会被抬成常用词。
    // 专名（محمد、أحمد、محمود）也占住自己的写法，但只压别的词的变形（حَمِدَ 的变位、分词），不压同形的原形
    // （形容词 سَعِيد 跟人名 Saeed 照常分）
    const isClosedLemma = (h: FormHit): boolean =>
      h.weight >= 1 && this.pos[h.entry].some((p) => CLOSED.has(p))
    const isName = (h: FormHit): boolean => h.weight >= 1 && this.pos[h.entry].includes('propn')
    if (direct?.some(isClosedLemma))
      for (const h of direct) hits.set(h.entry, isClosedLemma(h) ? h.weight : h.weight * 0.05)
    else if (direct?.some(isName))
      for (const h of direct) hits.set(h.entry, h.weight >= 1 ? h.weight : h.weight * 0.05)
    else put(direct, 1)
    if (!direct) put(this.getLoose(arLooseKey(surface)), 0.8)
    const anyDirect = hits.size > 0
    let cost = Infinity
    for (const g of arLemmaCandidates(surface)) {
      if (!g.tags.every((t) => t in CLITICS)) continue
      if (g.tags.length > cost) break
      const h = (this.get(arKey(g.lemma)) ?? this.getLoose(arLooseKey(g.lemma)))?.filter((x) =>
        cliticAllows(g.tags, this.pos[x.entry])
      )
      if (!h?.length) continue
      cost = g.tags.length
      put(h, (anyDirect ? 0.3 : 0.9) ** g.tags.length)
    }
    return hits
  }
}

/** 词频表里的词形逐个分析过的结果 */
export interface CorpusAnalysis {
  /** 有分析的词形：词形、频率、对上的词条与权重 */
  words: { w: string; f: number; hits: [number, number][] }[]
  /** 只对上这个词条的词形的频率之和（词条「独有」的证据） */
  unique: Float64Array
  /** 按频率加权：只有一种分析的、几种分析的、对不上的 */
  coverage: { unique: number; ambiguous: number; none: number }
  /** 没对上的高频词形（排查用） */
  missed: [string, number][]
}

/** 分析词频表的前 maxWords 个词形（再往后的多是专名、错字、方言） */
export function analyseCorpus(
  wf: Map<string, number>,
  index: FormIndex,
  n: number,
  maxWords = 300_000
): CorpusAnalysis {
  const out: CorpusAnalysis['words'] = []
  const unique = new Float64Array(n)
  let uniq = 0
  let amb = 0
  let none = 0
  const missed: [string, number][] = []
  for (const [w, f] of [...wf.entries()].slice(0, maxWords)) {
    const hits = [...index.analyse(w).entries()]
    if (!hits.length) {
      none += f
      if (missed.length < 400 && /[\u{621}-\u{64a}]/u.test(w)) missed.push([w, f])
      continue
    }
    if (hits.length === 1) {
      unique[hits[0][0]] += f
      uniq += f
    } else amb += f
    out.push({ w, f, hits })
  }
  const all = uniq + amb + none || 1
  return {
    words: out,
    unique,
    coverage: { unique: uniq / all, ambiguous: amb / all, none: none / all },
    missed
  }
}

/**
 * 虚词的词头本身的频率（别的词条是 0）：虚词没有变形，词头又常跟实词的某个变位同形（في 与动词 فَى 的变位），
 * 独有的词形往往一个都没有；把词头的频率算进它的先验，免得同形的冷僻词把它的频率分走。
 */
export function headwordEvidence(
  wf: Map<string, number>,
  heads: string[],
  pos: PosTag[][]
): Float64Array {
  const out = new Float64Array(heads.length)
  heads.forEach((w, i) => {
    if (pos[i].some((p) => CLOSED.has(p))) out[i] = wf.get(arKey(w)) ?? 0
  })
  return out
}

/**
 * 把词形的频率分到词条上。一个词形对上几个词条时按「先验 × 权重」分，只分一遍（不迭代：
 * 迭代会让碰巧跟高频虚词同形的冷僻词越分越多）：
 *   先验 = base（词性：虚词高、专名低、只在方言古典里用的更低）×（独有的词形的频率 + extra）；
 *   extra 是别的证据：Tatoeba 里按英译分辨出来的出现次数、虚词词头本身的频率（headwordEvidence）——
 *   没有独有词形的词条（هو「他」、مَن「谁」、في「在」）靠它。
 * explain 里的词条另外列出频率从哪些词形来（排查用）。
 */
export function allocate(
  corpus: CorpusAnalysis,
  base: Float64Array,
  extra: Float64Array,
  explain?: Set<number>
): { freq: Float64Array; explain: Map<number, [string, number, number][]> } {
  const n = base.length
  const p = new Float64Array(n)
  for (let i = 0; i < n; i++) p[i] = base[i] * (corpus.unique[i] + extra[i] + 1e-12)
  const freq = new Float64Array(n)
  const why = new Map<number, [string, number, number][]>()
  for (const a of corpus.words) {
    let sum = 0
    for (const [e, w] of a.hits) sum += w * p[e]
    if (!sum) continue
    for (const [e, w] of a.hits) {
      const share = (a.f * w * p[e]) / sum
      freq[e] += share
      if (explain?.has(e)) why.set(e, [...(why.get(e) ?? []), [a.w, share, a.hits.length]])
    }
  }
  return { freq, explain: why }
}
