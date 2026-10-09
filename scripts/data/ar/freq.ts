/**
 * 词频：wordfreq 的阿拉伯语大表（large_ar.msgpack.gz，维基百科、字幕、新闻、网页、推特五种语料合起来，
 * 去掉了元音符号与延长线，跟查词键一个口径）。表里是词形（كتابه、والكتاب……），这里把它们归到词条上：
 *   1. 词形的查词键在变形表里（كتب = كَتَبَ 的过去式、كِتَاب 的复数……）就分给这些词条；
 *   2. 不在表里的剥掉附着词再查（وبكتابه → كتاب）；
 *   3. 一个词形对上几个词条时按「先验」分：先验从各词条自己的证据迭代几轮（EM），
 *      لم 对上否定词 لَمْ 和动词 لَمَّ 时，动词别的词形（يلم、لممت……）很少见，大头就归否定词。
 * 结果是每个词条的频率（每百万词出现几次）与名次。
 */
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { arKey, arLemmaCandidates } from '../../../src/shared/lang/ar/rules'

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

export class FormIndex {
  readonly map = new Map<string, FormHit[]>()
  add(form: string, entry: number, weight: number): void {
    const k = arKey(form)
    if (!k) return
    const list = this.map.get(k)
    if (!list) this.map.set(k, [{ entry, weight }])
    else {
      const h = list.find((x) => x.entry === entry)
      if (h) h.weight = Math.max(h.weight, weight)
      else list.push({ entry, weight })
    }
  }
  get(k: string): FormHit[] | undefined {
    return this.map.get(k)
  }
}

export interface Attribution {
  /** 每个词条的频率（比例） */
  freq: Float64Array
  /** 词形总数、对上表的、靠剥附着词对上的、没对上的（按频率加权的比例） */
  coverage: { direct: number; clitic: number; none: number }
  /** 没对上的高频词形（排查用） */
  missed: [string, number][]
}

/**
 * 把词形的频率分到词条上。prior[e] 是词条的先验（初值），迭代时换成上一轮分到的频率开方（压一压大词的优势）。
 * 只用前 maxWords 个词形（再往后的多是专名、错字、方言）。
 */
export function attribute(
  wf: Map<string, number>,
  index: FormIndex,
  prior: Float64Array,
  opts: { maxWords?: number; rounds?: number } = {}
): Attribution {
  const words = [...wf.entries()].slice(0, opts.maxWords ?? 300_000)
  // 每个词形先找到候选：表里直接有的，或者剥附着词后有的（只取剥得最少的那一档）
  const hits: { f: number; list: FormHit[]; clitic: boolean }[] = []
  let direct = 0
  let clitic = 0
  let none = 0
  const missed: [string, number][] = []
  for (const [w, f] of words) {
    const k = arKey(w)
    const d = index.get(k)
    if (d) {
      hits.push({ f, list: d, clitic: false })
      direct += f
      continue
    }
    let found: FormHit[] | undefined
    let cost = Infinity
    for (const g of arLemmaCandidates(w)) {
      if (g.tags.length > cost) break
      const h = index.get(arKey(g.lemma))
      if (!h) continue
      cost = g.tags.length
      found = [...(found ?? []), ...h.map((x) => ({ entry: x.entry, weight: x.weight * 0.9 }))]
    }
    if (found) {
      hits.push({ f, list: found, clitic: true })
      clitic += f
    } else {
      none += f
      if (missed.length < 400 && /[\u{621}-\u{64a}]/u.test(w)) missed.push([w, f])
    }
  }
  let p = Float64Array.from(prior)
  let freq = new Float64Array(prior.length)
  for (let round = 0; round < (opts.rounds ?? 4); round++) {
    freq = new Float64Array(prior.length)
    for (const h of hits) {
      let sum = 0
      for (const x of h.list) sum += x.weight * p[x.entry]
      if (!sum) continue
      for (const x of h.list) freq[x.entry] += (h.f * x.weight * p[x.entry]) / sum
    }
    // 下一轮的先验：本轮的频率开方，再跟初值的先验平均一下（没证据的词条不至于归零）
    const next = new Float64Array(prior.length)
    let total = 0
    for (let i = 0; i < freq.length; i++) total += Math.sqrt(freq[i])
    for (let i = 0; i < freq.length; i++)
      next[i] = 0.7 * (Math.sqrt(freq[i]) / (total || 1)) * freq.length + 0.3 * prior[i]
    p = next
  }
  const all = direct + clitic + none || 1
  return {
    freq,
    coverage: { direct: direct / all, clitic: clitic / all, none: none / all },
    missed
  }
}
