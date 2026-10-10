/**
 * 生成俄语词典 resources/data/ru/dict.sqlite（不入库）：
 *   node scripts/data/run-ts.mjs scripts/data/ru/build.ts
 * 再校验：node scripts/data/run-ts.mjs scripts/lang/validate.ts ru
 *
 * 1. 英文维基词典的俄语词条（kaikki）做主干：词头与重音、词性、英文释义、IPA、录音、变格变位表、体的配对。
 * 2. OpenRussian.org：排名、CEFR 标注、英文译文、体的配对；维基词典没有的常用词用它的变格变位表补上。
 * 3. 词频：字幕、Tatoeba、维基百科的词形频率按变形表对到词条，加上 OpenRussian 的排名，合成一个名次（fr）。
 * 4. 分级（ТРКИ 六级）：按名次、照各级官方词汇量切；data/ru/basic.json 的基础词不晚于标的等级；
 *    OpenRussian 标了 A1 / A2 的词不晚于那一级；体的配对两个词最多差一级。
 * 5. 中文释义：中文维基词典（人写的正式词条）、俄文维基词典译文表里的中文；没有中文的常用词列进 data/ru/zh-todo.txt。
 * 6. 例句：维基词典词条里的用例（带英文），Tatoeba 的俄中、俄英对照（每个词挑几句短的、容易的）。
 * 做法与依据见 docs/lang/ru.md。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LexDbWriter, ROOT } from '../../lang/lexdb-writer'
import { key, looseKey, romanize, stripStress } from '../../../src/shared/lang/ru/rules'
import { TORFL, TORFL_CUTOFFS } from '../../../src/shared/lang/ru/spec'
import type { AudioRef, LexEntryData, LexSense, PosTag } from '../../../src/shared/lang/types'
import { fetchAll } from './fetch'
import { combine, lemmaCounts, rankToCounts, WORD_RE, type FormIndex, type Source } from './freq'
import { readOpenRussian, type OrWord } from './openrussian'
import { ToSimplified, bz2Text, tsvRows } from './read'
import { SOURCE } from './sources'
import { readWiktionary, type Cell, type WiktSense } from './wiktionary'
import { readRuWiktionaryZh, readZhWiktionary, zhKey, type ZhRecords } from './zh'

const t0 = Date.now()
const log = (msg: string): void => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${msg}`)

const LEVELS = TORFL.levels.map((l) => l.id)
const levelIndex = (l: string | undefined): number => (l ? LEVELS.indexOf(l) : 99)

// ───────────────────────── 原始数据 ─────────────────────────

const raw = await fetchAll([
  'kaikkiEn',
  'kaikkiZhHans',
  'kaikkiZhHant',
  'kaikkiRu',
  'orSql',
  'tatoebaRus',
  'tatoebaRusCmn',
  'tatoebaRusEng',
  'tatoebaCmn',
  'tatoebaEng',
  'freqSubs',
  'freqWiki',
  'openccChars',
  'openccPhrases'
])
const t2s = new ToSimplified(raw.openccChars, raw.openccPhrases)

// ───────────────────────── 词条 ─────────────────────────

interface Entry {
  w: string
  d?: string
  pos: PosTag
  rawPos: string
  g?: string
  animacy?: string
  headTags: string[]
  partners: string[]
  cells: Cell[]
  related: string[]
  senses: WiktSense[]
  ipa: string[]
  audio: AudioRef[]
  classes: string[]
  synonyms: string[]
  antonyms: string[]
  derived: boolean
  or?: OrWord
  orOnly?: boolean
  score: number
  seen: boolean
  fr?: number
  level?: string
  themes: string[]
}

const wikt = await readWiktionary(raw.kaikkiEn)
log(
  `维基词典：原形 ${wikt.lemmas.filter((l) => !l.derived).length}，另立的派生词 ${wikt.lemmas.filter((l) => l.derived).length}，异体写法 ${wikt.aliases.length}，变形词条 ${wikt.inflections}（不另立）`
)

const entries: Entry[] = wikt.lemmas.map((l) => ({
  w: l.word,
  d: l.stressed !== l.word && stripStress(l.stressed) === l.word ? l.stressed : undefined,
  pos: l.pos,
  rawPos: l.rawPos,
  g: l.gender,
  animacy: l.animacy,
  headTags: l.headTags,
  partners: l.partners,
  cells: l.cells,
  related: l.related,
  senses: l.senses,
  ipa: l.ipa,
  audio: l.audio,
  classes: l.classes,
  synonyms: l.synonyms,
  antonyms: l.antonyms,
  derived: l.derived,
  score: -99,
  seen: false,
  themes: []
}))

/** 词头 → 词条下标 */
const byWord = new Map<string, number[]>()
const indexWord = (i: number): void => {
  const list = byWord.get(entries[i].w) ?? []
  list.push(i)
  byWord.set(entries[i].w, list)
}
entries.forEach((_, i) => indexWord(i))

// 异体写法：记成目标词条的另一个写法（ё 写成 е 的不用记，宽松键本来就对得上）
let aliasAdded = 0
for (const a of wikt.aliases) {
  if (a.tags.includes('dated')) continue
  const target = stripStress(a.target)
  const cands = (byWord.get(target) ?? []).filter((i) => entries[i].rawPos === a.pos)
  const i = cands[0] ?? byWord.get(target)?.[0]
  if (i === undefined) continue
  if (looseKey(a.word) === looseKey(target)) continue
  entries[i].cells.push([a.word, 'alternative'])
  aliasAdded++
}
log(`异体写法记到目标词条上：${aliasAdded}`)

// 异体写法里宽松键已经对得上的（旧正字法 столъ、ё 写成 е 的 еще́）不另存；
// 跟别的词条的词头撞上的也不要（кафе́ 是 кофе 的方言写法，可它首先是「咖啡馆」кафе）
const headKeys = new Set(entries.map((e) => looseKey(e.w)))
for (const e of entries) {
  const covered = new Set([
    looseKey(e.w),
    ...e.cells.filter((c) => !c.includes('alternative')).map((c) => looseKey(c[0]))
  ])
  e.cells = e.cells.filter(
    (c) =>
      !c.includes('alternative') || (!covered.has(looseKey(c[0])) && !headKeys.has(looseKey(c[0])))
  )
}

/**
 * 维基词典把变格表挂在一页里最后一个词性下面：весь 的表挂在了口语的副词「весь」上，限定词「весь」反而没有。
 * 不变格的词性（副词、语气词……）带着格的表时，挪给同一个词里会变格的那个（限定词 > 代词 > 形容词 > 数词）
 */
const DECLINING: PosTag[] = ['noun', 'propn', 'adj', 'det', 'pron', 'num', 'verb']
const CASE_TAGS = [
  'nominative',
  'genitive',
  'dative',
  'accusative',
  'instrumental',
  'prepositional'
]
const hasCase = (c: Cell): boolean => c.some((t) => CASE_TAGS.includes(t))
const RECEIVERS: PosTag[] = ['det', 'pron', 'adj', 'num']
let moved = 0
for (const [i, e] of entries.entries()) {
  if (DECLINING.includes(e.pos) || !e.cells.some(hasCase)) continue
  const sibs = (byWord.get(e.w) ?? [])
    .filter((j) => j !== i && RECEIVERS.includes(entries[j].pos) && !entries[j].cells.some(hasCase))
    .sort((a, b) => RECEIVERS.indexOf(entries[a].pos) - RECEIVERS.indexOf(entries[b].pos))
  if (!sibs.length) continue
  entries[sibs[0]].cells = [...e.cells.filter(hasCase), ...entries[sibs[0]].cells]
  e.cells = e.cells.filter((c) => !hasCase(c))
  moved++
}
log(`变格表挪到会变格的同形词上：${moved}`)

// ───────────────────────── OpenRussian ─────────────────────────

const or = readOpenRussian(raw.orSql)
log(`OpenRussian：${or.size} 个词`)

const OR_POS: Record<string, PosTag[]> = {
  noun: ['noun', 'propn'],
  verb: ['verb'],
  adjective: ['adj', 'det', 'num', 'pron'],
  adverb: ['adv', 'part', 'intj'],
  expression: ['phrase', 'idiom', 'proverb'],
  other: ['pron', 'det', 'adp', 'cconj', 'sconj', 'part', 'intj', 'num', 'adv', 'phrase', 'other']
}

const OR_ONLY_POS: PosTag[] = ['noun', 'verb', 'adj', 'adv']
const OR_ONLY_RANK = 30000

/** 先把所有词形放进一张表，判断 OpenRussian 独有的词是不是已经收的词的变形 */
const formKeys = new Set<string>()
for (const e of entries) {
  formKeys.add(key(e.w))
  for (const [f] of e.cells) formKeys.add(key(f))
}

let orMatched = 0
let orAdded = 0
const orToEntry = new Map<number, number>()
for (const w of or.values()) {
  const cands = (byWord.get(w.bare) ?? []).filter((i) =>
    w.type ? (OR_POS[w.type] ?? []).includes(entries[i].pos) : true
  )
  if (cands.length) {
    // 同形词（за́мок / замо́к）按重音挑
    const i = cands.find((c) => (entries[c].d ?? entries[c].w) === w.accented) ?? cands[0]
    if (!entries[i].or || (w.rank ?? 1e9) < (entries[i].or!.rank ?? 1e9)) entries[i].or = w
    orToEntry.set(w.id, i)
    orMatched++
    continue
  }
  // 维基词典没有、也不是别的词的变形：用 OpenRussian 的数据另立词条。OpenRussian 里混着不少变形（хуже、
  // найдено）、专名（мэри）与冷僻词，只收前 3 万名里的名词、动词、形容词、副词
  if (
    byWord.has(w.bare) ||
    formKeys.has(key(w.bare)) ||
    wikt.inflectionWords.has(w.bare) ||
    !w.en.length ||
    !w.pos ||
    !OR_ONLY_POS.includes(w.pos) ||
    !w.rank ||
    w.rank > OR_ONLY_RANK ||
    w.bare.length < 3 ||
    w.bare[0] !== w.bare[0].toLowerCase()
  )
    continue
  const i = entries.length
  entries.push({
    w: w.bare,
    d: w.accented !== w.bare ? w.accented : undefined,
    pos: w.pos ?? 'other',
    rawPos: w.type ?? 'other',
    g: w.gender,
    animacy: w.pos === 'noun' ? (w.animate ? 'animate' : 'inanimate') : undefined,
    headTags: [
      ...(w.aspect === 'both' ? ['imperfective', 'perfective'] : w.aspect ? [w.aspect] : []),
      ...(w.indeclinable ? ['indeclinable'] : []),
      ...(w.pluralOnly ? ['plural'] : [])
    ],
    partners: [],
    cells: w.cells,
    related: [],
    senses: [{ en: w.en.slice(0, 4), tags: [], topics: [], examples: [] }],
    ipa: [],
    audio: [],
    classes: [],
    synonyms: [],
    antonyms: [],
    derived: false,
    or: w,
    orOnly: true,
    score: -99,
    seen: false,
    themes: []
  })
  indexWord(i)
  orToEntry.set(w.id, i)
  orAdded++
}
log(`OpenRussian 对上 ${orMatched} 个词条，另立 ${orAdded} 个维基词典没有的词`)

// ───────────────────────── 查词键的索引（词频、例句用） ─────────────────────────

const strictIdx: FormIndex = new Map()
const looseIdx: FormIndex = new Map()
const addIdx = (idx: FormIndex, k: string, i: number): void => {
  if (!k) return
  const list = idx.get(k)
  if (!list) idx.set(k, [i])
  else if (!list.includes(i)) list.push(i)
}
entries.forEach((e, i) => {
  for (const f of [e.w, e.d ?? '', ...e.cells.map((c) => c[0])]) {
    if (!f) continue
    addIdx(strictIdx, key(f), i)
    addIdx(looseIdx, looseKey(f), i)
  }
})
log(`索引：${strictIdx.size} 个查词键`)

// ───────────────────────── 词频 ─────────────────────────

function readFreqList(file: string, name: string): Source {
  const counts = new Map<string, number>()
  let total = 0
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const sp = line.indexOf(' ')
    if (sp <= 0) continue
    const c = Number(line.slice(sp + 1).split(' ')[0])
    if (!c) continue
    total += c
    const k = key(line.slice(0, sp))
    if (strictIdx.has(k) || looseIdx.has(looseKey(k))) counts.set(k, (counts.get(k) ?? 0) + c)
  }
  return { name, counts, total }
}

const subs = readFreqList(raw.freqSubs, 'subs')
const wiki = readFreqList(raw.freqWiki, 'wiki')
log(`词频：字幕 ${subs.counts.size} 个词形，维基百科 ${wiki.counts.size} 个词形`)

// Tatoeba：句中大写的词（Том、Мэри）只算给专名，免得「том」（卷）因为 Том 排到最前
const rusSentences = new Map<number, string>()
const tat: Source = { name: 'tatoeba', counts: new Map(), total: 0 }
const tatCap: Source = { name: 'tatoeba-cap', counts: new Map(), total: 0 }
for (const [id, lang, text] of tsvRows(bz2Text(raw.tatoebaRus))) {
  if (lang !== 'rus' || !text) continue
  rusSentences.set(Number(id), text)
  let first = true
  for (const m of text.matchAll(WORD_RE)) {
    const tok = m[0]
    tat.total++
    const k = key(tok)
    const capital = !first && tok[0] !== tok[0].toLowerCase()
    first = false
    const map = capital ? tatCap.counts : tat.counts
    map.set(k, (map.get(k) ?? 0) + 1)
  }
}
tatCap.total = tat.total
log(`Tatoeba：${rusSentences.size} 句俄语，${tat.total} 个词次`)

const n = entries.length
const isProper = (i: number): boolean => entries[i].w[0] !== entries[i].w[0].toLowerCase()
/**
 * 跟普通词同形时不参与分的：专名（По、Или、Правда）、字母与缩写（В、В.）、词缀、符号。
 * 只有它们自己的时候才算给它们（Москва）
 */
const weak = (i: number): boolean => {
  const e = entries[i]
  return (
    isProper(i) ||
    ['propn', 'abbr', 'affix', 'symbol'].includes(e.pos) ||
    e.w.includes('.') ||
    (e.w.length === 1 && !['adp', 'cconj', 'sconj', 'part', 'pron', 'intj'].includes(e.pos))
  )
}
/**
 * 一个词形是某个词条的词头、又是别的词条的形动词 / 短尾 / 比较级时，算给词头的那个：
 * хорошо、красиво 是副词（不是 хороший 的短尾中性），следующий 是形容词（不是 следовать 的形动词）
 */
const DERIVED_FORM = ['participle', 'short-form', 'comparative', 'alternative']
const common = (cands: number[], form: string): number[] => {
  const strong = cands.filter((i) => !weak(i))
  let c = strong.length ? strong : cands
  if (c.length > 1) {
    const lf = looseKey(form)
    const owners = c.filter((i) => looseKey(entries[i].w) === lf)
    if (owners.length) {
      const keep = c.filter(
        (i) =>
          owners.includes(i) ||
          !entries[i].cells.some(
            (cell) => looseKey(cell[0]) === lf && cell.some((t) => DERIVED_FORM.includes(t))
          )
      )
      if (keep.length) c = keep
    }
  }
  return c
}
const subsC = lemmaCounts(subs, strictIdx, looseIdx, looseKey, n, common)
const wikiC = lemmaCounts(wiki, strictIdx, looseIdx, looseKey, n, common)
const tatC = lemmaCounts(tat, strictIdx, looseIdx, looseKey, n, common)
// 句中大写的词只算给专名
const tatCapC = lemmaCounts(tatCap, strictIdx, looseIdx, looseKey, n, (c) => c.filter(isProper))
for (let i = 0; i < n; i++) tatC[i] += tatCapC[i]
const orC = rankToCounts(entries.map((e) => e.or?.rank ?? null))
const minSubs = Math.min(...[...subs.counts.values()])
const { score, seen } = combine(
  [
    { counts: subsC, total: subs.total, weight: 0.3, floor: ((0.5 * minSubs) / subs.total) * 1e6 },
    { counts: tatC, total: tat.total, weight: 0.3 },
    { counts: orC, total: 1e6, weight: 0.25, floor: 440000 / 80010 },
    { counts: wikiC, total: wiki.total, weight: 0.15 }
  ],
  n
)
entries.forEach((e, i) => {
  e.score = score[i]
  e.seen = !!seen[i]
})
const ranked = entries
  .map((_, i) => i)
  .filter((i) => entries[i].seen)
  .sort((a, b) => entries[b].score - entries[a].score)
ranked.forEach((i, r) => (entries[i].fr = r + 1))
log(`词频名次：${ranked.length} 个词条有名次`)

// ───────────────────────── 分级 ─────────────────────────

const lower = (i: number, level: string): void => {
  if (levelIndex(level) < levelIndex(entries[i].level)) entries[i].level = level
}

/** 定死的等级：basic.json 的基础词、OpenRussian 人工标的 A1 / A2（它 B1 以上的标注看上去是按排名切的，不用） */
const fixed = new Map<number, number>()
const fix = (i: number, level: string): void => {
  const l = levelIndex(level)
  if (l < (fixed.get(i) ?? 99)) fixed.set(i, l)
}

// 基础词（data/ru/basic.json）：「词#英文」按英文释义挑同形词里的那一个（среда#Wednesday），
// 没写的挑最常用的那个
interface Theme {
  id: string
  title: { zh: string; en: string }
  [level: string]: unknown
}
const basic = JSON.parse(readFileSync(join(ROOT, 'data/ru/basic.json'), 'utf8')) as {
  themes: Theme[]
}
const missingBasic: string[] = []
for (const th of basic.themes)
  for (const level of LEVELS) {
    const words = th[level]
    if (typeof words !== 'string') continue
    for (const item of words.split(/\s+/).filter(Boolean)) {
      const [word, hint] = item.split('#')
      let cands = byWord.get(word.replace(/_/g, ' ')) ?? []
      if (hint)
        cands = cands.filter((i) =>
          entries[i].senses.some((s) =>
            s.en.some((g) => g.toLowerCase().includes(hint.toLowerCase()))
          )
        )
      if (!cands.length) {
        missingBasic.push(item)
        continue
      }
      const i = cands.reduce((a, b) => (entries[b].score > entries[a].score ? b : a))
      fix(i, level)
      if (!entries[i].themes.includes(th.id)) entries[i].themes.push(th.id)
    }
  }
if (missingBasic.length) log(`basic.json 里没查到的词：${missingBasic.join(' ')}`)
for (const [i, e] of entries.entries())
  if (e.or?.level === 'A1') fix(i, 'teu')
  else if (e.or?.level === 'A2') fix(i, 'tbu')

/**
 * 按词频切：每一级的累计词数照官方词汇量（780、1300、2300、5000、11000、20000），
 * 定死的词也算在里面（基础词提前了几个，词频切的就少几个）。
 * 专名、缩写、词缀、符号、谚语不分级（官方大纲不收专名；俄罗斯、中国、莫斯科几个由 basic.json 定）
 */
const NOT_COUNTED: PosTag[] = ['propn', 'abbr', 'affix', 'symbol', 'proverb']
const countable = ranked.filter((i) => !NOT_COUNTED.includes(entries[i].pos) && !isProper(i))
const thresholds = TORFL_CUTOFFS.map(([level, cum], L) => {
  let union = [...fixed.values()].filter((l) => l <= L).length
  let k = 0
  while (union < cum && k < countable.length) {
    if ((fixed.get(countable[k]) ?? 99) > L) union++
    k++
  }
  return { level, score: k ? entries[countable[k - 1]].score : Infinity }
})
for (const i of countable) {
  const t = thresholds.find((x) => entries[i].score >= x.score)
  if (t) entries[i].level = t.level
}
for (const [i, l] of fixed) lower(i, LEVELS[l])

// 体的配对：两个词最多差一级
const partnerIdx = (e: Entry): number[] => {
  const names = new Set([...e.partners.map(stripStress), ...(e.or?.partners ?? [])])
  const out: number[] = []
  for (const p of names)
    for (const j of byWord.get(p) ?? []) if (entries[j].pos === 'verb') out.push(j)
  return out
}
for (let pass = 0; pass < 2; pass++)
  for (const [i, e] of entries.entries()) {
    if (e.pos !== 'verb' || !e.level) continue
    const next = LEVELS[Math.min(levelIndex(e.level) + 1, LEVELS.length - 1)]
    for (const j of partnerIdx(e)) if (j !== i) lower(j, next)
  }

// ───────────────────────── 中文释义 ─────────────────────────

const zhw = await readZhWiktionary([raw.kaikkiZhHans, raw.kaikkiZhHant], t2s)
log(
  `中文维基词典：${zhw.glosses.reduce((a, m) => a + m.size, 0)} 个词有正式词条（机器人批量建的光杆条目 ${zhw.skippedBot} 条不收）`
)
const ruZh = await readRuWiktionaryZh(raw.kaikkiRu, t2s)
log(`俄文维基词典：${ruZh.size} 个词的译文表里有中文`)

/** 词头 + 词性 → 词条下标（同形异义词按维基词典页面上的先后） */
const byWordPos = new Map<string, number[]>()
for (const [i, e] of entries.entries()) {
  const k = zhKey(e.w, e.pos)
  const list = byWordPos.get(k) ?? []
  list.push(i)
  byWordPos.set(k, list)
}

/**
 * 一个词条该用哪一条中文记录。同形异义词（есть「吃」/ есть「有」，за́мок / замо́к）两边的记录数一样时按先后对齐，
 * 不一样时分不清哪条对哪个，就都不用（宁缺毋错）；只有一个词条时，几条记录的释义合在一起
 */
/**
 * 三部维基词典对代词性的词、虚词的词性分法不一样（весь 在英文版是限定词，在中文版、俄文版是代词），
 * 本词性对不上时在相近的词性里找
 */
const POS_FALLBACK: Partial<Record<PosTag, PosTag[]>> = {
  det: ['pron', 'adj', 'num'],
  pron: ['det', 'adj'],
  adj: ['det', 'pron'],
  num: ['det', 'adj', 'noun'],
  propn: ['noun'],
  part: ['adv', 'intj', 'cconj', 'sconj'],
  adv: ['part', 'intj'],
  intj: ['part', 'adv'],
  cconj: ['sconj', 'part'],
  sconj: ['cconj', 'part'],
  adp: ['adv']
}

function zhFor(recordSets: Map<string, ZhRecords>[], i: number): string[] | null {
  const e = entries[i]
  const keys = [zhKey(e.w, e.pos), ...(POS_FALLBACK[e.pos] ?? []).map((p) => zhKey(e.w, p))]
  for (const k of keys) {
    const group = byWordPos.get(zhKey(e.w, e.pos)) ?? [i]
    const sets = recordSets.filter((m) => m.has(k))
    if (!sets.length) continue
    if (group.length === 1) {
      const all = sets.flatMap((m) => m.get(k)!).flatMap((r) => r ?? [])
      return all.length ? [...new Set(all)] : null
    }
    // 几个同形异义词：只在一份文件里出现、条数相同时按先后对齐
    if (sets.length !== 1) return null
    const recs = sets[0].get(k)!
    if (recs.length !== group.length) return null
    return recs[group.indexOf(i)] ?? null
  }
  return null
}

// ───────────────────────── 例句 ─────────────────────────

// Tatoeba 的中文、英文翻译
const cmn = new Map<number, string>()
for (const [id, lang, text] of tsvRows(bz2Text(raw.tatoebaCmn)))
  if (lang === 'cmn' && text) cmn.set(Number(id), t2s.convert(text))
const toZh = new Map<number, string>()
for (const [a, b] of tsvRows(bz2Text(raw.tatoebaRusCmn))) {
  const zh = cmn.get(Number(b))
  if (zh && !toZh.has(Number(a))) toZh.set(Number(a), zh)
}
const engWanted = new Map<number, number>()
for (const [a, b] of tsvRows(bz2Text(raw.tatoebaRusEng)))
  if (!engWanted.has(Number(a))) engWanted.set(Number(a), Number(b))
const engIds = new Set(engWanted.values())
const eng = new Map<number, string>()
for (const [id, lang, text] of tsvRows(bz2Text(raw.tatoebaEng)))
  if (lang === 'eng' && text && engIds.has(Number(id))) eng.set(Number(id), text)
log(`Tatoeba：${toZh.size} 句有中文翻译，${engWanted.size} 句有英文翻译`)

/** 一个词形对上的词条：常用的那个 */
function bestEntry(tok: string): number | undefined {
  const cands = strictIdx.get(key(tok)) ?? looseIdx.get(looseKey(tok))
  if (!cands) return undefined
  let best = cands[0]
  for (const i of cands) if (entries[i].score > entries[best].score) best = i
  return best
}

interface Cand {
  id: number
  text: string
  zh?: string
  en?: string
  words: number[]
  /** 句中最难的词的等级（没有等级的算 6） */
  hard: number
  quality: number
}
const PER_ENTRY = 3
/** Tatoeba 里成千上万句「Том … Мэри」（JS 的 \b 不认西里尔字母，只能自己写边界） */
const TOM_MARY = /(?<![А-Яа-яЁё])(Том|Мэри|Тома|Тому|Томом|Томе)(?![А-Яа-яЁё])/u
const picks = new Map<number, Cand[]>()
let candCount = 0
for (const [id, text] of rusSentences) {
  const zh = toZh.get(id)
  const enId = engWanted.get(id)
  const en = enId !== undefined ? eng.get(enId) : undefined
  if (!zh && !en) continue
  if (text.length < 6 || text.length > 110 || /[a-zA-Z]/.test(text)) continue
  const words: number[] = []
  let hard = 0
  for (const m of text.matchAll(WORD_RE)) {
    const i = bestEntry(m[0])
    if (i === undefined) {
      hard = 6
      continue
    }
    if (!words.includes(i)) words.push(i)
    hard = Math.max(hard, Math.min(6, levelIndex(entries[i].level)))
  }
  if (!words.length) continue
  candCount++
  // 有中文翻译的优先；Том、Мэри 的句子太多，往后放；20–60 个字母的长度最合适
  const len = text.length
  const quality =
    (zh ? 0 : 30) +
    (TOM_MARY.test(text) ? 12 : 0) +
    (len < 20 ? 20 - len : len > 60 ? (len - 60) / 2 : 0)
  const c: Cand = { id, text, zh, en, words, hard, quality }
  for (const i of words) {
    const e = entries[i]
    // 句子不比这个词难太多（最多高一级）
    if (hard > Math.min(6, levelIndex(e.level)) + 1 && e.level) continue
    const list = picks.get(i) ?? []
    list.push(c)
    list.sort((a, b) => a.quality - b.quality || a.hard - b.hard)
    if (list.length > PER_ENTRY) list.pop()
    picks.set(i, list)
  }
}
const chosen = new Map<number, Cand>()
for (const list of picks.values()) for (const c of list) chosen.set(c.id, c)
log(`Tatoeba 例句：候选 ${candCount} 句，选出 ${chosen.size} 句`)

// ───────────────────────── 写库 ─────────────────────────

const db = new LexDbWriter('ru')
for (const s of Object.values(SOURCE)) if (s.id !== 'torfl') db.source(s)

// 维基词典的用例（先写，词条的义项要引用例句号）
const senseEx = new Map<WiktSense, number[]>()
let wiktExamples = 0
for (const e of entries)
  for (const s of e.senses)
    if (s.examples.length) {
      senseEx.set(
        s,
        s.examples.map((x) => {
          wiktExamples++
          return db.example({ text: x.text, en: x.en, src: 'wiktionary' })
        })
      )
    }

function stressInfo(e: Entry): { zal?: string; stress?: string; mobile?: boolean } {
  if (e.pos === 'verb') {
    const c = e.classes.find((x) => /^\d/.test(x))
    if (!c) return {}
    const zal = c.split(' ')[0]
    const letters = zal.replace(/^[\d°*]+/, '').replace(/[①-⑩()[\]]/g, '')
    return { zal, stress: letters || undefined, mobile: /c/.test(letters) }
  }
  const acc = e.classes.find((x) => x.startsWith('accent-'))
  if (!acc) return {}
  // a（重音固定在词干）、b（固定在词尾）以外的都会移动：c、d、e、f 以及带撇的变体
  const letter = acc.slice(7)
  return { stress: letter, mobile: letter !== 'a' && letter !== 'b' }
}

const strip = stripStress
function nounDeclension(e: Entry): string | null {
  const w = e.w.toLowerCase()
  const sg = e.cells.filter((c) => c.includes('singular'))
  const forms = new Set(e.cells.map((c) => strip(c[0])))
  if (e.headTags.includes('indeclinable') || (e.cells.length >= 6 && forms.size === 1))
    return 'indeclinable'
  if (!sg.length && e.cells.some((c) => c.includes('plural'))) return 'plural-only'
  const gen = strip(sg.find((c) => c.includes('genitive'))?.[0] ?? '')
  if (/(ый|ий|ой|ая|яя|ое|ее)$/.test(w) && /(ого|его|ой|ей)$/.test(gen)) return 'adjectival'
  if (/мя$/.test(w) && e.g === 'n') return 'heteroclitic'
  if (w === 'путь' || w === 'дитя') return 'heteroclitic'
  if (/[ая]$/.test(w)) return 'declension-1'
  if (e.g === 'f' && /ь$/.test(w)) return 'declension-3'
  if (e.g === 'm' || e.g === 'n') return 'declension-2'
  return null
}

function conjugation(e: Entry): string | null {
  const pick = (person: string, num: string): string =>
    strip(
      e.cells.find(
        (c) =>
          c.includes(person) && c.includes(num) && (c.includes('present') || c.includes('future'))
      )?.[0] ?? ''
    ).replace(/(ся|сь)$/, '')
  const sg2 = pick('second-person', 'singular')
  const pl3 = pick('third-person', 'plural')
  if (!sg2) return null
  // 第一人称单数以 -м 结尾的是古老的无构干元音变位（есть：ем、ешь；дать：дам、дашь），算不规则
  if (/м$/.test(pick('first-person', 'singular'))) return 'irregular'
  const first = /[её]шь$/.test(sg2)
  const second = /ишь$/.test(sg2)
  const pl3first = /[ую]т$/.test(pl3)
  const pl3second = /[ая]т$/.test(pl3)
  if (first && (pl3first || !pl3)) return 'first-conjugation'
  if (second && (pl3second || !pl3)) return 'second-conjugation'
  if ((first && pl3second) || (second && pl3first)) return 'mixed-conjugation'
  return 'irregular'
}

const ADJ_STEMS = ['hard-stem', 'soft-stem', 'velar-stem', 'sibilant-stem', 'ц-stem', 'vowel-stem']

function classesOf(e: Entry): string[] {
  const out: string[] = []
  if (e.pos === 'noun') {
    const d = nounDeclension(e)
    if (d) out.push(d)
    if (e.animacy === 'animate' || e.animacy === 'inanimate') out.push(e.animacy)
  } else if (e.pos === 'verb') {
    const ipf = e.headTags.includes('imperfective') || e.or?.aspect === 'imperfective'
    const pf = e.headTags.includes('perfective') || e.or?.aspect === 'perfective'
    if (ipf) out.push('imperfective')
    if (pf) out.push('perfective')
    if (e.or?.aspect === 'both' && !ipf && !pf) out.push('imperfective', 'perfective')
    const c = e.classes.find((x) => /^\d/.test(x)) ?? ''
    if (/\btransitive\b/.test(c) && !/intransitive/.test(c)) out.push('transitive')
    else if (/intransitive/.test(c)) out.push('intransitive')
    if (/(ся|сь)$/.test(e.w)) out.push('reflexive')
    const conj = conjugation(e)
    if (conj) out.push(conj)
  } else if (e.pos === 'adj') {
    const stem = e.classes.find((x) => ADJ_STEMS.includes(x))
    if (stem) out.push(stem)
  }
  return out
}

/** 体的配对（带重音的词头） */
function aspectPartners(e: Entry): string[] {
  const out: string[] = [...e.partners]
  for (const p of e.or?.partners ?? []) {
    const j = (byWord.get(p) ?? []).find((x) => entries[x].pos === 'verb')
    const shown = j !== undefined ? (entries[j].d ?? entries[j].w) : p
    if (!out.some((x) => strip(x) === strip(shown))) out.push(shown)
  }
  return out.slice(0, 4)
}

let withZh = 0
const hasZh = new Set<number>()
let zhFromZhw = 0
let zhFromRu = 0
/**
 * 体积：完整的变格变位表只给词频前 FULL_RANK 名与有等级的词；更冷僻的只留主要形式（名词的单数属格、
 * 复数主格属格，动词的人称形式与过去时、命令式，形容词的短尾与比较级），别的变形靠 rules.lemmaCandidates 找回。
 * 哪份频率表里都没出现过的实词不收。
 */
const FULL_RANK = 30000
const PRINCIPAL: Partial<Record<PosTag, string[][]>> = {
  noun: [
    ['genitive', 'singular'],
    ['nominative', 'plural'],
    ['genitive', 'plural']
  ],
  propn: [
    ['genitive', 'singular'],
    ['nominative', 'plural']
  ],
  verb: [
    ['first-person', 'singular'],
    ['second-person', 'singular'],
    ['third-person', 'plural'],
    ['past', 'masculine', 'singular'],
    ['past', 'feminine', 'singular'],
    ['past', 'plural'],
    ['imperative', 'second-person', 'singular']
  ],
  adj: [['short-form'], ['comparative']]
}
function cellsFor(e: Entry): Cell[] {
  if ((e.fr && e.fr <= FULL_RANK) || e.level) return e.cells
  const sets = PRINCIPAL[e.pos]
  if (!sets) return e.cells
  return e.cells.filter(
    (c) => c.includes('alternative') || sets.some((s) => s.every((t) => c.includes(t)))
  )
}
const LEXICAL: PosTag[] = ['noun', 'verb', 'adj', 'adv', 'propn']
let dropped = 0

const entryIds: (number | undefined)[] = []
for (const [i, e] of entries.entries()) {
  if (!e.seen && LEXICAL.includes(e.pos) && !e.themes.length) {
    dropped++
    continue
  }
  const cells = cellsFor(e)
  const zhw1 = zhFor(zhw.glosses, i)
  const ru1 = zhFor([ruZh], i)
  const senses: LexSense[] = e.senses.map((s) => {
    const out: LexSense = { en: s.en }
    if (s.tags.length) out.t = s.tags
    if (s.topics.length) out.dom = s.topics
    const ex = senseEx.get(s)
    if (ex?.length) out.ex = ex
    if (s.of) out.see = [s.of]
    return out
  })
  // 中文：两部维基词典的义项跟英文的义项不是一一对应的（义项数相同时次序也常常不同：хороший 的
  // 「好看的」对着中文的「亲密的」），所以中文都放在第一个义项上，当作中文释义的汇总：
  // 先放俄文维基词典译文表里的对应词（第一个义项的直接对译：молоко → 牛奶，奶水，乳汁，乳），
  // 再接中文维基词典的各条释义（去掉跟前面重复的）
  const zh: string[] = []
  if (ru1?.length) {
    zh.push(ru1.join('，'))
    zhFromRu++
  }
  for (const g of zhw1 ?? []) if (!ru1?.includes(g) && !zh.includes(g)) zh.push(g)
  if (zhw1?.length) zhFromZhw++
  if (zh.length) {
    senses[0].zh = zh
    senses[0].zs = 'wikt-zh'
  }
  if (senses.some((s) => s.zh?.length)) {
    withZh++
    hasZh.add(i)
  }
  // 近义、反义、相关的词放在第一个义项上
  const syn = [...e.synonyms]
  const ant = [...e.antonyms]
  for (const id of e.or?.synonyms ?? []) {
    const b = or.get(id)?.bare
    if (b && !syn.includes(b) && syn.length < 8) syn.push(b)
  }
  for (const id of e.or?.antonyms ?? []) {
    const b = or.get(id)?.bare
    if (b && !ant.includes(b) && ant.length < 8) ant.push(b)
  }
  if (syn.length) senses[0].syn = syn
  if (ant.length) senses[0].ant = ant
  if (e.related.length)
    senses[0].see = [...new Set([...(senses[0].see ?? []), ...e.related])].slice(0, 8)

  const x: Record<string, unknown> = {}
  if (e.pos === 'verb') {
    const p = aspectPartners(e)
    if (p.length) x.aspect = p
  }
  // 重音类型（扎利兹尼亚克的 a–f）放 x.stress；重音会移动的另在 cls 里标 mobile-stress（界面显示成标签）
  const st = stressInfo(e)
  if (st.stress) x.stress = st.stress
  if (st.zal) x.zal = st.zal

  const cls = classesOf(e)
  if (st.mobile) cls.push('mobile-stress')
  const src = ['wiktionary']
  if (e.orOnly) src[0] = 'openrussian'
  else if (e.or) src.push('openrussian')
  for (const s of senses) if (s.zs && !src.includes(s.zs)) src.push(s.zs)
  if (e.audio.length) src.push('commons')

  const data: LexEntryData = {
    w: e.w,
    ...(e.d && { d: e.d }),
    p: [e.pos],
    // 只有复数的名词（ножницы、деньги）不标性
    ...(e.g && !cls.includes('plural-only') && { g: e.g }),
    ...(e.ipa.length && { ipa: e.ipa }),
    rom: romanize(e.d ?? e.w),
    ...(e.audio.length && { au: e.audio }),
    s: senses,
    ...(cells.length && { f: cells }),
    ...(cls.length && { cls }),
    ...(e.level && { lv: { torfl: e.level } }),
    ...(e.fr && { fr: e.fr }),
    ...(Object.keys(x).length && { x }),
    src
  }
  entryIds[i] = db.entry(data)
}
log(
  `词条写完：${entries.length - dropped}（没有词频证据、不收的 ${dropped}），有中文的 ${withZh}（用到中文维基词典的 ${zhFromZhw}，用到俄文维基词典译文表的 ${zhFromRu}）`
)

// Tatoeba 例句挂到词条上：选它的词条，再加句中其他例句还不到 8 句的词
const linkCount = new Map<number, number>()
for (const c of [...chosen.values()].sort((a, b) => a.quality - b.quality)) {
  const lv = LEVELS[Math.min(c.hard, LEVELS.length - 1)] ?? null
  const id = db.example({
    text: c.text,
    zh: c.zh ?? null,
    zs: c.zh ? 'tatoeba' : null,
    en: c.en ?? null,
    src: 'tatoeba',
    lv: c.hard < 6 ? lv : null
  })
  for (const i of c.words) {
    const entryId = entryIds[i]
    if (entryId === undefined) continue
    const mine = picks.get(i)?.includes(c)
    const k = linkCount.get(i) ?? 0
    if (mine || k < 8) {
      db.link(id, entryId)
      linkCount.set(i, k + 1)
    }
  }
}

// 主题词本
for (const [i, e] of entries.entries()) {
  const entryId = entryIds[i]
  if (entryId !== undefined) for (const th of e.themes) db.list(`theme:${th}`, entryId, e.fr)
}
db.meta(
  'themes',
  basic.themes.map((t) => ({ id: t.id, title: t.title }))
)
db.meta('levelCutoffs', Object.fromEntries(TORFL_CUTOFFS))

const stats = db.finish()
log(
  `写好 ${stats.file}：${(stats.bytes / 1048576).toFixed(1)} MB，词条 ${stats.entries}，查词键 ${stats.forms}，例句 ${stats.examples}（维基词典 ${wiktExamples}）`
)
log(`各级：${LEVELS.map((l) => `${l} ${stats.lists[`torfl:${l}`] ?? 0}`).join('，')}`)

// ───────────────────────── 要补中文的常用词 ─────────────────────────

const todo: string[] = []
for (const i of ranked) {
  const e = entries[i]
  if (e.pos === 'propn' || e.pos === 'affix' || e.pos === 'symbol') continue
  if (entryIds[i] === undefined || hasZh.has(i)) continue
  const en = e.senses
    .flatMap((s) => s.en)
    .slice(0, 3)
    .map((g) => (g.length > 120 ? g.slice(0, 117) + '…' : g))
    .join('; ')
    .replace(/\t|\n/g, ' ')
  todo.push(`${e.d ?? e.w}\t${e.pos}\t${en}`)
  if (todo.length >= 8000) break
}
mkdirSync(join(ROOT, 'data/ru'), { recursive: true })
writeFileSync(
  join(ROOT, 'data/ru/zh-todo.txt'),
  '# 俄语：还没有中文释义的常用词（按词频，前 8000 个）。每行：词头（带重音）\t词性\t英文释义\n' +
    todo.join('\n') +
    '\n'
)
log(`zh-todo.txt：${todo.length} 个`)
