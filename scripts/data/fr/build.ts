/**
 * 生成法语词典 resources/data/fr/dict.sqlite（不入库）和 data/fr/zh-todo.txt（入库）。
 *
 *   node scripts/data/run-ts.mjs scripts/data/fr/download.ts   下载原始数据（已有的跳过，约 3.6 GB）
 *   node scripts/data/run-ts.mjs scripts/data/fr/build.ts      建库（第一次十来分钟，之后中间结果有缓存）
 *   node scripts/data/run-ts.mjs scripts/lang/validate.ts fr   校验
 * 软件开着时库文件被占用换不掉：加 --out <文件> 写到别处，校验时把文件路径写在语言代码后面。
 *
 * 词条的骨架是英文维基词典的法语词条（英文释义、性、变位表、IPA、录音、例句）；
 * 中文释义按「中文维基词典 → 法语维基词典的译词表 → 英文维基词典的译词表 → CFDICT」对到各个义项上（align.ts）；
 * 法语释义（单语）取自法语维基词典；词频与分级来自 Lexique 与手挑的核心词（levels.ts）；
 * 例句是 Tatoeba 的法中、法英对照与维基词典义项下的例句。来源与许可见 sources.ts、docs/lang/fr.md。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LexDbWriter, ROOT } from '../../lang/lexdb-writer'
import type {
  AudioRef,
  CefrLevel,
  LexEntryData,
  LexSense,
  PosTag
} from '../../../src/shared/lang/types'
import { CEFR_LEVELS } from '../../../src/shared/lang/types'
import { frKey, tokenize } from '../../../src/shared/lang/fr/rules'
import { CORE_SOURCE, LEXIQUE_SOURCE } from '../../../src/shared/lang/fr/spec'
import { fetchedInfo } from './fetch'
import { CACHE } from './fetch'
import { DOWNLOADS, SOURCES } from './sources'
import { log } from './io'
import { loadLexique, lexLookup, lexScore } from './lexique'
import { loadEnWikt, type Draft, type DraftExample } from './wikt-en'
import { loadFrWikt, type FrEntry } from './wikt-fr'
import { loadCedict, loadCfdict, loadJieba, loadZhWikt, type ZhWiktEntry } from './zh-sources'
import { loadPivot, type PivotSense } from './pivot'
import { align, pivotFits } from './align'
import { loadTatoeba } from './tatoeba'
import {
  bandOfRank,
  coreLevel,
  easier,
  harder,
  levelOfRank,
  loadCore,
  loadZhCore,
  registerFloor
} from './levels'

// ───────────────────────── 读数据 ─────────────────────────

const lex = await loadLexique()
const enw = await loadEnWikt()
const cedict = await loadCedict()
const jieba = await loadJieba()
const cfdict = await loadCfdict()
const zhwikt = await loadZhWikt(cedict.t2s)
const pivot = await loadPivot()
const want = new Set<string>([...enw.drafts.map((d) => d.k), ...Object.keys(lex.any)])
const frwikt = await loadFrWikt(want)
const tatoeba = await loadTatoeba(cedict.t2s)
const core = loadCore(ROOT)
const zhCore = loadZhCore(ROOT)

// ───────────────────────── 索引 ─────────────────────────

const group = <T>(list: T[], key: (x: T) => string | string[]): Map<string, T[]> => {
  const m = new Map<string, T[]>()
  for (const x of list)
    for (const k of ([] as string[]).concat(key(x))) {
      const l = m.get(k)
      if (l) l.push(x)
      else m.set(k, [x])
    }
  return m
}
const frByKey = group(frwikt, (e) => `${e.k}|${e.p}`)
const zhByKey = group(zhwikt, (e) => `${e.k}|${e.p ?? ''}`)
const pivotByFr = group(pivot, (p) => [...new Set(p.fr.map(([w]) => frKey(w)))])

// ───────────────────────── 词条 ─────────────────────────

interface Sense {
  en: string[]
  zh?: string[]
  zs?: string
  mono?: string[]
  t: string[]
  dom: string[]
  ex: DraftExample[]
  syn: string[]
  ant: string[]
}

interface Item {
  w: string
  k: string
  p: PosTag
  g?: string
  senses: Sense[]
  ipa: string[]
  au: AudioRef[]
  f: string[][]
  cls: string[]
  x: Record<string, unknown>
  src: Set<string>
  score: number
  rank?: number
  lv?: CefrLevel
  /** Tatoeba 里出现的次数（没有 Lexique 词频的才数） */
  tat: number
}

const VERB_GROUP = ['', '1er groupe', '2e groupe', '3e groupe']

/** 录音最多留 4 个：先一个法国的（巴黎优先），再各取一个加拿大、比利时、瑞士、非洲的，不够再补法国的 */
function pickAudio(list: AudioRef[]): AudioRef[] {
  const seen = new Set<string>()
  const uniq = list.filter((a) => {
    const file = decodeURIComponent(a.url)
      .split('/')
      .pop()!
      .replace(/\.(mp3|ogg)$/, '')
      .replace(/[ _]+/g, '_')
      .toLowerCase()
    if (seen.has(file)) return false
    seen.add(file)
    return true
  })
  // 标签已经统一成「国家 (城市)」（wikt-en.ts 的 placeLabel）
  const region = (a: AudioRef): string => {
    const l = a.label ?? ''
    if (/^Canada|^United States/.test(l)) return 'ca'
    if (/^Belgium/.test(l)) return 'be'
    if (/^Switzerland/.test(l)) return 'ch'
    if (
      /^(Senegal|Côte d'Ivoire|Cameroon|Congo|Morocco|Algeria|Tunisia|Mali|Bénin|Benin|Togo|Madagascar|Burkina|Niger|Gabon|Guinée|Guinea|Rwanda|Burundi)/.test(
        l
      )
    )
      return 'af'
    return 'fr'
  }
  const out: AudioRef[] = []
  const fr = uniq.filter((a) => region(a) === 'fr')
  const paris = fr.find((a) => /Paris/.test(a.label ?? '')) ?? fr[0]
  if (paris) out.push(paris)
  for (const r of ['ca', 'be', 'ch', 'af']) {
    const a = uniq.find((x) => region(x) === r)
    if (a && out.length < 4) out.push(a)
  }
  for (const a of fr) if (out.length < 4 && !out.includes(a)) out.push(a)
  return out
}

/** 过去分词的阴性、复数（en.wiktionary 的变位表只给阳性单数） */
function participleForms(f: string[][]): string[][] {
  const pp = f.find(([, ...t]) => t.includes('participle') && t.includes('past'))
  if (!pp) return []
  const p = pp[0]
  if (!/[éiusteê]$/.test(p) || / /.test(p)) return []
  const has = new Set(f.map(([x]) => x))
  const add: string[][] = []
  const sx = /[sx]$/.test(p)
  const forms: [string, string[]][] = [
    [p + 'e', ['participle', 'past', 'feminine', 'singular']],
    [sx ? p : p + 's', ['participle', 'past', 'masculine', 'plural']],
    [p + 'es', ['participle', 'past', 'feminine', 'plural']]
  ]
  for (const [x, t] of forms) if (!has.has(x)) add.push([x, ...t])
  return add
}

const items: Item[] = []
const matchedFr = new Set<FrEntry>()

function fromDraft(d: Draft): Item {
  const frCands = frByKey.get(`${d.k}|${d.p}`) ?? []
  const fr = frCands.find((e) => !d.g || !e.g || e.g === d.g) ?? frCands[0]
  if (fr) matchedFr.add(fr)
  const zw: ZhWiktEntry[] = [
    ...(zhByKey.get(`${d.k}|${d.p}`) ?? []),
    // 中文维基词典没写词性的词条：只对这个词头里最常用的那个词性（在下面按词频挑）
    ...(unknownPosOwner.get(d.k) === d ? (zhByKey.get(`${d.k}|`) ?? []) : [])
  ]
  const pv: PivotSense[] = (pivotByFr.get(d.k) ?? []).filter((p) => pivotFits(p, d.k, d.p, d.g))
  const cf = cfdict[d.k] ?? []
  const al = align(
    { senses: d.senses, key: d.k, pos: d.p, g: d.g, fr, zhwikt: zw, pivot: pv, cf },
    cedict.en,
    cedict.t2s,
    jieba
  )
  const src = new Set<string>(['wiktionary'])
  const senses: Sense[] = d.senses.map((s, i) => {
    const z = al.zh[i]
    const zh = z.items.length ? z.items : undefined
    if (zh) src.add(z.src === 'wikt' ? 'wikt-zh' : 'cfdict')
    if (al.mono[i].length) src.add('frwiktionary')
    return {
      ...s,
      ...(zh ? { zh, zs: z.src === 'wikt' ? 'wikt-zh' : 'cfdict' } : {}),
      ...(al.mono[i].length ? { mono: al.mono[i] } : {})
    }
  })
  // IPA：音位的 /…/ 优先，最多两个；英文维基词典没有时用法语维基词典的，再没有用 Lexique 的
  const phon = d.ipa.filter((x) => x.startsWith('/'))
  let ipa = phon.length ? phon.slice(0, 2) : d.ipa.slice(0, 1)
  if (!ipa.length && fr?.ipa) ipa = [fr.ipa]
  if (!ipa.length && lex.ipa[d.k] && !/ /.test(d.k)) ipa = [`/${lex.ipa[d.k]}/`]
  const au = pickAudio([...d.au, ...(fr?.au ?? [])])
  if (au.length) src.add('commons')
  const cls: string[] = []
  const x: Record<string, unknown> = {}
  if (d.p === 'verb') {
    if (fr?.grp) cls.push(VERB_GROUP[fr.grp])
    if (/^(se |s'|s’)/.test(d.w)) cls.push('pronominal')
    if (d.aux?.length) x.aux = d.aux.join(' / ')
  }
  if (fr?.h) x.h = 'aspiré'
  const f = [...d.f]
  if (d.p === 'verb') f.push(...participleForms(f))
  return {
    w: d.w,
    k: d.k,
    p: d.p,
    ...(d.g ? { g: d.g } : {}),
    senses,
    ipa,
    au,
    f,
    cls,
    x,
    src,
    score: d.p === 'propn' ? 0 : lexScore(lexLookup(lex, d.k, d.p, d.g)),
    tat: 0
  }
}

/** 中文维基词典里没写词性的词条，归给同一词头里词频最高的那个（不是专名的）词条 */
const unknownPosOwner = new Map<string, Draft>()
for (const d of enw.drafts) {
  if (d.p === 'propn') continue
  const cur = unknownPosOwner.get(d.k)
  const s = lexScore(lexLookup(lex, d.k, d.p, d.g))
  if (!cur || s > lexScore(lexLookup(lex, cur.k, cur.p, cur.g))) unknownPosOwner.set(d.k, d)
}

log('拼词条、对中文释义…')
for (const d of enw.drafts) items.push(fromDraft(d))

// 同形不同性的名词（le livre「书」、la livre「磅」；la part「份」、le part「新生儿」）：
// Lexique 分了性的，没有自己那个性的词频的一条只是借了别人的词频，大打折扣；
// Lexique 不分性的（两条拿到同一个词频），英文维基词典里排在后面的词源打个折（第一个词源通常是常用的那个）
for (const list of group(
  items.filter((i) => i.p === 'noun' && (i.g === 'm' || i.g === 'f')),
  (i) => i.k
).values()) {
  if (new Set(list.map((i) => i.g)).size < 2) continue
  const own = list.filter((i) => lex.lemmas[`${i.k}|noun|${i.g}`])
  if (own.length) {
    for (const i of list) if (!own.includes(i)) i.score *= 0.05
  } else for (const i of list.slice(1)) i.score *= 0.15
}

// 单个字母（h「小时」的缩写、y「色度坐标」、i「格拉哥里字母」）借的是字母本身的词频，不排名、不分级
for (const i of items)
  if ([...i.w].length === 1 && !['pron', 'adp', 'det', 'cconj', 'sconj', 'verb'].includes(i.p))
    i.score = 0

// 法语维基词典有、英文维基词典没有的常用词：用法语释义和译词表建词条
const FR_ONLY_MIN = 0.5
let frOnly = 0
const haveKeyPos = new Set(items.map((i) => `${i.k}|${i.p}`))
const bestScore = new Map<string, number>()
for (const i of items) bestScore.set(i.k, Math.max(bestScore.get(i.k) ?? 0, i.score))
for (const e of frwikt) {
  if (matchedFr.has(e) || haveKeyPos.has(`${e.k}|${e.p}`)) continue
  if ([...e.w].length < 2 || e.w !== e.w.toLocaleLowerCase('fr')) continue
  const score = lexScore(lexLookup(lex, e.k, e.p, e.g))
  // 同一个词另有常用得多的词性的（avant 介词 / 形容词「Avant-lès-Marcilly 的」）：多半是 Lexique 标错的词性
  if (score < FR_ONLY_MIN || (bestScore.get(e.k) ?? 0) > 5 * score) continue
  const zw = zhByKey.get(`${e.k}|${e.p}`) ?? []
  const senses: Sense[] = e.s.slice(0, 4).map((s, i) => {
    const zh = [...new Set([...(s.zh ?? []), ...(zw[0]?.s[i] ? [zw[0].s[i]] : [])])].slice(0, 4)
    return {
      en: (s.en ?? []).slice(0, 4),
      ...(zh.length ? { zh, zs: 'wikt-zh' } : {}),
      mono: [s.m],
      t: s.t ?? [],
      dom: [],
      ex: [],
      syn: [],
      ant: []
    }
  })
  items.push({
    w: e.w,
    k: e.k,
    p: e.p,
    ...(e.g ? { g: e.g } : {}),
    senses,
    ipa: e.ipa ? [e.ipa] : lex.ipa[e.k] ? [`/${lex.ipa[e.k]}/`] : [],
    au: pickAudio(e.au ?? []),
    f: [],
    cls: e.grp && e.p === 'verb' ? [VERB_GROUP[e.grp]] : [],
    x: e.h ? { h: 'aspiré' } : {},
    src: new Set([
      'frwiktionary',
      ...(senses.some((s) => s.zh) ? ['wikt-zh'] : []),
      ...(e.au?.length ? ['commons'] : [])
    ]),
    score,
    tat: 0
  })
  frOnly++
}
log(`词条：英文维基词典 ${enw.drafts.length} 条，另从法语维基词典补 ${frOnly} 条`)

// 变形、异体指向：挂到原词上
const byKeyPos = group(items, (i) => `${i.k}|${i.p}`)
let attached = 0
for (const ptr of enw.pointers) {
  for (const it of byKeyPos.get(`${frKey(ptr.of)}|${ptr.pos}`) ?? []) {
    if (it.f.some(([x]) => x === ptr.form) || frKey(ptr.form) === it.k) continue
    it.f.push([ptr.form, ...ptr.tags])
    attached++
  }
}
log(`变形、异体：另挂上 ${attached} 个`)

// 大写的缩写、字母（CE、VA、H）跟同键的小写词（ce、va、h）共用 Lexique 的词频，不算
const lowerKeys = new Set(items.filter((i) => i.w === i.w.toLocaleLowerCase('fr')).map((i) => i.k))
for (const it of items)
  if (it.p !== 'propn' && it.w !== it.w.toLocaleLowerCase('fr') && lowerKeys.has(it.k)) it.score = 0

// ───────────────────────── Tatoeba：短语与专名的出现次数 ─────────────────────────

// 没有 Lexique 词频的词，用它在 Tatoeba 里的出现次数估一个（打五折）。单词只数别的有词频的词条解释不了的写法：
// 动词 hier「夯」不能拿副词 hier「昨天」的次数；词缀（a-、-ai）不数
const explained = new Set<string>()
for (const it of items)
  if (it.score > 0) for (const form of [it.w, ...it.f.map(([x]) => x)]) explained.add(frKey(form))
const multi = new Map<string, { item: Item; keys: string[] }[]>()
const single = new Map<string, Item[]>()
for (const it of items) {
  if (
    it.score > 0 ||
    it.p === 'affix' ||
    (it.p !== 'propn' && it.w !== it.w.toLocaleLowerCase('fr'))
  )
    continue
  const keys = tokenize(it.w)
    .filter((t) => t.kind === 'word' || t.kind === 'num')
    .map((t) => frKey(t.text))
  // 省音的代词打头的（j'aime 名词「点赞」）不数：数到的几乎都是 j' + aime
  if (keys.length > 1 && /['’]$/.test(keys[0]) && !['phrase', 'idiom', 'proverb'].includes(it.p))
    continue
  if (keys.length > 1) {
    const l = multi.get(keys[0]) ?? []
    l.push({ item: it, keys })
    multi.set(keys[0], l)
  } else if (keys.length === 1 && keys[0] === it.k && (it.p === 'propn' || !explained.has(it.k))) {
    const l = single.get(keys[0]) ?? []
    l.push(it)
    single.set(keys[0], l)
  }
}
const tokenized = tatoeba.map((s) => tokenize(s.text))
let corpusTokens = 0
tokenized.forEach((toks) => {
  const words = toks.filter((t) => t.kind === 'word' || t.kind === 'num')
  corpusTokens += words.length
  const keys = words.map((t) => frKey(t.text))
  keys.forEach((k, i) => {
    for (const it of single.get(k) ?? [])
      if (it.p !== 'propn' || /^\p{Lu}/u.test(words[i].text)) it.tat++
    for (const m of multi.get(k) ?? []) if (m.keys.every((x, j) => keys[i + j] === x)) m.item.tat++
  })
})
for (const it of items)
  if (!it.score && it.tat && it.p !== 'propn') it.score = (0.5 * it.tat * 1e6) / corpusTokens

// ───────────────────────── 收哪些词 ─────────────────────────

const CLOSED = new Set<PosTag>([
  'pron',
  'det',
  'adp',
  'cconj',
  'sconj',
  'part',
  'num',
  'intj',
  'phrase',
  'idiom',
  'proverb',
  'affix',
  'other',
  'aux'
])
/**
 * 省音、倒装拼起来的组合（qu'il、n'est、a-t-il、puis-je）：切词时本来就拆成两个词分别查，单列一条只会占着
 * 常用词的名次；c'est 这种当整体学的留着
 */
const KEEP_COMBOS = new Set([
  "c'est",
  "qu'est-ce que",
  "qu'est-ce qui",
  "n'importe",
  "s'il vous plaît"
])
/** 不缩合的写法（de le、à les）只在少数情况下出现，单列一条会占着常用词的名次 */
const SKIP = new Set(['de le', 'de les', 'à le', 'à les', 'en le', 'en les'])
const isCombo = (it: Item): boolean =>
  (it.p === 'verb' || it.p === 'other' || it.p === 'intj' || it.p === 'phrase') &&
  !KEEP_COMBOS.has(it.k) &&
  tokenize(it.w).some(
    (t, i, all) =>
      (t.kind === 'punct' && /^-(t-)?$/.test(t.text) && i > 0) ||
      (t.kind === 'word' && /['’]$/.test(t.text) && all.some((x, j) => j > i && x.kind === 'word'))
  )
for (const it of items) if (it.p === 'other' && KEEP_COMBOS.has(it.k)) it.p = 'phrase'
const kept = items.filter((it) => {
  if (isCombo(it) || SKIP.has(it.k)) return false
  if (it.p === 'propn') return it.tat >= 20 || !!coreLevel(core, it.k, it.p, it.g)
  if (CLOSED.has(it.p)) return true
  return it.score > 0 || it.senses.some((s) => s.zh?.length) || !!coreLevel(core, it.k, it.p, it.g)
})
log(`收词：${kept.length} / ${items.length}（不收没有词频、没有中文的冷僻词与专名）`)

// 虚词的中文用手写的（data/fr/zh-core.txt）：列了的词条，自动对出的中文全部不用，没写到的义项不给中文
for (const it of kept) {
  const lines = zhCore.get(`${it.k}|${it.p}`)
  if (!lines) continue
  for (const s of it.senses) {
    const en = (s.en[0] ?? '').toLowerCase()
    // 最长的开头优先：「you」也是「yourself」的开头
    const hit = lines
      .filter((l) => en.startsWith(l.sense))
      .sort((a, b) => b.sense.length - a.sense.length)[0]
    delete s.zh
    delete s.zs
    if (hit) {
      s.zh = hit.zh
      s.zs = 'fr-core'
      hit.used = true
    }
  }
  if (!it.senses.some((s) => s.zs === 'wikt-zh')) it.src.delete('wikt-zh')
  if (!it.senses.some((s) => s.zs === 'cfdict')) it.src.delete('cfdict')
  it.src.add('fr-core')
}
const unused = [...zhCore].flatMap(([k, lines]) =>
  lines.filter((l) => !l.used).map((l) => `${k}「${l.sense}」`)
)
if (unused.length) log(`zh-core.txt 有 ${unused.length} 行没对上义项：${unused.join('；')}`)

// 名次与等级
const ranked = kept.filter((it) => it.score > 0).sort((a, b) => b.score - a.score)
ranked.forEach((it, i) => (it.rank = i + 1))
for (const it of kept) {
  let lv = it.p === 'propn' || it.p === 'affix' ? undefined : levelOfRank(it.rank)
  const c = coreLevel(core, it.k, it.p, it.g)
  if (lv) lv = harder(lv, registerFloor(it.senses.map((s) => s.t)))
  lv = easier(lv, c)
  if (c) it.src.add('fr-core')
  if (lv) it.lv = lv
}

// ───────────────────────── 写库 ─────────────────────────

// --out <文件>：写到别处（软件开着时 dict.sqlite 换不掉，先写到旁边再换）
const outArg = process.argv.indexOf('--out')
const db = new LexDbWriter('fr', outArg > 0 ? { file: process.argv[outArg + 1] } : {})
for (const s of Object.values(SOURCES)) db.source(s)
db.source(LEXIQUE_SOURCE)
db.source(CORE_SOURCE)
db.meta(
  'versions',
  Object.fromEntries(
    Object.entries(DOWNLOADS).map(([id, d]) => {
      const info = fetchedInfo(join(CACHE, d.file))
      return [id, info ? { url: info.url, lastModified: info.lastModified } : null]
    })
  )
)

kept.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.w.localeCompare(b.w, 'fr'))
const ids = new Map<Item, number>()
let senseExamples = 0
for (const it of kept) {
  const s: LexSense[] = it.senses.map((x) => {
    const ex = x.ex.map((e) => {
      senseExamples++
      return db.example({ text: e.text, en: e.en ?? null, src: 'wiktionary' })
    })
    return {
      ...(x.en.length ? { en: x.en } : {}),
      ...(x.zh?.length ? { zh: x.zh, zs: x.zs } : {}),
      ...(x.mono?.length ? { mono: x.mono } : {}),
      ...(x.t.length ? { t: x.t } : {}),
      ...(x.dom.length ? { dom: x.dom } : {}),
      ...(ex.length ? { ex } : {}),
      ...(x.syn.length ? { syn: x.syn } : {}),
      ...(x.ant.length ? { ant: x.ant } : {})
    }
  })
  const lv: Record<string, string> = {}
  if (it.lv) lv.cefr = it.lv
  const band = bandOfRank(it.rank)
  if (band) lv.freq = band
  if (it.score > 0 && it.src.has('wiktionary')) it.src.add('lexique')
  else if (it.score > 0 && it.tat === 0) it.src.add('lexique')
  const data: LexEntryData = {
    w: it.w,
    p: [it.p],
    ...(it.g ? { g: it.g } : {}),
    ...(it.ipa.length ? { ipa: it.ipa } : {}),
    ...(it.au.length ? { au: it.au } : {}),
    s,
    ...(it.f.length ? { f: it.f as [string, ...string[]][] } : {}),
    ...(it.cls.length ? { cls: it.cls } : {}),
    ...(Object.keys(lv).length ? { lv } : {}),
    ...(it.rank ? { fr: it.rank } : {}),
    ...(Object.keys(it.x).length ? { x: it.x } : {}),
    src: [...it.src]
  }
  ids.set(it, db.entry(data))
}
log(`写了 ${kept.length} 个词条，义项例句 ${senseExamples} 句`)

// ───────────────────────── Tatoeba 例句 ─────────────────────────

/** 词形键 → 最常用的那个词条（阅读器查词也是这样挑） */
const formOwner = new Map<string, Item>()
for (const it of kept) {
  for (const form of [it.w, ...it.f.map(([x]) => x)]) {
    const k = frKey(form)
    const cur = formOwner.get(k)
    if (!cur || (it.rank ?? 1e9) < (cur.rank ?? 1e9)) formOwner.set(k, it)
  }
}
const lvIdx = (l?: CefrLevel): number => (l ? CEFR_LEVELS.indexOf(l) : 5)
const PER_WORD = 3
const MAX_RANK_FOR_EXAMPLES = 30000
interface Cand {
  i: number
  score: number
}
const best = new Map<Item, Cand[]>()
const sentenceInfo = tatoeba.map((s, i) => {
  const toks = tokenized[i].filter((t) => t.kind === 'word')
  const its = toks.map((t) => formOwner.get(frKey(t.text)))
  // 难度：句子里最难的那个词的等级（专名、没查到的大写词不算）
  let hard = 0
  toks.forEach((t, j) => {
    const it = its[j]
    if (!it) {
      if (!/^\p{Lu}/u.test(t.text)) hard = Math.max(hard, 5)
      return
    }
    if (it.p !== 'propn') hard = Math.max(hard, lvIdx(it.lv))
  })
  return { its: [...new Set(its.filter((x): x is Item => !!x))], hard }
})
tatoeba.forEach((s, i) => {
  const len = s.text.length
  if (len < 8 || len > 140) return
  const { its, hard } = sentenceInfo[i]
  // 越短、越容易、有中文的越好
  const score = (s.zh ? 0 : 1000) + hard * 100 + len
  for (const it of its) {
    if ((it.rank ?? 1e9) > MAX_RANK_FOR_EXAMPLES) continue
    const list = best.get(it) ?? []
    if (list.length < PER_WORD || score < list[list.length - 1].score) {
      list.push({ i, score })
      list.sort((a, b) => a.score - b.score)
      if (list.length > PER_WORD) list.pop()
      best.set(it, list)
    }
  }
})
const chosen = new Map<number, Set<Item>>()
tatoeba.forEach((s, i) => {
  if (s.zh && s.text.length <= 140) chosen.set(i, new Set())
})
for (const [it, list] of best)
  for (const c of list) {
    const set = chosen.get(c.i) ?? new Set<Item>()
    set.add(it)
    chosen.set(c.i, set)
  }
let tatoebaExamples = 0
for (const [i, forItems] of [...chosen].sort((a, b) => a[0] - b[0])) {
  const s = tatoeba[i]
  const { its, hard } = sentenceInfo[i]
  // 挂到句子里的词条上；最常用的几十个虚词只挂选它当例句的那几句
  const link = its.filter((it) => (it.rank ?? 1e9) > 60 || forItems.has(it))
  db.example(
    {
      text: s.text,
      en: s.en ?? null,
      zh: s.zh ?? null,
      zs: s.zh ? 'tatoeba' : null,
      src: 'tatoeba',
      lv: CEFR_LEVELS[Math.min(hard, 5)]
    },
    link.map((it) => ids.get(it)!).filter(Boolean)
  )
  tatoebaExamples++
}
log(`Tatoeba 例句 ${tatoebaExamples} 句`)

// ───────────────────────── 收尾 ─────────────────────────

// 查词键去重：同一个词条、同一个键只留一行（严格键优先）。动词的 mange 在陈述式、虚拟式、命令式里各出现一次，
// 阅读器、查词每个键只取一行，留着几行只是占地方；变形表本身在词条 JSON 里，不受影响
db.db.exec(`
CREATE INDEX tmp_form ON form (key, entry, loose);
DELETE FROM form WHERE loose = 1 AND EXISTS (
  SELECT 1 FROM form f2 WHERE f2.key = form.key AND f2.entry = form.entry AND f2.loose = 0);
DELETE FROM form WHERE rowid NOT IN (SELECT MIN(rowid) FROM form GROUP BY key, entry, loose);
DROP INDEX tmp_form;
`)
const stats = db.finish()

// 要补中文的常用词：没有任何中文释义的，按词频排，前 8000 个
const todo = kept
  .filter((it) => it.rank && !it.senses.some((s) => s.zh?.length))
  .sort((a, b) => a.rank! - b.rank!)
  .slice(0, 8000)
  .map((it) => {
    const en = it.senses
      .flatMap((s) => s.en)
      .slice(0, 4)
      .join(' | ')
    return `${it.w}\t${it.p}${it.g ? ' ' + it.g : ''}\t${en || it.senses[0]?.mono?.[0] || ''}`
  })
mkdirSync(join(ROOT, 'data', 'fr'), { recursive: true })
writeFileSync(
  join(ROOT, 'data', 'fr', 'zh-todo.txt'),
  `# 没有中文释义的常用词（按词频，前 ${todo.length} 个）：词头\t词性 性\t英文释义（几个义项用 | 隔开）\n` +
    todo.join('\n') +
    '\n'
)

const levelCount = CEFR_LEVELS.map((l) => `${l} ${kept.filter((it) => it.lv === l).length}`).join(
  '，'
)
const withZh = kept.filter((it) => it.senses.some((s) => s.zh?.length))
const keptSet = new Set(kept)
const top = (n: number): string => {
  const list = ranked.filter((it) => keptSet.has(it)).slice(0, n)
  return `${Math.round((list.filter((it) => it.senses.some((s) => s.zh?.length)).length / list.length) * 100)}%`
}
log(
  `完成：${stats.file}  ${(stats.bytes / 1048576).toFixed(1)} MB，词条 ${stats.entries}，查词键 ${stats.forms}，例句 ${stats.examples}`
)
log(
  `各级：${levelCount}；有中文 ${withZh.length} 条（前 2000 ${top(2000)}，前 8000 ${top(8000)}，前 20000 ${top(20000)}）`
)
log(`zh-todo.txt：${todo.length} 行`)
