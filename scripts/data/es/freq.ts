/**
 * 词频：给每个词条一个分数，排出词频名次（fr），分级也按它切。
 *
 * 两份来源各有偏向，合起来用：
 * - wordfreq（Robyn Speer）：维基百科、字幕、新闻、图书、网页、推特、Reddit 七类语料，书面语占得多；
 *   按词形统计，所以一个词形的频率要分给拥有这个词形的词条（como → como 连词 / comer 的 yo 形）。
 *   怎么分：doozan 的词元表里写了这个词形归哪个词元的，按它的比例分；没写的按权重分——
 *   词头正是这个词形的占三倍；有虚词（冠词、代词、介词、连词、同形的副词）占着的词形，别的词性只分一点点
 *   （la、mi、no、sus 不能算到音符 la、mi、名词 no、感叹词 sus 头上；doozan 把 mis 记到音符 mi 头上这类，
 *   也不认）；大小写两种词头都有的（Cuba 古巴 / cuba 木桶、Valencia / valencia 化合价），
 *   按 Tatoeba 里这个词不在句首时大写的比例分，没有统计的大写词头只分一点点。
 * - doozan/spanish_data 的词元词频：OpenSubtitles 字幕（hermitdave/FrequencyWords）按维基词典归并到词元，
 *   口语多，日常词（hola、gracias、vale）靠前。
 * 词条的分数 = 两份的占比取平均（只有一份时取那一份）。还有几处修正：
 * - 固定短语里的出现不算这个词自己的：sin embargo 的 embargo、a través de 的 través、por supuesto 的 supuesto
 *   （按 Tatoeba 里这个词形有几成出现在固定短语——副词、介词、连词性的短语——里面，打相应的折扣，最少留一成）；
 * - 动词的分数不超过它不定式本身频率的一百倍（doozan 把 ¡tranquila! 记成了少见动词 tranquilar 的变位这类错）；
 * - 带空格的短语两份都没有，用它在 Tatoeba 四十多万句西语例句里出现的次数（占全部词次的比例），
 *   打三折（短语的次数里有不少只是两个词碰巧挨着）。
 */
import { readFileSync } from 'node:fs'
import { readWordfreq } from './util'

/** doozan 的词性 → kaikki 英文版的词性 */
const DOOZAN_POS: Record<string, string[]> = {
  n: ['noun'],
  v: ['verb'],
  adj: ['adj'],
  adv: ['adv'],
  prop: ['name'],
  interj: ['intj'],
  num: ['num'],
  pron: ['pron'],
  determiner: ['det', 'article', 'adj', 'pron'],
  prep: ['prep'],
  conj: ['conj'],
  contraction: ['contraction'],
  art: ['article', 'det'],
  phrase: ['phrase'],
  prefix: ['prefix'],
  particle: ['particle'],
  letter: ['character', 'noun']
}

export interface DoozanRow {
  lemma: string
  kpos: string[]
  count: number
  /** 词形 → 次数 */
  usage: Map<string, number>
}

export function readDoozan(file: string): DoozanRow[] {
  const out: DoozanRow[] = []
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // count,spanish,pos,flags,usage（usage 里用 | 和 : 分隔，不含逗号）
    const [count, lemma, pos, flags, usage] = line.split(',')
    if (!lemma || flags === 'NOUSAGE' || pos === 'none') continue
    const u = new Map<string, number>()
    for (const part of (usage ?? '').split('|')) {
      const j = part.indexOf(':')
      if (j > 0) u.set(part.slice(j + 1), Number(part.slice(0, j)))
    }
    out.push({ lemma, kpos: DOOZAN_POS[pos] ?? [], count: Number(count), usage: u })
  }
  return out
}

/** 一个要算分的词条：词头、词性、全部词形（含词头） */
export interface FreqEntry {
  word: string
  kpos: string
  forms: string[]
}

export interface PhraseStats {
  /** 带空格的词头（小写）→ 在 Tatoeba 里出现几次 */
  counts: Map<string, number>
  /** Tatoeba 的总词次 */
  total: number
  /** 词形（小写）→ 有几成出现在固定短语里（出现次数够多的才算） */
  inside: Map<string, number>
  /** 词形（小写）→ 不在句首时有几成首字母大写（专名 Cuba、Valencia 跟普通名词 cuba、valencia 分频率用） */
  upper: Map<string, number>
}

/** 带空格的短语的次数打几折 */
const PHRASE_DISCOUNT = 0.3
/** 动词分数的上限：不定式本身频率的几倍 */
const VERB_CAP = 100
/** 分词形频率时，虚词占着的词形给别的词性的权重、大写词头的权重 */
const MINOR = 0.01
const CAPITAL = 0.05

const FUNCTION_POS = new Set(['det', 'article', 'pron', 'prep', 'conj', 'contraction'])

/**
 * 每个词条的分数（占全部词次的比例，0 表示两份都没有）；scores[i] 对应 entries[i]。
 */
export function scoreEntries(
  entries: FreqEntry[],
  wordfreqFile: string,
  doozanFile: string,
  phrases: PhraseStats
): Float64Array {
  const wf = readWordfreq(wordfreqFile)
  const dz = readDoozan(doozanFile)
  const lower = (s: string): string => s.toLocaleLowerCase('es')
  /** 这个词形留给词条自己的比例（扣掉出现在固定短语里的） */
  const own = (form: string): number => 1 - Math.min(0.97, phrases.inside.get(form) ?? 0)

  // 词头（小写）→ 词条下标
  const byWord = new Map<string, number[]>()
  entries.forEach((e, i) => {
    const k = lower(e.word)
    let l = byWord.get(k)
    if (!l) byWord.set(k, (l = []))
    l.push(i)
  })
  const findEntry = (lemma: string, kpos: string[]): number | undefined => {
    const list = byWord.get(lower(lemma))
    if (!list) return undefined
    for (const p of kpos) {
      // 同词性有大小写两条（a / A）时取小写的
      const hit =
        list.find((i) => entries[i].kpos === p && entries[i].word === lower(entries[i].word)) ??
        list.find((i) => entries[i].kpos === p)
      if (hit !== undefined) return hit
    }
    return undefined
  }

  // 虚词占着的词形（la、mi、mis、no、sus……）：doozan 把它们记到名词、感叹词头上的（mis → 音符 mi）不算
  const isFuncEntry = (i: number, form: string): boolean =>
    FUNCTION_POS.has(entries[i].kpos) ||
    (entries[i].kpos === 'adv' && lower(entries[i].word) === form)
  const funcForms = new Set<string>()
  entries.forEach((e, i) => {
    if (e.word.includes(' ')) return
    for (const f of [e.word, ...e.forms].map(lower)) if (isFuncEntry(i, f)) funcForms.add(f)
  })

  // doozan：口语分 + 词形归属
  const spoken = new Float64Array(entries.length)
  let spokenTotal = 0
  /** 词形 → [[词条, 次数]]（doozan 说这个词形归哪个词元） */
  const formOwner = new Map<string, [number, number][]>()
  for (const r of dz) {
    spokenTotal += r.count
    const i = findEntry(r.lemma, r.kpos)
    if (i === undefined) continue
    for (const [form, n] of r.usage) {
      if (funcForms.has(form) && !isFuncEntry(i, form)) continue
      spoken[i] += n * own(form)
      let l = formOwner.get(form)
      if (!l) formOwner.set(form, (l = []))
      l.push([i, n])
    }
  }

  // wordfreq：每个词形的频率分给拥有它的词条
  const claim = new Map<string, number[]>()
  entries.forEach((e, i) => {
    if (e.word.includes(' ')) return
    for (const f of new Set([e.word, ...e.forms].map(lower))) {
      if (f.includes(' ')) continue
      let l = claim.get(f)
      if (!l) claim.set(f, (l = []))
      l.push(i)
    }
  })
  const written = new Float64Array(entries.length)
  let writtenTotal = 0
  for (const [form, list] of claim) {
    const f = wf.get(form)
    if (!f) continue
    writtenTotal += f
    const mine = f * own(form)
    const owners = formOwner.get(form)?.filter(([i]) => list.includes(i))
    if (owners?.length) {
      const sum = owners.reduce((a, [, n]) => a + n, 0)
      for (const [i, n] of owners) written[i] += (mine * n) / sum
      continue
    }
    const isFunc = (i: number): boolean => isFuncEntry(i, form)
    const hasFunc = list.some(isFunc)
    const hasLower = list.some((i) => entries[i].word === lower(entries[i].word))
    const hasUpper = list.some((i) => entries[i].word !== lower(entries[i].word))
    // 大小写两种词头都有（Cuba / cuba）：按 Tatoeba 里不在句首时大写的比例分；没有统计的，大写的只分一点点
    const up = hasLower && hasUpper ? phrases.upper.get(form) : undefined
    const w = list.map((i) => {
      const e = entries[i]
      let x = lower(e.word) === form ? 3 : 1
      if (hasFunc && !isFunc(i)) x *= MINOR
      const capital = e.word !== lower(e.word)
      if (hasLower && hasUpper)
        x *=
          up === undefined
            ? capital
              ? CAPITAL
              : 1
            : capital
              ? Math.max(up, 0.01)
              : Math.max(1 - up, 0.01)
      return x
    })
    const sum = w.reduce((a, b) => a + b, 0)
    list.forEach((i, k) => (written[i] += (mine * w[k]) / sum))
  }

  const out = new Float64Array(entries.length)
  entries.forEach((e, i) => {
    if (e.word.includes(' ')) {
      const n = phrases.counts.get(lower(e.word)) ?? 0
      out[i] = n ? (n / phrases.total) * PHRASE_DISCOUNT : 0
      return
    }
    const s = spoken[i] ? spoken[i] / spokenTotal : 0
    const w = written[i] ? written[i] / writtenTotal : 0
    let score = s && w ? (s + w) / 2 : s || w
    if (e.kpos === 'verb' && /r(se)?$/.test(e.word))
      score = Math.min(score, VERB_CAP * Math.max(wf.get(lower(e.word)) ?? 0, 1e-8))
    out[i] = score
  })
  return out
}
