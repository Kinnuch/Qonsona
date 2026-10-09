/**
 * 把中文释义、法语释义对到英文维基词典的义项上。
 *
 * 几份来源的义项划分各不相同，只能靠「英文的桥」对：
 * - 法语维基词典的义项有英文译词（同一个义项的翻译表）→ 跟英文释义比词；
 * - 英文维基词典翻译表（pivot）的中文译词本来就挂在一个英文义项上（英文词头 + 义项说明）；
 * - 中文维基词典、CFDICT 的中文词 → 查 CC-CEDICT 的英文意思再比。
 * 比的是英文实词（小写、去掉常见虚词、粗略去掉词尾）重合几个，重合最多的那个义项胜；一个都不重合的：
 * 只有一个义项时就给它，否则中文维基词典的第 n 个义项给第 n 个还没有中文的义项（两边的义项大体都是常用的在前），
 * 其余的不要（宁缺毋滥）。
 */
import type { PosTag } from '../../../src/shared/lang/types'
import { frKey } from '../../../src/shared/lang/fr/rules'
import type { FrEntry } from './wikt-fr'
import type { CfHit, ZhWiktEntry } from './zh-sources'
import { toSimplified } from './zh-sources'
import type { PivotSense } from './pivot'

const STOP = new Set(
  'a an the to of for in on at by with from into onto as or and be been being is are was were it its one oneself ones someone something somebody sth sb that this which who whom what used use make made do does done get got have has had very more most much some any not no such other another so than then there their them they he she his her him you your we our us i my me etc especially usually often also e g ie eg'.split(
    ' '
  )
)

/** 英文的「词袋」：实词、小写、粗略去词尾 */
export function bag(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 2 || STOP.has(raw)) continue
    let w = raw
    if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
    else if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y'
    else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
    else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2)
    else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
    out.add(w)
  }
  return out
}

const overlap = (a: Set<string>, b: Set<string>): number => {
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return n
}

/** 「美丽的，漂亮的；好看的」拆成几个词；括号里的逗号不拆 */
export function splitZh(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if ('（(［[【'.includes(ch)) depth++
    else if ('）)］]】'.includes(ch)) depth = Math.max(0, depth - 1)
    if (depth === 0 && '，,；;／/'.includes(ch)) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** 英文维基词典里「貓 /猫」「空閒 /空閑 /空闲」：取最后一个（简体），再逐字转简体保险 */
export function pickSimplified(word: string, t2s: Record<string, string>): string {
  const parts = word
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
  return toSimplified(parts[parts.length - 1] ?? word, t2s)
}

/** 中文词的英文意思（CC-CEDICT）；形容词后面的「的」、动词前面的「使」去掉再查 */
function zhBag(term: string, cedict: Record<string, string[]>): Set<string> {
  const core = term.replace(/[（(［[【][^）)］\]】]*[）)］\]】]/g, '').trim()
  const tries = [core, core.replace(/的$/, ''), core.replace(/^使/, ''), core.replace(/地$/, '')]
  const out = new Set<string>()
  for (const t of tries) for (const d of cedict[t] ?? []) for (const w of bag(d)) out.add(w)
  return out
}

/** 一个中文候选：从哪来、英文的桥 */
interface Cand {
  zh: string
  src: 'zhwikt' | 'frwikt' | 'pivot' | 'cfdict'
  bridge: Set<string>
  /** 中文维基词典的第几个义项（序号回退用） */
  ord?: number
  w: number
}

export interface AlignInput {
  /** 各义项的英文释义 */
  senses: { en: string[] }[]
  key: string
  pos: PosTag
  g?: string
  fr?: FrEntry
  zhwikt?: ZhWiktEntry[]
  pivot?: PivotSense[]
  cf?: CfHit[]
}

export interface AlignOut {
  /** 每个义项的中文（已排好、去重） */
  zh: { items: string[]; src: 'wikt' | 'cfdict' }[]
  /** 每个义项的法语释义 */
  mono: string[][]
}

/** 英文维基词典的词性 → 法语词条的词性对不对得上 */
const PIVOT_POS: Record<string, PosTag[]> = {
  noun: ['noun', 'propn'],
  verb: ['verb'],
  adj: ['adj'],
  adv: ['adv'],
  pron: ['pron'],
  prep: ['adp'],
  conj: ['cconj', 'sconj'],
  intj: ['intj'],
  num: ['num'],
  det: ['det'],
  article: ['det'],
  phrase: ['phrase', 'idiom', 'proverb', 'adv', 'adp'],
  prep_phrase: ['adp', 'phrase'],
  proverb: ['proverb', 'phrase']
}

export function pivotFits(p: PivotSense, key: string, pos: PosTag, g?: string): boolean {
  if (!(PIVOT_POS[p.p] ?? []).includes(pos)) return false
  return p.fr.some(([w, ...tags]) => {
    if (frKey(w) !== key) return false
    if (pos !== 'noun' || !g || g === 'mf') return true
    if (tags.includes('masculine') && !tags.includes('feminine')) return g === 'm'
    if (tags.includes('feminine') && !tags.includes('masculine')) return g === 'f'
    return true
  })
}

export function align(
  input: AlignInput,
  cedict: Record<string, string[]>,
  t2s: Record<string, string>,
  jieba: Record<string, number>
): AlignOut {
  const n = input.senses.length
  const sBags = input.senses.map((s) => bag(s.en.join(' ')))
  const best = (b: Set<string>): number => {
    let bi = -1
    let bs = 0
    sBags.forEach((sb, i) => {
      const o = overlap(b, sb)
      if (o > bs) {
        bs = o
        bi = i
      }
    })
    return bi
  }

  // 收候选
  const cands: Cand[] = []
  input.zhwikt?.forEach((e) =>
    e.s.forEach((gloss, ord) => {
      for (const zh of splitZh(gloss))
        cands.push({ zh, src: 'zhwikt', bridge: zhBag(zh, cedict), ord, w: 3 })
    })
  )
  for (const s of input.fr?.s ?? [])
    for (const z of s.zh ?? []) {
      const zh = toSimplified(z, t2s)
      const b = bag((s.en ?? []).join(' '))
      for (const w of zhBag(zh, cedict)) b.add(w)
      cands.push({ zh, src: 'frwikt', bridge: b, w: 2.5 })
    }
  for (const p of input.pivot ?? [])
    for (const z of p.zh) {
      const zh = pickSimplified(z, t2s)
      cands.push({ zh, src: 'pivot', bridge: bag(`${p.e} ${p.s}`), w: 2 })
    }
  for (const c of input.cf ?? []) {
    // 一个中文词对一长串法语释义的，越往后越不像是这个法语词的主要意思
    const w = (c.i === 0 ? 1.2 : c.i < 3 ? 0.8 : 0.4) * (c.one ? 0.7 : 1)
    cands.push({ zh: c.zh, src: 'cfdict', bridge: zhBag(c.zh, cedict), w })
  }

  // 分给义项
  const perSense = Array.from(
    { length: n },
    () => new Map<string, { score: number; srcs: Set<string> }>()
  )
  const put = (i: number, c: Cand): void => {
    const zh = c.zh.replace(/^[（(][^）)]*[）)]$/, '').trim()
    if (!zh || zh.length > 24 || !/\p{Script=Han}/u.test(zh)) return
    const cur = perSense[i].get(zh) ?? { score: 0, srcs: new Set<string>() }
    cur.score += c.w
    cur.srcs.add(c.src)
    perSense[i].set(zh, cur)
  }
  const unplaced: Cand[] = []
  for (const c of cands) {
    if (n === 1) {
      put(0, c)
      continue
    }
    const i = best(c.bridge)
    if (i >= 0) put(i, c)
    else unplaced.push(c)
  }
  // 对不上的中文维基词典释义：第 n 个给第 n 个还没有中文的义项；第一个义项的保底给第一个义项
  for (const c of unplaced) {
    if (c.src !== 'zhwikt' || c.ord === undefined) continue
    if (c.ord < n && perSense[c.ord].size === 0) put(c.ord, c)
    else if (c.ord === 0 && perSense[0].size === 0) put(0, c)
  }

  const zh = perSense.map((m) => {
    const wikt = [...m].filter(([, v]) => [...v.srcs].some((s) => s !== 'cfdict'))
    const use = wikt.length ? wikt : [...m]
    const items = use
      .sort(
        (a, b) =>
          b[1].score - a[1].score ||
          (jieba[b[0].replace(/的$/, '')] ?? 0) - (jieba[a[0].replace(/的$/, '')] ?? 0) ||
          a[0].length - b[0].length
      )
      .map(([z]) => z)
    // 去掉被别的候选包含的重复（「漂亮」和「漂亮的」只留一个）
    const kept: string[] = []
    for (const z of items) {
      const base = z.replace(/的$/, '')
      if (kept.some((k) => k.replace(/的$/, '') === base)) continue
      kept.push(z)
      if (kept.length >= 4) break
    }
    return { items: kept, src: (wikt.length ? 'wikt' : 'cfdict') as 'wikt' | 'cfdict' }
  })

  // 法语释义：法语维基词典的义项按英文译词对；只有一个英文义项时给第一个法语释义
  const mono: string[][] = Array.from({ length: n }, () => [])
  const fs = input.fr?.s ?? []
  if (n === 1 && fs.length) mono[0].push(fs[0].m)
  else
    fs.forEach((s, j) => {
      const i = s.en?.length ? best(bag(s.en.join(' '))) : j === 0 ? 0 : -1
      if (i >= 0 && !mono[i].length) mono[i].push(s.m)
    })
  return { zh, mono }
}
