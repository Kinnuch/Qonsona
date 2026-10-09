/**
 * 手写查字（主进程）：第一次识别时才从词典数据库读出所有字的笔画（KanjiVG），建参考数据，
 * 之后一直放在内存里（六千多字，十几 MB）。识别本身在 shared/ja/handwriting.ts。
 */
import { DatabaseSync } from 'node:sqlite'
import { inflateRawSync } from 'node:zlib'
import {
  buildRefs,
  recognize,
  type Candidate,
  type RefIndex,
  type RefRow,
  type Stroke
} from '../shared/ja/handwriting'

/** 常用字往前排的默认力度（见 HandwritingIndex.preferCommon） */
export const COMMON_BIAS = 0.01

export interface HandwritingOptions {
  /** 也认平假名、片假名（默认只认汉字和々〆） */
  kana?: boolean
  /** 常用字往前排的力度，见 preferCommon；默认 COMMON_BIAS */
  commonBias?: number
}

/** 建参考数据的情况 */
export interface HandwritingStats {
  /** 参考数据里有几个字、一共几笔 */
  chars: number
  strokes: number
  /** 读数据库、解压笔画用了多久（毫秒） */
  readMs: number
  /** 建参考数据用了多久（毫秒） */
  buildMs: number
  /** 参考数据占多少字节（类型化数组，不算字的字符串） */
  bytes: number
}

type Row = Record<string, unknown>

/** 汉字以外也认的两个：「人々」的々、「〆切」的〆 */
const MARKS = new Set(['々', '〆'])
const KANA = /^[ぁ-ゖァ-ヺー]$/
const HAN = /^\p{Script=Han}$/u

/**
 * 常用度排名（越小越常用），从 kanji.data 里算：报纸用字的频度排名（fr，前 2500 个）优先；
 * 没有的按常用汉字（gr ≤ 8）、JLPT（jl）、人名用汉字（gr 9、10）往后排；都没有的算最生僻（null）。
 * 假名和々〆算比较常用
 */
export function commonRank(ch: string, data: Row): number | null {
  if (typeof data.fr === 'number') return data.fr
  if (MARKS.has(ch) || KANA.test(ch)) return 1000
  const gr = typeof data.gr === 'number' ? data.gr : null
  if (gr !== null && gr <= 8) return 2600
  if (typeof data.jl === 'number') return 2800
  if (gr !== null) return 3200
  return null
}

export class HandwritingIndex {
  #path: string
  #kana: boolean
  #bias: number
  #refs: RefIndex | null = null
  #stats: HandwritingStats | null = null

  /** path 是 dict.sqlite；这时还不读，第一次识别（或调 load）时才读 */
  constructor(path: string, opts: HandwritingOptions = {}) {
    this.#path = path
    this.#kana = !!opts.kana
    this.#bias = Math.max(0, opts.commonBias ?? COMMON_BIAS)
  }

  /** 建参考数据的情况；还没建时是 null */
  get stats(): HandwritingStats | null {
    return this.#stats
  }

  /** 现在就建好参考数据（比如打开手写板时先建，第一笔写完不用等） */
  load(): HandwritingStats {
    if (!this.#refs) this.#build()
    return this.#stats!
  }

  #build(): RefIndex {
    const t0 = performance.now()
    const db = new DatabaseSync(this.#path, { readOnly: true })
    const rows: RefRow[] = []
    try {
      const all = db
        .prepare('SELECT ch, data, strokes FROM kanji WHERE strokes IS NOT NULL')
        .all() as Row[]
      for (const r of all) {
        const ch = String(r.ch)
        const data = JSON.parse(String(r.data)) as Row
        // 汉字只要 KANJIDIC 里有的（有 gr 这一项）：不要 ⺡ 这类部首的变形、冷（U+F92E）这类兼容区的重复字
        const wanted =
          MARKS.has(ch) || (HAN.test(ch) && 'gr' in data) || (this.#kana && KANA.test(ch))
        if (!wanted) continue
        const paths = JSON.parse(inflateRawSync(r.strokes as Uint8Array).toString()) as string[]
        rows.push({ ch, paths, rank: commonRank(ch, data) })
      }
    } finally {
      db.close()
    }
    const t1 = performance.now()
    const refs = buildRefs(rows)
    refs.commonBias = this.#bias
    const t2 = performance.now()
    const arrays = [refs.first, refs.pts, refs.joined, refs.ptsQ, refs.joinedQ, refs.len]
    arrays.push(refs.cen, refs.cenJ, refs.feat, refs.rarity)
    this.#stats = {
      chars: refs.chars.length,
      strokes: refs.first[refs.chars.length],
      readMs: Math.round(t1 - t0),
      buildMs: Math.round(t2 - t1),
      bytes: arrays.reduce((n, a) => n + a.byteLength, 0)
    }
    return (this.#refs = refs)
  }

  /**
   * 识别：strokes 是画板上写的若干笔（每笔是画板坐标的点列，点数、点距随意），
   * 返回最像的 n 个字，分数越小越像（见 shared/ja/handwriting.ts）
   */
  recognize(strokes: Stroke[], n = 20): Candidate[] {
    return recognize(strokes, this.#refs ?? this.#build(), n)
  }

  /**
   * 常用字往前排：分数差在 bias 以内时，常用的（报纸上用得多的、常用汉字、JLPT 考的）排前面；
   * 0 时只在同分时才看常用度。默认 COMMON_BIAS（写得像的字照样排第一，只是形近字里常用的靠前）
   */
  preferCommon(bias = COMMON_BIAS): void {
    this.#bias = Math.max(0, bias)
    if (this.#refs) this.#refs.commonBias = this.#bias
  }
}
