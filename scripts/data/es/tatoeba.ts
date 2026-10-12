/**
 * Tatoeba 例句（CC BY 2.0 FR）：西班牙语句子配上中文、英文翻译。
 * - 中文：先用直接的西中对译（spa-cmn_links）；没有的，取它的英文翻译的中文翻译（spa → eng → cmn，
 *   都是人工翻译，只是隔了一层英语，来源另记 tatoeba-pivot）。
 * - 英文：西英对译（spa-eng_links），取第一句。
 * 学习软件里不放的内容（粗口、色情、自杀）挡掉；太长的不要。
 */
import { readTsv } from './util'

export interface TSentence {
  id: number
  text: string
  en?: string
  zh?: string
  /** 中文翻译的来源：tatoeba（直接对译）或 tatoeba-pivot（经英文） */
  zs?: string
}

export interface TatoebaFiles {
  spa: string
  cmn: string
  eng: string
  spaCmn: string
  spaEng: string
  engCmn: string
}

/** 例句最长多少字 */
const MAX_LEN = 140

/** 不放进学习软件的句子（粗口、色情、自杀） */
export const UNSUITABLE =
  /\b(put[ao]s?|putit[ao]|mierdas?|jod(?:er|e|o|ido|ida|idos|idas|ete)|coños?|pollas?|foll\w+|cabr[oó]n\w*|gilipollas|pendej\w+|vergas?|ching\w+|culer[oa]s?|maric[oó]n\w*|marica|viol(?:ar|ó|aron|ación|ada|ado)\w*|suicid\w*|porno\w*|sexo|sexual\w*|desnud\w+|condón|condones|orgasm\w*|masturb\w*|prostitut\w*)\b/i

/** 链接表：左 id → 右 id 列表 */
async function links(file: string, keep?: (a: number) => boolean): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>()
  for await (const [a, b] of readTsv(file)) {
    const x = Number(a)
    if (keep && !keep(x)) continue
    let l = out.get(x)
    if (!l) out.set(x, (l = []))
    l.push(Number(b))
  }
  return out
}

/** 句子表：id → 文字（只要 want 里的） */
async function sentences(file: string, want?: Set<number>): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  for await (const row of readTsv(file)) {
    const id = Number(row[0])
    if (want && !want.has(id)) continue
    const text = row[2]?.trim()
    if (text) out.set(id, text)
  }
  return out
}

/** 全部西语句子（不管有没有翻译，数短语出现次数用）与带翻译的例句 */
export async function loadTatoeba(f: TatoebaFiles): Promise<{
  all: string[]
  examples: TSentence[]
}> {
  const spa = await sentences(f.spa)
  const spaCmn = await links(f.spaCmn)
  const spaEng = await links(f.spaEng)
  const engIds = new Set<number>()
  for (const l of spaEng.values()) for (const e of l) engIds.add(e)
  const engCmn = await links(f.engCmn, (e) => engIds.has(e))
  const cmnIds = new Set<number>()
  for (const l of spaCmn.values()) for (const c of l) cmnIds.add(c)
  for (const l of engCmn.values()) for (const c of l) cmnIds.add(c)
  const cmn = await sentences(f.cmn, cmnIds)
  const eng = await sentences(f.eng, engIds)

  const examples: TSentence[] = []
  for (const [id, text] of spa) {
    if (text.length > MAX_LEN || UNSUITABLE.test(text)) continue
    const en = (spaEng.get(id) ?? []).map((e) => eng.get(e)).find((s) => s && !UNSUITABLE.test(s))
    let zh = (spaCmn.get(id) ?? []).map((c) => cmn.get(c)).find(Boolean)
    let zs = zh ? 'tatoeba' : undefined
    if (!zh)
      for (const e of spaEng.get(id) ?? []) {
        zh = (engCmn.get(e) ?? []).map((c) => cmn.get(c)).find(Boolean)
        if (zh) {
          zs = 'tatoeba-pivot'
          break
        }
      }
    if (!en && !zh) continue
    examples.push({ id, text, en, zh, zs })
  }
  return { all: [...spa.values()], examples }
}

/** 一句话切成小写的词（只要字母，数短语用） */
export const words = (text: string): string[] =>
  text
    .toLocaleLowerCase('es')
    .split(/[^\p{L}]+/u)
    .filter(Boolean)

/** 一个词形至少出现这么多次，才算它有几成在固定短语里 */
const MIN_INSIDE = 20

/**
 * 带空格的词头在句子里出现了几次（两到六个词连着出现），返回次数与总词次；
 * 另外数每个词形有几成出现在固定短语（fixed，副词、介词、连词性的短语）里面——
 * sin embargo 的 embargo、a través de 的 través 几乎只在短语里出现，算词频时要扣掉。
 * 短语按小写、只留字母的词序列比（por favor、sin embargo、a lo mejor）。
 */
export function countPhrases(
  texts: string[],
  phrases: Iterable<string>,
  fixed: Set<string>
): {
  counts: Map<string, number>
  total: number
  inside: Map<string, number>
  upper: Map<string, number>
} {
  const want = new Map<string, { key: string; fixed: boolean; n: number }>()
  let maxN = 2
  for (const p of phrases) {
    const ws = words(p)
    if (ws.length < 2) continue
    want.set(ws.join(' '), {
      key: p.toLocaleLowerCase('es'),
      fixed: fixed.has(p),
      n: ws.length
    })
    maxN = Math.max(maxN, Math.min(ws.length, 6))
  }
  const counts = new Map<string, number>()
  const seen = new Map<string, number>()
  const inPhrase = new Map<string, number>()
  /** 不在句首时首字母大写的次数、小写的次数（Cuba 跟 cuba「木桶」、Valencia 跟 valencia「化合价」） */
  const caps = new Map<string, [number, number]>()
  let total = 0
  for (const t of texts) {
    const raw = t.split(/[^\p{L}]+/u).filter(Boolean)
    for (let i = 1; i < raw.length; i++) {
      const w = raw[i]
      const k = w.toLocaleLowerCase('es')
      const c = caps.get(k) ?? [0, 0]
      if (w[0] !== k[0]) c[0]++
      else c[1]++
      caps.set(k, c)
    }
    const ws = words(t)
    total += ws.length
    const covered = new Uint8Array(ws.length)
    for (let i = 0; i < ws.length; i++) {
      let gram = ws[i]
      for (let n = 2; n <= maxN && i + n <= ws.length; n++) {
        gram += ' ' + ws[i + n - 1]
        const p = want.get(gram)
        if (!p) continue
        counts.set(p.key, (counts.get(p.key) ?? 0) + 1)
        if (p.fixed) covered.fill(1, i, i + n)
      }
    }
    ws.forEach((w, i) => {
      seen.set(w, (seen.get(w) ?? 0) + 1)
      if (covered[i]) inPhrase.set(w, (inPhrase.get(w) ?? 0) + 1)
    })
  }
  const inside = new Map<string, number>()
  for (const [w, n] of inPhrase) {
    const all = seen.get(w) ?? 0
    if (all >= MIN_INSIDE) inside.set(w, n / all)
  }
  /** 词形 → 大写的比例（出现五次以上的才算） */
  const upper = new Map<string, number>()
  for (const [w, [u, l]] of caps) if (u + l >= 5) upper.set(w, u / (u + l))
  return { counts, total, inside, upper }
}

/** 阳性、阴性的限定词（冠词、指示词、缩合） */
export const MASC_DET = new Set(
  'el un este ese aquel del al los unos estos esos aquellos ningún algún'.split(' ')
)
export const FEM_DET = new Set(
  'la una esta esa aquella las unas estas esas aquellas ninguna alguna'.split(' ')
)

/**
 * 阴阳性不同的同形名词（el capital 资本 / la capital 首都、el orden 顺序 / la orden 命令）：
 * 数它们在 Tatoeba 里前面紧挨着阳性、阴性限定词的次数，返回 词 → [阳性, 阴性]。
 * forms：这些词的各个词形（单复数）→ 词头。
 */
export function genderCounts(
  texts: string[],
  forms: Map<string, string>
): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>()
  for (const t of texts) {
    const ws = words(t)
    for (let i = 1; i < ws.length; i++) {
      const w = forms.get(ws[i])
      if (!w) continue
      const prev = ws[i - 1]
      const c = out.get(w) ?? [0, 0]
      if (MASC_DET.has(prev)) c[0]++
      else if (FEM_DET.has(prev)) c[1]++
      else continue
      out.set(w, c)
    }
  }
  return out
}
