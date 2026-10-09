/**
 * 生成英语词典库 resources/data/en/dict.sqlite（不入库）：
 *   node scripts/data/run-ts.mjs scripts/data/en/build.ts
 *
 * 词条：ECDICT（英汉双解，MIT）里有词频名次、考试标签、柯林斯星级、牛津标记，或者在 CEFR-J / Octanove /
 * NGSL 词表里的单词；词组按它们在 Tatoeba 母语者句子里出现的次数挑。变形来自 ECDICT 的 exchange、
 * 变形词条与 lemma 表；英式 IPA 来自 Britfone（后备 ECDICT 音标），美式来自 ipa-dict；分级见 spec.ts；
 * 例句是 Tatoeba 的英语句子（有中文翻译的优先）。粗俗、冒犯的义项与词条按标记由程序挡掉。
 * 下载的原始文件在 .cache/data/en/；有 kaikki-en.jsonl.gz（英语维基词典）时另外补 IPA 与录音地址。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { LexDbWriter, ROOT, cacheDir, dataDir, download } from '../../lang/lexdb-writer'
import type {
  AudioRef,
  CefrLevel,
  LexEntryData,
  LexSense,
  PosTag
} from '../../../src/shared/lang/types'
import { CEFR_LEVELS } from '../../../src/shared/lang/types'
import {
  PRONOUN_HOSTS,
  expandContraction,
  key,
  splitContraction
} from '../../../src/shared/lang/en/rules'
import * as SRC from '../../../src/shared/lang/en/sources'
import {
  SUBORDINATORS,
  parseDefinitions,
  parseExchange,
  parseTranslation,
  rankOf,
  readEcdict,
  typeTags,
  type EcdictRow,
  type TransLine
} from './ecdict'
import {
  britfoneStressed,
  britfoneToIpa,
  ecdictPhonetic,
  splitIpaDict,
  usStressed,
  usStyle
} from './ipa'
import {
  THEMES,
  frequencyCuts,
  levelByRank,
  levelIndex,
  loadCefrj,
  loadNgslList,
  loadOctanove,
  type ProfileItem
} from './levels'
import { POSSESSIVES, PhraseCounter, REFLEXIVES, phrasePattern } from './phrases'
import { loadSentences, qualityOrder, sentenceTokens, type Sentence } from './tatoeba'
import { WIKT_POS, loadKaikki, type KaikkiWord } from './kaikki'

const t0 = Date.now()
const log = (m: string): void => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`)

// ───────────────────────── 原始数据 ─────────────────────────

const RAW = 'https://raw.githubusercontent.com'
const TATO = 'https://downloads.tatoeba.org/exports/per_language'
const NGSL_URL = 'https://www.newgeneralservicelist.com/s'
const FILES: Record<string, [string, string]> = {
  ecdict: [`${RAW}/skywind3000/ECDICT/master/ecdict.csv`, 'ecdict.csv'],
  lemma: [`${RAW}/skywind3000/ECDICT/master/lemma.en.txt`, 'ecdict-lemma.en.txt'],
  cefrj: ['http://www.cefr-j.org/data/CEFRJ_wordlist_ver1.6.zip', 'CEFRJ_wordlist_ver1.6.zip'],
  octanove: [
    `${RAW}/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv`,
    'octanove-vocabulary-profile-c1c2-1.0.csv'
  ],
  ngsl: [
    `${NGSL_URL}/NGSL_12_lemmatized_for_teaching.csv`,
    'ngsl-NGSL_12_lemmatized_for_teaching.csv'
  ],
  ngslS: [
    `${NGSL_URL}/NGSL-Spoken_12_lemmatized_for_teaching.csv`,
    'ngsl-NGSL-Spoken_12_lemmatized_for_teaching.csv'
  ],
  nawl: [
    `${NGSL_URL}/NAWL_12_lemmatized_for_teaching.csv`,
    'ngsl-NAWL_12_lemmatized_for_teaching.csv'
  ],
  tsl: [
    `${NGSL_URL}/TSL_12_lemmatized_for_teaching.csv`,
    'ngsl-TSL_12_lemmatized_for_teaching.csv'
  ],
  bsl: [
    `${NGSL_URL}/BSL_120_lemmatized_for_teaching.csv`,
    'ngsl-BSL_120_lemmatized_for_teaching.csv'
  ],
  ndl: [
    `${NGSL_URL}/NDL_11_lemmatized_for_teaching.txt`,
    'ngsl-NDL_11_lemmatized_for_teaching.txt'
  ],
  ipaUs: [`${RAW}/open-dict-data/ipa-dict/master/data/en_US.txt`, 'ipa-dict-en_US.txt'],
  britfone: [
    `${RAW}/JoseLlarena/Britfone/master/britfone.main.3.0.1.csv`,
    'britfone.main.3.0.1.csv'
  ],
  sentences: [
    `${TATO}/eng/eng_sentences_detailed.tsv.bz2`,
    'tatoeba-eng_sentences_detailed.tsv.bz2'
  ],
  userLanguages: [`${TATO}/eng/eng_user_languages.tsv.bz2`, 'tatoeba-eng_user_languages.tsv.bz2'],
  tags: [`${TATO}/eng/eng_tags.tsv.bz2`, 'tatoeba-eng_tags.tsv.bz2'],
  links: [`${TATO}/eng/eng-cmn_links.tsv.bz2`, 'tatoeba-eng-cmn_links.tsv.bz2'],
  cmn: [`${TATO}/cmn/cmn_sentences.tsv.bz2`, 'tatoeba-cmn_sentences.tsv.bz2'],
  cmnTranscriptions: [
    `${TATO}/cmn/cmn_transcriptions.tsv.bz2`,
    'tatoeba-cmn_transcriptions.tsv.bz2'
  ]
}

const path: Record<string, string> = {}
for (const [k, [url, file]] of Object.entries(FILES)) {
  try {
    path[k] = await download('en', url, file)
  } catch (e) {
    console.error(
      `下载失败：${url}\n  可以手动下载（curl -L -C - --retry 5 -o .cache/data/en/${file} "${url}"）再重跑`
    )
    throw e
  }
}
const kaikkiFile = join(cacheDir('en'), 'kaikki-en.jsonl.gz')

// ───────────────────────── ECDICT ─────────────────────────

const rows = readEcdict(readFileSync(path.ecdict, 'utf8'))
log(`ECDICT：${rows.length} 行`)
const byWord = new Map<string, EcdictRow>()
const byLower = new Map<string, EcdictRow[]>()
for (const r of rows) {
  byWord.set(r.word, r)
  const k = r.word.toLowerCase()
  byLower.set(k, [...(byLower.get(k) ?? []), r])
}
const isMulti = (w: string): boolean => /\s/.test(w)

/** 变形 → 原形：ECDICT 的变形词条（0: / 1:）、释义里的「go的过去式」、lemma 表的规则变形 */
const reverse = new Map<string, Map<string, string[][]>>() // 原形 → 变形 → 几组标签
function addReverse(lemma: string, form: string, tags: string[]): void {
  if (!lemma || !form || lemma === form || /\s/.test(form)) return
  const m = reverse.get(lemma) ?? new Map<string, string[][]>()
  const list = m.get(form) ?? []
  if (!list.some((t) => t.join(' ') === tags.join(' '))) list.push(tags)
  m.set(form, list)
  reverse.set(lemma, m)
}
for (const r of rows) {
  if (isMulti(r.word)) continue
  const ex = parseExchange(r.exchange)
  if (ex.lemma && ex.types)
    for (const tags of typeTags(ex.types)) addReverse(ex.lemma, r.word, tags)
  if (r.translation.includes('的'))
    for (const line of parseTranslation(r.translation))
      for (const n of line.notes)
        // 变形的变形（beens、hads）抄了原词的释义，「be的过去分词」不是说它的
        if (!ex.lemma || ex.lemma.toLowerCase() === n.lemma.toLowerCase())
          addReverse(n.lemma, r.word, n.tags)
}
/** lemma 表：只收看得出是规则变化的词形（标签按词尾推），不规则的 ECDICT 已经有了 */
function regularTags(lemma: string, form: string): string[][] | null {
  const l = lemma.toLowerCase()
  const f = form.toLowerCase()
  const stems = [l, l.replace(/e$/, ''), l.replace(/y$/, 'i'), l + l.slice(-1)]
  const ends = (suffix: string): boolean => stems.some((s) => s + suffix === f)
  if (ends('s') || ends('es')) return [['plural'], ['third-person', 'singular', 'present']]
  if (ends('ed') || ends('d')) return [['past'], ['past', 'participle']]
  if (ends('ing') || (l.endsWith('ie') && f === l.slice(0, -2) + 'ying'))
    return [['present', 'participle']]
  if (ends('er') || ends('r')) return [['comparative']]
  if (ends('est') || ends('st')) return [['superlative']]
  return null
}
for (const line of readFileSync(path.lemma, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^;/\s][^/]*)\/\d+\s*->\s*(.+)$/)
  if (!m) continue
  const lemma = m[1].trim()
  for (const form of m[2].split(',').map((s) => s.trim())) {
    if (!/^[a-z]+$/i.test(form) || form.length < 2) continue
    const tags = regularTags(lemma, form)
    if (tags) for (const t of tags) addReverse(lemma, form, t)
  }
}
// be 的 am：ECDICT 没有这个变形
addReverse('be', 'am', ['first-person', 'singular', 'present'])
log(`变形：${reverse.size} 个原形`)

// ───────────────────────── 分级词表 ─────────────────────────

const profiles = [...loadCefrj(path.cefrj), ...loadOctanove(path.octanove)]
const profExact = new Map<string, ProfileItem[]>()
const profLower = new Map<string, ProfileItem[]>()
for (const p of profiles) {
  profExact.set(p.w, [...(profExact.get(p.w) ?? []), p])
  const k = p.w.toLowerCase()
  profLower.set(k, [...(profLower.get(k) ?? []), p])
}
log(`CEFR-J + Octanove：${profiles.length} 项`)
const NGSL_LISTS: [string, string][] = [
  ['ndl', path.ndl],
  ['ngsl-s', path.ngslS],
  ['ngsl', path.ngsl],
  ['tsl', path.tsl],
  ['bsl', path.bsl],
  ['nawl', path.nawl]
]
const ngslOf = new Map<string, string[]>()
for (const [id, file] of NGSL_LISTS)
  for (const w of loadNgslList(file)) {
    const k = w.toLowerCase()
    const list = ngslOf.get(k) ?? []
    if (!list.includes(id)) list.push(id)
    ngslOf.set(k, list)
  }
log(`NGSL 系列：${ngslOf.size} 个词`)

/** 一个词条在 CEFR-J / Octanove 里的项：先按原样大小写找，没有再不分大小写 */
const profileOf = (w: string): ProfileItem[] =>
  profExact.get(w) ??
  (w === w.toLowerCase() || /^[A-Z][a-z]/.test(w) ? (profLower.get(w.toLowerCase()) ?? []) : [])

// ───────────────────────── 读音 ─────────────────────────

const ukIpa = new Map<string, { strong: string[]; weak: string[] }>()
for (const line of readFileSync(path.britfone, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^,]+),\s*(.+)$/)
  if (!m) continue
  const word = m[1]
    .replace(/\(\d\)$/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
  const cur = ukIpa.get(word) ?? { strong: [], weak: [] }
  const ipa = britfoneToIpa(m[2])
  const list = britfoneStressed(m[2]) ? cur.strong : cur.weak
  if (!list.includes(ipa)) list.push(ipa)
  ukIpa.set(word, cur)
}
const usIpa = new Map<string, { strong: string[]; weak: string[] }>()
for (const line of readFileSync(path.ipaUs, 'utf8').split(/\r?\n/)) {
  const [word, ipas] = line.split('\t')
  if (!word || !ipas) continue
  const cur = { strong: [] as string[], weak: [] as string[] }
  for (const raw of splitIpaDict(ipas)) {
    const ipa = usStyle(raw)
    const list = usStressed(raw) ? cur.strong : cur.weak
    if (!list.includes(ipa)) list.push(ipa)
  }
  usIpa.set(word.toLowerCase(), cur)
}
log(`IPA：英式 ${ukIpa.size}、美式 ${usIpa.size}`)

// Tatoeba 的句子先读进来：例句、数词组用，句子里出现过的词形也拿来核对变形表
const { sentences: rawSentences, stats: sstats } = loadSentences({
  sentences: path.sentences,
  userLanguages: path.userLanguages,
  tags: path.tags,
  links: path.links,
  cmn: path.cmn,
  cmnTranscriptions: path.cmnTranscriptions
})
log(
  `Tatoeba：英语 ${sstats.total} 句，母语者 ${sstats.native}，挡掉（标签）${sstats.badTag}，长度不合 ${sstats.length}，可用 ${sstats.kept}（有中文 ${sstats.withZh}）`
)
const attested = new Set<string>()
for (const s of rawSentences) for (const t of sentenceTokens(s.text)) attested.add(key(t))

// ───────────────────────── 挑单词 ─────────────────────────

/** 词条的义项：中文按行，同词性的英文释义挂上去 */
interface Built {
  row: EcdictRow
  w: string
  p: PosTag[]
  s: LexSense[]
  /** 这一条本身也是别的词的变形（children → child） */
  of: string[]
  rank: number
  blocked: boolean
  usedWordnet: boolean
}

const FUNCTION_POS = new Set<PosTag>(['det', 'pron', 'adp', 'cconj', 'sconj', 'aux', 'part'])

/** 短词、全大写词的 WordNet 释义里混着同形缩写的意思（me = Maine、OK = Oklahoma、Am = 镅） */
const ABBR_GLOSS =
  /^(?:a |an |the )?(?:state|city|town|island|river|province|county|country|port|capital)\b.*\b(?:in|of)\b|letter of the (?:roman|greek|hebrew) alphabet|(?:chemical|metallic|radioactive) element|\b(?:abbreviation|acronym)\b/i

function buildSenses(
  row: EcdictRow,
  opts: { phrase: boolean; proper: boolean; common?: boolean }
): Built {
  const lines = parseTranslation(row.translation)
  const defs = parseDefinitions(row.definition)
  const of: string[] = []
  for (const l of lines) for (const n of l.notes) if (!of.includes(n.lemma)) of.push(n.lemma)
  const ex = parseExchange(row.exchange)
  if (ex.lemma && !of.includes(ex.lemma)) of.unshift(ex.lemma)
  const general = lines.filter(
    (l) => !l.web && !l.domain && (!l.name || opts.proper) && l.items.length
  )
  const domain = lines.filter((l) => !l.web && l.domain && l.items.length)
  const web = lines.filter((l) => l.web && l.items.length)
  // 常用词有一般的释义时，不再列专业领域的（I 的「[计] 中断」、my 的「[医] 迈尔」）
  const use: TransLine[] = [
    ...general,
    ...(general.length && opts.common ? [] : domain.slice(0, general.length ? 2 : 3))
  ]
  if (!general.length && !domain.length) use.push(...web.slice(0, 1))
  // 第一行（主要的意思）是粗俗、冒犯的：整条不收
  const firstReal = lines.find((l) => !l.web && !l.domain && (l.items.length || l.allFlagged))
  const blocked = !!firstReal?.allFlagged || (lines.length > 0 && lines.every((l) => l.allFlagged))
  const senses: LexSense[] = []
  const posOf = (l: TransLine): PosTag[] => {
    if (opts.phrase && !l.pos.length) return []
    return l.pos.map((p) =>
      p === 'cconj' && SUBORDINATORS.has(row.word.toLowerCase()) ? 'sconj' : p
    )
  }
  const lineSense = new Map<PosTag, LexSense>()
  for (const l of use) {
    // 太长的一条多半是网上抄来的解说（「你懂的（网络热词……）」），有别的条目时不要
    const short = l.items.filter((x) => x.length <= 40)
    const s: LexSense = { zh: (short.length ? short : l.items).slice(0, 10), zs: 'ecdict' }
    const ps = posOf(l)
    if (ps.length) s.p = ps
    if (l.labels.length) s.t = [...new Set(l.labels)]
    if (l.domain) s.dom = [l.domain]
    if (l.name) s.p = ['propn']
    senses.push(s)
    for (const p of ps) if (!l.domain && !lineSense.has(p)) lineSense.set(p, s)
  }
  // 英文释义：挂到同词性的第一个义项上；没有中文时自己成义项
  let usedWordnet = false
  const byPos = new Map<PosTag | null, string[]>()
  const shortWord = row.word.length <= 3 || /^[A-Z.]+$/.test(row.word)
  for (const d of defs) {
    if (d.flagged || (shortWord && ABBR_GLOSS.test(d.gloss))) continue
    const list = byPos.get(d.pos) ?? []
    if (list.length < 4) list.push(d.gloss)
    byPos.set(d.pos, list)
  }
  if (senses.length) {
    for (const [p, glosses] of byPos) {
      const s = p ? lineSense.get(p) : senses.length === 1 ? senses[0] : undefined
      if (s && !s.en) {
        s.en = glosses
        usedWordnet = true
      }
    }
  } else {
    for (const [p, glosses] of byPos) {
      senses.push(p ? { p: [p], en: glosses } : { en: glosses })
      usedWordnet = true
    }
  }
  // 词条的词性：义项的词性按顺序；都没有时按 CEFR-J、英文释义推
  const p: PosTag[] = []
  for (const s of senses) for (const x of s.p ?? []) if (!p.includes(x)) p.push(x)
  if (!p.length) {
    for (const it of profileOf(row.word)) if (it.pos && !p.includes(it.pos)) p.push(it.pos)
    for (const d of defs) if (d.pos && !p.includes(d.pos)) p.push(d.pos)
  }
  if (!p.length) p.push(opts.phrase ? 'phrase' : /^[A-Z.]+$/.test(row.word) ? 'abbr' : 'other')
  // 只有一种词性时义项上不再重复写
  if (p.length === 1) for (const s of senses) if (s.p?.length === 1 && s.p[0] === p[0]) delete s.p
  return { row, w: row.word, p, s: senses, of, rank: rankOf(row), blocked, usedWordnet }
}

/** 中文释义里的汉字（去掉「的」「了」这类虚字） */
const STOP_HAN = new Set([...'的地得了着过们之等某'])
const hanOf = (items: string[]): Set<string> =>
  new Set(
    items
      .join('')
      .match(/\p{Script=Han}/gu)
      ?.filter((c) => !STOP_HAN.has(c)) ?? []
  )
/** 变形词条的中文意思跟原形差不多（一半以上的汉字原形里也有） */
function sameMeaning(b: Built, lemma: string): boolean {
  const mine = hanOf(b.s.flatMap((s) => (s.dom ? [] : (s.zh ?? []))))
  if (!mine.size) return true
  const row = byWord.get(lemma) ?? byLower.get(lemma.toLowerCase())?.[0]
  if (!row) return false
  const base = hanOf(parseTranslation(row.translation).flatMap((l) => (l.domain ? [] : l.items)))
  let common = 0
  for (const c of mine) if (base.has(c)) common++
  return common / mine.size >= 0.5
}

const WORD = /^[\p{L}][\p{L}.'’-]*$/u
const entries: Built[] = []
let blockedCount = 0
let pureForms = 0
for (const r of rows) {
  if (isMulti(r.word) || !WORD.test(r.word) || r.word.length > 30) continue
  const listed =
    profileOf(r.word).length > 0 || (r.word === r.word.toLowerCase() && ngslOf.has(r.word))
  const tagged = r.tags.length > 0
  const starred = r.collins > 0 || r.oxford
  const rank = rankOf(r)
  if (!listed && !tagged && !starred && !rank) continue
  const proper = /^[A-Z]/.test(r.word)
  // 大写开头的：专名只收常用的
  if (proper && !listed && !tagged && !starred && rank > 15000) continue
  const common = listed || (rank > 0 && rank <= 10000)
  const b = buildSenses(r, { phrase: false, proper, common })
  if (b.blocked) {
    blockedCount++
    continue
  }
  if (!b.s.length) {
    pureForms++
    continue
  }
  // 只是别的词的变形、意思跟原形一样的（trees「树木」、children「孩子们」、faster「更快」）不单列：
  // 查 trees 时由原形的变形表带到 tree。意思不一样的（found「建立」、left「左边的」、glasses「眼镜」）留着
  const ex = parseExchange(r.exchange)
  if (ex.lemma && !listed && sameMeaning(b, ex.lemma)) {
    pureForms++
    continue
  }
  // 人名、地名之类只有专名义项的：不常用就不收
  if (proper && !listed && !tagged && b.p.length === 1 && b.p[0] === 'propn' && rank > 8000)
    continue
  entries.push(b)
}
log(`单词：${entries.length} 条（挡掉粗俗冒犯 ${blockedCount} 条，只是变形 ${pureForms} 条）`)
const blockedWords = new Set<string>()
for (const r of rows) {
  if (isMulti(r.word)) continue
  if (buildSenses(r, { phrase: false, proper: false }).blocked)
    blockedWords.add(r.word.toLowerCase())
}

// 维基词典（可选）：补读音、录音与英文释义（单词与词组候选都要）；
// 主要意思带粗俗、冒犯标签的词，不在分级与考试词表里的也挡掉
const kaikki: Map<string, KaikkiWord> = existsSync(kaikkiFile)
  ? await loadKaikki(
      kaikkiFile,
      new Set([
        ...entries.map((b) => b.w.toLowerCase()),
        ...rows.filter((r) => isMulti(r.word) && r.translation).map((r) => r.word.toLowerCase())
      ]),
      log
    )
  : new Map()
{
  let n = 0
  for (let i = entries.length - 1; i >= 0; i--) {
    const b = entries[i]
    const k = b.w.toLowerCase()
    if (!kaikki.get(k)?.flagged) continue
    blockedWords.add(k)
    if (profileOf(b.w).length || b.row.tags.length || ngslOf.has(k)) continue
    entries.splice(i, 1)
    n++
  }
  if (kaikki.size) log(`维基词典标为粗俗、冒犯而挡掉：${n} 条`)
}

// ───────────────────────── 变形表 ─────────────────────────

/** 这种标签的变形，这个词性的词才有（I 没有复数，London 没有第三人称单数） */
function posAllows(p: PosTag[], tags: string[]): boolean {
  if (tags.includes('plural')) return p.some((x) => ['noun', 'propn', 'abbr', 'num'].includes(x))
  if (tags.includes('comparative') || tags.includes('superlative'))
    return p.some((x) => ['adj', 'adv', 'det'].includes(x))
  return p.some((x) => x === 'verb' || x === 'aux')
}
/** ECDICT 里有词频的词形 */
const rankedForm = (f: string): boolean => {
  const r = byWord.get(f) ?? byLower.get(f.toLowerCase())?.[0]
  return !!r && rankOf(r) > 0
}
const formsOf = new Map<Built, [string, ...string[]][]>()
let droppedForms = 0
for (const b of entries) {
  const out: [string, ...string[]][] = []
  const seen = new Set<string>()
  /** trusted：词条自己的 exchange；别处推来的（变形词条、释义里的说明、lemma 表）要在句子或词频表里见过 */
  const add = (form: string, tags: string[], trusted: boolean): void => {
    if (!form || form === b.w || !posAllows(b.p, tags)) return
    if (/[\s-]/.test(form) && !/[\s-]/.test(b.w)) return
    // 词形跟标签对不上的（hangs 标成过去式、walked 标成复数）
    const lw = b.w.toLowerCase()
    const lf = form.toLowerCase()
    const plainS = lf === lw + 's' || lf === lw + 'es'
    if (tags.includes('past') && plainS) return
    if (tags.includes('present') && tags.includes('participle') && !/(?:ing|in')$/.test(lf)) return
    if ((tags.includes('plural') || tags.includes('third-person')) && /(?:ed|ing)$/.test(lf))
      if (!lw.endsWith('ed') && !lw.endsWith('ing')) return
    const low = key(form)
    if (!trusted && !attested.has(low) && !rankedForm(form) && !ukIpa.has(low)) {
      droppedForms++
      return
    }
    const k = `${form}|${tags.join(' ')}`
    if (seen.has(k)) return
    seen.add(k)
    out.push([form, ...tags])
  }
  const ex = parseExchange(b.row.exchange)
  const proper = /^[A-Z]/.test(b.w)
  // 大写的词（Monday）：变形也大写
  const cased = (f: string): string => (proper ? f[0].toUpperCase() + f.slice(1) : f)
  // 本身就是变形的词条（found、better、children）：自己的 exchange 常混着原形的变形，不用
  if (!ex.lemma)
    for (const [form, t] of ex.forms) for (const tags of typeTags(t)) add(cased(form), tags, true)
  // 专名、缩写不用推来的变形（London 没有 londons）
  if (!proper)
    for (const [form, tagsList] of reverse.get(b.w) ?? [])
      for (const tags of tagsList) add(form, tags, false)
  formsOf.set(b, out)
}
log(`变形表：去掉没有印证的词形 ${droppedForms} 个`)

// ───────────────────────── 读音（每条） ─────────────────────────

function pronunciation(
  b: Built
): Pick<LexEntryData, 'ipa' | 'au'> & { x: Record<string, unknown> } {
  const k = b.w.toLowerCase()
  const kk = kaikki.get(k)
  const uk = ukIpa.get(k)
  const us = usIpa.get(k)
  let ukStrong = uk?.strong.length ? uk.strong : (uk?.weak ?? [])
  if (!ukStrong.length && kk?.uk.length) ukStrong = kk.uk
  if (!ukStrong.length) {
    const p = ecdictPhonetic(b.row.phonetic)
    if (p) ukStrong = [p]
  }
  let usStrong = us?.strong.length ? us.strong : (us?.weak ?? [])
  if (!usStrong.length && kk?.us.length) usStrong = kk.us
  // cmudict 给 the 的重读式是 AH1（/ðʌ/），实际重读时是 /ðiː/
  if (k === 'the') usStrong = ['/ðiː/']
  const x: Record<string, unknown> = {}
  if (ukStrong.length) x.ipaUk = ukStrong.slice(0, 2)
  if (usStrong.length) x.ipaUs = usStrong.slice(0, 2)
  const functional = b.p.some((p) => FUNCTION_POS.has(p)) || ['be', 'have', 'do'].includes(k)
  if (functional) {
    const weak = [
      ...(uk?.strong.length ? uk.weak : []),
      ...(us?.strong.length ? us.weak : [])
    ].filter((w, i, a) => a.indexOf(w) === i)
    if (weak.length) x.weak = weak.slice(0, 4)
  }
  const ipa = [...ukStrong.slice(0, 2), ...usStrong.slice(0, 2)].filter(
    (w, i, a) => a.indexOf(w) === i
  )
  const au: AudioRef[] = (kk?.audio ?? []).slice(0, 3)
  return { ...(ipa.length ? { ipa } : {}), ...(au.length ? { au } : {}), x }
}

// ───────────────────────── 分级 ─────────────────────────

const cefrPosOf = new Map<Built, Map<string, CefrLevel>>()
const ranked: { rank: number; level: CefrLevel }[] = []
const POS_SHORT: Partial<Record<PosTag, string>> = {
  noun: 'n.',
  verb: 'v.',
  adj: 'adj.',
  adv: 'adv.',
  adp: 'prep.',
  cconj: 'conj.',
  pron: 'pron.',
  det: 'det.',
  num: 'num.',
  intj: 'int.',
  aux: 'aux.',
  part: 'part.'
}
/** 一个词在 CEFR-J / Octanove 里各词性的等级：CEFR-J 为准，Octanove 只补 CEFR-J 没给的词性 */
function profileLevels(w: string): Map<string, CefrLevel> {
  const m = new Map<string, CefrLevel>()
  const fromCefrj = new Set<string>()
  for (const it of profileOf(w)) {
    const pos = it.pos ? (POS_SHORT[it.pos] ?? it.pos) : '?'
    const cur = m.get(pos)
    if (it.src === 'cefrj') {
      if (!fromCefrj.has(pos) || levelIndex(it.level) < levelIndex(cur!)) m.set(pos, it.level)
      fromCefrj.add(pos)
    } else if (!fromCefrj.has(pos) && (!cur || levelIndex(it.level) < levelIndex(cur)))
      m.set(pos, it.level)
  }
  return m
}

/** CEFR-J 里并列的另一种拼写（color → colour）；缩写、带点的不算 */
function spellingVariants(w: string): string[] {
  const out = new Set<string>()
  for (const it of profileOf(w))
    for (const v of it.group) {
      if (v.toLowerCase() === w.toLowerCase() || /[.\s]/.test(v) || v.length < 3) continue
      if (Math.abs(v.length - w.length) > 3 || v[0].toLowerCase() !== w[0].toLowerCase()) continue
      out.add(v)
    }
  return [...out]
}
const easiest = (m: Map<string, CefrLevel>): CefrLevel | undefined =>
  [...m.values()].sort((a, b) => levelIndex(a) - levelIndex(b))[0]
for (const b of entries) {
  const m = profileLevels(b.w)
  cefrPosOf.set(b, m)
  const l = easiest(m)
  if (l && b.rank) ranked.push({ rank: b.rank, level: l })
}
const cuts = frequencyCuts(ranked)
log(`词频补级的切点（名次）：${cuts.map((c, i) => `${CEFR_LEVELS[i]} ≤ ${c}`).join('，')}`)
const EXAM_CEFR: Record<string, CefrLevel> = {
  zk: 'A2',
  gk: 'B1',
  cet4: 'B1',
  cet6: 'B2',
  ky: 'B2',
  ielts: 'B2',
  toefl: 'C1',
  gre: 'C2'
}
const EXAMS = new Set(Object.keys(EXAM_CEFR))
const levelOf = new Map<Built, CefrLevel>()
const levelBy = { list: 0, lemma: 0, freq: 0, exam: 0, none: 0 }
const byHead = new Map<string, Built>()
for (const b of entries) if (!byHead.has(b.w)) byHead.set(b.w, b)
for (const b of entries) {
  const l = easiest(cefrPosOf.get(b)!)
  // 本身是别的词的变形（children、unlisted 的比较级）：跟原形同级
  const lemma = b.of.map((o) => byHead.get(o) ?? byHead.get(o.toLowerCase())).find(Boolean)
  const lemmaLevel = lemma ? easiest(profileLevels(lemma.w)) : undefined
  if (l) {
    levelOf.set(b, l)
    levelBy.list++
  } else if (lemmaLevel) {
    levelOf.set(b, lemmaLevel)
    levelBy.lemma++
  } else if (b.rank && !/^[A-Z]/.test(b.w)) {
    // 专名、缩写不按词频补级（London 不是 A1 的词汇）
    levelOf.set(b, levelByRank(b.rank, cuts))
    levelBy.freq++
  } else {
    const ex = b.row.tags
      .filter((t) => EXAMS.has(t))
      .map((t) => EXAM_CEFR[t])
      .sort((a, c) => levelIndex(a) - levelIndex(c))[0]
    if (ex) {
      levelOf.set(b, ex)
      levelBy.exam++
    } else levelBy.none++
  }
}
log(
  `CEFR：词表 ${levelBy.list}，随原形 ${levelBy.lemma}，按词频 ${levelBy.freq}，按考试标签 ${levelBy.exam}，没有 ${levelBy.none}`
)

// ───────────────────────── 句子与词组 ─────────────────────────

/** 词形（查词键）→ 最常用的那个词条：阅读句子、挂例句、数词组都用 */
const tokenEntry = new Map<string, Built>()
const better = (a: Built | undefined, b: Built): boolean => !a || (b.rank || 1e9) < (a.rank || 1e9)
for (const b of entries) {
  const k = key(b.w)
  if (better(tokenEntry.get(k), b)) tokenEntry.set(k, b)
}
for (const b of entries)
  for (const [form] of formsOf.get(b)!) {
    const k = key(form)
    const cur = tokenEntry.get(k)
    // 词头本身是一个词条时，只有原形更常用才让给原形（saw → see，found → find）
    if (better(cur, b)) tokenEntry.set(k, b)
  }
const lemmaOf = (w: string): string[] => {
  const k = key(w)
  const c = splitContraction(k)
  if (c && !c.possessive && !tokenEntry.has(k)) return [c.hostLemma, ...c.cliticLemmas.slice(0, 1)]
  const b = tokenEntry.get(k)
  return [b ? key(b.w) : k]
}

// 含有挡掉的词的句子不用
const sentences = qualityOrder(
  rawSentences.filter((s) => !sentenceTokens(s.text).some((t) => blockedWords.has(key(t))))
)
log(`去掉含挡掉词条的句子后：${sentences.length} 句`)

// 词组候选：ECDICT 的多词词条，加上分级词表里的多词项
const phraseRows = new Map<string, EcdictRow>()
const patterns = new Map<string, ReturnType<typeof phrasePattern>>()
for (const r of rows) {
  if (!isMulti(r.word) || !r.translation.trim()) continue
  const lines = parseTranslation(r.translation)
  if (!lines.some((l) => l.items.length && !l.domain && !l.name)) continue
  if (/^(a|an|the|to)\s+\S+$/i.test(r.word)) continue
  const pat = phrasePattern(r.word, lemmaOf)
  if (!pat) continue
  // 同一个样子只要一条（释义长的那条）
  const prev = phraseRows.get(pat.key)
  if (prev && prev.translation.length >= r.translation.length) continue
  phraseRows.set(pat.key, r)
  patterns.set(pat.key, pat)
}
log(`词组候选：${phraseRows.size} 个`)
const counter = new PhraseCounter([...patterns.values()].filter((p) => !!p))

/** 例句：每个单词最多 6 句，词组 3 句；按句子的先后挑，有中文的在前 */
const EX_PER_WORD = 6
const quota = new Map<Built, number[]>()
for (let i = 0; i < sentences.length; i++) {
  const s = sentences[i]
  const toks = sentenceTokens(s.text)
  const lemmas: string[] = []
  const slots: (string | null)[] = []
  const linked = new Set<Built>()
  for (const t of toks) {
    const k = key(t)
    const parts = lemmaOf(t)
    for (const p of parts) {
      lemmas.push(p)
      slots.push(POSSESSIVES.has(k) ? '<poss>' : REFLEXIVES.has(k) ? '<refl>' : null)
    }
    let b = tokenEntry.get(k)
    if (!b) {
      const c = splitContraction(k)
      if (c) b = tokenEntry.get(key(c.hostLemma))
    }
    if (b) linked.add(b)
  }
  counter.add(i, lemmas, slots)
  for (const b of linked) {
    const q = quota.get(b) ?? []
    if (q.length < EX_PER_WORD) {
      q.push(i)
      quota.set(b, q)
    }
  }
}
log(`数完词组：${counter.counts.size} 个在句子里出现过`)

// 挑词组：出现 3 次以上，或者在分级词表里。不收逐字组合出来的（I know、he is、tell me、has been）：
// 以人称代词开头或结尾的、助动词加一个虚词的，除非带 one's / sb 这类占位（lose one's temper）
const MIN_PHRASE = 3
const PERSONAL = new Set(
  'i you he she it we they me him her us them myself yourself himself herself'.split(' ')
)
const AUX_FIRST = new Set('be have do will would shall should can could may might must'.split(' '))
function compositional(pkey: string): boolean {
  if (/<(poss|refl|gap)>/.test(pkey)) return false
  const t = pkey.split(' ')
  if (PERSONAL.has(t[0]) || PERSONAL.has(t[t.length - 1])) return true
  return t.length === 2 && AUX_FIRST.has(t[0]) && !(t[1] === 'to' && t[0] !== 'be')
}
interface PhraseBuilt extends Built {
  count: number
  pkey: string
}
const phrases: PhraseBuilt[] = []
let chunks = 0
for (const [pkey, r] of phraseRows) {
  const count = counter.counts.get(pkey) ?? 0
  const listed = profileOf(r.word).length > 0
  if (count < MIN_PHRASE && !listed) continue
  if (!listed && compositional(pkey)) {
    chunks++
    continue
  }
  // 维基词典说主要意思是粗俗、冒犯的词组也不收
  if (!listed && kaikki.get(r.word.toLowerCase())?.flagged) continue
  const b = buildSenses(r, { phrase: true, proper: false, common: true })
  if (b.blocked || !b.s.length) continue
  if (r.word.split(/\s+/).some((w) => blockedWords.has(w.toLowerCase()))) continue
  phrases.push({ ...b, count, pkey })
}
phrases.sort((a, b) => b.count - a.count)
log(`词组：${phrases.length} 个（逐字组合的 ${chunks} 个不收）`)

// 词组的等级：只用分级词表（CEFR-J 里有 according to、ice cream 这类）。没列的词组不按组成词推：
// 推出来的大都是 A1、A2，会把 A2 词表撑到上万条（give up 的难处不在组成词）
for (const ph of phrases) {
  const m = profileLevels(ph.w)
  cefrPosOf.set(ph, m)
  const l = easiest(m)
  if (l) levelOf.set(ph, l)
}

// ───────────────────────── 缩约 ─────────────────────────

/** 常见缩约：ECDICT 有的补上完整形式；Tatoeba 里常见、ECDICT 没有的，按规则生成一条 */
const contractionCount = new Map<string, number>()
for (const s of sentences)
  for (const t of sentenceTokens(s.text)) {
    const k = key(t)
    if (k.includes("'") && expandContraction(k))
      contractionCount.set(k, (contractionCount.get(k) ?? 0) + 1)
  }
/** 缩约的词性：宿主词（助动词、代词、副词）+ 附着成分（n't 是小品词，其余是助动词；let's 的 's 是 us） */
const AUX_HOSTS = new Set(
  'be have do will would shall should can could may might must need dare ought'.split(' ')
)
const ADV_HOSTS = new Set(['there', 'here', 'where', 'when', 'how', 'why'])
const CONTRACTION_POS = (k: string): PosTag[] => {
  const c = splitContraction(k)
  if (!c) return ['other']
  if (c.hostLemma === 'let') return ['verb', 'pron']
  const host: PosTag = AUX_HOSTS.has(c.hostLemma)
    ? 'aux'
    : ADV_HOSTS.has(c.hostLemma)
      ? 'adv'
      : 'pron'
  const clitic: PosTag = c.clitic === "n't" || c.clitic === 'not' ? 'part' : 'aux'
  return host === clitic ? [host] : [host, clitic]
}
const generated: Built[] = []
for (const b of entries) {
  const exp = b.w.includes("'") ? expandContraction(b.w) : null
  if (exp) {
    b.p = CONTRACTION_POS(key(b.w))
    for (const s of b.s) delete s.p
  }
}
// 宿主词限于代词、助动词、疑问词这些（tom'll 这种人名加缩约不收）
const CONTRACTION_HOSTS = new Set([...PERSONAL, ...AUX_FIRST, ...PRONOUN_HOSTS, 'let', 'who'])
for (const [k, n] of contractionCount) {
  if (n < 20 || byLower.has(k)) continue
  const c = splitContraction(k)
  if (!c || c.possessive || !CONTRACTION_HOSTS.has(c.hostLemma)) continue
  const exp = expandContraction(k)!
  const w = k.startsWith("i'") ? 'I' + k.slice(1) : k
  generated.push({
    row: {
      word: w,
      phonetic: '',
      definition: '',
      translation: '',
      collins: 0,
      oxford: false,
      tags: [],
      bnc: 0,
      frq: 0,
      exchange: ''
    },
    w,
    p: CONTRACTION_POS(k),
    s: [{ en: [exp], zh: [`${exp} 的缩约`], zs: 'qonsona' }],
    of: [],
    rank: 0,
    blocked: false,
    usedWordnet: false
  })
}
log(`生成缩约词条：${generated.length} 条`)
// 缩约跟宿主词同级（won't 随 will、I'm 随 I）
for (const b of [...entries, ...generated]) {
  if (levelOf.has(b) || !b.w.includes("'")) continue
  const c = splitContraction(key(b.w))
  if (!c || c.possessive) continue
  const host = tokenEntry.get(key(c.hostLemma))
  const l = host ? levelOf.get(host) : undefined
  if (l) levelOf.set(b, l)
}

// ───────────────────────── 写库 ─────────────────────────

// 先写到 dict.next.sqlite，最后再换上 dict.sqlite（软件开着时 dict.sqlite 删不掉）
const finalFile = join(dataDir('en'), 'dict.sqlite')
const db = new LexDbWriter('en', { file: join(dataDir('en'), 'dict.next.sqlite') })
const sourcesUsed = [
  SRC.ECDICT,
  SRC.WORDNET,
  SRC.ECDICT_LEMMA,
  SRC.CEFRJ,
  SRC.OCTANOVE,
  SRC.NGSL,
  SRC.IPADICT,
  SRC.BRITFONE,
  SRC.TATOEBA,
  SRC.QONSONA,
  ...(kaikki.size ? [SRC.WIKTIONARY, SRC.COMMONS_AUDIO] : [])
]
for (const s of sourcesUsed) db.source(s)

const all: Built[] = [
  ...[...entries].sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9)),
  ...generated,
  ...phrases
]

/**
 * 没有英文释义的义项（功能词、词组：WordNet 只有实词）补维基词典的英文释义：
 * 按义项的词性找维基词典同词性的前几条，一个词性只用一次
 */
const wiktUsed = new Set<Built>()
let wiktFilled = 0
for (const b of all) {
  const kk = kaikki.get(b.w.toLowerCase())
  if (!kk || !Object.keys(kk.glosses).length) continue
  const used = new Set<string>()
  // 这个词性已经有 WordNet 的英文释义时不补（同词性的第二个义项补上去常常对不上：water 的「流泪」）
  const hasEn = new Set(b.s.filter((s) => s.en?.length).map((s) => s.p?.[0] ?? b.p[0]))
  for (const s of b.s) {
    if (s.en?.length || !s.zh?.length || s.dom) continue
    const pos = s.p?.[0] ?? b.p[0]
    if (hasEn.has(pos)) continue
    const wp = (WIKT_POS[pos] ?? WIKT_POS.other).find((x) => kk.glosses[x]?.length && !used.has(x))
    if (!wp) continue
    used.add(wp)
    s.en = kk.glosses[wp]
    wiktUsed.add(b)
    wiktFilled++
  }
}
log(`维基词典补英文释义：${wiktFilled} 个义项（${wiktUsed.size} 条）`)
const idOf = new Map<Built, number>()
const themeLists = new Map<string, { title: { zh: string; en: string }; ids: [number, number][] }>()
const irregular: [number, number][] = []
const zhMissing: Built[] = []
let withIpa = 0
let withAudio = 0
for (const b of all) {
  const lv: Record<string, string | string[]> = {}
  const l = levelOf.get(b)
  if (l) lv.cefr = l
  const exam = b.row.tags.filter((t) => EXAMS.has(t))
  if (exam.length) lv['cn-exam'] = exam
  const ng = b.w === b.w.toLowerCase() || /\s/.test(b.w) ? ngslOf.get(b.w.toLowerCase()) : undefined
  if (ng?.length) lv.ngsl = ng
  if (b.row.collins >= 1 && b.row.collins <= 5) lv.collins = String(b.row.collins)
  const pron = isMulti(b.w) ? { x: {} as Record<string, unknown> } : pronunciation(b)
  const x: Record<string, unknown> = { ...pron.x }
  const posLv = cefrPosOf.get(b)
  if (posLv && posLv.size > 1) x.cefrPos = [...posLv].map(([p, v]) => `${p} ${v}`)
  const exp = b.w.includes("'") ? expandContraction(b.w) : null
  if (exp) x.exp = exp
  const ofLemmas = b.of.filter((o) => o.toLowerCase() !== b.w.toLowerCase())
  if (ofLemmas.length) x.of = ofLemmas.slice(0, 3)
  const variants = isMulti(b.w) ? [] : spellingVariants(b.w)
  if (variants.length) x.var = variants
  const forms = isMulti(b.w) ? phraseForms(b) : (formsOf.get(b) ?? [])
  const src = new Set<string>([b.row.translation ? 'ecdict' : 'qonsona'])
  if (b.usedWordnet) src.add('wordnet')
  if (wiktUsed.has(b)) src.add('wiktionary')
  if (posLv?.size) for (const it of profileOf(b.w)) src.add(it.src)
  if (ng?.length) src.add('ngsl')
  if (x.ipaUk && ukIpa.has(b.w.toLowerCase())) src.add('britfone')
  if (x.ipaUs && usIpa.has(b.w.toLowerCase())) src.add('ipadict')
  if (
    kaikki.has(b.w.toLowerCase()) &&
    (pron.au?.length || (!ukIpa.has(b.w.toLowerCase()) && x.ipaUk))
  )
    src.add('wiktionary')
  if (pron.au?.length) src.add('commons')
  const data: LexEntryData = {
    w: b.w,
    p: b.p,
    ...(pron.ipa ? { ipa: pron.ipa } : {}),
    ...(pron.au ? { au: pron.au } : {}),
    s: b.s,
    ...(forms.length ? { f: forms } : {}),
    ...(Object.keys(lv).length ? { lv } : {}),
    ...(b.rank ? { fr: b.rank } : {}),
    ...(Object.keys(x).length ? { x } : {}),
    src: [...src]
  }
  const id = db.entry(data)
  idOf.set(b, id)
  if (pron.ipa) withIpa++
  if (pron.au?.length) withAudio++
  if (b.rank && b.rank <= 8000 && !b.s.some((s) => s.zh?.length)) zhMissing.push(b)
  // 主题词本（CEFR-J 的主题分类）
  for (const it of profileOf(b.w))
    for (const th of it.themes) {
      const t = THEMES[th]
      if (!t) continue
      const list = themeLists.get(t.id) ?? { title: { zh: t.zh, en: t.en }, ids: [] }
      if (!list.ids.some(([e]) => e === id)) list.ids.push([id, b.rank || 99999])
      themeLists.set(t.id, list)
    }
  // 不规则动词
  if (b.p.includes('verb') && l && levelIndex(l) <= levelIndex('C1') && isIrregular(b))
    irregular.push([id, b.rank || 99999])
}
log(`写了 ${all.length} 条（IPA ${withIpa}、录音 ${withAudio}）`)

function phraseForms(b: Built): [string, ...string[]][] {
  // 动词开头的词组：给动词的变形（give up → gave up、given up……）；ice cream 这种名词不算
  if (!b.p.some((p) => p === 'phrase' || p === 'verb' || p === 'idiom')) return []
  const words = b.w.split(/\s+/)
  const head = tokenEntry.get(key(words[0]))
  if (!head || !head.p.includes('verb') || key(head.w) !== key(words[0])) return []
  const rest = words.slice(1).join(' ')
  return (formsOf.get(head) ?? [])
    .filter(([, ...tags]) => !tags.includes('plural') && !tags.includes('comparative'))
    .map(([form, ...tags]) => [`${form} ${rest}`, ...tags] as [string, ...string[]])
}

/**
 * 不规则动词：只看 ECDICT 给这个词的过去式、过去分词（p:、d:，一般是最常用的那个）；
 * 古旧、方言的异体（wrought、holden、staid）在变形表里，但不算它不规则
 */
function isIrregular(b: Built): boolean {
  const ex = parseExchange(b.row.exchange)
  if (ex.lemma) return false
  const past = ex.forms.filter(([, t]) => t === 'p' || t === 'd').map(([f]) => f)
  if (!past.length) return false
  const l = b.w.toLowerCase()
  const regular = new Set([
    l + 'ed',
    l + 'd',
    l.replace(/y$/, 'ied'),
    l + l.slice(-1) + 'ed',
    l + 'ked'
  ])
  return past.some((f) => !regular.has(f.toLowerCase()))
}

for (const [id, list] of themeLists)
  for (const [e, rank] of list.ids) db.list(`theme:${id}`, e, rank)
for (const [e, rank] of irregular) db.list('x:irregular', e, rank)
db.meta(
  'themes',
  [...themeLists].map(([id, l]) => ({ id, title: l.title }))
)
db.meta('lists_info', [{ name: 'x:irregular', title: { zh: '不规则动词', en: 'Irregular verbs' } }])
db.meta('cefrCuts', { by: 'min(BNC, 当代语料库) 名次', cuts })

// 例句
const levelOfSentence = (s: Sentence): string | null => {
  let worst = -1
  for (const t of sentenceTokens(s.text)) {
    const b = tokenEntry.get(key(t))
    const l = b ? levelOf.get(b) : undefined
    if (l) worst = Math.max(worst, levelIndex(l))
  }
  return worst >= 0 ? CEFR_LEVELS[worst] : null
}
const exampleLinks = new Map<number, Set<number>>()
const link = (i: number, entry: number): void => {
  const set = exampleLinks.get(i) ?? new Set<number>()
  set.add(entry)
  exampleLinks.set(i, set)
}
for (const [b, idxs] of quota) {
  const id = idOf.get(b)
  if (id) for (const i of idxs) link(i, id)
}
for (const ph of phrases) {
  const id = idOf.get(ph)
  if (id) for (const i of counter.hits.get(ph.pkey) ?? []) link(i, id)
}
let exWithZh = 0
for (const [i, ids] of [...exampleLinks].sort((a, b) => a[0] - b[0])) {
  const s = sentences[i]
  db.example(
    {
      text: s.text,
      zh: s.zh ?? null,
      zs: s.zh ? 'tatoeba' : null,
      src: 'tatoeba',
      lv: levelOfSentence(s)
    },
    [...ids]
  )
  if (s.zh) exWithZh++
}
log(`例句：${exampleLinks.size} 句（有中文 ${exWithZh}）`)

const stats = db.finish()
log(`完成：${finalFile}  ${(stats.bytes / 1048576).toFixed(1)} MB`)
// 换上正式文件；dict.sqlite 正被别的程序打开（开着的软件）时换不了，过一会儿再试，还不行就留着 dict.next.sqlite
{
  let done = false
  for (let i = 0; i < 12 && !done; i++) {
    try {
      rmSync(finalFile, { force: true })
      renameSync(stats.file, finalFile)
      done = true
    } catch {
      if (i === 0) log('dict.sqlite 正被别的程序打开，等它关掉再换（最多一分钟）…')
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
  if (!done)
    log(`dict.sqlite 一直被占用：新库留在 ${stats.file}，关掉软件后改名成 dict.sqlite（或重跑）`)
}
log(`词条 ${stats.entries}，查词键 ${stats.forms}，例句 ${stats.examples}`)
console.log(
  Object.entries(stats.lists)
    .sort()
    .map(([k, v]) => `${k} ${v}`)
    .join('，')
)

// 需要补中文的常用词（英语有 ECDICT，一般是空的）
mkdirSync(join(ROOT, 'data', 'en'), { recursive: true })
const todo = join(ROOT, 'data', 'en', 'zh-todo.txt')
writeFileSync(
  todo,
  [
    '# 词频前 8000 名里没有中文释义的词条（词头\t词性\t英文释义）。英语的中文释义来自 ECDICT，这里一般只剩极少数。',
    `# 由 scripts/data/en/build.ts 生成（${new Date().toISOString().slice(0, 10)}）`,
    ...zhMissing
      .sort((a, b) => a.rank - b.rank)
      .map(
        (b) =>
          `${b.w}\t${b.p.join(',')}\t${b.s
            .flatMap((s) => s.en ?? [])
            .slice(0, 2)
            .join('; ')}`
      )
  ].join('\n') + '\n'
)
log(`zh-todo：${zhMissing.length} 条 → ${todo}（${statSync(todo).size} 字节）`)
