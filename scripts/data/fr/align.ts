/**
 * 把中文释义、法语释义对到英文维基词典的义项上。
 *
 * 几份来源的义项划分各不相同，只能靠「英文的桥」对：
 * - 法语维基词典的义项有英文译词（同一个义项的翻译表）→ 跟英文释义比词；
 * - 英文维基词典翻译表（pivot）的中文译词本来就挂在一个英文义项上：英文词头得出现在这个法语义项的英文释义里，
 *   再按翻译表的义项说明挑最像的义项（chat「cat（家猫）」↔ 猫）；
 * - 中文维基词典、CFDICT 的中文词 → 查 CC-CEDICT 的英文意思再比。
 * 比的是英文实词（小写、去掉虚词、粗略去掉词尾）重合几个，重合最多的义项胜。英文释义全是虚词的
 * （「a, an」「to be」）改比原词。对不上的：
 * - 桥是空的（CC-CEDICT 不认得这个中文说法）、又是人写的中文释义：只有一个义项时给它；
 *   两边义项数一样时第 n 个给第 n 个；否则只把第一个给第一个义项；
 * - 桥不空却对不上，说明是别的意思（同形词、别的义项），不要（宁缺毋滥）。
 * 虚词（代词、冠词、介词、连词）不用 CFDICT：反查出来的多是不相干的词。
 */
import type { PosTag } from '../../../src/shared/lang/types'
import { frKey } from '../../../src/shared/lang/fr/rules'
import type { FrEntry } from './wikt-fr'
import type { CfHit, ZhWiktEntry } from './zh-sources'
import { toSimplified } from './zh-sources'
import type { PivotSense } from './pivot'

/** 只去掉真正的虚词：be、have、go、make 这些对法语的 être、avoir、aller、faire 是实词 */
const STOP = new Set(
  'a an the to of for in on at by with from into onto as or and it its one oneself ones someone something somebody sth sb that this these those which who whom what whose not no such other another so than then there their them they he she his her him you your we our us i my me etc especially usually often also e g ie eg very more most much some any used use certain'.split(
    ' '
  )
)

function stem(raw: string): string {
  let w = raw
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y'
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  return w
}

/** 虚词的释义里也不算数的：冠词与凑数的词 */
const FILLER = new Set('a an the sth sb etc e g ie eg used use'.split(' '))

/**
 * 英文的「词袋」：小写、粗略去词尾。mode：content 只留实词；function 留代词、介词（给代词、介词这些虚词条比），
 * 只去掉冠词和凑数的词；all 全留
 */
export function bag(
  text: string,
  mode: 'content' | 'function' | 'all' | boolean = 'content'
): Set<string> {
  const m = mode === true ? 'all' : mode === false ? 'content' : mode
  const out = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (!raw) continue
    if (m === 'content' && (raw.length < 2 || STOP.has(raw))) continue
    if (m === 'function' && FILLER.has(raw)) continue
    out.add(stem(raw))
  }
  return out
}

const overlap = (a: Set<string>, b: Set<string>): number => {
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return n
}

/**
 * 翻译表的英文词头跟这个义项对不对得上：词头出现在释义里，或者是释义里某个词的合成词
 * （bedsheet ⊃ sheet、windowpane ⊃ pane）；lira 跟「pound (unit of currency)」对不上
 */
function headFits(head: Set<string>, sense: Set<string>): boolean {
  if (overlap(head, sense)) return true
  for (const h of head)
    for (const w of sense) if (w.length >= 4 && h.length > w.length && h.includes(w)) return true
  return false
}

/** 「美丽的，漂亮的；好看的」拆成几个词；括号里的逗号不拆 */
export function splitZh(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if ('（(［[【〈'.includes(ch)) depth++
    else if ('）)］]】〉'.includes(ch)) depth = Math.max(0, depth - 1)
    if (depth === 0 && '，,；;／/'.includes(ch)) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** 一个中文译词的写法整理：去掉词性缩写（prep. adv.）、〈俗〉这类标记、句末标点；整个包在括号里的去掉括号 */
export function cleanItem(zh: string): string {
  let s = zh
    .replace(
      /^\s*(?:prep|adv|adj|loc\.\s*prép|loc|n\.\s*[mf]|v\.\s*[ti]|conj|pron|interj)\.\s*/i,
      ''
    )
    .replace(/^〈[^〉]*〉\s*/, '')
    .replace(/[。：:；;，,、\s]+$/u, '')
    .trim()
  const m = /^[（(]([^（()）]*)[）)]$/.exec(s)
  if (m) s = m[1].trim()
  return s
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
function zhMeaning(term: string, cedict: Record<string, string[]>): string {
  const core = term.replace(/[（(［[【〈][^）)］\]】〉]*[）)］\]】〉]/g, '').trim()
  const tries = [core, core.replace(/的$/, ''), core.replace(/^使/, ''), core.replace(/地$/, '')]
  return [...new Set(tries)].flatMap((t) => cedict[t] ?? []).join(' ; ')
}

type Src = 'zhwikt' | 'frwikt' | 'pivot' | 'cfdict'

/** 一个中文候选：从哪来、英文的桥 */
interface Cand {
  zh: string
  src: Src
  /** 英文的桥（实词）；raw 是连虚词一起的 */
  bridge: Set<string>
  raw: Set<string>
  /** pivot：英文词头（得出现在义项的英文释义里） */
  head?: Set<string>
  /** 中文维基词典的第几个义项（序号回退用） */
  ord?: number
  /** 来自没写词性的中文维基词典词条（几个词性的意思混在一起，不能按序号对） */
  mixed?: boolean
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

const FUNCTION_POS = new Set<PosTag>(['pron', 'det', 'adp', 'cconj', 'sconj', 'part', 'other'])
/** 一个义项最多几个中文说法 */
const MAX_ITEMS = 3
const WEIGHT: Record<Src, number> = { zhwikt: 3, frwikt: 2.5, pivot: 2, cfdict: 1 }

export function align(
  input: AlignInput,
  cedict: Record<string, string[]>,
  t2s: Record<string, string>,
  jieba: Record<string, number>
): AlignOut {
  const n = input.senses.length
  // 虚词（代词、冠词、介词、连词）的英文释义几乎全是虚词（「you (singular)」），整个当实词比
  const fn = FUNCTION_POS.has(input.pos) ? 'function' : 'content'
  const sBags = input.senses.map((s) => bag(s.en.join(' '), fn))
  const sRaw = input.senses.map((s) => bag(s.en.join(' '), true))
  /** 跟哪个义项最像（实词重合；义项的英文全是虚词时比原词）；都不像返回 -1 */
  const best = (c: Pick<Cand, 'bridge' | 'raw' | 'head'>): number => {
    let bi = -1
    let bs = 0
    for (let i = 0; i < n; i++) {
      if (c.head && !headFits(c.head, sBags[i].size ? sBags[i] : sRaw[i])) continue
      const o = sBags[i].size ? overlap(c.bridge, sBags[i]) : overlap(c.raw, sRaw[i])
      if (o > bs) {
        bs = o
        bi = i
      }
    }
    return bi
  }
  const meaning = (zh: string): { bridge: Set<string>; raw: Set<string> } => {
    const m = zhMeaning(zh, cedict)
    return { bridge: bag(m, fn), raw: bag(m, true) }
  }

  // 收候选
  const cands: Cand[] = []
  const zwSenses = input.zhwikt?.flatMap((e) => e.s.map((g) => ({ g, mixed: e.p === null }))) ?? []
  zwSenses.forEach(({ g, mixed }, ord) => {
    for (const part of splitZh(g)) {
      const zh = cleanItem(part)
      if (zh) cands.push({ zh, src: 'zhwikt', ...meaning(zh), ord, mixed, w: WEIGHT.zhwikt })
    }
  })
  for (const s of input.fr?.s ?? [])
    for (const z of s.zh ?? []) {
      const zh = cleanItem(toSimplified(z, t2s))
      if (!zh) continue
      const m = meaning(zh)
      const en = (s.en ?? []).join(' ')
      for (const w of bag(en, fn)) m.bridge.add(w)
      for (const w of bag(en, true)) m.raw.add(w)
      cands.push({ zh, src: 'frwikt', ...m, w: WEIGHT.frwikt })
    }
  for (const p of input.pivot ?? [])
    for (const z of p.zh) {
      const zh = cleanItem(pickSimplified(z, t2s))
      if (!zh) continue
      cands.push({
        zh,
        src: 'pivot',
        bridge: bag(`${p.e} ${p.s}`, fn),
        raw: bag(`${p.e} ${p.s}`, true),
        head: bag(p.e, fn).size ? bag(p.e, fn) : bag(p.e, true),
        w: WEIGHT.pivot
      })
    }
  if (!FUNCTION_POS.has(input.pos))
    for (const c of input.cf ?? []) {
      // 一个中文词对一长串法语释义的，越往后越不像是这个法语词的主要意思
      const w = (c.i === 0 ? 1.2 : c.i < 3 ? 0.8 : 0.4) * (c.one ? 0.7 : 1)
      cands.push({ zh: c.zh, src: 'cfdict', ...meaning(c.zh), w })
    }

  // 分给义项
  const perSense = Array.from(
    { length: n },
    () => new Map<string, { score: number; srcs: Set<Src> }>()
  )
  const put = (i: number, c: Cand): void => {
    const zh = c.zh
    if (!zh || zh.length > 24 || !/\p{Script=Han}/u.test(zh)) return
    const cur = perSense[i].get(zh) ?? { score: 0, srcs: new Set<Src>() }
    cur.score += c.w
    cur.srcs.add(c.src)
    perSense[i].set(zh, cur)
  }
  const orphans: Cand[] = []
  for (const c of cands) {
    const i = best(c)
    if (i >= 0) put(i, c)
    else if (!c.bridge.size && (c.src === 'zhwikt' || c.src === 'frwikt')) orphans.push(c)
    // 桥不空却对不上的：别的意思，不要
  }
  // 桥是空的人写释义：只有一个义项给它；义项数一样按序号；否则只把中文维基词典的第一个给第一个义项
  for (const c of orphans) {
    if (c.mixed) {
      if (c.ord === 0 && (n === 1 || perSense[0].size === 0)) put(0, c)
    } else if (n === 1) put(0, c)
    else if (c.src === 'zhwikt' && c.ord !== undefined) {
      if (zwSenses.length === n) put(c.ord, c)
      else if (c.ord === 0 && perSense[0].size === 0) put(0, c)
    } else if (c.src === 'frwikt' && perSense[0].size === 0) put(0, c)
  }

  const zh = perSense.map((m) => {
    const human = [...m].filter(([, v]) => v.srcs.has('zhwikt') || v.srcs.has('frwikt'))
    const wikt = [...m].filter(([, v]) => [...v.srcs].some((s) => s !== 'cfdict'))
    // 人写的已经有两个以上时，只在翻译表里出现过一次的不再往上加
    const use = (
      human.length >= 2
        ? wikt.filter(([, v]) => v.srcs.has('zhwikt') || v.srcs.has('frwikt') || v.score >= 4)
        : wikt.length
          ? wikt
          : [...m]
    ).sort(
      (a, b) =>
        b[1].score - a[1].score ||
        (jieba[b[0].replace(/的$/, '')] ?? 0) - (jieba[a[0].replace(/的$/, '')] ?? 0) ||
        a[0].length - b[0].length
    )
    // CFDICT 只作补充时按常用度排，最多两个
    if (!wikt.length)
      use.sort((a, b) => (jieba[b[0]] ?? 0) - (jieba[a[0]] ?? 0) || b[1].score - a[1].score)
    const kept: string[] = []
    for (const [z] of use) {
      const base = z.replace(/的$/, '')
      if (kept.some((k) => k.replace(/的$/, '') === base)) continue
      kept.push(z)
      if (kept.length >= (wikt.length ? MAX_ITEMS : 2)) break
    }
    return { items: kept, src: (wikt.length ? 'wikt' : 'cfdict') as 'wikt' | 'cfdict' }
  })

  // 法语释义：法语维基词典的义项按英文译词对；只有一个英文义项时给第一个法语释义
  const mono: string[][] = Array.from({ length: n }, () => [])
  const fs = input.fr?.s ?? []
  if (n === 1 && fs.length) mono[0].push(fs[0].m)
  else
    fs.forEach((s, j) => {
      const en = (s.en ?? []).join(' ')
      const i = en ? best({ bridge: bag(en, fn), raw: bag(en, true) }) : j === 0 ? 0 : -1
      if (i >= 0 && !mono[i].length) mono[i].push(s.m)
    })
  return { zh, mono }
}
