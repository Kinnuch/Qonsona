/**
 * 词频：三份语料各数一遍，换算成「每百万词出现几次」，按权重合起来排名次（fr，1 最常用）。
 *
 * - UD ARCOSG（8.6 万词）：对话、体育解说、口述故事、新闻稿、访谈、小说、正式散文、报纸专栏，
 *   原形是人工标的，直接数原形（动名词的原形是动词：fàgail → fàg）。权重 0.45。
 * - LearnGaelic 语料词频表（《Litir do Luchd-ionnsachaidh》与 BBC ALBA 节目字幕，各前一万个词形）：
 *   面向学习者的真实材料。权重 0.35。
 * - 盖尔语维基百科（全部条目正文）：量大，但偏百科、专名多。权重 0.20。
 *
 * 后两份只有词形：按词典的变形表（跟阅读器查词同一套键）找回原形；一个词形对上几个词条时，
 * 按 ARCOSG 里各词条的次数分（a 是「他的」「去」还是关系小品词，看 ARCOSG 里谁常见）。
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import Bunzip from 'seek-bzip'
import { gdKey, lemmaCandidatesGd, tokenizeGd } from '../../../src/shared/lang/gd/rules'
import type { GdEntry } from './kaikki'

export const WEIGHTS = { arcosg: 0.45, learngaelic: 0.35, wiki: 0.2 }

/** UD 词性 → kaikki 词性 */
const UPOS_TO_KPOS: Record<string, string[]> = {
  NOUN: ['noun'],
  PROPN: ['name', 'noun'],
  VERB: ['verb'],
  AUX: ['verb'],
  ADJ: ['adj'],
  ADV: ['adv'],
  ADP: ['prep', 'prep_phrase'],
  PRON: ['pron'],
  DET: ['det', 'article'],
  PART: ['particle'],
  CCONJ: ['conj'],
  SCONJ: ['conj'],
  NUM: ['num'],
  INTJ: ['intj']
}

/** 词形 → 词条（下标）：词头、显示写法、变形表 */
export class FormIndex {
  #head = new Map<string, number[]>()
  #form = new Map<string, number[]>()
  constructor(readonly entries: GdEntry[]) {
    entries.forEach((e, i) => {
      const add = (map: Map<string, number[]>, text: string): void => {
        const k = gdKey(text)
        if (!k) return
        const list = map.get(k)
        if (!list) map.set(k, [i])
        else if (!list.includes(i)) list.push(i)
      }
      add(this.#head, e.data.w)
      if (e.data.d) add(this.#head, e.data.d)
      for (const [f] of e.data.f ?? []) add(this.#form, f)
    })
  }

  /** 一个写法对上的词条：词头优先，其次变形表，再按规则猜原形；kpos 给了就先按词性筛 */
  resolve(text: string, kpos?: string[]): number[] {
    const k = gdKey(text)
    const pick = (ids: number[] | undefined): number[] => {
      if (!ids?.length) return []
      if (!kpos) return ids
      const same = ids.filter((i) => kpos.includes(this.entries[i].kpos))
      return same
    }
    for (const map of [this.#head, this.#form]) {
      const hit = pick(map.get(k))
      if (hit.length) return hit
    }
    for (const g of lemmaCandidatesGd(text)) {
      const hit = pick(this.#head.get(g.lemma))
      if (hit.length) return hit
      const hit2 = pick(this.#form.get(g.lemma))
      if (hit2.length) return hit2
    }
    // 词性对不上时退一步：不管词性
    if (kpos) return this.resolve(text)
    return []
  }

  /**
   * 正文里的一个词形可能是哪些词条：词头与变形表一起算（toir 既是方言词头，也是 thoir 的从属式；
   * bhith 是 bi 的动名词），由调用的一方按先验分；都没有时按规则猜原形
   */
  candidates(text: string): number[] {
    const k = gdKey(text)
    const out = [...(this.#head.get(k) ?? [])]
    for (const i of this.#form.get(k) ?? []) if (!out.includes(i)) out.push(i)
    if (out.length) return out
    for (const g of lemmaCandidatesGd(text)) {
      const hit = [...(this.#head.get(g.lemma) ?? []), ...(this.#form.get(g.lemma) ?? [])]
      if (hit.length) return [...new Set(hit)]
    }
    return []
  }
}

export interface CorpusCounts {
  /** 每个词条的次数（下标对 entries） */
  counts: Float64Array
  /** 语料一共多少词（算每百万用） */
  tokens: number
  /** 对不上任何词条的词次 */
  unmatched: number
  /** 对不上的词里最常见的（汇报、补词用） */
  topUnmatched: [string, number][]
}

const top = (m: Map<string, number>, n: number): [string, number][] =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)

/** ARCOSG：数原形（带词性） */
export function countArcosg(files: string[], index: FormIndex): CorpusCounts {
  const counts = new Float64Array(index.entries.length)
  let tokens = 0
  let unmatched = 0
  const miss = new Map<string, number>()
  for (const file of files)
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue
      const cols = line.split('\t')
      if (cols.length < 4 || !/^\d+$/.test(cols[0])) continue
      const [, form, lemma, upos] = cols
      if (upos === 'PUNCT' || upos === 'SYM' || upos === 'X') continue
      tokens++
      const kpos = UPOS_TO_KPOS[upos]
      let ids = index.resolve(lemma === '_' ? form : lemma, kpos)
      if (!ids.length) ids = index.resolve(form, kpos)
      if (!ids.length) {
        unmatched++
        miss.set(`${lemma}/${upos}`, (miss.get(`${lemma}/${upos}`) ?? 0) + 1)
        continue
      }
      for (const i of ids) counts[i] += 1 / ids.length
    }
  return { counts, tokens, unmatched, topUnmatched: top(miss, 40) }
}

/** 只有词形的语料：按词形找词条，几个词条时按先验（ARCOSG 的次数 + 1）分 */
export function countForms(
  forms: Map<string, number>,
  index: FormIndex,
  prior: Float64Array
): CorpusCounts {
  const counts = new Float64Array(index.entries.length)
  let tokens = 0
  let unmatched = 0
  const miss = new Map<string, number>()
  for (const [form, n] of forms) {
    tokens += n
    const ids = index.candidates(form)
    if (!ids.length) {
      unmatched += n
      miss.set(form, (miss.get(form) ?? 0) + n)
      continue
    }
    const w = ids.map((i) => prior[i] + 1)
    const sum = w.reduce((a, b) => a + b, 0)
    ids.forEach((i, j) => (counts[i] += (n * w[j]) / sum))
  }
  return { counts, tokens, unmatched, topUnmatched: top(miss, 40) }
}

/** LearnGaelic 的词频表：词形,次数, */
export function readLearnGaelic(file: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const [form, n] = line.split(',')
    const c = Number(n)
    if (!form || !c) continue
    const k = gdKey(form)
    out.set(k, (out.get(k) ?? 0) + c)
  }
  return out
}

// ───────────────────────── 维基百科 ─────────────────────────

/** 去掉维基标记，留下正文（模板、表格、引用、文件、分类都不要） */
export function stripWikitext(src: string): string {
  let t = src
  // 嵌套模板 {{…}}：从里往外去
  for (let i = 0; i < 8 && t.includes('{{'); i++) t = t.replace(/\{\{[^{}]*\}\}/g, ' ')
  t = t
    .replace(/\{\|[\s\S]*?\|\}/g, ' ')
    .replace(/<ref[^>]*\/>/g, ' ')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    // 文件、图片、分类、跨语言链接
    .replace(/\[\[(?:[^\]|:]*):[^\]]*\]\]/g, ' ')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:[^\s\]]+\s*([^\]]*)\]/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/'''?/g, '')
    // 小标题（Iomraidhean「参考」、Ceanglaichean a-mach「外部链接」每篇都有）、列表、表格行都不要
    .replace(/^[=*#:;|!].*$/gm, ' ')
    .replace(/&[a-z]+;/g, ' ')
  return t
}

/** 盖尔语维基百科：数正文里的词形（结果缓存在 .cache，换了 dump 才重数） */
export function countWikiForms(dumpFile: string, cacheFile: string): Map<string, number> {
  // 改了去标记的规则就改版本号，缓存跟着作废
  const stamp = `${statSync(dumpFile).size}-v2`
  if (existsSync(cacheFile)) {
    const c = JSON.parse(readFileSync(cacheFile, 'utf8')) as {
      stamp: string
      forms: [string, number][]
    }
    if (c.stamp === stamp) return new Map(c.forms)
  }
  const xml = Bunzip.decode(readFileSync(dumpFile)).toString('utf8')
  const forms = new Map<string, number>()
  const pageRe = /<page>([\s\S]*?)<\/page>/g
  let m: RegExpExecArray | null
  let pages = 0
  while ((m = pageRe.exec(xml))) {
    const page = m[1]
    if (!/<ns>0<\/ns>/.test(page) || /<redirect /.test(page)) continue
    const text = /<text[^>]*>([\s\S]*?)<\/text>/.exec(page)?.[1]
    if (!text) continue
    pages++
    const plain = stripWikitext(
      text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
    )
    for (const tok of tokenizeGd(plain)) {
      if (tok.kind !== 'word') continue
      const k = gdKey(tok.text)
      if (k.length > 30) continue
      forms.set(k, (forms.get(k) ?? 0) + 1)
    }
  }
  // 只出现一两次的多是专名、错字：不要（也省缓存）
  const kept = [...forms.entries()].filter(([, n]) => n >= 3)
  writeFileSync(cacheFile, JSON.stringify({ stamp, pages, forms: kept }))
  return new Map(kept)
}

/** 合并：每份语料换成每百万词，按权重相加 */
export function combine(parts: { c: CorpusCounts; w: number }[], n: number): Float64Array {
  const score = new Float64Array(n)
  for (const { c, w } of parts) {
    const per = 1e6 / Math.max(1, c.tokens)
    for (let i = 0; i < n; i++) score[i] += c.counts[i] * per * w
  }
  return score
}
