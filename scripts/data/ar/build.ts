/**
 * 生成阿拉伯语词典 resources/data/ar/dict.sqlite（不入库）：
 *   node scripts/data/run-ts.mjs scripts/data/ar/build.ts
 * 之后校验：node scripts/data/run-ts.mjs scripts/lang/validate.ts ar
 *
 * 数据（来源与许可见 sources.ts，做法见 docs/lang/ar.md）：
 *   1. 英文维基词典的阿拉伯语词条（kaikki.org）：词条、带元音的写法、义项、IPA、录音、变形表、词根、派生式；
 *      「……的异体」记成目标词条的写法，「……的变形」补查词键；
 *   2. wordfreq 词频：词形的频率归到原形上 → 词频名次、CEFR 与 ACTFL 分级；
 *   3. 中文释义：中文维基词典的阿拉伯语词条 → 维基词典翻译表（同一英语义项下的阿、汉译词，对到义项上）
 *      → 中文维基词典汉语词条的翻译表；都没有的常用词列进 data/ar/zh-todo.txt；
 *   4. 例句：维基词典的用例（编者写的，不收古兰经、古诗引文）、Tatoeba 阿英 / 阿中对照。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LexDbWriter, ROOT, cacheDir } from '../../lang/lexdb-writer'
import type { LexEntryData, LexSense, PosTag } from '../../../src/shared/lang/types'
import {
  arKey,
  arRomanize,
  arTokenize,
  hasVowelMarks,
  normalizeArabic
} from '../../../src/shared/lang/ar/rules'
import { rootTypes, verbPattern, wazn } from '../../../src/shared/lang/ar/morph'
import { FILES, SOURCES, fetchFile } from './sources'
import {
  POS_OF,
  readKaikki,
  parseRecord,
  type Cell,
  type WiktEntry,
  type WiktRedirect
} from './wiktionary'
import { FormIndex, allocate, analyseCorpus, headwordEvidence, readWordfreq } from './freq'
import { assignLevels } from './levels'
import { T2S, readZhWiktionary } from './zh'
import { chineseTranslations, englishPivot, simplifiedOf } from './translations'
import { readTatoeba } from './tatoeba'

const t0 = Date.now()
const log = (msg: string): void => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`)
const cache = cacheDir('ar')

// ───────────────────────── 下载 ─────────────────────────

const file = Object.fromEntries(
  await Promise.all(
    (Object.keys(FILES) as (keyof typeof FILES)[]).map(async (k) => [k, await fetchFile(k)])
  )
) as Record<keyof typeof FILES, string>

// ───────────────────────── 维基词典 ─────────────────────────

const raw: WiktEntry[] = []
const redirects: WiktRedirect[] = []
for await (const o of readKaikki(file.wiktEn)) {
  const r = parseRecord(o)
  if (!r) continue
  if ('entry' in r) raw.push(r.entry)
  else redirects.push(r.redirect)
}
log(`维基词典：${raw.length} 个词条记录，${redirects.length} 个异体 / 变形记录`)

/** 比较带元音的写法：规整字母，去掉静符，词尾的格尾元音、鼻音符不算 */
const vocal = (s: string): string =>
  normalizeArabic(s)
    .normalize('NFC')
    .replace(/\u{652}/gu, '')
    .replace(/[\u{64b}-\u{650}]+$/u, '')

/**
 * 合并：同一个写法（带元音）既有名词又有形容词记录的（إِنْجْلِيزِيّ 形容词「英国的」、名词「英国人」）合成一条，
 * 义项注明各自的词性；别的同形词（不同词源、不同念法）各是各的词条。
 */
interface Entry extends WiktEntry {
  p: PosTag[]
  /** 每个义项的词性（合并的词条才有） */
  senseP: (PosTag | undefined)[]
}
const entries: Entry[] = []
{
  const byVocal = new Map<string, Entry>()
  for (const e of raw) {
    const k = `${arKey(e.w)}|${vocal(e.d)}`
    const prev = byVocal.get(k)
    const nominal = (p: PosTag): boolean => p === 'noun' || p === 'adj'
    if (prev && nominal(prev.pos) && nominal(e.pos) && !prev.p.includes(e.pos)) {
      prev.p.push(e.pos)
      prev.senseP.push(...e.senses.map(() => e.pos))
      if (!prev.senseP[0]) prev.senseP.fill(prev.pos, 0, prev.senses.length)
      prev.senses.push(...e.senses)
      const seen = new Set(prev.cells.map(([f, t]) => f + '|' + t.join(' ')))
      for (const c of e.cells) if (!seen.has(c[0] + '|' + c[1].join(' '))) prev.cells.push(c)
      for (const h of e.head) prev.head.push(h)
      prev.root ??= e.root
      prev.deriv = [...new Set([...prev.deriv, ...e.deriv])]
      prev.decl = [...new Set([...prev.decl, ...e.decl])]
      prev.ipa = [...new Set([...prev.ipa, ...e.ipa])]
      prev.au = prev.au.length ? prev.au : e.au
      prev.etyLinks.push(...e.etyLinks)
      continue
    }
    const entry: Entry = { ...e, p: [e.pos], senseP: e.senses.map(() => undefined) }
    entries.push(entry)
    if (!prev) byVocal.set(k, entry)
  }
}
const N = entries.length
log(`合并名词、形容词后：${N} 个词条`)

// 词根：词源里没写的，从它链接到的动词借（动名词、分词常这样），用词型核对一下根字母对得上
{
  const rootsByW = new Map<string, Set<string>>()
  for (const e of entries)
    if (e.root) {
      const k = arKey(e.w)
      rootsByW.set(k, new Set([...(rootsByW.get(k) ?? []), e.root]))
    }
  let borrowed = 0
  for (const e of entries) {
    if (e.root || e.pos === 'propn') continue
    const roots = new Set<string>()
    for (const l of e.etyLinks) for (const r of rootsByW.get(arKey(l)) ?? []) roots.add(r)
    if (roots.size !== 1) continue
    const [r] = roots
    if (wazn(e.d, r)) {
      e.root = r
      borrowed++
    }
  }
  log(
    `词根：${entries.filter((e) => e.root).length} 个词条有词根（${borrowed} 个从词源链接的动词借来）`
  )
}

// ───────────────────────── 词形索引（词频、例句、转向都用） ─────────────────────────

/** 词条只在方言、古典、古旧里用的（所有义项都带这些标签） */
const MARGINAL =
  /^(obsolete|archaic|Classical|dialectal|Egypt|Gulf|Levantine|Iraq|Morocco|Yemen|Hejaz|Najd|Sudan|Tunisia|Algeria|Libya|Lebanon|Syria|Palestine|Jordan|Maghreb|al-Andalus|Andalusian|Internet|slur|vulgar|derogatory|offensive|historical|rare|Koranic|Quranic|poetic)$/
const marginal = (e: Entry): boolean => e.senses.every((s) => s.tags.some((t) => MARGINAL.test(t)))

/** 词形的权重：词头 1；变形表里平常的格 0.6，命令式、祈使式、虚拟式、被动、属构、分词与动名词低一些 */
function cellWeight(tags: string[]): number {
  if (tags.includes('passive')) return 0.2
  if (tags.includes('imperative')) return 0.25
  if (tags.includes('jussive') || tags.includes('subjunctive')) return 0.3
  if (tags.includes('participle') || tags.includes('verbal-noun')) return 0.3
  if (tags.includes('construct')) return 0.4
  return 0.6
}
/** 先验里词性那一项：虚词高，专名、字母符号、只在方言古典里用的低 */
const CLOSED = new Set<PosTag>(['pron', 'det', 'adp', 'cconj', 'sconj', 'part', 'num'])
const base = new Float64Array(N)
const index = new FormIndex(entries.map((e) => e.p))
entries.forEach((e, i) => {
  base[i] =
    e.kpos === 'character' || e.pos === 'affix' || e.pos === 'symbol'
      ? 0.02
      : marginal(e)
        ? 0.2
        : e.pos === 'propn'
          ? 0.5
          : CLOSED.has(e.pos)
            ? 2
            : 1
  index.add(e.w, i, 1)
  index.add(e.d, i, 1)
  for (const a of e.dAlt) index.add(a, i, 0.9)
  for (const [f, t] of e.head) index.add(f, i, t.includes('verbal-noun') ? 0.3 : 0.8)
  for (const [f, t] of e.cells) index.add(f, i, cellWeight(t))
})
// 异体、变形记录指向的词条
const byKey = new Map<string, number[]>()
entries.forEach((e, i) => {
  const k = arKey(e.w)
  byKey.set(k, [...(byKey.get(k) ?? []), i])
})
/** 带元音的写法对上的词条：先比带元音的；比不上的，同一个写法（同词性）只有一个词条时才认 */
function findEntries(word: string, pos?: PosTag[]): number[] {
  const cand = (byKey.get(arKey(word)) ?? []).filter(
    (i) => !pos?.length || entries[i].p.some((p) => pos.includes(p))
  )
  if (!hasVowelMarks(word)) return cand.length === 1 ? cand : []
  const v = vocal(word)
  const exact = cand.filter(
    (i) => vocal(entries[i].d) === v || entries[i].dAlt.some((a) => vocal(a) === v)
  )
  return exact.length ? exact : cand.length === 1 && pos?.length ? cand : []
}
const redirectTargets: { r: WiktRedirect; to: number[] }[] = []
for (const r of redirects) {
  const to = findEntries(r.target)
  if (!to.length) continue
  redirectTargets.push({ r, to })
  for (const i of to) index.add(r.w, i, r.kind === 'alt' ? 0.9 : 0.5)
}
log(`异体 / 变形记录对上词条的：${redirectTargets.length}`)

// ───────────────────────── 词频（一）：逐个分析词频表里的词形 ─────────────────────────

const wf = readWordfreq(file.wordfreq)
const corpus = analyseCorpus(wf, index, N, 300_000)
log(
  `wordfreq：${wf.size} 个词形；按频率算，只对上一个词条的 ${(corpus.coverage.unique * 100).toFixed(1)}%，对上几个的 ${(corpus.coverage.ambiguous * 100).toFixed(1)}%，没对上 ${(corpus.coverage.none * 100).toFixed(1)}%`
)

// ───────────────────────── Tatoeba：例句，也给同形词作证 ─────────────────────────

const t2s = new T2S(file.openccChars, file.openccPhrases)
const tatoeba = readTatoeba(
  {
    ara: file.taraSentences,
    araEng: file.taraEng,
    araCmn: file.taraCmn,
    eng: file.tengSentences,
    engCmn: file.tengCmn,
    cmn: file.tcmnSentences
  },
  (s) => t2s.convert(s)
).filter((s) => s.en || s.zh) // 没有译文的句子不收
log(
  `Tatoeba：${tatoeba.length} 句有译文的阿拉伯语句子，英译 ${tatoeba.filter((s) => s.en).length}，中译 ${tatoeba.filter((s) => s.zs === 'tatoeba').length}（经英语转 ${tatoeba.filter((s) => s.zs === 'tatoeba-en').length}）`
)

/**
 * 按英译分辨句子里的词是哪个词条：一个词形对上几个词条时，看哪个词条的英文释义里的词出现在英译里
 * （按 IDF 加权）。هو 在 “He is …” 里是代词「他」，不是心理学的「本我」。
 *   - 释义里能拿来比的词：整条释义就一个词的（on、who、from——虚词靠这个），
 *     或者长释义里的实词（to raise (a building) 里只算 raise、building，不算 to、a）；
 *   - 句子里只对上一个词条的词，它的释义词算「有主了」，不拿来给别的词作证；
 *   - 几个候选的释义里都有的词（يقول 的 قال 与 قَوَّلَ 都有 say），按各自独有词形的频率分；
 *   - 只用 12 个词以内的句子（长句里英语词太多，碰巧对上的多）；一个都对不上的不算证据。
 */
const enWords = (s: string): string[] => s.toLowerCase().match(/[a-z]+/g) ?? []
const STOP = new Set(
  (
    'a an the to of in on at by for from with as or and but not no be is are was were been being am ' +
    'it its this that these those he she they we you i me him her them us his their our your my ' +
    'do does did done have has had having will would shall should can could may might must ' +
    'which who whom whose what when where why how there here than then so such very too also ' +
    'something someone somebody one ones oneself thing things about into onto upon over under up down out ' +
    'off again all any both each few more most other some own same just only'
  ).split(' ')
)
const df = new Map<string, number>()
for (const s of tatoeba)
  if (s.en) for (const w of new Set(enWords(s.en))) df.set(w, (df.get(w) ?? 0) + 1)
const idf = (w: string): number => Math.log((tatoeba.length + 1) / ((df.get(w) ?? 0) + 1))
const glossWords = entries.map((e) => {
  const out = new Set<string>()
  for (const s of e.senses)
    for (const item of s.en.replace(/\([^)]*\)/g, ' ').split(/[,;]/)) {
      const ws = enWords(item.replace(/^\s*(to|a|an|the)\s+/i, ''))
      if (ws.length === 1) out.add(ws[0])
      else for (const w of ws) if (!STOP.has(w)) out.add(w)
    }
  return out
})
/**
 * 动词的派生名词（动名词、主动名词、被动名词）也算这个动词的证据：不带元音时 يمكن 既是 أَمْكَنَ（第四式）
 * 也是 مَكَّنَ（第二式）的现在式、يقول 既是 قَالَ 也是 قَوَّلَ 的，语料分不出来；但 مُمْكِن「可能的」、إِمْكَان
 * 只属于 أَمْكَنَ，قَوْل、قَائِل 只属于 قَالَ。取这些名词独有词形的频率的一半。
 */
const derived = new Float64Array(N)
entries.forEach((e, i) => {
  if (e.pos !== 'verb') return
  const forms = new Set(
    [...e.head, ...e.cells]
      .filter(
        ([, t]) => (t.includes('verbal-noun') || t.includes('participle')) && !t.includes('passive')
      )
      .map(([f]) => f)
  )
  for (const f of forms)
    for (const j of findEntries(f, ['noun', 'adj'])) if (j !== i) derived[i] += corpus.unique[j]
})
const U = (i: number): number => corpus.unique[i] + 0.5 * derived[i] + 1e-7
const explainList = (process.env.AR_EXPLAIN ?? '').split(',').filter(Boolean)
const tatoebaCount = new Float64Array(N)
let tatoebaTokens = 0
/** 每句的词：对上的词条、英译分辨出来的（之后挂例句用） */
const sentenceTokens: { hits: number[]; best: number[] }[][] = []
const debugTat = new Map<number, number>()
for (const s of tatoeba) {
  const toks: { hits: number[]; best: number[] }[] = []
  const en = s.en ? new Set(enWords(s.en)) : null
  const all = arTokenize(s.text)
    .filter((t) => t.kind === 'word')
    .map((t) => [...index.analyse(t.text).keys()])
  tatoebaTokens += all.length
  const used = new Set<string>()
  for (const hits of all) if (hits.length === 1) for (const w of glossWords[hits[0]]) used.add(w)
  for (const hits of all) {
    if (!hits.length) continue
    let best: number[] = hits.length === 1 ? hits : []
    if (hits.length > 1 && en && all.length <= 12) {
      const score = hits.map((h) => {
        let sc = 0
        for (const w of glossWords[h])
          if (en.has(w) && !used.has(w)) {
            const sharing = hits.filter((o) => glossWords[o].has(w))
            sc += (idf(w) * U(h)) / sharing.reduce((a, o) => a + U(o), 0)
          }
        return sc
      })
      const max = Math.max(...score)
      if (max > 0) best = hits.filter((_, k) => score[k] === max)
      if (explainList.length)
        for (const h of best)
          if (explainList.includes(entries[h].d)) {
            const n = (debugTat.get(h) ?? 0) + 1
            debugTat.set(h, n)
            if (n <= 4)
              console.log(
                `  [Tatoeba] ${entries[h].d}：${s.text}｜${s.en}｜${[...glossWords[h]].filter((w) => en.has(w)).join(',')}`
              )
          }
    }
    for (const h of best) tatoebaCount[h] += 1 / best.length
    toks.push({ hits, best })
  }
  sentenceTokens.push(toks)
}

// ───────────────────────── 词频（二）与分级 ─────────────────────────

const extra = new Float64Array(N)
const heads = headwordEvidence(
  wf,
  entries.map((e) => e.w),
  entries.map((e) => e.p)
)
for (let i = 0; i < N; i++)
  extra[i] = (0.5 * tatoebaCount[i]) / Math.max(1, tatoebaTokens) + heads[i] + 0.5 * derived[i]
// 排查：AR_EXPLAIN=كَتَبَ,شَمْس 列出这些词条的频率从哪些词形来
const explainSet = new Set<number>()
for (const w of explainList)
  entries.forEach((e, i) => (e.d === w || e.w === w) && explainSet.add(i))
const att = allocate(corpus, base, extra, explainSet)
for (const [i, list] of att.explain) {
  const e = entries[i]
  console.log(
    `${e.d} ${e.p.join(',')}：频率 ${(att.freq[i] * 1e6).toFixed(1)}/百万，独有 ${(corpus.unique[i] * 1e6).toFixed(1)}，Tatoeba ${(extra[i] * 1e6).toFixed(1)}`
  )
  for (const [w, f, n] of list.sort((a, b) => b[1] - a[1]).slice(0, 8))
    console.log(`    ${w}  ${(f * 1e6).toFixed(2)}（${n} 个词条）`)
}
/**
 * 日常生活的具体词（吃的、穿的、身体、家人、颜色、数字、日子……）在新闻、百科语料里偏少，
 * 按词频排会排得太难；Kelly 项目也是先按词频、再人工把数字、食物、衣物这类词补进低级别的。
 * 这里按维基词典的主题分类给这些词的分数乘 3（只限名词、形容词、数词）。
 */
const BASIC_TOPICS = new Set([
  'Anatomy',
  'Body parts',
  'Clothing',
  'Headwear',
  'Colors',
  'Foods',
  'Fruits',
  'Vegetables',
  'Beverages',
  'Cooking',
  'Cakes and pastries',
  'Cookware and bakeware',
  'Food and drink containers',
  'Furniture',
  'Rooms',
  'Buildings',
  'Family',
  'Occupations',
  'Animals',
  'Birds',
  'Mammals',
  'Insects',
  'Days of the week',
  'Months',
  'Time',
  'Weather',
  'Rain',
  'Seasons',
  'Vehicles',
  'Sports',
  'Musical instruments',
  'Emotions',
  'Shapes',
  'Countries',
  'Languages',
  'Nationalities'
])
const basicTopic = (e: Entry): boolean =>
  (e.p.includes('noun') || e.p.includes('adj') || e.p.includes('num')) &&
  (e.pos === 'num' || e.senses.some((s) => s.topics.some((t) => BASIC_TOPICS.has(t))))
/**
 * 排名用的分数：wordfreq 每百万词出现几次 + 0.25 × Tatoeba 每百万词出现几次（Tatoeba 多是日常会话），
 * 日常主题的具体词再乘 3。
 */
const score = new Float64Array(N)
for (let i = 0; i < N; i++)
  score[i] =
    (att.freq[i] * 1e6 + (0.25 * tatoebaCount[i] * 1e6) / Math.max(1, tatoebaTokens)) *
    (basicTopic(entries[i]) ? 3 : 1)
/** 参加分级的：标准语里的普通词（专名、字母、符号、词缀、带空格的短语、只在方言古典里用的不算） */
const LEVEL_POS = new Set<PosTag>([
  'noun',
  'verb',
  'adj',
  'adv',
  'pron',
  'det',
  'adp',
  'cconj',
  'sconj',
  'num',
  'part',
  'intj'
])
const eligible = (i: number): boolean => {
  const e = entries[i]
  return (
    LEVEL_POS.has(e.pos) &&
    e.kpos !== 'character' &&
    !e.w.includes(' ') &&
    !e.w.startsWith('ـ') && // 后缀（ـهَا、ـكُمْ）
    !marginal(e) &&
    !/^[\u{621}-\u{64a}]$/u.test(e.w)
  )
}
const levels = assignLevels(score, eligible)
// 词频名次：所有词条按分数排
const freqRank = new Map<number, number>()
;[...score.keys()]
  .filter((i) => score[i] > 0)
  .sort((a, b) => score[b] - score[a])
  .forEach((i, k) => freqRank.set(i, k + 1))
log(`分级：${levels.size} 个词条；有词频名次的 ${freqRank.size}`)
// 排查：AR_SUSPECTS=1 列出 B1 以内、独有词形的频率不到一成的动词（可能是同形的冷僻词被抬高了）
if (process.env.AR_SUSPECTS) {
  const sus = [...levels]
    .filter(
      ([i, lv]) =>
        lv.rank <= 3500 && entries[i].pos === 'verb' && corpus.unique[i] < att.freq[i] * 0.1
    )
    .sort((a, b) => a[1].rank - b[1].rank)
  console.log(`可疑 ${sus.length} 个：`)
  for (const [i, lv] of sus)
    console.log(
      `  ${lv.rank} ${lv.cefr} ${entries[i].d} 频率 ${(att.freq[i] * 1e6).toFixed(1)} 独有 ${(corpus.unique[i] * 1e6).toFixed(1)} Tatoeba ${tatoebaCount[i].toFixed(1)}  ${entries[i].senses[0]?.en.slice(0, 40)}`
    )
}

// ───────────────────────── 中文释义 ─────────────────────────

/** 每个词条：中文概括（不分义项）与来源；每个义项的中文（翻译表） */
const zhSummary = new Map<number, { zh: string[]; zs: string }>()
const zhSense = new Map<number, Map<number, Map<string, number>>>()

// 1. 中文维基词典的阿拉伯语词条
const zhWikt = await readZhWiktionary([file.wiktZhHant, file.wiktZhHans], t2s)
let zhWiktMatched = 0
for (const z of zhWikt) {
  const pos = POS_OF[z.pos]
  const hits = findEntries(z.d ?? z.w, pos ? [pos] : undefined)
  if (hits.length !== 1) continue
  const i = hits[0]
  const prev = zhSummary.get(i)
  const zh = [...new Set([...(prev?.zh ?? []), ...z.senses])].slice(0, 8)
  zhSummary.set(i, { zh, zs: SOURCES.wiktZh.id })
  if (!prev) zhWiktMatched++
}
log(`中文维基词典：${zhWikt.length} 条阿拉伯语词条有中文释义，对上 ${zhWiktMatched} 个词条`)

// 2. 英文维基词典的翻译表：英语义项下的阿、汉译词；阿拉伯语词条里有这个英语词作释义的义项才挂上
const enPivot = await englishPivot(file.wiktEnEnglish, join(cache, 'pivot-en.json'))
/** 英文释义拆成几项：小写、去掉括号说明与开头的 to / a / the */
const glossItems = (en: string): string[] =>
  en
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[,;]/)
    .map((s) =>
      s
        .replace(/^\s*(to|a|an|the)\s+/, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
const senseItems = entries.map((e) => e.senses.map((s) => new Set(glossItems(s.en))))
let pivotSenses = 0
for (const pv of enPivot) {
  const pos = POS_OF[pv.pos]
  const word = pv.en.toLowerCase()
  // 汉语译词：繁体、简体并列的取简体（「書 /书」），只要纯汉字的短词
  const zhs = pv.zh
    .map((z) => t2s.convert(simplifiedOf(z)))
    .filter((z) => /^[\p{Script=Han}·]{1,12}$/u.test(z))
  if (!zhs.length) continue
  for (const a of pv.ar) {
    for (const i of findEntries(
      a,
      pos ? [pos, ...(pos === 'adj' ? (['noun'] as PosTag[]) : [])] : undefined
    )) {
      senseItems[i].forEach((items, si) => {
        if (!items.has(word)) return
        let m = zhSense.get(i)
        if (!m) zhSense.set(i, (m = new Map()))
        let c = m.get(si)
        if (!c) {
          m.set(si, (c = new Map()))
          pivotSenses++
        }
        for (const z of zhs) c.set(z, (c.get(z) ?? 0) + 1)
      })
    }
  }
}
log(`翻译表（英语词条）：${enPivot.length} 个英语义项，挂上了 ${pivotSenses} 个阿拉伯语义项`)

// 3. 中文维基词典汉语词条的翻译表：汉语词 → 阿拉伯语译词，作为词条的中文概括（前两种都没有时）
const zhTr = await chineseTranslations(
  [file.wiktZhChineseHant, file.wiktZhChineseHans],
  join(cache, 'pivot-zh.json')
)
const zhFromZhEntries = new Map<number, Map<string, number>>()
for (const t of zhTr) {
  const zh = t2s.convert(t.zh)
  if (!/^\p{Script=Han}[\p{Script=Han}·]{0,9}$/u.test(zh)) continue
  const pos = POS_OF[t.pos]
  for (const a of t.ar)
    for (const i of findEntries(
      a,
      pos ? [pos, ...(pos === 'adj' ? (['noun'] as PosTag[]) : [])] : undefined
    )) {
      let m = zhFromZhEntries.get(i)
      if (!m) zhFromZhEntries.set(i, (m = new Map()))
      m.set(zh, (m.get(zh) ?? 0) + 1)
    }
}
let zhEntryUsed = 0
for (const [i, m] of zhFromZhEntries) {
  if (zhSummary.has(i) || zhSense.has(i)) continue
  zhSummary.set(i, {
    zh: [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([z]) => z),
    zs: SOURCES.wiktTr.id
  })
  zhEntryUsed++
}
log(`翻译表（汉语词条）：${zhTr.length} 组，给 ${zhEntryUsed} 个词条补了中文`)

// ───────────────────────── 写库 ─────────────────────────

const db = new LexDbWriter('ar')
for (const s of Object.values(SOURCES)) db.source({ ...s })
const levelSources = (await import('../../../src/shared/lang/ar/spec')).spec.levelSystems.flatMap(
  (s) => s.sources
)
for (const s of levelSources) db.source(s)

/** 维基词典的转写 → 本软件的写法（ʔ → ʾ、ʕ → ʿ、ṯ → th……）；只在词头没标元音时用 */
const fromWiktRom = (r: string): string =>
  r
    .replace(/ʔ/g, 'ʾ')
    .replace(/ʕ/g, 'ʿ')
    .replace(/ṯ/g, 'th')
    .replace(/ḵ/g, 'kh')
    .replace(/ḏ/g, 'dh')
    .replace(/š/g, 'sh')
    .replace(/ḡ/g, 'gh')
    .replace(/iyy\b/g, 'ī')
    .replace(/^ʾ/, '')

/**
 * 动词格子的标签去掉重复的：过去式本来就是完成体、现在式本来就是未完成体（只留 past / non-past），
 * 过去式没有语气（去掉 indicative），主动是默认的（只标 passive）。
 */
function verbTags(t: string[]): string[] {
  return t.filter(
    (x) =>
      x !== 'active' &&
      x !== 'perfective' &&
      x !== 'imperfective' &&
      !(x === 'indicative' && t.includes('past'))
  )
}
const has = (t: string[], ...xs: string[]): boolean => xs.every((x) => t.includes(x))
/** 冷僻动词只收的主要形式：过去式与现在式的他、她、他们、我，现在式的我们，命令式的你，分词与动名词 */
function principal(t: string[]): boolean {
  if (t.includes('participle') || t.includes('verbal-noun')) return !t.includes('passive')
  if (t.includes('passive')) return false
  const person =
    has(t, 'third-person', 'masculine', 'singular') ||
    has(t, 'third-person', 'feminine', 'singular') ||
    has(t, 'third-person', 'masculine', 'plural') ||
    has(t, 'first-person', 'singular')
  if (t.includes('past')) return person
  if (t.includes('non-past') && t.includes('indicative'))
    return person || has(t, 'first-person', 'plural')
  return has(t, 'imperative', 'second-person', 'masculine', 'singular')
}

/**
 * 变形表里收哪些格（体积见 docs/lang/ar.md「词典数据」）：
 * 分级里的词收全表，只是被动只收第三人称（第一、二人称的被动几乎不用）；
 * 冷僻动词只收主要形式（别的形式靠 lemmaCandidates 按词缀猜），冷僻名词、形容词只收主格。
 */
function tableOf(e: Entry, leveled: boolean): Cell[] {
  if (e.pos === 'verb') {
    const cells = e.cells.map(([f, t]): Cell => [f, verbTags(t)])
    return cells.filter(([, t]) =>
      leveled
        ? !t.includes('passive') || t.includes('third-person') || t.includes('participle')
        : principal(t)
    )
  }
  if (leveled) return e.cells
  return e.cells.filter(([, t]) => !t.includes('accusative') && !t.includes('genitive'))
}

const exampleIds = new Map<string, number>()
const entryIds = new Int32Array(N)
const zhTodo: { rank: number; line: string }[] = []
let withZh = 0
let romMismatch = 0
let romChecked = 0
const romSamples: string[] = []
const levelCount: Record<string, number> = {}
for (let i = 0; i < N; i++) {
  const e = entries[i]
  const lv = levels.get(i)
  // 义项
  const senses: LexSense[] = e.senses.map((s, si) => {
    const sense: LexSense = { en: [s.en] }
    if (e.senseP[si] && e.p.length > 1) sense.p = [e.senseP[si]!]
    if (s.tags.length) sense.t = s.tags
    if (s.topics.length) sense.dom = s.topics.slice(0, 3)
    if (s.syn.length) sense.syn = s.syn.slice(0, 6)
    if (s.ant.length) sense.ant = s.ant.slice(0, 6)
    const zh = zhSense.get(i)?.get(si)
    if (zh) {
      sense.zh = [...zh.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([z]) => z)
      sense.zs = SOURCES.wiktTr.id
    }
    // 维基词典的用例：编者写的，带英译；引文（古兰经、古诗）不收
    const ex: number[] = []
    for (const x of s.examples) {
      if (x.type === 'quotation' || x.text.length > 120) continue
      const k = x.text
      let id = exampleIds.get(k)
      if (id === undefined) {
        id = db.example({ text: x.text, en: x.en ?? null, src: SOURCES.wiktionary.id })
        exampleIds.set(k, id)
      }
      ex.push(id)
    }
    if (ex.length) sense.ex = ex.slice(0, 4)
    return sense
  })
  // 中文概括：只有一个义项时并进去，否则单列在最前面
  const sum = zhSummary.get(i)
  if (sum) {
    // 中文维基词典的义项顺序跟英文版不一样（كتاب 把「经文」排在「书」前面）：
    // 含有英文版靠前义项的翻译表译词的，排到前面
    const pivotWords = senses.flatMap((s) => (s.zs === SOURCES.wiktTr.id ? (s.zh ?? []) : []))
    const rank = (g: string): number => {
      const k = pivotWords.findIndex((z) => g.split(/[，,；;、]/).some((part) => part.trim() === z))
      return k < 0 ? Infinity : k
    }
    const zh = [...sum.zh].sort((a, b) => rank(a) - rank(b))
    if (senses.length === 1 && !senses[0].zh) {
      senses[0].zh = zh
      senses[0].zs = sum.zs
    } else senses.unshift({ zh, zs: sum.zs })
  }
  const hasZh = senses.some((s) => s.zh?.length)
  if (hasZh) withZh++
  // 变形表：表里有的格 + 词头模板里列的主要形式（表里没有的）
  const cells = tableOf(e, !!lv)
  const seen = new Set(cells.map(([f, t]) => `${f}|${t.join(' ')}`))
  const f: [string, ...string[]][] = cells.map(([form, tags]) => [form, ...tags])
  for (const [form, raw] of e.head) {
    const tags = e.pos === 'verb' ? verbTags(raw) : raw
    if (!seen.has(`${form}|${tags.join(' ')}`) && !cells.some(([c]) => c === form)) {
      seen.add(`${form}|${tags.join(' ')}`)
      f.push([form, ...tags])
    }
  }
  // 转写：带元音的词头用本软件的转写；没标元音的用维基词典的；词缀（ـِي）不转写
  const rom = e.d.startsWith('ـ')
    ? undefined
    : hasVowelMarks(e.d)
      ? arRomanize(e.d)
      : e.romWikt
        ? fromWiktRom(e.romWikt)
        : undefined
  if (e.romWikt && hasVowelMarks(e.d)) {
    romChecked++
    const a = fromWiktRom(e.romWikt).replace(/-/g, '')
    const b = (rom ?? '').replace(/-/g, '')
    if (a !== b) {
      romMismatch++
      if (romSamples.length < 40) romSamples.push(`${e.d}  wikt=${e.romWikt}  ours=${rom}`)
    }
  }
  // 构词
  const x: Record<string, unknown> = {}
  const cls: string[] = []
  if (e.root) x.root = e.root
  if (e.pos === 'verb' && e.verbForm) {
    x.form = e.verbForm
    cls.push(`form-${e.verbForm.toLowerCase()}`)
    if (e.vowels) x.vowels = e.vowels
    const pat = verbPattern(e.verbForm, e.vowels)
    if (pat) x.pattern = pat
    if (e.root) cls.push(...rootTypes(e.root))
  } else if (e.root && e.p.some((p) => p === 'noun' || p === 'adj')) {
    const pat = wazn(e.d, e.root)
    if (pat) x.pattern = pat
  }
  for (const d of e.deriv) cls.push(d)
  for (const d of e.decl) cls.push(d)
  if (e.cats.some((c) => /nisba/i.test(c))) cls.push('nisba')
  const data: LexEntryData = {
    w: e.w,
    ...(e.d !== e.w ? { d: e.d } : {}),
    p: e.p,
    ...(e.g ? { g: e.g } : {}),
    ...(e.ipa.length ? { ipa: e.ipa } : {}),
    ...(rom ? { rom } : {}),
    ...(e.au.length ? { au: e.au } : {}),
    s: senses,
    ...(f.length ? { f } : {}),
    ...(cls.length ? { cls: [...new Set(cls)] } : {}),
    ...(lv ? { lv: { cefr: lv.cefr, actfl: lv.actfl } } : {}),
    ...(freqRank.has(i) ? { fr: freqRank.get(i) } : {}),
    ...(Object.keys(x).length ? { x } : {}),
    src: [
      SOURCES.wiktionary.id,
      ...(sum?.zs === SOURCES.wiktZh.id ? [SOURCES.wiktZh.id] : []),
      ...(zhSense.has(i) || sum?.zs === SOURCES.wiktTr.id ? [SOURCES.wiktTr.id] : [])
    ]
  }
  const id = db.entry(data)
  entryIds[i] = id
  if (lv) levelCount[lv.cefr] = (levelCount[lv.cefr] ?? 0) + 1
  // 另外的写法：别的念法、转写（拉丁字母也能查）、词根（用空格隔开的根字母，查「ك ت ب」列出整个词族）
  const keys = new Set([arKey(e.w), arKey(e.d), ...f.map(([form]) => arKey(form))])
  for (const a of e.dAlt) {
    if (keys.has(arKey(a))) continue
    db.form(id, a, ['alternative'])
    keys.add(arKey(a))
  }
  if (rom) db.form(id, rom, ['romanization'])
  if (e.root) db.form(id, e.root, ['root'])
  // 待补中文的常用词：有词频名次的（字母、符号、词缀、只在方言古典里用的不算）
  const rank = freqRank.get(i)
  if (!hasZh && rank && base[i] >= 0.5)
    zhTodo.push({
      rank,
      line: `${e.w}\t${e.d}\t${e.p.join(',')}\t${lv?.cefr ?? '-'}\t${e.senses
        .slice(0, 6)
        .map((s) => s.en)
        .join(' | ')}`
    })
}
log(`词条写完：${N}；有中文的 ${withZh}；分级 ${JSON.stringify(levelCount)}`)
log(`转写对照维基词典：${romChecked} 个里不一样的 ${romMismatch}`)

// 异体、变形记录：补查词键
const formKeys = new Map<number, Set<string>>()
let redirectForms = 0
for (const { r, to } of redirectTargets)
  for (const i of to) {
    let ks = formKeys.get(i)
    if (!ks) formKeys.set(i, (ks = new Set()))
    const k = arKey(r.w)
    if (ks.has(k)) continue
    ks.add(k)
    db.form(entryIds[i], r.w, r.kind === 'alt' ? ['alternative', ...r.tags] : r.tags)
    redirectForms++
  }
log(`异体、变形补的查词键：${redirectForms}`)

// Tatoeba 例句：挂到句子里出现的词条上；难度取句中最难的词（没分级的普通词算 C2，专名不算）
const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
let linked = 0
tatoeba.forEach((s, k) => {
  // 每个词挂一个词条：英译分得出来的挂那个，分不出来的挂分数最高（最常用）的
  const pick = (list: number[]): number => list.reduce((a, b) => (score[b] > score[a] ? b : a))
  const ids = [
    ...new Set(sentenceTokens[k].map((t) => (t.best.length ? pick(t.best) : pick(t.hits))))
  ]
  let hardest = -1
  for (const i of ids) {
    const lv = levels.get(i)
    if (lv) hardest = Math.max(hardest, ORDER.indexOf(lv.cefr))
    else if (eligible(i)) hardest = ORDER.length - 1
  }
  const id = db.example(
    {
      text: s.text,
      en: s.en ?? null,
      zh: s.zh ?? null,
      zs: s.zs === 'tatoeba-en' ? SOURCES.tatoebaPivot.id : s.zs ? SOURCES.tatoeba.id : null,
      src: SOURCES.tatoeba.id,
      lv: hardest >= 0 ? ORDER[hardest] : null
    },
    ids.map((i) => entryIds[i])
  )
  if (ids.length) linked++
  void id
})
log(`Tatoeba 例句：${tatoeba.length} 句，挂上词条的 ${linked}`)

// 数据版本
db.meta('ar', {
  wiktionary: FILES.wiktEn[0],
  roots: new Set(entries.filter((e) => e.root).map((e) => e.root)).size,
  zhTodo: zhTodo.length
})
const stats = db.finish()
log(
  `完成：${stats.file}  ${(stats.bytes / 1048576).toFixed(1)} MB，词条 ${stats.entries}，查词键 ${stats.forms}，例句 ${stats.examples}`
)

// zh-todo.txt：没有中文释义的词，按词频名次列前 8000 个
mkdirSync(join(ROOT, 'data', 'ar'), { recursive: true })
const todo = zhTodo.sort((a, b) => a.rank - b.rank).slice(0, 8000)
writeFileSync(
  join(ROOT, 'data', 'ar', 'zh-todo.txt'),
  [
    '# 需要补中文释义的常用词，按词频名次排：不带元音的词头 \\t 带元音的写法 \\t 词性 \\t CEFR（没分级的写 -） \\t 英文释义（义项之间用 | 隔开）',
    '# 由 scripts/data/ar/build.ts 生成；中文来源见 docs/lang/ar.md「中文释义」。同形词各占一行，按带元音的写法区分',
    ...todo.map((t) => t.line)
  ].join('\n') + '\n'
)
log(`zh-todo.txt：${todo.length} 个`)
writeFileSync(
  join(cache, 'build-report.json'),
  JSON.stringify(
    {
      entries: N,
      withZh,
      levels: levelCount,
      coverage: corpus.coverage,
      missed: corpus.missed.slice(0, 200),
      romMismatch,
      romChecked,
      romSamples,
      bytes: stats.bytes,
      forms: stats.forms
    },
    null,
    1
  )
)
