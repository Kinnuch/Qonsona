/**
 * 词网：盖尔语词 ↔ WordNet 3.0 同义词集 ↔ 英文词（Princeton WordNet）、中文词（中文开放词网 COW）。
 *
 * 盖尔语一边有两份：
 * - Unified Scottish Gaelic Wordnet v0.9（USGW）：约六千五百词是专业译者新译、校过的（DS），另四千多词来自
 *   扩展开放多语词网（EOMW）。编号是 WordNet 2.1 的，按普林斯顿的 2.1→3.0 义项对照换成 3.0（名词、动词）；
 * - OMW 里由维基词典翻译表导出的盖尔语词网（wn-wikt-gla，3.0 编号）。
 *
 * 用处：
 * 1. 给维基词典的义项补中文（wn-zh）和盖尔语释义（mono）：同义词集的英文词要跟义项的英文释义对得上才用；
 * 2. 维基词典没收的 USGW 词（tachartas「事件」、dleastanas「职责」……）另成词条：英文释义是同义词集的英文词，
 *    中文同样来自 COW，盖尔语释义来自 USGW。
 * 同一个同义词集里的中文词按在 Tatoeba 中文句子里出现的次数排（狗 在 犬 前面）。
 */
import { readFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import Bunzip from 'seek-bzip'
import type { LexSense } from '../../../src/shared/lang/types'
import { gdKey, gdLooseKey } from '../../../src/shared/lang/gd/rules'
import type { GdEntry } from './kaikki'
import { splitGloss } from './kaikki'

export interface WordnetFiles {
  usgwZip: string
  wiktGla: string
  pwn: string
  cow: string
  /** 普林斯顿的 2.1→3.0 对照（sensemap 里四个文件的内容） */
  sensemap: { text: string; pos: 'n' | 'v'; poly: boolean }[]
  /** Tatoeba 中文句子（排中文词的先后） */
  cmnSentences: string
}

const LETTER_TO_KPOS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  a: 'adj',
  s: 'adj',
  r: 'adv'
}
const kposLetters = (kpos: string): string[] | null =>
  kpos === 'noun'
    ? ['n']
    : kpos === 'verb'
      ? ['v']
      : kpos === 'adj'
        ? ['a', 's']
        : kpos === 'adv'
          ? ['r']
          : null

/** 英文释义的一条规整成可以跟 WordNet 词比的样子 */
const normEn = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*(to|a|an|the)\s+/, '')
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()

export interface WordnetStats {
  synsets: number
  gdWords: number
  sensesZh: number
  entriesZh: number
  sensesMono: number
  newEntries: number
  newAlternatives: number
}

export class Wordnet {
  /** 盖尔语词（gdKey）→ 同义词集（3.0）与出处（usgw / wikt） */
  gd = new Map<string, { word: string; syn: Map<string, 'usgw' | 'wikt'> }>()
  /** 同义词集 → USGW 的盖尔语释义 */
  mono = new Map<string, string>()
  eng = new Map<string, string[]>()
  cow = new Map<string, string[]>()
  /** 英文词在 3.0 里的义项序号（lemma|同义词集 → 1 最常用）：从义项对照表的 3.0 一侧取 */
  senseNo = new Map<string, number>()
  #counts = new Map<string, number>()

  constructor(files: WordnetFiles) {
    // 2.1 → 3.0
    const map21 = new Map<string, { off: string; score: number }>()
    for (const sm of files.sensemap)
      for (const line of sm.text.split('\n')) {
        const parts = line.trim().split(' ')
        if (parts.length < 3) continue
        let score = 100
        let a: string | undefined
        let b: string | undefined
        let key30: string | undefined
        let sn = 1
        if (sm.poly) {
          score = Number(parts[0])
          a = parts[1].split(';')[1]
          const right = parts[2]?.split(';')
          b = right?.[1]
          key30 = right?.[0]
          sn = Number(right?.[2]) || 1
        } else {
          a = parts[1]
          b = parts[3]
          key30 = parts[2]
        }
        if (!a || !b) continue
        if (key30) {
          const lemma = key30.split('%')[0].replace(/_/g, ' ').toLowerCase()
          const k = `${lemma}|${b}-${sm.pos}`
          if (!this.senseNo.has(k) || this.senseNo.get(k)! > sn) this.senseNo.set(k, sn)
        }
        const k = `${a}-${sm.pos}`
        const cur = map21.get(k)
        if (!cur || cur.score < score) map21.set(k, { off: `${b}-${sm.pos}`, score })
      }
    const add = (lemma: string, syn: string, from: 'usgw' | 'wikt'): void => {
      const word = lemma.trim()
      const k = gdKey(word)
      if (!k) return
      if (!this.gd.has(k)) this.gd.set(k, { word, syn: new Map() })
      const m = this.gd.get(k)!.syn
      if (!m.has(syn)) m.set(syn, from)
    }
    const zip = unzipSync(readFileSync(files.usgwZip))
    const tabName = Object.keys(zip).find((n) => n.endsWith('.tab'))
    if (!tabName) throw new Error('USGW 压缩包里没有 .tab')
    for (const line of strFromU8(zip[tabName]).split(/\r?\n/)) {
      const [id, type, value] = line.split('\t')
      if (!id || !value) continue
      const pos = id.slice(-1)
      const syn = pos === 'n' || pos === 'v' ? map21.get(id)?.off : undefined
      if (!syn) continue
      if (type === 'gla:lemma') add(value, syn, 'usgw')
      else if (type === 'gla:gloss' && value !== 'NO_GLOSS' && !this.mono.has(syn))
        this.mono.set(syn, value.trim())
    }
    for (const line of readFileSync(files.wiktGla, 'utf8').split('\n')) {
      const [id, type, value] = line.split('\t')
      if (!id || id.startsWith('#') || !value || !type?.includes('lemma')) continue
      add(value, id, 'wikt')
    }
    const readTab = (file: string): Map<string, string[]> => {
      const out = new Map<string, string[]>()
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const [id, type, value] = line.split('\t')
        if (!id || id.startsWith('#') || !value || !type?.endsWith('lemma')) continue
        if (!out.has(id)) out.set(id, [])
        out.get(id)!.push(value.trim().replace(/_/g, ' '))
      }
      return out
    }
    this.eng = readTab(files.pwn)
    this.cow = readTab(files.cow)
    // 中文词的常用程度：Tatoeba 中文句子里一到四个字的子串出现几次
    const wanted = new Set<string>()
    for (const zh of this.cow.values()) for (const w of zh) if ([...w].length <= 4) wanted.add(w)
    const text = Bunzip.decode(readFileSync(files.cmnSentences)).toString('utf8')
    for (const line of text.split('\n')) {
      const s = [...(line.split('\t')[2] ?? '')]
      for (let i = 0; i < s.length; i++)
        for (let n = 1; n <= 4 && i + n <= s.length; n++) {
          const sub = s.slice(i, i + n).join('')
          if (wanted.has(sub)) this.#counts.set(sub, (this.#counts.get(sub) ?? 0) + 1)
        }
    }
  }

  /** 一个同义词集的中文词：只要汉字，按常用程度排 */
  zhOf(syn: string): string[] {
    return (this.cow.get(syn) ?? [])
      .filter((w) => /^[\p{Script=Han}·]+$/u.test(w) && [...w].length <= 6)
      .map((w, i) => ({ w, i, c: this.#counts.get(w) ?? 0 }))
      .sort((a, b) => b.c - a.c || a.i - b.i)
      .map((x) => x.w)
  }

  stats(): Pick<WordnetStats, 'synsets' | 'gdWords'> {
    const syn = new Set<string>()
    for (const v of this.gd.values()) for (const s of v.syn.keys()) syn.add(s)
    return { synsets: syn.size, gdWords: this.gd.size }
  }

  /**
   * 一个义项的英文释义（拆好、规整过的几条）对上的同义词集，好的在前：对上的条数多的在前，
   * 一样多时看对上的英文词在 WordNet 里是第几个义项（court 的第 1 义是法庭）。
   * 英文词多义、对上的又是它很靠后的义项时不算（leap 的「上涨」义），宁缺毋滥
   */
  bestSynsets(raw: string[], cands: string[]): string[] {
    const items = raw.map(normEn)
    const scored: { syn: string; n: number; sn: number }[] = []
    for (const syn of cands) {
      const lemmas = (this.eng.get(syn) ?? []).map((w) => w.toLowerCase())
      const hitIdx = items.map((it, i) => (lemmas.includes(it) ? i : -1)).filter((i) => i >= 0)
      const hit = hitIdx.map((i) => items[i])
      if (!hit.length) continue
      // 带括号限定的释义（mouse (input device…)、subject (at school)）说的是特定的义项，
      // 只凭它一条对上不算——括号去掉以后对上的多半是最常见的那个义项
      if (hit.length < 2 && hitIdx.every((i) => /\(/.test(raw[i]))) continue
      const pos = syn.slice(-1)
      // 形容词、副词没有义项序号，当作第一义
      const sn = Math.min(
        ...hit.map((it) => this.senseNo.get(`${it}|${syn}`) ?? (pos === 'n' || pos === 'v' ? 3 : 1))
      )
      scored.push({ syn, n: hit.length, sn })
    }
    scored.sort((a, b) => b.n - a.n || a.sn - b.sn)
    // 只对上一条、又是很靠后的义项：只有这一个候选时才要
    return scored
      .filter((s, i) => s.n >= 2 || s.sn <= 4 || (i === 0 && scored.length === 1))
      .map((s) => s.syn)
  }

  /** 给维基词典的义项补中文与盖尔语释义 */
  enrich(entries: GdEntry[]): { sensesZh: number; entriesZh: number; sensesMono: number } {
    let sensesZh = 0
    let entriesZh = 0
    let sensesMono = 0
    for (const e of entries) {
      const letters = kposLetters(e.kpos)
      const g = this.gd.get(gdKey(e.data.w))
      if (!letters || !g) continue
      const cands = [...g.syn.keys()].filter((s) => letters.includes(s.slice(-1)))
      if (!cands.length) continue
      let any = false
      for (const sense of e.data.s) {
        const items = (sense.en ?? []).flatMap((x) => splitGloss(x))
        if (!items.length) continue
        const best = this.bestSynsets(items, cands)
        if (!best.length) continue
        if (!sense.zh?.length) {
          const zh = this.zhOf(best[0]).slice(0, 3)
          if (zh.length) {
            sense.zh = zh
            sense.zs = 'wn-zh'
            sensesZh++
            any = true
          }
        }
        const m = best.map((s) => this.mono.get(s)).find(Boolean)
        if (m && !sense.mono?.length) {
          sense.mono = [m]
          sensesMono++
          if (!e.data.src?.includes('usgw')) e.data.src = [...(e.data.src ?? []), 'usgw']
        }
      }
      if (any) {
        entriesZh++
        if (!e.data.src?.includes('wn-zh')) e.data.src = [...(e.data.src ?? []), 'wn-zh']
      }
    }
    return { sensesZh, entriesZh, sensesMono }
  }

  /**
   * 维基词典没收的词另成词条（一个词性一条，一个同义词集一个义项）。
   * 跟已有词条只差重音符的当作异体并进去（加一个 alternative 词形）
   */
  newEntries(existing: GdEntry[]): { entries: GdEntry[]; alternatives: number } {
    const keys = new Set<string>()
    const loose = new Map<string, GdEntry>()
    for (const e of existing) {
      keys.add(gdKey(e.data.w))
      if (!loose.has(gdLooseKey(e.data.w))) loose.set(gdLooseKey(e.data.w), e)
      for (const [f] of e.data.f ?? []) keys.add(gdKey(f))
    }
    const out: GdEntry[] = []
    let alternatives = 0
    for (const [k, { word, syn }] of this.gd) {
      if (keys.has(k)) continue
      if (word.split(/\s+/).length > 3 || /[0-9()]/.test(word)) continue
      const near = loose.get(gdLooseKey(word))
      if (near) {
        ;(near.data.f ??= []).push([word, 'alternative'])
        alternatives++
        continue
      }
      // 按词性分：名词、动词、形容词、副词各一条
      const byPos = new Map<string, { syn: string; from: 'usgw' | 'wikt' }[]>()
      for (const [s, from] of syn) {
        const kpos = LETTER_TO_KPOS[s.slice(-1)]
        if (!kpos) continue
        if (!byPos.has(kpos)) byPos.set(kpos, [])
        byPos.get(kpos)!.push({ syn: s, from })
      }
      for (const [kpos, list] of byPos) {
        const senses: LexSense[] = []
        let usgw = false
        let wikt = false
        for (const { syn: s, from } of list.slice(0, 6)) {
          const en = (this.eng.get(s) ?? []).slice(0, 4)
          if (!en.length) continue
          const sense: LexSense = { en }
          const zh = this.zhOf(s).slice(0, 3)
          if (zh.length) {
            sense.zh = zh
            sense.zs = 'wn-zh'
          }
          const m = this.mono.get(s)
          if (m) sense.mono = [m]
          senses.push(sense)
          if (from === 'usgw') usgw = true
          else wikt = true
        }
        if (!senses.length) continue
        const src = [
          ...(usgw ? ['usgw'] : []),
          ...(wikt ? ['omw-wikt'] : []),
          ...(senses.some((x) => x.zh?.length) ? ['wn-zh'] : [])
        ]
        out.push({
          data: {
            w: word,
            p: [
              kpos === 'noun' ? 'noun' : kpos === 'verb' ? 'verb' : kpos === 'adj' ? 'adj' : 'adv'
            ],
            s: senses,
            src
          },
          kpos,
          examples: senses.map(() => [])
        })
      }
    }
    return { entries: out, alternatives }
  }
}
